/**
 * ===========================================================================
 *  Cihaz kontrol düzlemi SÖZLEŞMESİ  (Plan C.9)
 *
 *  ⚠️ BU PAKET KANAL BİLMEZ. Ne `am broadcast`, ne WebSocket, ne ADB.
 *     Yalnız "hangi operasyon, hangi sonuç" tanımlar. Kanal implementasyonları
 *     `@nesy/control-channels`tedir ve BU pakete bağımlıdır — tersi asla.
 *
 *  Neden var: 8 production dosyası receiver sınıf adlarını ve action
 *  isimlerini HARDCODE ediyordu. Mobil taraf Faz 4'te o iki receiver'ı
 *  siliyor; sözleşme olmadan `GET_KEY` / `GET_STATE` / `SET_RUN` /
 *  `GET_DEVICE_ID` / `GET_RUN` / `RESET_STATE` / `NAV_TO` / `SEED_STATE`
 *  akışlarının HEPSİ kırılırdı.
 * ===========================================================================
 */

/**
 * Log/fixture çıktısında ZORUNLU redakte edilir (C.2).
 *
 * Nominal tip: sıradan bir `string` buraya atanamaz — `asSecret()` üzerinden
 * geçmek zorunlu. Böylece "yanlışlıkla loglanan secret" derleme zamanında
 * ayırt edilebilir hale gelir.
 */
export type Secret = string & { readonly __redacted: unique symbol };

/** Ham string'i Secret'a çevirir. TEK dönüşüm noktası — grep'lenebilir. */
export const asSecret = (raw: string): Secret => raw as Secret;

/**
 * "Bu çağrıda HMAC YOK" sentinel'i.
 *
 * `set_run` sözleşmede `secret`i ZORUNLU tutar — Faz 4'te HMAC'ı unutmak
 * derleme hatası olmalı, sessiz bir çalışma zamanı zafiyeti değil. Ama legacy
 * kanal secret'ı hiç göndermiyor, dolayısıyla o çağıranların açıkça
 * "sır yok" demesi gerekiyor. `asSecret("")` yazmak niyeti gizlerdi; bu sabit
 * greplenebilir ve Faz 8'de legacy kanal silinince kalan kullanımları
 * bulmak tek `grep NO_SECRET` demektir.
 */
export const NO_SECRET: Secret = "" as Secret;

/** Secret'ı asla doğrudan basmayın; bu yardımcıyı kullanın. */
export const redact = (_s: Secret): string => "***REDACTED***";

/**
 * Her operasyonun taşıdığı korelasyon kimliği.
 *
 * **Neden zorunlu (tur 13 — P0).** Cihaz tarafında
 * `CommandRouter.execute(cmd, ctx, params)` bir `CommandContext(origin, scope,
 * requestId)` istiyor ve `ResultCache.single(scope, requestId, fp)` İKİSİYLE
 * anahtarlanıyor. Bu alanlar olmadan receiver kanalından gelen komutlar için
 * idempotency anahtarı ÜRETİLEMİYORDU — yani single-flight koruması tam olarak
 * recovery için var olan ve bu yüzden en çok retry edilen kanalda çalışmıyordu.
 */
export interface ControlEnvelope {
  /** Çağrı başına TEKİL. Cihazın idempotency anahtarının bir yarısı. */
  requestId: string;
  /**
   * İdempotency KAPSAMI. Cihazın `sessionId`'si DEĞİLDİR: host onu bilemez ve
   * `set_run` onu zaten değiştirir (dairesellik). Host'un orkestrasyon kapsamı
   * taşınır — normalde `runId`, `set_run`'da YENİ `runId`.
   */
  scope: string;
  /**
   * Durmuş (force-stop / kill / hiç açılmamış) uygulamayı UYANDIRMAYA izin ver.
   *
   * **Varsayılan `false` — ve bu bilinçli.** Faz 0.1 spike'ı ölçtü: recovery
   * kanalını mümkün kılan tam olarak `--include-stopped-packages`'tır (Q4/Q5/Q7
   * hepsi bu bayrakla PASS). Ama bayrağı her çağrıya koymak davranışı
   * DEĞİŞTİRİR: `get_state` gibi salt-okunur bir sorgu, uygulamayı başlatarak
   * "app çalışmıyor" bilgisini yok eder ve çağıranın dallanmasını bozar.
   *
   * Bu yüzden uyandırma AÇIK bir tercihtir; legacy kodun bayrağı koyduğu
   * yerlerde `true`, koymadığı yerlerde yok.
   */
  wakeStopped?: boolean;
}

/** Kontrol düzleminde çalıştırılabilecek operasyonlar. */
export type ControlOperation = ControlEnvelope &
  (
    | { op: "get_state" }
    | {
        op: "set_run";
        runId: string;
        /** base64url, 32 bayt CSPRNG. ASLA loglanmaz (C.2, C.2c). */
        secret: Secret;
        wsEnabled?: boolean;
        wsPort?: number;
        skipDeliveryWait?: boolean;
      }
    | { op: "end_run" }
    | { op: "get_run" }
    | { op: "get_device_id" }
    | { op: "get_request_key" }
    | { op: "reset_state" }
    | { op: "seed"; verb: string; params: Record<string, string> }
    | {
        op: "sql_named";
        /** App Adapter allowlist key. Never arbitrary SQL. */
        name: string;
        /** Broadcast-safe scalar params; nested values fail before dispatch. */
        params?: Record<string, string | number | boolean | null>;
        maxRows?: number;
      }
    | { op: "navigate"; destination: string }
    | { op: "get_command_result"; targetRequestId: string }
    /**
     * Ekrandaki canlı ViewModel/screen alanları (Debug View · C.11.4).
     *
     * **Receiver DEĞİL, ACTIVITY DUMP kanalı.** `get_state`'ten farklıdır:
     * `get_state` bridge durumunu (runId, isLogin, route) broadcast ile okur;
     * bu op ekranın in-memory alanlarını `dumpsys activity … --<flag>` ile
     * okur ve uygulama ön planda değilse doğal olarak boş döner.
     *
     * Faz 5.9'da hedef `dumpsys activity provider
     * <pkg>/com.verdict.sdk.core.VerdictDumpProvider --verdict-screen-state`
     * olacak — component adıyla, authority ile DEĞİL (Faz 0.1 spike'ı
     * authority'nin hiç eşleşmediğini ölçtü). Bu op, o geçişte `adb.ts`'in
     * değişmemesini sağlar.
     */
    | { op: "get_screen_state" }
  );

export type ControlOp = ControlOperation["op"];

/**
 * `ACTION` komutunun terminal yanıtı.
 *
 * **`void` DEĞİL (tur 13).** `ACTION` komutları `COMMAND_DISPATCHED`
 * semantiğine sahiptir; `void` dönmek "iş bitti" yanılsaması üretiyordu.
 * `completion` alanı sonucun NEREDEN beklenmesi gerektiğini söyler.
 */
export interface Dispatched {
  accepted: true;
  requestId: string;
  /**
   * `"sync"`  → iş receiver deadline'ı içinde BİTTİ, ek beklemek gerekmez.
   * `"async"` → iş sürüyor; sonuç `get_command_result` ile okunur (C.9a).
   *             WS açıksa ayrıca `COMMAND_RESULT_ASYNC` event'i gelir.
   */
  completion: "sync" | "async";
  /**
   * Cihazın HAM yanıt metni (örn. `OK:36`).
   *
   * Sözleşme tipli sonuç üretiyor ama bazı çağıranlar cihazın kendi metnini
   * kullanıcıya/rapora yazıyor (`broadcastSelectRoute` → `ERROR:ROUTE_NOT_FOUND:36`).
   * Bu alan o bilgiyi korur; **kanal-agnostiktir** — her kanalın bir "cihazın
   * söylediği şey" metni vardır, taşıma detayı değildir.
   */
  raw?: string;
}

/** Cihazın bridge durumu — `get_state` yanıtı. */
export interface DeviceBridgeState {
  runId: string | null;
  sessionId: string | null;
  seq: number | null;
  currentScreen: string | null;
  isLogin: boolean | null;
  route: string | null;
  skipDeliveryWait: boolean | null;
  /** Bilinmeyen alanlar sessizce korunur — additive wire kuralı (C.3). */
  [extra: string]: unknown;
}

/** Operation → sonuç tipi eşlemesi. Çağıran keyfi bir `T` iddia EDEMEZ. */
export interface ControlResultMap {
  get_state: DeviceBridgeState;
  set_run: Dispatched;
  end_run: Dispatched;
  get_run: { runId: string; sessionId: string; seq: number };
  get_device_id: { deviceId: string };
  /** `data.key` LOG/AUDIT kopyasında redakte edilir; transport yanıtında açık (Faz 4.5). */
  get_request_key: { key: string };
  reset_state: Dispatched;
  seed: Dispatched;
  sql_named: { rows: unknown[]; rowCount?: number; redacted?: boolean; raw?: string };
  navigate: Dispatched;
  get_command_result:
    | { state: "pending" }
    | { state: "done"; result: unknown };
  get_screen_state: ScreenStateDump;
}

/** `get_screen_state` yanıtı. */
export interface ScreenStateDump {
  /**
   * Kurulu build dump hook'unu içeriyor mu.
   *
   * `false` = eski/enstrümante olmayan build; UI kullanıcıya doğru build
   * istemesini söyleyebilir. Bu bir HATA DEĞİL — dump çalıştı, işaret yoktu.
   */
  instrumented: boolean;
  /** Ayrıştırılmış `{ shared?, screen? }` gövdesi; işaret yoksa null. */
  state: { shared?: Record<string, unknown>; screen?: Record<string, unknown> } | null;
  /** Ham dump metni — teşhis için. */
  raw: string;
}

/** Stabil hata kodları — cihazın `CommandErrorCode` enum'uyla hizalı. */
export type ControlErrorCode =
  | "UNKNOWN_COMMAND"
  | "MISSING_PARAM"
  | "INVALID_PARAM"
  | "PRECONDITION_FAILED"
  | "WRONG_SCREEN"
  | "TIMEOUT"
  | "HANDLER_FAILED"
  | "NOT_AUTHORIZED"
  | "PAYLOAD_TOO_LARGE"
  | "DUPLICATE_REQUEST"
  | "PROVIDER_MISSING"
  | "QUERY_NOT_REGISTERED"
  | "RESULT_TOO_LARGE"
  | "NESTED_PAYLOAD_REJECTED"
  | "RESOURCE_EXHAUSTED"
  /** Kanal seviyesi: cihaza hiç ulaşılamadı (receiver yok, timeout, adb hatası). */
  | "CHANNEL_UNAVAILABLE"
  /** Yanıt geldi ama parse edilemedi / nonce uyuşmadı. */
  | "PROTOCOL_VIOLATION";

export type ControlResult<K extends ControlOp> =
  | { ok: true; data: ControlResultMap[K] }
  | {
      ok: false;
      code: ControlErrorCode;
      detail?: string;
      /** Cihazın ham yanıt metni (örn. `ERROR:ROUTE_NOT_FOUND:36`). */
      raw?: string;
    };

/**
 * Yürütücü sözleşmesi.
 *
 * Taşıma bilgisi bu pakette DEĞİL, `@nesy/control-channels`tedir; node
 * fabrikası `@nesy/control-channels/node` alt yolundan gelir
 * (`createControlExecutor`). Uygulamalar yalnız KABLOLAMA yapar — hangi
 * `applicationId`, hangi log hedefi. Yürütücüyü her app'te yeniden yazmak,
 * C.9'un ortadan kaldırdığı çoğaltmayı geri getirirdi.
 */
export interface ControlExecutor {
  run<Op extends ControlOperation>(
    serial: string,
    op: Op,
  ): Promise<ControlResult<Op["op"]>>;
}

/**
 * Host-side diagnostic escalation levels (plan B.5.4).
 *
 * These names describe the artefact, not how a command reaches the device.
 * This package deliberately carries no ADB, receiver, provider, or WebSocket
 * details.
 */
export type DiagnosticLevel =
  | "D1_MEMINFO"
  | "D2_PERFETTO"
  | "D3_HEAPDUMP";

/**
 * Budget and safety policy evaluated by the Cockpit host.
 *
 * D3 is disabled in the default policy exported by the API implementation and
 * may only be requested with explicit opt-in. A policy value alone never makes
 * a field/production build eligible for heap dumping.
 */
export interface DiagnosticCapturePolicy {
  enabled: Record<DiagnosticLevel, boolean>;
  cooldownMs: Record<DiagnosticLevel, number>;
  quotaPerRun: Record<DiagnosticLevel, number>;
  /** No OS capture may begin while `get_health.inCriticalSpan` is true. */
  inhibitDuringCriticalSpan: boolean;
  /** Required free bytes / expected heap-dump bytes before D3 may begin. */
  minFreeSpaceMultiplier: number;
}

/**
 * A successfully correlated host diagnostic artefact. `skippedReason` remains
 * part of the shared projection for persisted audit rows; skipped rows have no
 * artefact and are represented by the API's audit/view model.
 *
 * `marker*MonoTs` are decimal strings because the SDK returns CLOCK_BOOTTIME
 * milliseconds and the contract must remain safe if that counter outgrows
 * JavaScript's exact integer range.
 */
export interface DiagnosticCapture {
  captureId: string;
  level: DiagnosticLevel;
  runId: string;
  sessionId: string;
  screen: string;
  operation: string | null;
  spanId: string | null;
  pid: number;
  markerPreMonoTs: string;
  markerPostMonoTs: string;
  artifactPath: string;
  /**
   * Required for minified automationRelease D2/D3 artefacts. The host stores a
   * copy of that build's mapping.txt alongside the capture (plan B.5.5).
   */
  mappingFileRef?: string;
  /** Heap dumps are always sensitive and are excluded from reports by default. */
  sensitive: boolean;
  skippedReason?:
    | "cooldown"
    | "quota"
    | "critical_span"
    | "low_disk"
    | "not_profileable"
    | "api_too_low"
    | "opt_in_missing";
}

/** `requestId` üreteci — çağıranların elle string uydurmasını engeller. */
let seqCounter = 0;
export function newRequestId(prefix = "req"): string {
  seqCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${seqCounter.toString(36)}`;
}

/**
 * ---------------------------------------------------------------------------
 *  EVENT ADI ALIAS HARİTASI  (tur 14 — A.4.2)
 *
 *  Test Standartları dokümanı, planın DONDURULMUŞ wire name listesinde
 *  OLMAYAN isimler kullanıyor. Yetenek farkı değil, isim farkı — ama smoke
 *  test'in 7 adımından 4'ü bunlara bağlı ve harita olmadan oracle eşleşmez.
 *
 *  Yeni wire name ÜRETİLMEZ; dondurulmuş listeye dokunulmaz (C.3 kural 1).
 * ---------------------------------------------------------------------------
 */
export const EVENT_ALIAS: Readonly<Record<string, string>> = Object.freeze({
  APP_READY: "BRIDGE_INIT",
  LOGIN_SUCCESS: "STATE_LOGIN",
  SCHEDULE_LOADED: "STATE_ROUTE",
  DELIVERY_SAVED: "DELIVERY_PERSISTED",
});

/** Doküman/test adını dondurulmuş wire name'e çevirir. */
export const resolveEventName = (name: string): string =>
  EVENT_ALIAS[name] ?? name;

/**
 * ---------------------------------------------------------------------------
 *  DURABLE EVENT DELIVERY (Faz 2 · B.5 · D.2)
 *
 *  Ayrı dosyada tutuluyor çünkü kontrol düzlemi (host → cihaz komut) ile
 *  kanıt teslimi (cihaz → host durable event) iki farklı yön ve iki farklı
 *  invariant setidir. Aynı dosyada olsalar biri diğerinin tiplerini "elde
 *  varken" kullanmaya başlar.
 * ---------------------------------------------------------------------------
 */
export * from "./durable-events.js";
