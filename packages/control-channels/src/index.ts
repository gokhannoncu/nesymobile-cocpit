/**
 * ===========================================================================
 *  Kontrol düzlemi KANALLARI  (Plan C.9)
 *
 *  Bağımlılık yönü: control-channels → control-contract.  TERSİ ASLA.
 *  (tur 8: önceki sürüm kanalları contract paketine koyup aynı pakete
 *   "kanal bilgisi yok" diyordu — çelişkiydi.)
 *
 *  Faz 0.3 kapsamı: YALNIZ `LegacyReceiverChannel`. Davranış DEĞİŞMEZ.
 *  `VerdictChannel` Faz 4'te eklenir; `detectChannel()` iskeleti burada
 *  hazır durur ki Faz 4 yalnız implementasyon eklesin.
 * ===========================================================================
 */
import type {
  ControlErrorCode,
  ControlOperation,
  ControlResult,
  ScreenStateDump,
} from "@nesy/control-contract";

/** Kanalların ihtiyaç duyduğu tek dış yetenek: `adb` çalıştırmak. */
export interface AdbRunner {
  /** `adb -s <serial> <...args>` çalıştırır, stdout döner. Hata → throw. */
  (serial: string, args: string[], timeoutMs?: number): Promise<string>;
}

export interface ChannelContext {
  /** Cihazdaki gerçek `applicationId` (13 flavor → 13 farklı değer). */
  applicationId: string;
  adb: AdbRunner;
}

export interface ControlChannel {
  readonly name: "legacy" | "verdict";
  run<Op extends ControlOperation>(
    serial: string,
    op: Op,
    ctx: ChannelContext,
  ): Promise<ControlResult<Op["op"]>>;
}

// ---------------------------------------------------------------------------
//  LEGACY RECEIVER CHANNEL
//
//  Mevcut iki receiver'ı çağırır. Bu sınıf, 8 dosyaya dağılmış olan
//  hardcoded sınıf adı + action ismi + `am broadcast` çağrısını TEK yere
//  toplar. Faz 8'de tamamen silinecek (C.9 adım 9).
// ---------------------------------------------------------------------------

const LEGACY_KEY_RECEIVER =
  "com.arasdigital.nesymobile.adb.ProtectedRequestKeyReceiver";
const LEGACY_NAV_RECEIVER =
  "com.arasdigital.nesymobile.adb.TestNavigationReceiver";
const ACTION_PREFIX = "com.arasdigital.nesymobile.";

/**
 * `am broadcast` çıktısından payload çıkarır. **TEK implementasyon.**
 *
 * ⚠️ **EXIT CODE'A GÜVENİLMEZ.** `am broadcast` yetkisiz durumda bile `0`
 * dönebilir; broadcast izin kontrolü `sendBroadcast()` DÖNDÜKTEN SONRA yapılır
 * ve başarısızlık exception atmaz (C.2). Cihazda ölçüldü — var olmayan bir
 * component bile şunu üretiyor:
 *
 *     Broadcasting: Intent { ... cmp=com.no.such.pkg/.NoReceiver }
 *     Broadcast completed: result=0
 *     EXIT=0
 *
 * Bu yüzden kanıt yalnızca `data="…"` payload'ıdır — yokluk = ULAŞMADI.
 *
 * ### Neden "son tırnağa kadar" (greedy)
 *
 * **`am` payload içindeki tırnakları KAÇIRMIYOR.** Gerçek cihaz çıktısı:
 *
 *     Broadcast completed: result=42, data="A:{"runId":"r1","seq":7}"
 *
 * Mevcut kod tabanında bu payload'ı okumak için ÜÇ farklı regex dolaşıyordu:
 *
 * | Varyant | Yer | Davranış |
 * |---|---|---|
 * | `/\bdata="((?:\\"|[^"])*)"/`  | `device-courier-auth`, `nesy-mobile-auth.router`, `field-courier-login-orchestrator`, `adb-scenario-executor` | ilk iç tırnakta **KESER** |
 * | `/data="([\s\S]*?)"/`         | `test-event-bridge:207,241` | lazy — ilk iç tırnakta **KESER** |
 * | `/data="([\s\S]*)"/`          | `test-event-bridge:290` | greedy — **DOĞRU** |
 *
 * İlk iki varyant yalnızca tırnaksız payload'larda (`GET_KEY`,
 * `GET_DEVICE_ID`) tesadüfen çalışıyor; `GET_STATE` ve `RESET_STATE` JSON
 * döndürdüğü için orada `{` sonrası her şeyi kaybederlerdi. Tek doğru semantik
 * greedy olan — bu fonksiyon onu benimser.
 */
export function parseBroadcastPayload(stdout: string): string | null {
  for (const marker of ['data="', 'result="']) {
    const start = stdout.indexOf(marker);
    if (start === -1) continue;
    let body = stdout.slice(start + marker.length);
    // `am` payload'dan SONRA alan yazabilir (`", extras: Bundle[…]`). Greedy
    // arama oraya taşmasın; kapanış tırnağı bu işaretin hemen öncesindedir.
    const extras = body.indexOf('", extras:');
    if (extras !== -1) body = body.slice(0, extras + 1);
    const end = body.lastIndexOf('"');
    if (end <= 0) continue;
    return body.slice(0, end);
  }
  return null;
}

/**
 * `am broadcast` çıktısındaki `result=<int>` kodu.
 *
 * `Broadcast completed:` satırındaki İLK eşleşme alınır — payload'ın kendisi
 * `result=` içerebilir (örn. get_state JSON'u) ve o dikkate alınmamalı.
 */
export function parseResultCode(stdout: string): number | null {
  const m = /\bresult=(-?\d+)/.exec(stdout);
  return m?.[1] ? Number(m[1]) : null;
}

interface LegacyRoute {
  receiver: string;
  action: string;
  /** `--es k v` / `--ez k true` çiftleri. */
  extras: string[];
}

/** Operation → legacy receiver + action + extras. Tek eşleme noktası. */
function routeLegacy(op: ControlOperation): LegacyRoute | null {
  // Cihaz tarafında `am` bir SHELL üzerinden koşuyor; boş bir değer
  // `--es run_id` şeklinde argümansız kalır ve am hata verir. Legacy kod bunu
  // `''` ile çözüyordu — aynı davranış korunur.
  const es = (k: string, v: string) => ["--es", k, v === "" ? "''" : v];

  switch (op.op) {
    case "get_state":
      return { receiver: LEGACY_KEY_RECEIVER, action: "GET_STATE", extras: [] };
    case "get_run":
      return { receiver: LEGACY_KEY_RECEIVER, action: "GET_RUN", extras: [] };
    case "get_device_id":
      return { receiver: LEGACY_KEY_RECEIVER, action: "GET_DEVICE_ID", extras: [] };
    case "get_request_key":
      return { receiver: LEGACY_KEY_RECEIVER, action: "GET_KEY", extras: [] };
    case "reset_state":
      return { receiver: LEGACY_KEY_RECEIVER, action: "RESET_STATE", extras: [] };
    case "set_run": {
      const extras = [...es("run_id", op.runId)];
      // ⚠️ STRING extra (`--es`), boolean (`--ez`) DEĞİL. Mobil taraf ikisini de
      // kabul ediyor (`getBooleanExtra(...) || getStringExtra(...) == "true"`)
      // ama production'da bugüne dek koşan tel `--es`. Faz 0.3'ün sözü
      // "davranış değişmez" — telin biçimini de değiştirmiyoruz.
      if (op.wsEnabled !== undefined)
        extras.push(...es("ws_enabled", String(op.wsEnabled)));
      if (op.wsPort !== undefined) extras.push(...es("ws_port", String(op.wsPort)));
      if (op.skipDeliveryWait !== undefined)
        extras.push(...es("skip_delivery_wait", String(op.skipDeliveryWait)));
      // NOT: `secret` legacy receiver'a GÖNDERİLMEZ — eski receiver onu
      // tanımıyor ve HMAC yalnız Verdict kanalında geçerli (C.2a). Secret'ın
      // legacy yola sızmaması BİLİNÇLİ.
      return { receiver: LEGACY_KEY_RECEIVER, action: "SET_RUN", extras };
    }
    case "seed": {
      const extras = es("verb", op.verb);
      for (const [k, v] of Object.entries(op.params)) extras.push(...es(k, v));
      return { receiver: LEGACY_NAV_RECEIVER, action: "SEED_STATE", extras };
    }
    case "navigate":
      return {
        receiver: LEGACY_NAV_RECEIVER,
        action: "NAV_TO",
        extras: es("destination", op.destination),
      };
    // Legacy receiver'ların KARŞILIĞI OLMAYAN operasyonlar. Faz 4'te
    // VerdictChannel bunları destekler; şimdilik açıkça reddedilir —
    // sessizce "başarılı" dönmek yanlış olurdu.
    case "end_run":
    case "get_command_result":
      return null;
    // Bu op ACTIVITY DUMP kanalına ait (aşağıdaki LegacyActivityDumpChannel);
    // receiver kanalı onu taşımaz.
    case "get_screen_state":
      return null;
  }
}

/** `Activity.RESULT_OK` / `RESULT_CANCELED` — receiver'ların kullandığı kodlar. */
const RESULT_OK = -1;
const RESULT_CANCELED = 0;

/**
 * Receiver'ların `ERROR:<KOD>[:detay]` sözlüğü → sözleşmenin hata kodu.
 *
 * Kaynak: `ProtectedRequestKeyReceiver.kt` + `TestNavigationReceiver.kt`
 * companion sabitleri. Eşlenmeyen bir kod gelirse `HANDLER_FAILED`'a düşer ama
 * `detail` ham kodu TAŞIR — bilgi kaybı olmaz.
 */
const LEGACY_ERROR_MAP: Readonly<Record<string, ControlErrorCode>> = {
  INVALID_ACTION: "UNKNOWN_COMMAND",
  UNKNOWN_DESTINATION: "INVALID_PARAM",
  UNKNOWN_VERB: "INVALID_PARAM",
  NO_USERNAME: "MISSING_PARAM",
  NO_SHIPMENT_ID: "MISSING_PARAM",
  NO_STOP_ID: "MISSING_PARAM",
  NO_ROUTE: "MISSING_PARAM",
  NO_PIN: "MISSING_PARAM",
  NO_FOREGROUND_MAIN_ACTIVITY: "WRONG_SCREEN",
  NOT_ON_STOPLIST: "WRONG_SCREEN",
  NOT_ON_LOGIN: "WRONG_SCREEN",
  ROUTE_DIALOG_NOT_SHOWN: "WRONG_SCREEN",
  DEVICE_ID_NOT_FOUND: "PRECONDITION_FAILED",
  SHIPMENT_NOT_FOUND: "PRECONDITION_FAILED",
  STOP_NOT_FOUND: "PRECONDITION_FAILED",
  ROUTE_NOT_FOUND: "PRECONDITION_FAILED",
  STATE_TIMEOUT: "TIMEOUT",
  KEY_GENERATION_FAILED: "HANDLER_FAILED",
  NAV_FAILED: "HANDLER_FAILED",
  STATE_FAILED: "HANDLER_FAILED",
};

/**
 * `data=` payload'ını operasyona göre tipli sonuca çevirir.
 *
 * ⚠️ **BU FONKSİYONUN EN ÖNEMLİ İŞİ "BAŞARILI" DEMEMEYİ BİLMEK.**
 * Cihazda ölçüldü: var olmayan bir component'e gönderilen broadcast bile
 *
 *     Broadcast completed: result=0
 *     EXIT=0
 *
 * üretiyor. Yani ne exit code ne `result=0` başarı kanıtıdır. Kanıt YALNIZCA
 * `data="…"` payload'ıdır ve legacy receiver'ların **9 op'unun HEPSİ** payload
 * döndürür (`OK:<x>` · `ERROR:<KOD>` · `{"reset":"ok"}`). Payload yokluğu =
 * receiver kurulu değil / ulaşılamadı → `CHANNEL_UNAVAILABLE`.
 */
function decodeLegacy<Op extends ControlOperation>(
  op: Op,
  payload: string | null,
  resultCode: number | null,
): ControlResult<Op["op"]> {
  type R = ControlResult<Op["op"]>;
  const fail = (code: ControlErrorCode, detail?: string): R =>
    ({ ok: false, code, detail, ...(payload ? { raw: payload } : {}) }) as R;
  const good = (data: unknown): R => ({ ok: true, data }) as R;

  if (!payload) {
    return fail(
      "CHANNEL_UNAVAILABLE",
      `${op.op}: broadcast payload yok (result=${resultCode ?? "?"}) — ` +
        `receiver kurulu değil ya da ulaşılamadı. result=0 + exit=0 BAŞARI DEĞİL.`,
    );
  }

  // --- Hata yolları ------------------------------------------------------
  // 1) `ERROR:<KOD>[:detay]` — iki receiver'ın ortak sözlüğü.
  if (payload.startsWith("ERROR:")) {
    const [, code = "", ...rest] = payload.split(":");
    return fail(
      LEGACY_ERROR_MAP[code] ?? "HANDLER_FAILED",
      rest.length > 0 ? `${code}: ${rest.join(":")}` : code,
    );
  }
  // 2) `reset_state` JSON hata biçimi — `ERROR:` öneki KULLANMIYOR.
  if (op.op === "reset_state" && payload.includes('"error"')) {
    const message = /"message"\s*:\s*"([^"]*)"/.exec(payload)?.[1] ?? "";
    const code: ControlErrorCode =
      message === "bridge_disabled"
        ? "PRECONDITION_FAILED"
        : message === "timeout"
          ? "TIMEOUT"
          : "HANDLER_FAILED";
    return fail(code, message || payload);
  }
  // 3) Payload var ama receiver CANCELED dedi — tanınmayan hata biçimi.
  if (resultCode === RESULT_CANCELED) {
    return fail("HANDLER_FAILED", `result=0, data=${payload}`);
  }
  if (resultCode !== RESULT_OK && resultCode !== null) {
    return fail("PROTOCOL_VIOLATION", `beklenmeyen result=${resultCode}`);
  }

  // --- Başarı yolları ---------------------------------------------------
  /** Mutasyonların `OK:<echo>` biçimini doğrular ve `Dispatched` üretir. */
  const dispatched = (expectedEcho?: string): R => {
    if (!payload.startsWith("OK:")) {
      return fail("PROTOCOL_VIOLATION", `"OK:" beklenirken alındı: ${payload}`);
    }
    const echo = payload.slice(3);
    // Receiver kendisine verilen değeri geri yansıtıyor; uyuşmazlık başka bir
    // broadcast'in yanıtını okuduğumuz anlamına gelir — sessizce kabul edilmez.
    if (expectedEcho !== undefined && echo !== expectedEcho) {
      return fail(
        "PROTOCOL_VIOLATION",
        `echo uyuşmuyor: beklenen "${expectedEcho}", gelen "${echo}"`,
      );
    }
    return good({
      accepted: true,
      requestId: op.requestId,
      completion: "sync",
      raw: payload,
    });
  };

  switch (op.op) {
    case "get_device_id":
      return good({ deviceId: payload });
    case "get_request_key":
      return good({ key: payload });
    case "get_run": {
      // Legacy biçim: "runId|sessionId|seq"
      const parts = payload.split("|");
      if (parts.length < 3) {
        return fail("PROTOCOL_VIOLATION", `get_run biçimi bozuk: ${payload}`);
      }
      const [runId = "", sessionId = "", seq = "0"] = parts;
      return good({ runId, sessionId, seq: Number(seq) || 0 });
    }
    case "get_state": {
      try {
        return good(JSON.parse(payload) as unknown);
      } catch {
        return fail("PROTOCOL_VIOLATION", "get_state JSON parse edilemedi");
      }
    }
    // Mutasyonlar. Legacy receiver deadline'ı içinde bitiriyor (GET_STATE ve
    // RESET_STATE `goAsync` + 5 s watchdog kullanıyor, ama yanıtı YİNE de
    // broadcast tamamlanmadan veriyor) → `completion: "sync"`. Verdict kanalı
    // bunu `"async"` yapabilir (C.9a); çağıran `get_command_result` ile poll eder.
    case "set_run":
      return dispatched(op.runId);
    case "navigate":
      return dispatched(op.destination);
    case "seed":
      // Seed fiillerinin echo'su fiile göre değişiyor (stopId, route, pin…);
      // sabit bir beklenti YOK — yalnız "OK:" öneki doğrulanır.
      return dispatched();
    case "reset_state":
      // Başarı biçimi `{"reset":"ok"}` — `OK:` öneki KULLANMIYOR.
      if (!payload.includes('"ok"')) {
        return fail("PROTOCOL_VIOLATION", `reset_state yanıtı tanınmadı: ${payload}`);
      }
      return good({
        accepted: true,
        requestId: op.requestId,
        completion: "sync",
        raw: payload,
      });
    default:
      return fail("UNKNOWN_COMMAND", op.op);
  }
}

/**
 * Op'un taşıdığı sırları serbest metinden siler.
 *
 * **Neden gerekli (C.2).** `secret` argv'de `--es` olarak geçiyor; birçok
 * process wrapper hata mesajına TÜM komut satırını koyar
 * (`Command failed: adb -s X shell am broadcast … --es secret ABC`). O mesajı
 * `detail` alanına ham geçirmek sırrı log'a yazmak demektir. Legacy kanal
 * secret'ı hiç göndermiyor ama Faz 4'ün `VerdictChannel`'ı gönderecek —
 * temizlik kanal katmanının değişmez kuralı olmalı, tek bir kanalın değil.
 */
function scrubSecrets(text: string, op: ControlOperation): string {
  if (op.op !== "set_run") return text;
  const secret: string = op.secret;
  return secret.length > 0 ? text.split(secret).join("***REDACTED***") : text;
}

export class LegacyReceiverChannel implements ControlChannel {
  readonly name = "legacy" as const;

  async run<Op extends ControlOperation>(
    serial: string,
    op: Op,
    ctx: ChannelContext,
  ): Promise<ControlResult<Op["op"]>> {
    const route = routeLegacy(op);
    if (!route) {
      return {
        ok: false,
        code: "UNKNOWN_COMMAND",
        detail: `${op.op}: legacy receiver'larda karşılığı yok (Faz 4 VerdictChannel gerekir)`,
      } as ControlResult<Op["op"]>;
    }

    // EXPLICIT COMPONENT ZORUNLU (C.9 tur 7): action-only gönderim, aynı
    // action'ı dinleyen BAŞKA bir uygulama tarafından yakalanıp sahte yanıtla
    // taklit edilebilir. Faz 0.1 spike'ı ayrıca ölçtü: implicit broadcast
    // API 29/31/34/36'da hiç ULAŞMIYOR (Q2) — yani explicit zaten zorunluluk.
    const args = [
      // Bazı çağıranlar tek cihaz varsayıp `-s` KULLANMIYOR (legacy
      // `requestAppValueFromAdb`). `-s ""` göndermek adb'yi düşürürdü.
      ...(serial ? ["-s", serial] : []),
      "shell",
      "am",
      "broadcast",
      // Durmuş uygulamayı yalnız çağıran açıkça istediğinde uyandır (envelope).
      ...(op.wakeStopped ? ["--include-stopped-packages"] : []),
      "-n",
      `${ctx.applicationId}/${route.receiver}`,
      "-a",
      `${ACTION_PREFIX}${route.action}`,
      ...route.extras,
    ];

    let stdout: string;
    try {
      stdout = await ctx.adb(serial, args, BROADCAST_TIMEOUT_MS);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        code: "CHANNEL_UNAVAILABLE",
        detail: scrubSecrets(raw, op),
      } as ControlResult<Op["op"]>;
    }

    const res = decodeLegacy(
      op,
      parseBroadcastPayload(stdout),
      parseResultCode(stdout),
    );
    // Cihazın döndürdüğü metin de temizlenir — `detail` payload'ı yansıtabiliyor.
    return !res.ok && res.detail
      ? ({ ...res, detail: scrubSecrets(res.detail, op) } as ControlResult<Op["op"]>)
      : res;
  }
}

/** Mobil watchdog `GET_STATE`'i 5 s'de bitirir; broadcast'e biraz pay bırak. */
const BROADCAST_TIMEOUT_MS = 15_000;

/**
 * Bir op'un ÇALIŞTIRILMAYAN, kopyala-yapıştır önizleme komutunu üretir.
 *
 * Debug View'ın "commands" sekmesi kullanıcıya terminale yazabileceği satırı
 * gösteriyor. O satırlar bugün elle yazılmış string literal'ler; Faz 4 iki
 * receiver'ı silince **sessizce yanlış** olacaklar — kimse hata almaz, komut
 * kopyalanır ve çalışmaz. Aynı yönlendirme tablosundan üretmek bunu engeller.
 *
 * ⚠️ Bu fonksiyon bir taşıma değil, bir GÖSTERİM. Gerçek çağrı
 * `LegacyReceiverChannel`den geçer.
 */
export function previewCommand(
  op: ControlOperation,
  ctx: { applicationId: string; serial?: string },
): string | null {
  const route = routeLegacy(op);
  if (!route) return null;
  const parts = [
    "adb",
    ...(ctx.serial ? ["-s", ctx.serial] : []),
    "shell",
    "am",
    "broadcast",
    ...(op.wakeStopped ? ["--include-stopped-packages"] : []),
    "-n",
    `${ctx.applicationId}/${route.receiver}`,
    "-a",
    `${ACTION_PREFIX}${route.action}`,
    ...route.extras,
  ];
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
//  LEGACY ACTIVITY DUMP CHANNEL  (Debug View · C.11.4)
//
//  `dumpsys activity <pkg>/<Activity> --nesy-state` → `NESY_SCREEN_STATE:{json}`
//
//  Bu kanal `adb.ts`'de hardcode duran ÜÇ stringi sahiplenir: activity sınıf
//  adı, dump bayrağı ve çıktı işareti. Faz 5.9 üçünü de değiştiriyor
//  (VerdictDumpProvider / --verdict-screen-state / VERDICT_SCREEN_STATE:) ve
//  o değişiklik BU DOSYADA kalmalı, çağıranda değil.
// ---------------------------------------------------------------------------

const LEGACY_DUMP_ACTIVITY = "com.arasdigital.nesymobile.main.MainActivity";
const LEGACY_DUMP_FLAG = "--nesy-state";
const LEGACY_DUMP_MARKER = "NESY_SCREEN_STATE:";

/**
 * Faz 0.1 spike'ında ölçülen framework dump transfer timeout'u ~2.05–2.10 s.
 * 8 s onun üstünde kalıyor ve `adb.ts`'in bugünkü değeriyle aynı.
 */
const DUMP_TIMEOUT_MS = 8_000;

/** `NESY_SCREEN_STATE:{json}` satırını ayrıştırır. */
export function parseScreenStateDump(dump: string): ScreenStateDump {
  const marker = dump.indexOf(LEGACY_DUMP_MARKER);
  // İşaret yok = enstrümante olmayan build. HATA DEĞİL: dump çalıştı.
  if (marker < 0) return { instrumented: false, state: null, raw: dump };

  const line =
    dump.slice(marker + LEGACY_DUMP_MARKER.length).split("\n")[0]?.trim() ?? "";
  try {
    return {
      instrumented: true,
      state: JSON.parse(line) as ScreenStateDump["state"],
      raw: dump,
    };
  } catch {
    // İşaret vardı ama gövde bozuk — enstrümante SAYILMAZ, yoksa çağıran
    // "alanlar boş ama build doğru" diye yanlış rapor verir.
    return { instrumented: false, state: null, raw: dump };
  }
}

export class LegacyActivityDumpChannel implements ControlChannel {
  readonly name = "legacy" as const;

  async run<Op extends ControlOperation>(
    serial: string,
    op: Op,
    ctx: ChannelContext,
  ): Promise<ControlResult<Op["op"]>> {
    if (op.op !== "get_screen_state") {
      return {
        ok: false,
        code: "UNKNOWN_COMMAND",
        detail: `${op.op}: activity dump kanalı yalnız get_screen_state taşır`,
      } as ControlResult<Op["op"]>;
    }
    // Component adı ZORUNLU. Faz 0.1 spike'ı ölçtü: `dumpsys activity provider`
    // authority ile HİÇ eşleşmiyor, component adı ister. Activity dump'ı da
    // aynı biçimi kullanıyor ve 13 flavor için daha sağlam — paket adı
    // değişiyor ama sınıf adı sabit.
    const component = `${ctx.applicationId}/${LEGACY_DUMP_ACTIVITY}`;
    try {
      const out = await ctx.adb(
        serial,
        [
          ...(serial ? ["-s", serial] : []),
          "shell",
          `dumpsys activity ${component} ${LEGACY_DUMP_FLAG}`,
        ],
        DUMP_TIMEOUT_MS,
      );
      return { ok: true, data: parseScreenStateDump(out) } as ControlResult<Op["op"]>;
    } catch (err) {
      return {
        ok: false,
        code: "CHANNEL_UNAVAILABLE",
        detail: err instanceof Error ? err.message : String(err),
      } as ControlResult<Op["op"]>;
    }
  }
}

// ---------------------------------------------------------------------------
//  KANAL TESPİTİ  (C.9 — Faz 4'te tamamlanır)
// ---------------------------------------------------------------------------

export type ChannelKind = "legacy" | "verdict";

/**
 * Hangi kanal kullanılacak?
 *
 * **Exit code'a GÜVENİLMEZ** (C.9): `am broadcast` yetkisiz durumda bile `0`
 * döner. Tespit **nonce'lı ordered result** ile yapılır:
 *
 * ```
 * VERDICT_CMD ping { nonce: <rastgele> }
 *   → yanıtta AYNI nonce geri geldi mi?  EVET → verdict
 *   → timeout / nonce uyuşmuyor / yanıt yok → legacy
 * ```
 *
 * FAZ 0.3'TE: her zaman `"legacy"` döner — davranış değişmez. Faz 4'te
 * `VerdictChannel` eklenince gerçek tespit buraya yazılır. İskeletin şimdi
 * durması, Faz 4'ün yalnız implementasyon eklemesini sağlar.
 *
 * Sonuç device worker ömrü boyunca cache'lenir ama **kanal hatasında cache
 * invalidate edilir** ve tespit tekrarlanır (uygulama güncellenmiş olabilir).
 */
export async function detectChannel(
  _serial: string,
  _ctx: ChannelContext,
): Promise<ChannelKind> {
  return "legacy";
}

export const channelFor = (kind: ChannelKind): ControlChannel => {
  switch (kind) {
    case "legacy":
      return new LegacyReceiverChannel();
    case "verdict":
      // Faz 4'te: return new VerdictChannel();
      throw new Error("VerdictChannel Faz 4'te eklenir");
  }
};
