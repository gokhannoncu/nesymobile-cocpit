/**
 * ===========================================================================
 *  wait_any RUNTIME  (Plan D.3 · D.6D · RUN_PLAY 3.9)
 *
 *  Sözleşme `@nesy/bridge-contract`ta (`UiWaitPlan`); burada onun YÜRÜTÜCÜSÜ.
 *
 *  ## Cihazda `wait_any` yok — yarış host'ta kuruluyor
 *
 *  Protocol v1'de yalnız tek hedefli `wait_node` var. Bu yürütücü planın her
 *  bacağını AYRI bir bağlantıda paralel `wait_node` olarak koşturur ve ilk
 *  sonuçlanan kazanır. Cihaz `wait_any` öğrendiğinde `planWaitExecution` tek
 *  komut dalını seçer ve BU dosyanın çağıranı değişmez.
 *
 *  ## Hot path kuralları — ve neden bu tasarım onları sağlıyor
 *
 *  - **Full dump yok.** Bacaklar yalnız `wait_node` gönderir; `dump`/`screenshot`
 *    bu yolda hiç çağrılmaz.
 *  - **Host'ta sabit yoklama yok.** Host soketten yanıt bekler (`await`),
 *    zamanlayıcıyla ağaç yoklamaz. Yoklama cihazın içindedir ve host onu
 *    ÇOĞALTMAZ — çoğaltmak, aynı ağacı iki yerden okuyup iki kat yük üretmek
 *    olurdu.
 *  - **İlk değerlendirme olay beklemez.** `wait_node` ilk döngüsünde ağacı
 *    hemen okur; zaten karşılanmış bir koşul anında döner.
 *  - **Sınırlı scoped güvenlik taraması.** Cihaz olay üretmezse bacak kendi
 *    zaman aşımıyla biter; host ek bir tarama başlatmaz. Mutation sonrası
 *    yeniden değerlendirme `onWaitReevaluation` ile TETİKLENİR, zamanlayıcıyla
 *    değil.
 * ===========================================================================
 */
import {
  cancelScopeFor,
  deviceReleaseByMs,
  planWaitExecution,
  validateWaitPlan,
  waitNodeParams,
  type BridgeCapabilityManifest,
  type CancelResult,
  type UiWaitPlan,
  type WaitAnyResult,
} from "@nesy/bridge-contract";
import { BridgeHostError, type BridgeClient } from "@nesy/bridge-client";

export interface WaitRuntimeOptions {
  client: BridgeClient;
  capabilities: Pick<BridgeCapabilityManifest, "supportsWaitAny" | "supportsCancelRequest">;
  /** requestId üreteci — testlerde deterministik olabilmesi için enjekte edilir. */
  newRequestId: (leg: string) => string;
  now?: () => number;
  logger?: (message: string) => void;
}

interface LegOutcome {
  key: string;
  isInterrupt: boolean;
  /** Cihazın yanıtı, ya da host hatası. */
  envelopeOk: boolean;
  error?: string;
  treeGen?: number;
  matchedCount?: number;
  node?: unknown;
  hostError?: BridgeHostError;
}

/**
 * Bir bekleme planını yürütür.
 *
 * Dönüş tipi `WaitAnyResult`: cihazın `wait_any`i olsa da olmasa da çağıran
 * aynı sonucu görür.
 */
export class BridgeWaitRuntime {
  private readonly client: BridgeClient;
  private readonly capabilities: Pick<BridgeCapabilityManifest, "supportsWaitAny" | "supportsCancelRequest">;
  private readonly newRequestId: (leg: string) => string;
  private readonly now: () => number;
  private readonly logger: (message: string) => void;
  /** Aktif planların iptal denetleyicileri. */
  private readonly active = new Map<string, { controller: AbortController; timeoutMs: number; startedAt: number }>();

  constructor(options: WaitRuntimeOptions) {
    this.client = options.client;
    this.capabilities = options.capabilities;
    this.newRequestId = options.newRequestId;
    this.now = options.now ?? Date.now;
    this.logger = options.logger ?? (() => undefined);
  }

  activeCount(): number {
    return this.active.size;
  }

  /**
   * Planı yürütür ve ilk sonuçlanan bacağı döndürür.
   *
   * `waitId` iptal için: `cancel(waitId)` bu planın tüm bacaklarını host
   * tarafında bırakır.
   */
  async waitAny(waitId: string, plan: UiWaitPlan, externalSignal?: AbortSignal): Promise<WaitAnyResult> {
    const validation = validateWaitPlan(plan);
    if (!validation.valid) {
      // Cihaza HİÇ gitmez: geçersiz bir plan yalnız zaman aşımına düşerdi ve
      // "beklenen görülmedi" diye raporlanırdı — oysa plan hatalıydı.
      throw new Error(`invalid wait plan (${validation.reason}): ${validation.detail}`);
    }
    const normalized = validation.plan;
    const strategy = planWaitExecution(normalized, this.capabilities);
    const startedAt = this.now();

    const controller = new AbortController();
    const forward = () => controller.abort();
    externalSignal?.addEventListener("abort", forward, { once: true });
    this.active.set(waitId, { controller, timeoutMs: normalized.timeoutMs, startedAt });

    try {
      if (strategy.kind === "SINGLE_WAIT_ANY") {
        // Reachable only if someone flips HOST_SUPPORTS_WAIT_ANY before writing
        // this branch. The old comment claimed this was unreachable "because the
        // device has no such command"; the device shipped it, `planWaitExecution`
        // routed here on capability alone, and every wait on a real device died
        // at once. The gate now lives in HOST_SUPPORTS_WAIT_ANY.
        throw new Error(
          "HOST_SUPPORTS_WAIT_ANY is on but BridgeWaitRuntime has no wait_any path; " +
            "implement the single-command branch or turn the flag back off",
        );
      }

      const legs = strategy.legs.map(async (leg): Promise<LegOutcome> => {
        try {
          const outcome = await this.client.send({
            command: "wait_node",
            requestId: this.newRequestId(leg.key),
            params: waitNodeParams(leg.predicate, strategy.timeoutMs),
            // Host zaman aşımı cihazınkinden BİRAZ uzun: cihazın kendi
            // `timeout` yanıtını görmek, host'un erken kesmesinden daha iyi
            // teşhis üretir (cihaz `polls`/`matched` alanlarını da döner).
            timeoutMs: strategy.timeoutMs + 1_000,
            signal: controller.signal,
          });
          const env = outcome.envelope;
          return {
            key: leg.key,
            isInterrupt: leg.isInterrupt,
            envelopeOk: env.ok,
            ...(typeof env.error === "string" ? { error: env.error } : {}),
            ...(typeof env.treeGen === "number" ? { treeGen: env.treeGen } : {}),
            ...(typeof env.matched === "number" ? { matchedCount: env.matched } : {}),
            ...(env.node === undefined ? {} : { node: env.node }),
          };
        } catch (err) {
          if (err instanceof BridgeHostError) {
            return { key: leg.key, isInterrupt: leg.isInterrupt, envelopeOk: false, hostError: err };
          }
          throw err;
        }
      });

      // İlk KAZANAN bacağı bekle. `timeout` bir kazanç değildir: bir bacağın
      // zaman aşımına düşmesi, diğerinin hâlâ eşleşebileceği anlamına gelir.
      const winner = await this.firstDecisive(legs);
      const elapsedMs = this.now() - startedAt;

      if (!winner) {
        return { status: "TIMEOUT", elapsedMs };
      }
      if (winner.hostError) {
        if (winner.hostError.code === "HOST_CANCELLED") return { status: "CANCELLED", elapsedMs };
        if (winner.hostError.code === "WAIT_CONNECTION_LOST") {
          // Zaman aşımı DEĞİL: koşul sağlanmış olabilir, host haberi alamadı.
          return { status: "WAIT_CONNECTION_LOST", elapsedMs };
        }
        if (winner.hostError.code === "HOST_TIMEOUT") return { status: "TIMEOUT", elapsedMs };
        throw winner.hostError;
      }
      if (winner.error === "ambiguous") {
        return {
          status: "AMBIGUOUS",
          key: winner.key,
          matchedCount: winner.matchedCount ?? 2,
          ...(winner.treeGen === undefined ? {} : { treeGen: winner.treeGen }),
          elapsedMs,
        };
      }
      if (winner.isInterrupt) {
        return {
          status: "INTERRUPT_MATCH",
          key: winner.key,
          ...(winner.treeGen === undefined ? {} : { treeGen: winner.treeGen }),
          elapsedMs,
          expectedInterrupt:
            plan.interrupts?.find((i) => i.key === winner.key)?.expected === true,
        };
      }
      return {
        status: "EXPECTED_MATCH",
        key: winner.key,
        ...(winner.treeGen === undefined ? {} : { treeGen: winner.treeGen }),
        elapsedMs,
      };
    } finally {
      // Her çıkış yolunda: aktif kayıt silinir, dinleyici kaldırılır, bacaklar
      // iptal edilir. Sızıntı bırakmamanın tek yolu.
      controller.abort();
      externalSignal?.removeEventListener("abort", forward);
      this.active.delete(waitId);
    }
  }

  /**
   * İlk BELİRLEYİCİ sonucu bekler.
   *
   * "Belirleyici" = eşleşme veya ambiguity. Bir bacağın `timeout` dönmesi
   * belirleyici değildir: diğer bacak hâlâ eşleşebilir ve ilk `timeout`u
   * kazanan saymak, planı erken sonlandırıp "görülmedi" demek olurdu.
   *
   * Hepsi belirsizse `null` döner ve çağıran `TIMEOUT` üretir.
   */
  private async firstDecisive(legs: readonly Promise<LegOutcome>[]): Promise<LegOutcome | null> {
    const pending = new Set(legs.map((p, index) => ({ p, index })));
    const results: LegOutcome[] = [];

    while (pending.size > 0) {
      const settled = await Promise.race(
        [...pending].map(async (entry) => ({ entry, outcome: await entry.p })),
      );
      pending.delete(settled.entry);
      const outcome = settled.outcome;
      results.push(outcome);

      const decisive =
        (outcome.envelopeOk && outcome.error === undefined) ||
        outcome.error === "ambiguous" ||
        outcome.hostError?.code === "HOST_CANCELLED" ||
        outcome.hostError?.code === "WAIT_CONNECTION_LOST";
      if (decisive) return outcome;
    }

    // Belirleyici hiçbir şey yok. Ambiguity zaten yukarıda dönerdi; kalanlar
    // timeout/not_found türü belirsizliklerdir.
    return results.find((r) => r.hostError !== undefined) ?? null;
  }

  /**
   * Bekleyişi HOST tarafında iptal eder.
   *
   * Kapsam açıkça `HOST_ONLY`: cihazda `cancel_request` yok, dolayısıyla
   * `wait_node` kendi zaman aşımına kadar cihazda ÇALIŞMAYA DEVAM eder.
   * `deviceReleaseByMs` bunu çağırana söyler; söylemezsek aynı hedefe hemen
   * yeni bir bekleme açan çağıran cihazda iki bekleme yaratır.
   */
  cancel(waitId: string, reason: string): CancelResult {
    const entry = this.active.get(waitId);
    if (!entry) {
      return { requestId: waitId, cancelled: false, scope: cancelScopeFor(this.capabilities) };
    }
    entry.controller.abort();
    this.active.delete(waitId);
    const scope = cancelScopeFor(this.capabilities);
    const releaseBy = deviceReleaseByMs(entry.timeoutMs, this.now() - entry.startedAt);
    this.logger(
      `[BridgeWait] cancelled ${waitId} (${reason}); scope=${scope}` +
        (scope === "HOST_ONLY" ? `, device keeps waiting for up to ${releaseBy}ms` : ""),
    );
    return { requestId: waitId, cancelled: true, scope, deviceReleaseByMs: releaseBy };
  }
}
