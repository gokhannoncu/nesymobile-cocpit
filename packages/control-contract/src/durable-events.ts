/**
 * ===========================================================================
 *  DURABLE EVENT DELIVERY SÖZLEŞMESİ  (Plan B.5 / D.2 / C.40 / C.14)
 *
 *  ⚠️ BU DOSYA DOMAIN BİLMEZ. Ne `STOP`, ne `PARCEL`, ne `COURIER_LOGIN`,
 *     ne `OPEN_STOP`. Yalnız "hangi lane, hangi identity, hangi cursor,
 *     hangi bekleme sonucu" tanımlar. Domain fact isimleri Domain Pack
 *     tarafındadır ve BU pakete bağımlıdır — tersi asla.
 *
 *  Neden ayrı bir sözleşme: iki teslim hattı (receipt-safe ve ordered) aynı
 *  şey değil ve karıştırıldığında hata SESSİZ olur. Order-sensitive bir fact
 *  receipt hattına bağlanırsa Continue Gate reducer state'i eksikken açılır ve
 *  hiçbir test kırmızıya düşmez. Lane'i tipe gömmek, o hatayı derleme zamanına
 *  taşımanın tek yolu.
 * ===========================================================================
 */

/**
 * Bir fact'in hangi teslim hattından authority kazandığı.
 *
 * `RECEIPT_SAFE`: "DB'ye commit edilmiş bu tek fact, kendi başına readiness
 * sağlar." Önceki event'lere, reducer state'ine veya sequence sırasına
 * bağımlılığı yoktur; bu yüzden ordered gap arkasında bekletilmesi gerekmez
 * (C.40).
 *
 * `ORDERED_REQUIRED`: fact ancak contiguous sıra içinde doğrudur. Final Oracle,
 * deterministic reducer, audit ve replay her zaman bu hattı kullanır.
 */
export type EvidenceDeliveryLane = "RECEIPT_SAFE" | "ORDERED_REQUIRED";

/**
 * Idempotency anahtarının KAYNAĞI.
 *
 * `INBOX_EVENT_ID` = `(runId, sessionId, seq)`; commit edilmiş inbox row'un
 * kendisi. `DERIVATION_ID` = reducer'ın ürettiği türetilmiş fact kimliği.
 * İkisi karıştırılamaz: türetilmiş bir fact'i inbox identity'siyle dedupe etmek
 * aynı row'dan iki farklı türetmeyi tek fact sanmaya yol açar.
 */
export type EvidenceIdempotencyKeySource = "INBOX_EVENT_ID" | "DERIVATION_ID";

/**
 * Registry'nin bir fact için ilan ettiği teslim sözleşmesi.
 *
 * `orderingReason` yalnız `ORDERED_REQUIRED` için anlamlıdır ve ZORUNLU
 * dokümantasyondur: "neden sıralı olmak zorunda" sorusunun cevabı yazılmazsa
 * bir sonraki geliştirici performans için lane'i düşürür.
 */
export interface EvidenceDeliveryContract {
  factKey: string;
  lane: EvidenceDeliveryLane;
  idempotencyKey: EvidenceIdempotencyKeySource;
  orderingReason?: string;
}

/** Bir stream'in kimliği. Her iki lane de stream-scoped ilerler. */
export interface DurableStreamScope {
  runId: string;
  sessionId: string;
}

/**
 * Commit edilmiş tek bir inbox row'a yapılan referans.
 *
 * `seq` tel üzerinde DECIMAL STRING'dir, number değil: cihaz tarafında Kotlin
 * `Long`, ve 2^53 üstünde `JSON.parse` iki farklı event'i sessizce tek değere
 * yuvarlıyor.
 */
export interface DurableEventRef {
  runId: string;
  sessionId: string;
  seq: string;
}

/** `DurableEventRef`'i tek satırlık, log'lanabilir, karşılaştırılabilir kimliğe çevirir. */
export const durableEventId = (ref: DurableEventRef): string =>
  `${ref.runId}/${ref.sessionId}/${ref.seq}`;

/**
 * Subscriber'ın nerede kaldığını taşıyan opak cursor.
 *
 * Lane cursor'ın İÇİNDEDİR. Receipt cursor'ını ordered subscriber'a vermek
 * (veya tersi) sessizce yanlış bir yerden devam etmek olurdu; lane'i cursor'a
 * gömünce bu bir decode hatasına dönüşür.
 */
export type DurableEventCursor = string;

/** Cursor encode/decode — TEK dönüşüm noktası, grep'lenebilir. */
export const encodeDurableCursor = (lane: EvidenceDeliveryLane, seq: bigint): DurableEventCursor =>
  `${lane}#${seq.toString()}`;

export interface DecodedDurableCursor {
  lane: EvidenceDeliveryLane;
  seq: bigint;
}

/**
 * Cursor'ı çözer. Lane uyuşmazlığını veya bozuk cursor'ı `null` döner —
 * çağıran "sıfırdan başla" ile "yanlış lane'den devam et" arasında ayrım
 * yapabilsin.
 */
export function decodeDurableCursor(
  cursor: DurableEventCursor,
  expectedLane: EvidenceDeliveryLane,
): DecodedDurableCursor | null {
  const hash = cursor.indexOf("#");
  if (hash <= 0) return null;
  const lane = cursor.slice(0, hash);
  const rawSeq = cursor.slice(hash + 1);
  if (lane !== expectedLane) return null;
  if (!/^\d{1,19}$/.test(rawSeq)) return null;
  return { lane: expectedLane, seq: BigInt(rawSeq) };
}

/**
 * Subscriber'ın hangi event'leri istediği.
 *
 * Domain-neutral kalması için filtre YALNIZ event adı ve payload üzerindeki
 * düz alan eşitlikleri üzerinden çalışır. `eventNames` boşsa hepsi geçer.
 * `payloadEquals`, `data` nesnesindeki bir alanın string karşılaştırmasıdır;
 * hangi alanların anlamlı olduğu Domain Pack'in bilgisidir, bu sözleşmenin
 * değil.
 */
export interface DurableEventFilter {
  eventNames?: readonly string[];
  payloadEquals?: Readonly<Record<string, string>>;
}

/**
 * Aynı iş biriminin farklı taşıyıcılarda aynı olduğunu söyleyen korelasyon.
 *
 * FOR_EACH iterasyonunda aynı `stepKey` birden çok kez beklenir; `occurrenceId`
 * olmadan ikinci iterasyonun beklemesi birincinin event'iyle tamamlanır.
 */
export interface DurableEventCorrelation {
  occurrenceId?: string;
  entityKey?: string;
  stepKey?: string;
}

/** Receipt hattının subscriber'a verdiği tek teslim. */
export interface DurableReceipt {
  lane: "RECEIPT_SAFE";
  ref: DurableEventRef;
  cursor: DurableEventCursor;
  /** Inbox row'un payload'ı. Doğrulama subscriber'ın işidir. */
  payload: unknown;
  /** Row'un COMMIT edildiği an — latency ölçümünün başlangıcı. */
  receivedAt: Date;
}

/** Ordered hattın subscriber'a verdiği tek teslim. */
export interface OrderedEvidence {
  lane: "ORDERED_REQUIRED";
  ref: DurableEventRef;
  cursor: DurableEventCursor;
  payload: unknown;
  receivedAt: Date;
  /** Teslim anındaki stream contiguous watermark'ı. */
  contiguousSeq: string;
}

export type DurableDelivery = DurableReceipt | OrderedEvidence;

/**
 * Host'un event beklemesi. SDK komutu DEĞİLDİR (C.14) — bekleme host
 * subscription'ıdır, cihazda thread/coroutine tutulmaz.
 */
export interface WaitEventRequest {
  runId: string;
  sessionId?: string;
  lane: EvidenceDeliveryLane;
  filter: DurableEventFilter;
  timeoutMs: number;
  cursor?: DurableEventCursor;
  correlation?: DurableEventCorrelation;
  signal?: AbortSignal;
}

/**
 * Bekleme sonucu.
 *
 * `TIMEOUT` bir FAILURE DEĞİLDİR: "beklenen kanıt görülmedi" demektir ve
 * kanıtsız hüküm üretmek Phase 2'nin açıkça yasakladığı şeydir (B.16).
 * `POISON_BLOCKED` yalnız ordered hatta çıkar — receipt hattı poison row
 * arkasında bloke olmaz (C.40).
 */
export type WaitEventResult =
  | {
      status: "MATCHED";
      lane: EvidenceDeliveryLane;
      cursor: DurableEventCursor;
      eventRef: string;
      payload: unknown;
    }
  | { status: "TIMEOUT"; lane: EvidenceDeliveryLane; cursor?: DurableEventCursor }
  | { status: "CANCELLED"; lane: EvidenceDeliveryLane; cursor?: DurableEventCursor }
  | { status: "CLOSED_RUN"; lane: EvidenceDeliveryLane; cursor?: DurableEventCursor }
  | {
      status: "POISON_BLOCKED";
      lane: "ORDERED_REQUIRED";
      cursor?: DurableEventCursor;
      eventRef: string;
      lastError: string;
    };

/**
 * Bir stream'in durable runtime sağlığı.
 *
 * Bunlar süs değil: durable bir hattın en kötü arıza modu "sessizce takılmak".
 * `oldestUnprocessedAgeMs` büyüyorsa ordered consumer duruyor, ve bu tek başına
 * hiçbir test'i kırmaz.
 */
export interface DurableStreamHealth {
  runId: string;
  sessionId: string;
  contiguousSeq: string;
  /** Commit edilmiş ama receipt hattına verilmemiş row sayısı. */
  receiptPending: number;
  /** Ordered hattın işlemediği, watermark altındaki row sayısı = consumer lag. */
  orderedLag: number;
  /** En eski işlenmemiş row'un yaşı; `null` = lag yok. */
  oldestUnprocessedAgeMs: number | null;
  /** Commit → receipt dispatch gecikmesinin son ölçümü. */
  lastReceiptDispatchLatencyMs: number | null;
  maxAttempt: number;
  lastError: string | null;
  deadLetteredCount: number;
  lateEventCount: number;
  closedAt: Date | null;
}

/** Process düzeyinde subscriber muhasebesi — leak'in tek görünür yeri. */
export interface DurableSubscriberHealth {
  activeSubscribers: number;
  cancelledSubscribers: number;
  completedSubscribers: number;
}

export interface DurableRuntimeHealth {
  subscribers: DurableSubscriberHealth;
  streams: readonly DurableStreamHealth[];
}

/**
 * SDK `EmitOutcome` diagnostic'inin host'tan sorabileceği BOUNDED yüzey.
 *
 * Neden bounded: diagnostic sorgusunun kendisi durable event üretirse, "event
 * görünmedi mi?" sorusu her sorulduğunda yeni event doğar ve hat kendi kendini
 * besler. Bu sözleşme bir OKUMA'dır; hiçbir implementasyonu inbox'a yazamaz.
 */
export interface EmitOutcomeDiagnosticQuery {
  runId: string;
  sessionId: string;
  /** Cihazın durable kabul edildiğini sandığı en yüksek seq. */
  throughSeq: string;
}

export interface EmitOutcomeDiagnosticResult {
  /** Host'un gerçekten commit ettiği contiguous watermark. */
  hostContiguousSeq: string;
  /** `throughSeq` host'ta gerçekten var mı? */
  present: boolean;
  /** Row ordered hatta işlendi mi? */
  orderedProcessed: boolean;
  /** Row receipt hattına verildi mi? */
  receiptDispatched: boolean;
  /** Row poison/dead-letter durumunda mı? */
  deadLettered: boolean;
  /**
   * Bu sorgunun durable event üretmediğinin TİP düzeyindeki beyanı. Her zaman
   * `true`; `false` yazan bir implementasyon derlenmez.
   */
  readonly sideEffectFree: true;
}

/**
 * Sync sink ile durable hattın aynı logical evidence'i ürettiğinin raporu.
 *
 * Eşitlik kanıtlanmadan synchronous sink primary path olmaktan çıkarılamaz.
 */
export interface SyncDurableEqualityReport {
  equal: boolean;
  syncCount: number;
  durableCount: number;
  /** Sync'te olup durable'da olmayan event kimlikleri. */
  missingFromDurable: readonly string[];
  /** Durable'da olup sync'te olmayan event kimlikleri. */
  missingFromSync: readonly string[];
  /** Aynı kimlikte farklı payload fingerprint — en tehlikeli uyuşmazlık. */
  payloadMismatches: readonly string[];
}
