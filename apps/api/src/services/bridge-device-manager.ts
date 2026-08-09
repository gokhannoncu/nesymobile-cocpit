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
  private readonly scope: BridgeRunScope;
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

    const params: Record<string, unknown> = { value: fingerprint.selector.value };
    if (fingerprint.selector.by === "text" && fingerprint.selector.exact !== undefined) {
      params.exact = fingerprint.selector.exact;
    }
    if (fingerprint.rowIndexHint !== undefined) params.rowIndex = fingerprint.rowIndexHint;
    if (command === "input_text") params.text = options.text ?? "";
    if (resolution.treeGen !== undefined) {
      // Beklenen ağaç neslini göndermek, aradaki bir değişikliğin `stale_tree`
      // ile REDDEDİLMESİNİ sağlar — yani yanlış node'a dokunmayı imkânsız kılar.
      params.expectTreeGen = resolution.treeGen;
    }
    params.timeoutMs = clampTapTimeoutMs(options.timeoutMs);

    lifecycle.mark("DISPATCHED", this.now());
    try {
      const envelope = await this.submit(command, params, options);
      const method = typeof envelope.method === "string" ? (envelope.method as BridgeActionMethod) : null;
      if (method) lifecycle.withMethod(method);
      // Cihaz jest pencereleri döndüyse kanıt olarak sakla; elle dokunuş
      // kirlenmesini ayırt etmenin tek yolu bu pencere.
      const startedAt = typeof envelope.gestureStartMonoTs === "number" ? envelope.gestureStartMonoTs : null;
      const endedAt = typeof envelope.gestureEndMonoTs === "number" ? envelope.gestureEndMonoTs : null;
      if (startedAt !== null) lifecycle.mark("GESTURE_STARTED", startedAt);
      if (endedAt !== null) lifecycle.mark("GESTURE_COMPLETED", endedAt);

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
