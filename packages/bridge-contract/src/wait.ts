/**
 * ===========================================================================
 *  UiWaitPlan / wait_any TEMELİ  (Plan D.3 · D.6D)
 *
 *  ## Neden burada bir "temel" var
 *
 *  Eski Bridge v1'de cihazın `wait_any` komutu YOKTU — yalnız tek hedefli
 *  `wait_node` vardı. Mobile M3 sonrası modern cihazlar `wait_any` sunar.
 *  RUN_PLAY expected/interrupt yarışı istiyor. İki dürüst seçenek vardı:
 *
 *    (a) Host tarafında `wait_any` diye bir komut varmış gibi modellemek.
 *        Testler yeşil olurdu; eski cihaz ilk çağrıda `unsupported_command`
 *        dönerdi. Bu, kanıt üretmek değil kanıt taklidi yapmaktır.
 *
 *    (b) Yarışı HOST'ta, birden çok `wait_node` üzerinden kurmak; ve cihazın
 *        `wait_any`i öğrendiği anda aynı çağıran arayüzünün tek komuta
 *        inebileceği şekilde yazmak.
 *
 *  (b) seçildi. `UiWaitPlan` çağıranın gördüğü sözleşmedir ve İKİ TARAFIN
 *  yeteneğine göre ya tek `wait_any` ya da N paralel `wait_node` olarak
 *  yürütülür. Çağıran kodu değişmez.
 *
 *  "İki tarafın" sonradan eklendi ve bedeli ödenerek öğrenildi: seçim yalnız
 *  CİHAZIN yeteneğine bakıyordu, cihaz komutu Mobile M3'te ekledi, host dalı
 *  hiç yazılmadı — ve (a) şıkkının tam olarak kaçınmak istediği şey oldu.
 *  Fark şu ki taklit host'ta değil SEÇİMDE yapıldı: sözleşme cihazın
 *  yapabildiğini modelledi, host'un yapabildiğini modellemedi. Kapı
 *  [HOST_SUPPORTS_WAIT_ANY].
 *
 *  ## Hot path kuralları (RUN_PLAY §3.9, acceptance 17–20)
 *
 *  - Beklerken full dump YOK. `wait_node` küçük typed alanlar döner; bekleme
 *    yolunda `dump`/`screenshot` çağrılmaz.
 *  - Host'ta sabit aralıklı yoklama YOK. Host soket yanıtını `await` eder;
 *    yoklama cihazın içindedir (`WAIT_POLL_INTERVAL_MS = 50`) ve host onu
 *    çoğaltmaz.
 *  - İlk değerlendirme olay beklemez: `wait_node` ilk döngüsünde ağacı hemen
 *    okur, yani zaten karşılanmış bir koşul anında döner.
 * ===========================================================================
 */
import { BRIDGE_LIMITS } from "./protocol.js";
import type { BridgeNode, BridgeSelector } from "./targets.js";
import { clampWaitTimeoutMs } from "./targets.js";

/** Cihazın `WaitUntil` karşılığı. */
export type UiWaitUntil = "APPEAR" | "DISAPPEAR";

/**
 * Beklenecek tek koşul.
 *
 * `stableForMs` neden var: bir node görünüp hemen kaybolabilir (yeniden çizim,
 * geçiş animasyonu). "Göründü" deyip aksiyon uygulamak, o anda ağacın yeniden
 * kurulmasıyla `stale_tree` üretir. Kararlılık penceresi bunu önler.
 */
export interface UiPredicate {
  selector: BridgeSelector;
  until: UiWaitUntil;
  stableForMs?: number;
}

/** Beklenen (istenen) hedef. Bulunursa plan başarıyla tamamlanır. */
export interface UiWaitTarget {
  key: string;
  predicate: UiPredicate;
}

/**
 * Kesinti hedefi — beklenen şey yerine ÇIKAN şey (dialog, hata, izin ekranı).
 *
 * Ayrı tutulmasının nedeni sonucun anlamı: beklenen hedef bulunursa akış devam
 * eder; kesinti bulunursa akış DURUR ve hangi kesintinin çıktığı kanıta yazılır.
 * İkisini tek listede yarıştırıp "ilk bulunan kazanır" demek, bir hata
 * dialogunu başarı sanmaya yol açar.
 */
export interface UiInterruptTarget {
  key: string;
  predicate: UiPredicate;
  /** Kesintinin ürün açısından beklenip beklenmediği. Politika üst katmanda. */
  expected?: boolean;
}

/**
 * Tek bir sınırlı bekleme planı.
 *
 * `candidateLimit`: yanıtın taşıyabileceği aday node sayısı üst sınırı. Sınır
 * olmadan, geniş bir selector eşleşen yüzlerce node'u yanıta koyar ve bekleme
 * yanıtı de facto bir full dump'a dönüşür — acceptance 17'nin ihlali.
 */
export interface UiWaitPlan {
  timeoutMs: number;
  expected: readonly UiWaitTarget[];
  interrupts?: readonly UiInterruptTarget[];
  candidateLimit?: number;
  /** Yüksek olan önce değerlendirilir; eşitlikte kesintiler önceliklidir. */
  priority?: number;
}

export const DEFAULT_WAIT_CANDIDATE_LIMIT = 8;

/**
 * Does the HOST implement the single `wait_any` command yet.
 *
 * The device has shipped it (`supportsWaitAny: true`, `handleWaitAny` with
 * MATCHED / TIMEOUT / CANCELLED / AMBIGUOUS), but `BridgeWaitRuntime` still has
 * only the raced `wait_node` path; its `SINGLE_WAIT_ANY` branch throws.
 *
 * This flag exists so that gap is stated in ONE place instead of being implied by
 * a stale comment. Flip it to `true` in the same change that implements the
 * branch — never before, or waits go back to failing on contact with a device.
 */
export const HOST_SUPPORTS_WAIT_ANY = false;

/**
 * `wait_any` sonucu.
 *
 * `AMBIGUOUS` ve `TIMEOUT` ayrı: birincisi "birden fazla eşleşme var, hangisi
 * olduğunu bilmiyorum", ikincisi "hiç görmedim". Aksiyon açısından ikisi de
 * ilerlememe sebebidir ama teşhis açısından tamamen farklıdır.
 *
 * `WAIT_CONNECTION_LOST` bir zaman aşımı DEĞİLDİR: koşul sağlanmış olabilir,
 * host haberi alamadı.
 */
export type WaitAnyResult =
  | {
      status: "EXPECTED_MATCH";
      key: string;
      treeGen?: number;
      elapsedMs: number;
      node?: BridgeNode;
    }
  | {
      status: "INTERRUPT_MATCH";
      key: string;
      treeGen?: number;
      elapsedMs: number;
      node?: BridgeNode;
      expectedInterrupt: boolean;
    }
  | { status: "AMBIGUOUS"; key: string; matchedCount: number; treeGen?: number; elapsedMs: number }
  | { status: "TIMEOUT"; elapsedMs: number; treeGen?: number }
  | { status: "CANCELLED"; elapsedMs: number }
  | { status: "WAIT_CONNECTION_LOST"; elapsedMs: number };

/** Plan doğrulama hatası — cihaza gitmeden host tarafında yakalanır. */
export interface WaitPlanRejection {
  valid: false;
  reason:
    | "NO_EXPECTED_TARGET"
    | "DUPLICATE_TARGET_KEY"
    | "TIMEOUT_OUT_OF_RANGE"
    | "CANDIDATE_LIMIT_OUT_OF_RANGE";
  detail: string;
}

export type WaitPlanValidation = { valid: true; plan: UiWaitPlan } | WaitPlanRejection;

/**
 * Planı doğrular ve cihaz sınırlarına normalize eder.
 *
 * Anahtar çakışması özellikle reddedilir: iki hedef aynı `key` taşıyorsa,
 * sonuçtaki `key` hangi koşulun sağlandığını ARTIK söylemez — kanıt sessizce
 * anlamsızlaşır.
 */
export function validateWaitPlan(plan: UiWaitPlan): WaitPlanValidation {
  if (plan.expected.length === 0) {
    return {
      valid: false,
      reason: "NO_EXPECTED_TARGET",
      detail: "a wait plan with no expected target can only ever time out",
    };
  }

  const keys = new Set<string>();
  for (const target of [...plan.expected, ...(plan.interrupts ?? [])]) {
    if (keys.has(target.key)) {
      return {
        valid: false,
        reason: "DUPLICATE_TARGET_KEY",
        detail: `duplicate wait key ${JSON.stringify(target.key)}; the result key would no longer identify which condition fired`,
      };
    }
    keys.add(target.key);
  }

  if (!Number.isFinite(plan.timeoutMs) || plan.timeoutMs <= 0) {
    return {
      valid: false,
      reason: "TIMEOUT_OUT_OF_RANGE",
      detail: `timeoutMs must be a positive number, got ${String(plan.timeoutMs)}`,
    };
  }

  const candidateLimit = plan.candidateLimit ?? DEFAULT_WAIT_CANDIDATE_LIMIT;
  if (!Number.isInteger(candidateLimit) || candidateLimit < 1 || candidateLimit > 64) {
    return {
      valid: false,
      reason: "CANDIDATE_LIMIT_OUT_OF_RANGE",
      detail: `candidateLimit must be an integer in [1, 64], got ${String(candidateLimit)}`,
    };
  }

  return {
    valid: true,
    plan: {
      ...plan,
      // Cihaz sınırının üstünü istemek, cihazın sessizce kırpması ve host'un
      // daha uzun beklemesi demektir; ikisi arasındaki boşlukta kimse bir şey
      // yapmaz.
      timeoutMs: clampWaitTimeoutMs(plan.timeoutMs),
      candidateLimit,
    },
  };
}

/**
 * Planın yürütülme biçimi — cihaz yeteneğine göre.
 *
 * `SINGLE_WAIT_ANY` bugün ERİŞİLEMEZ (cihazda komut yok) ama tipte duruyor:
 * cihaz komutu öğrendiğinde tek değişiklik planlayıcının bu dalı seçmesidir,
 * çağıran arayüzü aynı kalır.
 */
export type WaitExecutionStrategy =
  | { kind: "SINGLE_WAIT_ANY"; timeoutMs: number }
  | {
      kind: "RACED_WAIT_NODE";
      timeoutMs: number;
      /** Her biri ayrı bir bağlantıda paralel yürütülür. */
      legs: readonly { key: string; predicate: UiPredicate; isInterrupt: boolean }[];
    };

/**
 * Yürütme stratejisini seçer.
 *
 * `RACED_WAIT_NODE` her bacak için AYRI bağlantı ister; bunun sebebi cihazın
 * bir bağlantıda istekleri sırayla işlemesidir (`BridgeTcpServer.serve()`:
 * `readLine → handle → write`). Aynı sokette iki `wait_node` göndermek onları
 * yarıştırmaz, SIRAYA dizer — yani "yarış" sessizce ardışık beklemeye dönüşür
 * ve toplam süre iki katına çıkar.
 */
export function planWaitExecution(
  plan: UiWaitPlan,
  capabilities: { supportsWaitAny: boolean },
  hostSupportsWaitAny: boolean = HOST_SUPPORTS_WAIT_ANY,
): WaitExecutionStrategy {
  const timeoutMs = clampWaitTimeoutMs(plan.timeoutMs);
  // BOTH sides have to support it. Selecting on the device's capability alone was
  // a one-way bet on the host catching up first, and it lost: real devices report
  // `supportsWaitAny: true`, so every wait on a modern device routed into a host
  // branch that only throws — the run died at its first wait with
  // "device reports wait_any support but protocol v1 has no such command".
  if (capabilities.supportsWaitAny && hostSupportsWaitAny) {
    return { kind: "SINGLE_WAIT_ANY", timeoutMs };
  }
  return {
    kind: "RACED_WAIT_NODE",
    timeoutMs,
    legs: [
      // Kesintiler ÖNCE: eşit anda gelen iki yanıtta bir hata dialogunun
      // beklenen hedefe yenilmesi, hatayı başarı olarak raporlamak olurdu.
      ...(plan.interrupts ?? []).map((t) => ({
        key: t.key,
        predicate: t.predicate,
        isInterrupt: true,
      })),
      ...plan.expected.map((t) => ({ key: t.key, predicate: t.predicate, isInterrupt: false })),
    ],
  };
}

/**
 * Bir bekleme bacağının wire parametreleri (`wait_node`).
 *
 * Alan adları cihazın `parseWaitParameters` beklentisiyle uyumludur.
 */
export function waitNodeParams(predicate: UiPredicate, timeoutMs: number): Record<string, unknown> {
  const base: Record<string, unknown> = {
    // ⚠️ `by`, `matchBy` DEĞİL. Bu, gerçek cihaza karşı koşulan smoke'ta
    // yakalandı: `matchBy` gönderen bir istek `invalid_match_by` alıyordu.
    // Fake sunucu her alan adını kabul ettiği için testler yeşildi — tam olarak
    // "testler geçiyor, cihazda çalışmıyor" durumu (`parseWaitParameters`).
    by: predicate.selector.by === "id" ? "id" : "text",
    value: predicate.selector.value,
    until: predicate.until === "APPEAR" ? "appear" : "disappear",
    timeoutMs: clampWaitTimeoutMs(timeoutMs),
  };
  if (predicate.selector.by === "text" && predicate.selector.exact !== undefined) {
    base.exact = predicate.selector.exact;
  }
  // Cihazdaki adı `settleMs`; `stableForMs` diye bir alan YOKTUR ve bilinmeyen
  // alanlar sessizce yok sayıldığı için kararlılık penceresi hiç uygulanmazdı.
  if (predicate.stableForMs !== undefined) base.settleMs = predicate.stableForMs;
  return base;
}

/**
 * ---------------------------------------------------------------------------
 *  İptal
 *
 *  Eski cihazlarda `cancel_request` YOKTU; modern Mobile Bridge sunar.
 *  Host iptali yine iki katmanlıdır ve farkı gizlememek önemli:
 *
 *    1. HOST tarafı: bekleyen istek çözülür, çağıran `CANCELLED` alır, bacağın
 *       bağlantısı kapatılır. Bu ANINDA olur.
 *    2. CİHAZ tarafı (`supportsCancelRequest`): `cancel_request` +
 *       `targetRequestId` ile wait serbest bırakılır; yoksa wait kendi
 *       timeout'una kadar sürer.
 *
 *  `cancelScope` bu gerçeği taşır (`HOST_ONLY` vs `HOST_AND_DEVICE`).
 * ---------------------------------------------------------------------------
 */
export type CancelScope =
  /** Host isteği bıraktı; cihaz kendi zaman aşımına kadar sürdürür. */
  | "HOST_ONLY"
  /** Cihaz da iptal etti — Mobile M3+ `cancel_request` ile ulaşılır. */
  | "HOST_AND_DEVICE";

export interface CancelRequest {
  requestId: string;
  reason: string;
}

export interface CancelResult {
  requestId: string;
  cancelled: boolean;
  scope: CancelScope;
  /** Cihaz tarafı ne zaman gerçekten serbest kalır (tahmini üst sınır). */
  deviceReleaseByMs?: number;
}

/**
 * Verilen yeteneklerle iptalin kapsamını söyler.
 *
 * Fonksiyon olması şart: bu karar cihaz `cancel_request` öğrendiğinde
 * değişecek ve tek yerden değişmesi gerekiyor.
 */
export function cancelScopeFor(capabilities: { supportsCancelRequest: boolean }): CancelScope {
  return capabilities.supportsCancelRequest ? "HOST_AND_DEVICE" : "HOST_ONLY";
}

/**
 * İptal edilen bir beklemenin cihazda en kötü ne kadar daha süreceği.
 *
 * Çağıran bunu yeni bir bekleme açmadan önce dikkate almalı; aksi halde aynı
 * hedefte iki eşzamanlı `wait_node` oluşur.
 */
export function deviceReleaseByMs(timeoutMs: number, elapsedMs: number): number {
  return Math.max(0, clampWaitTimeoutMs(timeoutMs) - Math.max(0, elapsedMs));
}

/** Cihazın kendi poll aralığı — host'un bunu ÇOĞALTMAMASI gerektiğinin kaydı. */
export const DEVICE_INTERNAL_POLL_INTERVAL_MS = BRIDGE_LIMITS.deviceWaitPollIntervalMs;
