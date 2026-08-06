/**
 * ===========================================================================
 *  VERDICT ACCESSIBILITY BRIDGE — PROTOCOL v1 WIRE SÖZLEŞMESİ  (Plan D.3)
 *
 *  ⚠️ BU DOSYA UYDURULMADI. Her tip, her hata kodu ve her limit cihazdaki
 *     gerçek implementasyondan çıkarıldı:
 *
 *       NesyMobile/verdict-bridge/app/src/main/java/com/verdict/bridge/
 *         ProtocolV1.kt      (1995 satır — komut dispatch, hata taksonomisi)
 *         BridgeTcpServer.kt (NDJSON, 127.0.0.1:9876, satır başına bir yanıt)
 *
 *     Bunun nedeni acı bir asimetri: host bir sözleşme *uydurabilir* ve
 *     testleri de o uydurmaya göre yazabilir. O testler sonsuza kadar yeşil
 *     kalır ve gerçek cihazda hiçbir şey çalışmaz. Bu yüzden aşağıdaki her
 *     literal, cihazın kaynağındaki karşılığına referansla yazıldı.
 *
 *  ⚠️ BU PAKET TAŞIMA BİLMEZ. Ne TCP, ne socket, ne `adb forward`, ne NDJSON
 *     I/O. Yalnız "hangi komut, hangi alan, hangi sonuç" tanımlar. Taşıma
 *     `@nesy/bridge-client`tedir ve BU pakete bağımlıdır — tersi asla.
 *
 *  ⚠️ BU PAKET DOMAIN BİLMEZ. `STOP`, `PARCEL`, `TOUR`, `OPEN_STOP`,
 *     `APPROVE_TOUR`, `COURIER_LOGIN` gibi kavramlar buraya giremez. Bridge
 *     "hangi node'a dokun" bilir, "hangi iş kuralı" bilmez.
 * ===========================================================================
 */

/** `ProtocolV1.kt` → `const val VERSION = 1`. */
export const BRIDGE_PROTOCOL_VERSION = 1 as const;
export type BridgeProtocolVersion = typeof BRIDGE_PROTOCOL_VERSION;

/** `BridgeTcpServer.kt` → `LOOPBACK_ADDRESS` / `PORT`. */
export const BRIDGE_DEVICE_LOOPBACK = "127.0.0.1" as const;
export const BRIDGE_DEVICE_PORT = 9876 as const;

/**
 * Cihazın desteklediği komutlar — TAM liste.
 *
 * `ProtocolV1.dispatchCommand` içindeki `when` bloğunun birebir kopyası.
 * Burada olmayan bir komut cihazdan `unsupported_command` alır; bu yüzden
 * liste "şimdilik bunlar" değil, "protocol v1 budur" demektir.
 *
 * Mobile M3 sonrası: `wait_any`, `cancel_request`, `capabilities` listede.
 * `register_watch` / unsolicited push hâlâ YOKTUR (bilinçli gap).
 */
export const BRIDGE_COMMANDS = [
  "handshake",
  "ping",
  "dump",
  "find_id",
  "find_text",
  "tap_id",
  "tap_text",
  "input_text",
  "swipe",
  "back",
  "screenshot",
  "activate_id",
  "collection_info",
  "scroll_to_item",
  "wait_node",
  "wait_any",
  "cancel_request",
  "capabilities",
] as const;

export type BridgeCommand = (typeof BRIDGE_COMMANDS)[number];

const COMMAND_SET: ReadonlySet<string> = new Set(BRIDGE_COMMANDS);

export const isBridgeCommand = (value: unknown): value is BridgeCommand =>
  typeof value === "string" && COMMAND_SET.has(value);

/**
 * Komutun cihaz üzerinde FİZİKSEL ETKİ üretip üretmediği.
 *
 * Bu ayrım kozmetik değil: yanıtı kaybolan bir mutation `UNKNOWN_EFFECT`
 * olmak zorundadır (etki olmuş da olabilir), kaybolan bir observation ise
 * güvenle yeniden denenebilir. İkisini aynı retry politikasına sokmak, ya
 * çift tap ya da gereksiz run failure üretir.
 */
export const BRIDGE_MUTATION_COMMANDS: ReadonlySet<BridgeCommand> = new Set([
  "tap_id",
  "tap_text",
  "input_text",
  "swipe",
  "back",
  "activate_id",
  "scroll_to_item",
]);

export const isMutationCommand = (command: BridgeCommand): boolean =>
  BRIDGE_MUTATION_COMMANDS.has(command);

/** Uzun sürebilen, iptal edilebilir bekleme komutları. */
export const BRIDGE_WAIT_COMMANDS: ReadonlySet<BridgeCommand> = new Set([
  "wait_node",
  "wait_any",
]);

export const isWaitCommand = (command: BridgeCommand): boolean =>
  BRIDGE_WAIT_COMMANDS.has(command);

/**
 * Ağır artifact üreten komutlar.
 *
 * `screenshot` PNG'yi base64 olarak YANITIN İÇİNDE taşır (`handleScreenshot`
 * → `fields["data"] = result.pngBase64`). Bu yüzden hot path'te değildir ve
 * ayrı bir kotadan geçer; aksi halde tek bir bekleme döngüsü megabaytlarca
 * base64'ü satır satır soket üzerinden çeker.
 */
export const BRIDGE_HEAVY_COMMANDS: ReadonlySet<BridgeCommand> = new Set(["screenshot", "dump"]);

/**
 * ---------------------------------------------------------------------------
 *  Hata taksonomisi
 *
 *  `ProtocolV1.kt` içindeki TÜM `error` değerleri. Gruplandırma host'un
 *  kararıdır; string'ler cihazındır ve değiştirilemez.
 * ---------------------------------------------------------------------------
 */

/** Envelope/oturum düzeyi. Komut hiç çalışmadı. */
export const BRIDGE_ENVELOPE_ERRORS = [
  "invalid_json",
  "missing_request_id",
  "unsupported_protocol_version",
  "missing_command",
  "unsupported_command",
  "handshake_required",
  "request_id_conflict",
  "internal_error",
  "interrupted",
] as const;

/**
 * Run fencing. Cihaz başka bir run/session/epoch'a ait.
 *
 * Bunlar retry edilmez: `stale_run` "bu run artık cihazın aktif run'ı değil"
 * demektir ve tekrar denemek yalnız aynı cevabı üretir. Yanıt `expectedRunId`,
 * `expectedSessionId`, `expectedRunEpoch` taşır (`scopeErrorResponse`).
 */
export const BRIDGE_SCOPE_ERRORS = ["stale_run", "wrong_session"] as const;

/** Erişilebilirlik ağacı okunamadı veya beklenen nesil değişti. */
export const BRIDGE_TREE_ERRORS = [
  "root_unavailable",
  "tree_access_unavailable",
  "stale_tree",
] as const;

/**
 * Hedef çözümleme. `Selection.Failure` → `not_found` / `ambiguous`.
 *
 * ⚠️ `ambiguous` bir BAŞARISIZLIKTIR, bir uyarı değil. Cihaz iki eşleşme
 * gördüğünde HİÇBİR fiziksel aksiyon uygulamaz (`selectionError` action
 * dispatcher'a ulaşmadan döner). Host bunu "birincisini seç" diye
 * yorumlayamaz — o davranış tam olarak yanlış satıra dokunmak olurdu.
 */
export const BRIDGE_SELECTION_ERRORS = ["not_found", "ambiguous"] as const;

/**
 * Parametre doğrulama — bilinen SABİT kodlar.
 *
 * ⚠️ Bu liste TAM DEĞİL, ve olamaz: cihaz kodları `missing_$key` /
 * `invalid_$key` şablonuyla ÜRETİR (`ProtocolV1.requiredString` vb.), yani
 * taksonomi alan adları kadar açık uçludur. Gerçek cihazda `invalid_match_by`,
 * `invalid_until`, `missing_value`, `missing_runEpoch` gibi kodlar görüldü.
 *
 * Bu yüzden host tarafında kapalı bir union'a bağlanmak YANLIŞ olurdu: bilinmeyen
 * bir `invalid_foo` kodu tip düzeyinde reddedilirse, teşhis "beklenmeyen hata"ya
 * dönüşür ve hangi alanın hatalı olduğu kaybolur. Sınıflandırma
 * `classifyDeviceError` ile YAPISAL olarak yapılır.
 */
export const BRIDGE_PARAMETER_ERRORS = [
  "invalid_match_by",
  "invalid_until",
  "invalid_dump_scope",
  "missing_dump_scope",
  "invalid_settleMs",
  "missing_scroll_target",
  "missing_value",
] as const;

/** Cihaz hata kodunun ailesi. */
export type BridgeErrorFamily =
  | "ENVELOPE"
  | "SCOPE"
  | "TREE"
  | "SELECTION"
  | "PARAMETER"
  | "WAIT"
  | "ACTION"
  | "UNKNOWN";

/**
 * Tembel kurulur — bilinçli.
 *
 * Modül seviyesinde kurmak bir TDZ hatası veriyordu: bu blok `BRIDGE_WAIT_ERRORS`
 * ve `BRIDGE_ACTION_ERRORS`tan ÖNCE geliyor (hata aileleri okunabilirlik için
 * sırayla tanımlı). Blokları yeniden sıralamak da bir seçenekti, ama o zaman
 * dosyanın okuma sırası "önce zarf, sonra kapsam, sonra ağaç..." mantığını
 * kaybederdi ve bir sonraki ekleme aynı tuzağa yeniden düşerdi.
 */
let familyByCode: Map<string, BridgeErrorFamily> | null = null;

function errorFamilyIndex(): Map<string, BridgeErrorFamily> {
  familyByCode ??= new Map<string, BridgeErrorFamily>([
    ...BRIDGE_ENVELOPE_ERRORS.map((c) => [c, "ENVELOPE"] as const),
    ...BRIDGE_SCOPE_ERRORS.map((c) => [c, "SCOPE"] as const),
    ...BRIDGE_TREE_ERRORS.map((c) => [c, "TREE"] as const),
    ...BRIDGE_SELECTION_ERRORS.map((c) => [c, "SELECTION"] as const),
    ...BRIDGE_WAIT_ERRORS.map((c) => [c, "WAIT"] as const),
    ...BRIDGE_ACTION_ERRORS.map((c) => [c, "ACTION"] as const),
  ]);
  return familyByCode;
}

/**
 * Bir cihaz hata kodunu ailesine yerleştirir — bilinmeyen kodlar dahil.
 *
 * `missing_*`/`invalid_*` şablonu YAPISAL olarak tanınır, bu yüzden cihaz
 * yarın yeni bir alan eklediğinde host onun hatasını hâlâ "parametre hatası"
 * diye sınıflandırabilir ve hangi alan olduğunu kodun kendisinden okuyabilir.
 */
export function classifyDeviceError(code: string): { family: BridgeErrorFamily; field?: string } {
  const known = errorFamilyIndex().get(code);
  if (known) return { family: known };
  const parameter = /^(?:missing|invalid)_(.+)$/.exec(code);
  if (parameter) return { family: "PARAMETER", field: parameter[1] };
  return { family: "UNKNOWN" };
}

/** Bekleme sonucu. `timeout` bir KANIT YOKLUĞUDUR, ürün hatası değildir. */
export const BRIDGE_WAIT_ERRORS = ["timeout"] as const;

/** Aksiyon çalıştırıcı yok veya platform reddetti. */
export const BRIDGE_ACTION_ERRORS = ["action_unavailable"] as const;

export const BRIDGE_ERROR_CODES = [
  ...BRIDGE_ENVELOPE_ERRORS,
  ...BRIDGE_SCOPE_ERRORS,
  ...BRIDGE_TREE_ERRORS,
  ...BRIDGE_SELECTION_ERRORS,
  ...BRIDGE_PARAMETER_ERRORS,
  ...BRIDGE_WAIT_ERRORS,
  ...BRIDGE_ACTION_ERRORS,
] as const;

export type BridgeErrorCode = (typeof BRIDGE_ERROR_CODES)[number];

/**
 * Cihazdan gelmeyen, HOST'un ürettiği hata kodları.
 *
 * Ayrı tutulmaları şart: bir teşhis okuyan kişi "bunu cihaz mı söyledi, host
 * mu uydurdu" sorusunu ayırt edebilmeli. `UNKNOWN_EFFECT` özellikle önemli —
 * cihaz asla böyle bir şey söylemez, çünkü söyleyebilseydi etkinin ne olduğunu
 * biliyor olurdu.
 */
export const BRIDGE_HOST_ERROR_CODES = [
  /** Mutation gönderildi, yanıt gelmeden bağlantı koptu. Etki BİLİNMİYOR. */
  "UNKNOWN_EFFECT",
  /** Bekleme sırasında soket koptu. Bekleme sonucu bilinmiyor, etki yok. */
  "WAIT_CONNECTION_LOST",
  /** Host tarafı zaman aşımı (cihaz `timeout` demedi, host bekleyemedi). */
  "HOST_TIMEOUT",
  /** Çağıran iptal etti. */
  "HOST_CANCELLED",
  /** Soket hiç kurulamadı veya handshake başarısız. */
  "BRIDGE_UNAVAILABLE",
  /** Yanıt NDJSON olarak ayrıştırılamadı veya envelope sözleşmeye uymuyor. */
  "PROTOCOL_VIOLATION",
  /** Frame boyut sınırını aştı. */
  "FRAME_TOO_LARGE",
] as const;

export type BridgeHostErrorCode = (typeof BRIDGE_HOST_ERROR_CODES)[number];

const RETRYABLE_HOST_ERRORS: ReadonlySet<string> = new Set<BridgeHostErrorCode>([
  "WAIT_CONNECTION_LOST",
  "HOST_TIMEOUT",
  "BRIDGE_UNAVAILABLE",
]);

/**
 * Bu hatadan sonra AYNI komut güvenle tekrar gönderilebilir mi?
 *
 * `UNKNOWN_EFFECT` kasıtlı olarak retry edilemez sayılır. Etki olmuş olabilir;
 * tekrar göndermek çift tap, çift onay, çift kayıt üretir. Karar insanın veya
 * bir üst katman reconciliation'ının olmalı, transport'un değil.
 */
export const isRetryableHostError = (code: BridgeHostErrorCode): boolean =>
  RETRYABLE_HOST_ERRORS.has(code);

/**
 * Cihaz hatası retry edilebilir mi?
 *
 * `stale_run`/`wrong_session` retry edilmez (fencing kararı değişmez).
 * `ambiguous`/`not_found` retry edilmez (ağaç aynıysa sonuç aynıdır; host
 * selector'ı düzeltmeli). `root_unavailable`/`tree_access_unavailable` geçici
 * olabilir.
 */
const RETRYABLE_DEVICE_ERRORS: ReadonlySet<string> = new Set<BridgeErrorCode>([
  "root_unavailable",
  "tree_access_unavailable",
  "internal_error",
]);

export const isRetryableDeviceError = (code: string): boolean =>
  RETRYABLE_DEVICE_ERRORS.has(code);

/**
 * ---------------------------------------------------------------------------
 *  Aksiyon yöntemi (evidence)
 *
 *  `ProtocolV1.kt` → `METHOD_GESTURE`/`METHOD_SEMANTIC`/`METHOD_GLOBAL`/
 *  `METHOD_CAPTURE`.
 *
 *  Neden kanıt olarak taşınıyor: `gesture` gerçek bir dokunuş enjekte eder,
 *  `semantic` ise `performAction` ile node'u tetikler. İkisi aynı ürün
 *  davranışını kanıtlamaz — semantic bir tıklama, kullanıcının parmağının
 *  ulaşamadığı bir düğmeyi de "tıklar". Hangisinin kullanıldığı yanıtta yazılı
 *  olmazsa, sonradan "gerçekten dokunulabilir miydi" sorusu cevaplanamaz.
 * ---------------------------------------------------------------------------
 */
export const BRIDGE_ACTION_METHODS = ["gesture", "semantic", "global", "capture"] as const;
export type BridgeActionMethod = (typeof BRIDGE_ACTION_METHODS)[number];

/**
 * ---------------------------------------------------------------------------
 *  Limitler — cihazdaki sabitlerin birebir karşılığı
 *
 *  Host tarafında tutulmaları gerekiyor çünkü sınırı aşan bir isteği cihaza
 *  göndermek yalnız bir round-trip israfı değil: `MAX_WAIT_TIMEOUT_MS` üstü
 *  bir bekleme cihazda sessizce kırpılır ve host hâlâ kendi (daha uzun)
 *  zaman aşımını bekler, yani cihaz çoktan `timeout` dönmüşken host bekler.
 * ---------------------------------------------------------------------------
 */
export const BRIDGE_LIMITS = {
  /** `MAX_WAIT_TIMEOUT_MS = 120_000` */
  maxWaitTimeoutMs: 120_000,
  /** `WAIT_POLL_INTERVAL_MS = 50` — cihazın kendi poll aralığı (bilgi amaçlı). */
  deviceWaitPollIntervalMs: 50,
  /** `DEFAULT_TAP_SETTLE_TIMEOUT_MS = 2_000` */
  defaultTapTimeoutMs: 2_000,
  /** `MAX_TAP_SETTLE_TIMEOUT_MS = 10_000` */
  maxTapTimeoutMs: 10_000,
  /** `DEFAULT_SWIPE_DURATION_MS = 300` */
  defaultSwipeDurationMs: 300,
  /** `MAX_SWIPE_DURATION_MS = 10_000` */
  maxSwipeDurationMs: 10_000,
  /** `CACHE_TTL_MS = 5 * 60 * 1000` — cihazın requestId dedupe penceresi. */
  requestIdCacheTtlMs: 300_000,
} as const;

/**
 * Tek NDJSON frame için üst sınır.
 *
 * Cihaz sınır koymaz, ama host koymak ZORUNDA: `screenshot` yanıtı base64 PNG
 * taşır ve bozuk/kötü niyetli bir akış newline göndermeyi hiç bırakmayarak
 * host'un belleğini sınırsız büyütebilir. Sınır, `screenshot`ın gerçek
 * ihtiyacının üstünde ama bellek tükenmesinin çok altında seçildi.
 */
export const BRIDGE_MAX_FRAME_BYTES = 16 * 1024 * 1024;

/**
 * ---------------------------------------------------------------------------
 *  Wire envelope
 * ---------------------------------------------------------------------------
 */

/**
 * Run fencing kimliği — her komutta ZORUNLU.
 *
 * `runEpoch` neden var: aynı `runId` yeniden başlatılabilir. Epoch olmadan,
 * yeniden başlatılmış bir run'a ait geç gelen bir komut cihaz tarafından
 * geçerli sayılır ve YENİ run'ın ekranına dokunur. `ProtocolV1.compareScope`
 * epoch'u runId'den ÖNCE kontrol eder, tam bu yüzden.
 *
 * ⚠️ **`runEpoch` yalnız bir fencing alanı DEĞİL, bir DEVRALMA JETONUDUR.**
 * Bu, gerçek cihaza karşı koşulan ilk smoke'ta öğrenildi: handshake
 * `stale_run` ile reddedildi çünkü cihazda daha önceki bir oturumdan kalan
 * aktif bir scope vardı. `ProtocolV1.activateScope`ın kuralı şu:
 *
 * ```text
 * aktif scope yok            → talep edilen scope sahiplenilir
 * requested.runEpoch >  aktif → DEVRALIR (aktif run preempt edilir)
 * requested.runEpoch <= aktif → stale_run ile REDDEDİLİR
 * ```
 *
 * Sonucu host için bağlayıcı: bir cihazı sahiplenmek için epoch MONOTON ARTAN
 * olmak zorunda. Sabit bir epoch (ör. her zaman `1`) kullanan bir host,
 * cihazda kalıntı bir scope olduğu anda hiçbir komut çalıştıramaz — gözlem
 * bile yapamaz, çünkü handshake'in kendisi reddedilir.
 */
export interface BridgeRunScope {
  runId: string;
  sessionId: string;
  /**
   * Pozitif tam sayı. `parseRunScope` `epoch <= 0` ve kesirli değeri reddeder.
   *
   * Monoton artan olmalı — bkz. yukarıdaki devralma kuralı.
   */
  runEpoch: number;
}

/**
 * Bir handshake'in cihazı sahiplenip sahiplenemeyeceğini söyler.
 *
 * Pure fonksiyon: cihazın `activateScope` kuralının host tarafındaki aynası.
 * Amacı, bir round-trip harcamadan "bu epoch ile devralamam" diyebilmek ve
 * daha da önemlisi bu kuralın TEST EDİLEBİLİR olması.
 */
export function canClaimDevice(
  requestedEpoch: number,
  activeEpoch: number | null,
): { claim: true } | { claim: false; reason: "STALE_EPOCH"; minimumEpoch: number } {
  if (activeEpoch === null) return { claim: true };
  if (requestedEpoch > activeEpoch) return { claim: true };
  return { claim: false, reason: "STALE_EPOCH", minimumEpoch: activeEpoch + 1 };
}

/**
 * Cihazı sahiplenmeye yeterli, monoton artan bir epoch üretir.
 *
 * **MİLİSANİYE.** Bu bir üslup tercihi değil, sahadan gelen bir zorunluluk.
 * Protokol epoch'un BİRİMİNİ tanımlamıyor — yalnız "pozitif tam sayı" diyor —
 * ve bu, birimi büyük seçenin küçük seçeni kalıcı olarak dışarıda bıraktığı bir
 * durum yaratıyor: devralma `>` karşılaştırmasıyla yapıldığı için, milisaniye
 * ile sahiplenilmiş bir cihaz saniye kullanan bir host tarafından ASLA
 * devralınamaz (1.78e12 > 1.78e9).
 *
 * Gerçek cihazda tam bu yaşandı: aktif scope `runEpoch=1785610650611`
 * (milisaniye) tutuyordu; saniye tabanlı bir epoch ile handshake sonsuza kadar
 * `stale_run` alıyordu ve cihaz gözlem için bile açılamıyordu.
 *
 * Bir sayaç kullanmak ise restart'ta sıfırlanır ve aynı kilitlenmeyi üretir.
 */
export function monotonicRunEpoch(nowMs: number = Date.now()): number {
  return Math.floor(nowMs);
}

/**
 * Bir epoch'un milisaniye tabanlı görünüp görünmediğini söyler.
 *
 * Teşhis içindir: `stale_run` alan bir host'un ilk sorması gereken şey
 * "birimim doğru mu", ve `expectedRunEpoch` bunu okumaya yeter.
 */
export function looksLikeMillisecondEpoch(epoch: number): boolean {
  // 1e12 ≈ 2001 yılı milisaniye cinsinden; saniye cinsinden bir zaman damgası
  // 2001'den bu yana asla bu büyüklüğe çıkmaz.
  return epoch > 1_000_000_000_000;
}

/** Host'un tele yazdığı istek. */
export interface BridgeCommandEnvelope extends BridgeRunScope {
  /** Boş olamaz — `missing_request_id`. Aynı scope'ta idempotency anahtarı. */
  requestId: string;
  protocolVersion: BridgeProtocolVersion;
  command: BridgeCommand;
  /** Komuta özgü parametreler. Bilinmeyen alanlar cihazda YOK SAYILIR. */
  params?: Readonly<Record<string, unknown>>;
}

/**
 * Cihazın döndürdüğü yanıt.
 *
 * `ProtocolV1.response()`: `ok`, `requestId`, `monoTs`, `protocolVersion` her
 * zaman; scope alanları `withResponseScope` içindeyse; `error` başarısızlıkta;
 * ve komuta özgü alanlar düz olarak ÜST SEVİYEDE (nested `data` yok).
 */
export interface BridgeResultEnvelope {
  ok: boolean;
  requestId: string | null;
  /** Cihazın `SystemClock.elapsedRealtime()` değeri. Duvar saati DEĞİL. */
  monoTs: number;
  protocolVersion: number;
  runId?: string;
  sessionId?: string;
  runEpoch?: number;
  error?: string;
  /**
   * Komuta özgü alanlar. Şema-dışı alanlar KORUNUR: cihaz ileride additive
   * alan eklediğinde host'un onları düşürmesi teşhisi sessizce zayıflatır.
   */
  readonly [field: string]: unknown;
}

/**
 * ---------------------------------------------------------------------------
 *  Cihaz yetenekleri — Mobile M3 / M4C contract handoff
 *
 *  Eski Phase 3 baseline'ında `wait_any` / `cancel_request` / `capabilities`
 *  cihazda YOKTU. Mobile Bridge M3 bu üçlüyü ekledi. Bu sabitler artık
 *  "cihazın mevcut protocol v1 yüzeyi"ni yansıtır.
 *
 *  Hâlâ gap olan tek bilinçli madde: unsolicited push / `register_watch`
 *  (request-response kalır). Host eski cihazlarla konuşurken cihazın
 *  `capabilities` yanıtını [capabilityManifestFromDeviceResponse] ile
 *  okumalı; kör `false` varsayımı yasaktır.
 * ---------------------------------------------------------------------------
 */
export const BRIDGE_V1_DEVICE_GAPS = {
  /** Mobile M3+: cihaz `wait_any` sunar. Eski host fallback hâlâ `planWaitExecution(false)`. */
  waitAny: true,
  /**
   * Mobile M3+: `cancel_request` + `targetRequestId` var.
   * Host iptali hâlâ AYRI CONTROL bağlantısından göndermelidir — uzun wait
   * aynı soketin reader'ını tutar (`BridgeTcpServer` async wait dispatch).
   */
  cancelRequest: true,
  /** Mobile M3+: `capabilities` komutu var. */
  capabilitiesCommand: true,
  /**
   * `register_watch`/unsolicited push yok — ve bu İSTENEN durumdur
   * (RUN_PLAY §14.7, B2 request-response kalır). Host parser'ı
   * istenmemiş frame'i fail-closed reddeder.
   */
  unsolicitedPush: false,
} as const;

/**
 * Handshake / capabilities'ten türetilen yetenek manifestosu.
 *
 * Tercih sırası: cihaz `capabilities` yanıtı → [deriveCapabilityManifest].
 */
export interface BridgeCapabilityManifest {
  protocolVersion: number;
  commands: readonly BridgeCommand[];
  supportsWaitAny: boolean;
  supportsCancelRequest: boolean;
  supportsUnsolicitedPush: boolean;
  limits: typeof BRIDGE_LIMITS;
}

export function deriveCapabilityManifest(protocolVersion: number): BridgeCapabilityManifest {
  return {
    protocolVersion,
    commands: BRIDGE_COMMANDS,
    supportsWaitAny: BRIDGE_V1_DEVICE_GAPS.waitAny,
    supportsCancelRequest: BRIDGE_V1_DEVICE_GAPS.cancelRequest,
    supportsUnsolicitedPush: BRIDGE_V1_DEVICE_GAPS.unsolicitedPush,
    limits: BRIDGE_LIMITS,
  };
}

/**
 * Cihaz `capabilities` yanıtını tip-güvenli manifeste çevirir.
 *
 * Bilinmeyen komut adları düşürülür (`register_watch` asla geçmez). Boolean
 * alan yoksa [BRIDGE_V1_DEVICE_GAPS] baseline'ına düşülür — sessiz `false`
 * uydurulmaz.
 */
export function capabilityManifestFromDeviceResponse(
  response: Record<string, unknown>,
): BridgeCapabilityManifest {
  const protocolVersion =
    typeof response.protocolVersion === "number"
      ? response.protocolVersion
      : BRIDGE_PROTOCOL_VERSION;
  const rawCommands = Array.isArray(response.commands) ? response.commands : null;
  const commands =
    rawCommands === null
      ? BRIDGE_COMMANDS
      : (rawCommands.filter((c): c is BridgeCommand => isBridgeCommand(c)) as BridgeCommand[]);
  const limitsRaw =
    response.limits !== null && typeof response.limits === "object"
      ? (response.limits as Record<string, unknown>)
      : {};
  return {
    protocolVersion,
    commands: commands.length > 0 ? commands : BRIDGE_COMMANDS,
    supportsWaitAny:
      typeof response.supportsWaitAny === "boolean"
        ? response.supportsWaitAny
        : BRIDGE_V1_DEVICE_GAPS.waitAny,
    supportsCancelRequest:
      typeof response.supportsCancelRequest === "boolean"
        ? response.supportsCancelRequest
        : BRIDGE_V1_DEVICE_GAPS.cancelRequest,
    // Protocol v1 policy: never honor a device claim for unsolicited push.
    supportsUnsolicitedPush: false,
    limits: {
      maxWaitTimeoutMs:
        typeof limitsRaw.maxWaitTimeoutMs === "number"
          ? limitsRaw.maxWaitTimeoutMs
          : BRIDGE_LIMITS.maxWaitTimeoutMs,
      deviceWaitPollIntervalMs:
        typeof limitsRaw.deviceWaitPollIntervalMs === "number"
          ? limitsRaw.deviceWaitPollIntervalMs
          : BRIDGE_LIMITS.deviceWaitPollIntervalMs,
      defaultTapTimeoutMs:
        typeof limitsRaw.defaultTapTimeoutMs === "number"
          ? limitsRaw.defaultTapTimeoutMs
          : BRIDGE_LIMITS.defaultTapTimeoutMs,
      maxTapTimeoutMs:
        typeof limitsRaw.maxTapTimeoutMs === "number"
          ? limitsRaw.maxTapTimeoutMs
          : BRIDGE_LIMITS.maxTapTimeoutMs,
      defaultSwipeDurationMs:
        typeof limitsRaw.defaultSwipeDurationMs === "number"
          ? limitsRaw.defaultSwipeDurationMs
          : BRIDGE_LIMITS.defaultSwipeDurationMs,
      maxSwipeDurationMs:
        typeof limitsRaw.maxSwipeDurationMs === "number"
          ? limitsRaw.maxSwipeDurationMs
          : BRIDGE_LIMITS.maxSwipeDurationMs,
      requestIdCacheTtlMs:
        typeof limitsRaw.requestIdCacheTtlMs === "number"
          ? limitsRaw.requestIdCacheTtlMs
          : BRIDGE_LIMITS.requestIdCacheTtlMs,
    } as typeof BRIDGE_LIMITS,
  };
}
