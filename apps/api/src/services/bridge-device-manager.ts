/**
 * ===========================================================================
 *  BRIDGE DEVICE MANAGER  (Plan D.3 · RUN_PLAY 3.10 · 3.11)
 *
 *  Kapı + client + admission + bekleme yürütücüsünü tek bir cihaz nesnesinde
 *  birleştirir. `DeviceWorker`ın gördüğü yüzey budur.
 *
 *  ## Sessiz fallback YOK
 *
 *  Bridge kullanılamıyorsa bu sınıf HATA verir. Legacy runner'a, `adb shell input
 *  tap`e veya koordinat tabanlı bir dokunuşa düşmez. O fallback
 *  cazip görünür — "en azından bir şey yapmış oluruz" — ama yaptığı şey testin
 *  fiziksel aksiyon kanıtını sessizce koordinat tabanlı bir tap'e indirmek ve
 *  raporu "başarılı" bırakmaktır. Kanıt üretmeyen bir başarı, en pahalı arıza
 *  türüdür.
 *
 *  ## Aksiyonlar hedef kabulünden geçmek zorunda
 *
 *  Her mutation `admitMutationTarget` üzerinden geçer. Yalnız sıra ipucuna
 *  dayanan bir hedef cihaza HİÇ GİTMEZ ve `REJECTED` terminal durumu üretir —
 *  yani hiçbir şey olmadığı KESİNDİR ve güvenle tekrar denenebilir.
 * ===========================================================================
 */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  BridgeActionLifecycle,
  admitMutationTarget,
  clampSwipeDurationMs,
  clampTapTimeoutMs,
  dumpScopeToParams,
  laneForCommand,
  mayActOnResolution,
  redactForLog,
  type BridgeActionMethod,
  type BridgeActionRecord,
  type BridgeCapabilityManifest,
  type BridgeCommand,
  type BridgeNode,
  type BridgeResultEnvelope,
  type BridgeRunScope,
  type DumpScope,
  type TargetFingerprint,
  type TargetResolutionEvidence,
  type UiWaitPlan,
  type WaitAnyResult,
} from "@nesy/bridge-contract";
import { BridgeClient, BridgeHostError } from "@nesy/bridge-client";

import {
  AdmissionRejectedError,
  getAdmissionScheduler,
  type DeviceAdmissionScheduler,
} from "./bridge-admission.js";
import {
  BridgeDeviceGate,
  type BridgeDeviceCapabilitySnapshot,
  type BridgePreflightFailure,
} from "./bridge-device-gate.js";
import { BridgeWaitRuntime } from "./bridge-wait.js";

/** Bridge kullanılamıyor — açık, gerekçeli, fallback'siz. */
export class BridgeUnavailableError extends Error {
  constructor(readonly failure: BridgePreflightFailure) {
    super(`bridge unavailable (${failure.check}): ${failure.detail}`);
    this.name = "BridgeUnavailableError";
  }
}

export interface BridgeDeviceManagerOptions {
  deviceId: string;
  gate: BridgeDeviceGate;
  scope: BridgeRunScope;
  /** Screenshot artifact kök dizini. */
  artifactRoot: string;
  logger?: (message: string) => void;
  now?: () => number;
  /** Test seam: client fabrikası. */
  createClient?: (host: string, port: number, scope: BridgeRunScope) => BridgeClient;
}

export interface ScreenshotArtifact {
  /** Diskteki yol. Base64 ASLA log'a veya DB'ye yazılmaz. */
  filePath: string;
  width: number | null;
  height: number | null;
  byteLength: number;
  sha256: string;
}

export class BridgeDeviceManager {
  readonly deviceId: string;
  private readonly gate: BridgeDeviceGate;
  /**
   * NOT readonly: the manager outlives a single run (one per device, cached by
   * `DeviceWorker`), and the scope is this device's run FENCE. See [rebindScope].
   */
  private scope: BridgeRunScope;
  private readonly artifactRoot: string;
  private readonly logger: (message: string) => void;
  private readonly now: () => number;
  private readonly createClient: (host: string, port: number, scope: BridgeRunScope) => BridgeClient;
  private readonly scheduler: DeviceAdmissionScheduler;

  private client: BridgeClient | null = null;
  private waitRuntime: BridgeWaitRuntime | null = null;
  private snapshot: BridgeDeviceCapabilitySnapshot | null = null;
  private capabilities: BridgeCapabilityManifest | null = null;
  private requestCounter = 0;
  /** Terminal duruma ulaşmış aksiyon kayıtları — kanıt hattı. */
  private readonly actionLog: BridgeActionRecord[] = [];

  constructor(options: BridgeDeviceManagerOptions) {
    this.deviceId = options.deviceId;
    this.gate = options.gate;
    this.scope = options.scope;
    this.artifactRoot = options.artifactRoot;
    this.logger = options.logger ?? (() => undefined);
    this.now = options.now ?? Date.now;
    this.createClient =
      options.createClient ??
      ((host, port, scope) => new BridgeClient({ host, port, scope, logger: this.logger }));
    this.scheduler = getAdmissionScheduler(options.deviceId);
  }

  getSnapshot(): BridgeDeviceCapabilitySnapshot | null {
    return this.snapshot;
  }

  getCapabilities(): BridgeCapabilityManifest | null {
    return this.capabilities;
  }

  getActionLog(): readonly BridgeActionRecord[] {
    return this.actionLog;
  }

  getScheduler(): DeviceAdmissionScheduler {
    return this.scheduler;
  }

  getScope(): BridgeRunScope {
    return { ...this.scope };
  }

  /**
   * Point this manager at a NEW run.
   *
   * The manager is cached per device for the process lifetime, so without this it
   * kept sending commands under the FIRST run's `runId`/`sessionId` forever. Two
   * consequences, both bad: the device's fence (`ProtocolV1.validateActionScope`)
   * answers `stale_run` as soon as the device's active scope moves on — observed
   * as `TREE_UNAVAILABLE:stale_run` on every run after an out-of-band control op,
   * clearing only when the API process restarted — and, worse, while it does NOT
   * fail, every later run acts on the device under a retired run's identity,
   * which is exactly what run fencing exists to prevent.
   *
   * The client is dropped rather than reused: the handshake is per socket and
   * carries the scope, so a rebound scope needs a fresh one. `snapshot` and
   * `capabilities` are kept — they describe the DEVICE, not the run.
   */
  rebindScope(scope: BridgeRunScope): void {
    if (
      this.scope.runId === scope.runId &&
      this.scope.sessionId === scope.sessionId &&
      this.scope.runEpoch === scope.runEpoch
    ) {
      return;
    }
    this.logger(
      `[BridgeDeviceManager:${this.deviceId}] rebinding run scope ` +
        `${this.scope.runId} -> ${scope.runId} (epoch ${String(this.scope.runEpoch)} -> ${String(scope.runEpoch)})`,
    );
    this.scope = { ...scope };
    this.client?.dispose();
    this.client = null;
    this.waitRuntime = null;
    this.requestCounter = 0;
  }

  /**
   * Preflight + bağlantı. Başarısızlıkta AÇIK hata; fallback yok.
   */
  async ensureReady(): Promise<BridgeDeviceCapabilitySnapshot> {
    if (this.client && this.snapshot) return this.snapshot;

    const preflight = await this.gate.preflight(this.deviceId);
    if (!preflight.ok) {
      this.scheduler.setState({ deviceReady: false });
      throw new BridgeUnavailableError(preflight.failure);
    }

    const client = this.createClient("127.0.0.1", preflight.snapshot.hostPort, this.scope);
    try {
      this.capabilities = await client.connect();
    } catch (err) {
      client.dispose();
      this.scheduler.setState({ deviceReady: false });
      throw new BridgeUnavailableError({
        check: "BRIDGE_PING",
        detail: err instanceof Error ? err.message : String(err),
        remediation:
          "the forward is up but the device did not answer; confirm the accessibility service is running " +
          "(it owns the TCP listener) and that no other host process holds the port",
        fatal: false,
      });
    }

    this.client = client;
    this.snapshot = { ...preflight.snapshot, protocolVersion: this.capabilities.protocolVersion };
    this.waitRuntime = new BridgeWaitRuntime({
      client,
      capabilities: this.capabilities,
      newRequestId: (leg) => this.nextRequestId(`wait-${leg}`),
      now: this.now,
      logger: this.logger,
    });
    this.scheduler.setState({ deviceReady: true });
    this.logger(
      `[Bridge:${this.deviceId}] ready on host port ${preflight.snapshot.hostPort} ` +
        `(bridge ${String(preflight.snapshot.bridgeVersionName)}, protocol ${String(this.capabilities.protocolVersion)})`,
    );
    return this.snapshot;
  }

  private nextRequestId(prefix: string): string {
    this.requestCounter += 1;
    return `${prefix}-${this.deviceId}-${String(this.scope.runEpoch)}-${String(this.requestCounter)}`;
  }

  private requireClient(): BridgeClient {
    const client = this.client;
    if (!client) {
      throw new BridgeUnavailableError({
        check: "BRIDGE_PING",
        detail: "ensureReady() has not run or preflight failed",
        remediation: "call ensureReady() and surface its failure instead of falling back",
        fatal: false,
      });
    }
    return client;
  }

  /** Admission şeridinden geçirerek ham komut gönderir. */
  private async submit(
    command: BridgeCommand,
    params: Record<string, unknown> | undefined,
    options: { heavy?: boolean; timeoutMs?: number; runId?: string; control?: boolean } = {},
  ): Promise<BridgeResultEnvelope> {
    const client = this.requireClient();
    const requestId = this.nextRequestId(command);
    const lane = laneForCommand(command, options.heavy === true);
    return this.scheduler.submit({
      envelope: {
        deviceId: this.deviceId,
        command,
        lane,
        requestId,
        actorKind: "AUTOMATED_RUN",
        ...(options.runId === undefined ? {} : { runId: options.runId }),
      },
      run: async () => {
        const outcome = await client.send({
          command,
          requestId,
          ...(params === undefined ? {} : { params }),
          ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
          ...(options.control === true ? { control: true } : {}),
        });
        return outcome.envelope;
      },
    });
  }

  /**
   * Kapsamlı ağaç okuma. Scoped istek BAŞARISIZ olsa bile full dump'a DÜŞMEZ.
   */
  async dump(scope: DumpScope, options: { runId?: string } = {}): Promise<BridgeResultEnvelope> {
    return this.submit("dump", dumpScopeToParams(scope), {
      // `full` gerçekten ağırdır ve ayrı kotadan geçmeli; scoped okuma değil.
      heavy: scope.kind === "full",
      ...options,
    });
  }

  /**
   * Hedefi çözer ve KANIT üretir.
   *
   * Ambiguity ve stale tree burada yakalanır — yani fiziksel aksiyon
   * denenmeden önce.
   */
  async resolve(
    fingerprint: TargetFingerprint,
    options: { runId?: string } = {},
  ): Promise<TargetResolutionEvidence> {
    const selector = fingerprint.selector;
    const command: BridgeCommand = selector.by === "id" ? "find_id" : "find_text";
    const params: Record<string, unknown> = { value: selector.value };
    if (selector.by === "text" && selector.exact !== undefined) params.exact = selector.exact;
    if (fingerprint.rowIndexHint !== undefined) params.rowIndex = fingerprint.rowIndexHint;

    const envelope = await this.submit(command, params, options);
    const strength = admitMutationTarget(fingerprint).accepted ? "STRONG" : "WEAK";
    const treeGen = typeof envelope.treeGen === "number" ? envelope.treeGen : undefined;
    const matched = typeof envelope.matched === "number" ? envelope.matched : undefined;

    if (envelope.ok) {
      return {
        outcome: "RESOLVED_UNIQUE",
        fingerprint,
        strength,
        ...(matched === undefined ? {} : { matchedCount: matched }),
        ...(treeGen === undefined ? {} : { treeGen }),
        ...(envelope.node === undefined ? {} : { node: envelope.node as BridgeNode }),
      };
    }

    const error = typeof envelope.error === "string" ? envelope.error : "unknown";
    const outcome =
      error === "ambiguous"
        ? "AMBIGUOUS"
        : error === "not_found"
          ? "NOT_FOUND"
          : error === "stale_tree"
            ? "STALE_TREE"
            : "TREE_UNAVAILABLE";
    return {
      outcome,
      fingerprint,
      strength,
      ...(matched === undefined ? {} : { matchedCount: matched }),
      ...(treeGen === undefined ? {} : { treeGen }),
      deviceError: error,
    };
  }

  /**
   * Fiziksel aksiyon — hedef kabulü, çözümleme, yaşam döngüsü ve terminal durum.
   *
   * Sıra kasıtlı ve gevşetilemez:
   *   1. Hedef zayıfsa cihaza HİÇ GİTME (`REJECTED`).
   *   2. Çöz; ambiguous/stale ise dokunma (`FAILED`).
   *   3. Gönder; yanıt kaybolursa `UNKNOWN_EFFECT`.
   */
  async act(
    command: Extract<BridgeCommand, "tap_id" | "tap_text" | "activate_id" | "input_text">,
    fingerprint: TargetFingerprint,
    options: { runId?: string; text?: string; timeoutMs?: number } = {},
  ): Promise<BridgeActionRecord> {
    const lifecycle = new BridgeActionLifecycle(
      this.nextRequestId(command),
      command,
      fingerprint,
      "BRIDGE_INJECTED",
    );

    const admission = admitMutationTarget(fingerprint);
    if (!admission.accepted) {
      // Cihaza gitmedi → hiçbir şey olmadığı KESİN → güvenle tekrar denenebilir.
      lifecycle.mark("ACCEPTED", this.now());
      const record = lifecycle.finish("REJECTED", admission.reason);
      this.actionLog.push(record);
      return record;
    }

    const resolution = await this.resolve(fingerprint, options);
    lifecycle.withResolution(resolution).mark("ACCEPTED", this.now());
    if (!mayActOnResolution(resolution)) {
      const record = lifecycle.finish("FAILED", resolution.deviceError ?? resolution.outcome);
      this.actionLog.push(record);
      return record;
    }

    const params: Record<string, unknown> = {};
    if (command === "input_text") {
      // ⚠️ `id`, `value` DEĞİL — ve bu, `waitNodeParams`ın `by`/`matchBy` notuyla
      // aynı sınıf hata. Cihazın `handleInputText`i selector'ı `id` alanından
      // okur; `value` gönderen istek selector'SIZ çalışır, odaklı bir düzenlenebilir
      // node yoksa `not_found` döner. Gerçek cihazda tam bu yaşandı: `enter-pin`
      // `not_found` alıyordu, oysa `pinView` ekrandaydı ve `id` ile tek eşleşme
      // veriyordu.
      if (fingerprint.selector.by !== "id") {
        // Cihazda `input_text` YALNIZ ID ile eşler (`MatchBy.ID`). Metin
        // selector'ını `id` diye göndermek sessizce yanlış node'a yazmak olurdu;
        // reddetmek, cihaza hiç gitmediği için güvenle tekrarlanabilir.
        const record = lifecycle.finish(
          "REJECTED",
          `input_text requires an id selector; got by=${fingerprint.selector.by}`,
        );
        this.actionLog.push(record);
        return record;
      }
      params.id = fingerprint.selector.value;
      params.text = options.text ?? "";
    } else {
      params.value = fingerprint.selector.value;
      if (fingerprint.selector.by === "text" && fingerprint.selector.exact !== undefined) {
        params.exact = fingerprint.selector.exact;
      }
    }
    if (fingerprint.rowIndexHint !== undefined) params.rowIndex = fingerprint.rowIndexHint;
    if (resolution.treeGen !== undefined) {
      // Beklenen ağaç neslini göndermek, aradaki bir değişikliğin `stale_tree`
      // ile REDDEDİLMESİNİ sağlar — yani yanlış node'a dokunmayı imkânsız kılar.
      params.expectTreeGen = resolution.treeGen;
    }
    params.timeoutMs = clampTapTimeoutMs(options.timeoutMs);

    lifecycle.mark("DISPATCHED", this.now());
    try {
      let envelope = await this.submit(command, params, options);

      // `stale_tree` — ve YALNIZ `stale_tree` — tekrar denenir.
      //
      // Bu reddi cihaz, `expectTreeGen` tutmadığı için AKSİYONU YAPMADAN veriyor
      // (yukarıdaki fence'in tanımı bu). Yani "cihaza gitti ve dokunmadı" —
      // etkisizliği kesin olan tek sonuç. `UNKNOWN_EFFECT` tam tersi durumdur ve
      // asla tekrarlanmaz; ikisini aynı kefeye koymak onay tuşuna iki kez basmak
      // demek olurdu.
      //
      // Tekrar denemeye değer çünkü sık: gerçek cihazda ölçüldü, `input_text`
      // sonrası ağaç ~230ms boyunca 3 nesil ilerlemeye devam ediyor, oysa onu
      // izleyen resolve+act zinciri 60-120ms sonra iniyor. Executor her aksiyonu
      // `attempt-1` olarak gönderiyor ve kendi retry'ı YOK — yani bu olmadan adım
      // yavaşlamıyor, FAIL ediyor.
      if (!envelope.ok && envelope.error === "stale_tree" && params.expectTreeGen !== undefined) {
        const refreshed = await this.resolve(fingerprint, options);
        if (mayActOnResolution(refreshed) && refreshed.treeGen !== undefined) {
          lifecycle.withResolution(refreshed);
          params.expectTreeGen = refreshed.treeGen;
          // İkinci bir DISPATCHED işareti kasıtlı: kayıtta iki gönderim görünmeli,
          // yoksa "bir kez denendi" diye okunur.
          lifecycle.mark("DISPATCHED", this.now());
          envelope = await this.submit(command, params, options);
        }
      }

      const method = typeof envelope.method === "string" ? (envelope.method as BridgeActionMethod) : null;
      if (method) lifecycle.withMethod(method);
      // Cihaz jest pencereleri döndüyse kanıt olarak sakla; elle dokunuş
      // kirlenmesini ayırt etmenin tek yolu bu pencere.
      const startedAt = typeof envelope.gestureStartMonoTs === "number" ? envelope.gestureStartMonoTs : null;
      const endedAt = typeof envelope.gestureEndMonoTs === "number" ? envelope.gestureEndMonoTs : null;
      if (startedAt !== null) lifecycle.mark("GESTURE_STARTED", startedAt);
      if (endedAt !== null) lifecycle.mark("GESTURE_COMPLETED", endedAt);
      // ⚠️ Protocol v1 sends NEITHER window field. The two marks above are
      // therefore dead on every real device today, which is why the port must not
      // require `GESTURE_COMPLETED` to call an action verified — see
      // `describeActionEvidence`'s caller. They stay because a device that starts
      // reporting the window should light them up without a host change.
      //
      // Contamination is the claim the window was standing in for, and the device
      // answers it directly, so read it from there.
      if (typeof envelope.contaminated === "boolean") {
        lifecycle.withContamination(
          envelope.contaminated,
          typeof envelope.contaminationDetection === "string"
            ? envelope.contaminationDetection
            : undefined,
        );
      }

      const record = envelope.ok
        ? lifecycle.finish("SUCCEEDED")
        : lifecycle.finish("FAILED", typeof envelope.error === "string" ? envelope.error : "unknown");
      this.actionLog.push(record);
      return record;
    } catch (err) {
      if (err instanceof AdmissionRejectedError) {
        const record = lifecycle.finish("REJECTED", err.decision.reason);
        this.actionLog.push(record);
        return record;
      }
      if (err instanceof BridgeHostError) {
        const state = err.code === "UNKNOWN_EFFECT" ? "UNKNOWN_EFFECT" : "FAILED";
        const record = lifecycle.finish(state, err.code);
        this.actionLog.push(record);
        return record;
      }
      throw err;
    }
  }

  /** `swipe` — bir NODE'a değil EKRANA uygulanır; tek meşru koordinat kullanımı. */
  async swipe(
    from: { x: number; y: number },
    to: { x: number; y: number },
    options: { durationMs?: number; runId?: string } = {},
  ): Promise<BridgeResultEnvelope> {
    return this.submit(
      "swipe",
      {
        fromX: from.x,
        fromY: from.y,
        toX: to.x,
        toY: to.y,
        durationMs: clampSwipeDurationMs(options.durationMs),
      },
      options,
    );
  }

  async back(options: { runId?: string } = {}): Promise<BridgeResultEnvelope> {
    return this.submit("back", undefined, options);
  }

  /**
   * `scroll_to_item` — bir satırı GÖRÜNÜR kılar, kimliğini KURMAZ.
   *
   * Ayrım load-bearing: sanallaştırılmış bir satır ağaçta yoktur, dolayısıyla
   * hiçbir selector onu bulamaz ve `find_*` haklı olarak `not_found` der. Bu
   * komut yalnız listeyi konumlandırır; hangi satıra dokunulacağına hâlâ
   * `tap_text`/`tap_id` karar verir ve ambiguity'de düşer. `rowIndex`'i kimlik
   * saymak, arka planda liste yeniden sıralandığında sessizce başka kaydı
   * adreslemek olurdu — her oracle yeşilken veriyi yanlış yapan hata.
   *
   * Sözleşme komutu (`BRIDGE_COMMANDS`) ilan edilmişti ama host hiç
   * çağıramıyordu: `act()` yalnız dört komutu kabul ediyor ve hiçbir port bunu
   * sürmüyordu. Yani cihaz destekliyor, host isteyemiyordu.
   */
  async scrollToItem(
    selector: {
      listId?: string;
      listClass?: string;
      rowIndex?: number;
      text?: string;
      exact?: boolean;
    },
    options: { runId?: string } = {},
  ): Promise<BridgeResultEnvelope> {
    const params: Record<string, unknown> = {};
    // Tam BİR liste formu; ikisini birlikte yollamak cihazda
    // `multiple_list_forms` ile reddedilir ve reddedilmesi doğrudur.
    if (selector.listId !== undefined) params.listId = selector.listId;
    else if (selector.listClass !== undefined) params.listClass = selector.listClass;
    if (selector.rowIndex !== undefined) params.rowIndex = selector.rowIndex;
    if (selector.text !== undefined) {
      params.match = { by: "text", value: selector.text, exact: selector.exact ?? true };
    }
    return this.submit("scroll_to_item", params, options);
  }

  /**
   * Bekleme planı — `wait_any` sözleşmesi, v1'de yarıştırılmış `wait_node`.
   */
  async waitAny(waitId: string, plan: UiWaitPlan, signal?: AbortSignal): Promise<WaitAnyResult> {
    const runtime = this.waitRuntime;
    if (!runtime) throw new Error("bridge not ready; call ensureReady() first");
    return runtime.waitAny(waitId, plan, signal);
  }

  cancelWait(waitId: string, reason: string) {
    return this.waitRuntime?.cancel(waitId, reason);
  }

  /**
   * Screenshot — base64'ü DİSKE yazar, asla log'a veya DB'ye değil.
   *
   * Yanıt PNG'yi base64 olarak taşır (`handleScreenshot`). Onu bir log satırına
   * koymak, ekranın tamamını log toplayıcıya göndermektir; bir DB kolonuna
   * koymak ise aynı veriyi yedeklere yaymaktır. Diskte dosya + sha256 özeti
   * yeterli kanıttır.
   */
  async screenshot(options: { runId?: string; label?: string } = {}): Promise<ScreenshotArtifact> {
    const envelope = await this.submit("screenshot", undefined, { heavy: true, ...options });
    if (!envelope.ok) {
      throw new Error(`screenshot failed: ${String(envelope.error ?? "unknown")}`);
    }
    const base64 = typeof envelope.data === "string" ? envelope.data : "";
    if (base64 === "") throw new Error("screenshot response carried no data");

    const bytes = Buffer.from(base64, "base64");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const dir = path.join(this.artifactRoot, this.scope.runId, this.deviceId);
    await fs.mkdir(dir, { recursive: true });
    const name = `${options.label ?? "screen"}-${sha256.slice(0, 12)}.png`;
    const filePath = path.join(dir, name);
    await fs.writeFile(filePath, bytes);

    // Log satırı: boyut ve özet var, GÖRÜNTÜ YOK.
    this.logger(
      `[Bridge:${this.deviceId}] screenshot ${bytes.byteLength}B sha256=${sha256.slice(0, 12)} → ${filePath}`,
    );
    return {
      filePath,
      width: typeof envelope.width === "number" ? envelope.width : null,
      height: typeof envelope.height === "number" ? envelope.height : null,
      byteLength: bytes.byteLength,
      sha256,
    };
  }

  /** Teşhis için güvenli özet — hassas alanlar maskeli. */
  describeLast(envelope: BridgeResultEnvelope): string {
    return redactForLog(envelope);
  }

  /** Soket, forward ve bekleme temizliği. Idempotent. */
  async dispose(reason = "device manager disposed"): Promise<void> {
    this.client?.dispose(reason);
    this.client = null;
    this.waitRuntime = null;
    this.snapshot = null;
    this.capabilities = null;
    this.scheduler.setState({ deviceReady: false, activeRunId: null });
    await this.gate.releaseForward(this.deviceId);
  }
}
