/**
 * ===========================================================================
 *  Kontrol düzlemi KANALLARI  (Plan C.9)
 *
 *  Bağımlılık yönü: control-channels → control-contract.  TERSİ ASLA.
 *  (tur 8: önceki sürüm kanalları contract paketine koyup aynı pakete
 *   "kanal bilgisi yok" diyordu — çelişkiydi.)
 *
 *  Faz 8.1b: kontrol operasyonlarını yalnız `VerdictChannel`, nonce'lı
 *  ordered-result ve DumpProvider yolları üzerinden taşır.
 * ===========================================================================
 */
import type {
  ControlErrorCode,
  ControlOperation,
  ControlResult,
} from "@nesy/control-contract";

/** Kanalların ihtiyaç duyduğu tek dış yetenek: `adb` çalıştırmak. */
export interface AdbRunner {
  /**
   * `adb -s <serial> <...args>` çalıştırır, stdout döner. Hata → throw.
   * `stdin` argv dışında taşınması gereken tek-kullanımlık hassas içerik içindir.
   */
  (
    serial: string,
    args: string[],
    timeoutMs?: number,
    stdin?: string,
  ): Promise<string>;
}

export interface ChannelContext {
  /** Cihazdaki gerçek `applicationId` (13 flavor → 13 farklı değer). */
  applicationId: string;
  adb: AdbRunner;
}

export interface ControlChannel {
  readonly name: "verdict";
  run<Op extends ControlOperation>(
    serial: string,
    op: Op,
    ctx: ChannelContext,
  ): Promise<ControlResult<Op["op"]>>;
}

const VERDICT_CONTROL_RECEIVER = "com.verdict.sdk.core.VerdictControlReceiver";
const VERDICT_DUMP_PROVIDER = "com.verdict.sdk.core.VerdictDumpProvider";
const VERDICT_RESULT_JSON = "verdict.result.json";
const VERDICT_RESULT_TYPE = "verdict.result.type";
const VERDICT_ACTION_SUFFIX = ".VERDICT_CMD";

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

/** Verdict ordered broadcast'ın başarı kodu (`Activity.RESULT_OK`). */
const RESULT_OK = -1;

/**
 * Op'un taşıdığı sırları serbest metinden siler.
 *
 * **Neden gerekli (C.2).** `secret` argv'de `--es` olarak geçiyor; birçok
 * process wrapper hata mesajına TÜM komut satırını koyar
 * (`Command failed: adb -s X shell am broadcast … --es secret ABC`). O mesajı
 * `detail` alanına ham geçirmek sırrı log'a yazmak demektir. Temizlik bu
 * nedenle Verdict kanalının değişmez kuralıdır.
 */
function scrubSecrets(text: string, op: ControlOperation): string {
  if (op.op !== "set_run") return text;
  const secret: string = op.secret;
  return secret.length > 0 ? text.split(secret).join("***REDACTED***") : text;
}

// ---------------------------------------------------------------------------
//  VERDICT CHANNEL  (Faz 4.3b)
//
//  Receiver: mutasyonlar + ağır sorgular, explicit component ordered result.
//  DumpProvider: yalnız H.1 allowlist'indeki hafif, salt-okunur sorgular.
// ---------------------------------------------------------------------------

interface VerdictPendingResult {
  resultCode: number | null;
  dataJson: string | null;
  extrasJson: string | null;
  resultType: string | null;
  nonce: string | null;
}

/** JSON nesnesini, string içindeki `{` / `}` karakterlerine aldanmadan keser. */
function balancedJsonObject(source: string, objectStart: number): string | null {
  if (source[objectStart] !== "{") return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = objectStart; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(objectStart, i + 1);
    }
  }
  return null;
}

function bundleJsonExtra(stdout: string, key: string): string | null {
  const marker = `${key}=`;
  const markerAt = stdout.indexOf(marker);
  if (markerAt < 0) return null;
  const objectAt = stdout.indexOf("{", markerAt + marker.length);
  return objectAt < 0 ? null : balancedJsonObject(stdout, objectAt);
}

function bundleScalarExtra(stdout: string, key: string): string | null {
  const marker = `${key}=`;
  const markerAt = stdout.indexOf(marker);
  if (markerAt < 0) return null;
  const start = markerAt + marker.length;
  const endings = [
    stdout.indexOf(", ", start),
    stdout.indexOf("}]", start),
    stdout.indexOf("]", start),
    stdout.indexOf("\n", start),
  ].filter((index) => index >= 0);
  const end = endings.length > 0 ? Math.min(...endings) : stdout.length;
  const value = stdout.slice(start, end).trim();
  if (value.length === 0 || value === "null") return null;
  return value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1)
    : value;
}

/**
 * Android `PendingResult`'ın iki eşdeğer JSON yüzünü okur:
 * `resultData` (`data="…"`) ve result extras (`verdict.result.json`).
 */
export function parseVerdictPendingResult(stdout: string): VerdictPendingResult {
  return {
    resultCode: parseResultCode(stdout),
    dataJson: parseBroadcastPayload(stdout),
    extrasJson: bundleJsonExtra(stdout, VERDICT_RESULT_JSON),
    resultType: bundleScalarExtra(stdout, VERDICT_RESULT_TYPE),
    nonce: bundleScalarExtra(stdout, "nonce"),
  };
}

function firstVerdictJson(stdout: string): string | null {
  const markerAt = stdout.lastIndexOf('{"type":');
  return markerAt < 0 ? null : balancedJsonObject(stdout, markerAt);
}

const CONTROL_ERROR_CODES: ReadonlySet<string> = new Set<ControlErrorCode>([
  "UNKNOWN_COMMAND",
  "MISSING_PARAM",
  "INVALID_PARAM",
  "PRECONDITION_FAILED",
  "WRONG_SCREEN",
  "TIMEOUT",
  "HANDLER_FAILED",
  "NOT_AUTHORIZED",
  "PAYLOAD_TOO_LARGE",
  "DUPLICATE_REQUEST",
  "PROVIDER_MISSING",
  "QUERY_NOT_REGISTERED",
  "RESULT_TOO_LARGE",
  "NESTED_PAYLOAD_REJECTED",
  "RESOURCE_EXHAUSTED",
  "CHANNEL_UNAVAILABLE",
  "PROTOCOL_VIOLATION",
]);

const VERDICT_MUTATIONS: ReadonlySet<ControlOperation["op"]> = new Set([
  "set_run",
  "end_run",
  "reset_state",
  "seed",
  "navigate",
]);
const VERDICT_RESERVED_PARAMS: ReadonlySet<string> = new Set([
  "cmd",
  "op",
  "requestId",
  "scope",
  "params",
  "nonce",
  "secret",
  "origin",
  "verb",
]);

type JsonObject = Record<string, unknown>;
type VerdictDumpOperation = Extract<
  ControlOperation,
  { op: "get_run" | "get_command_result" | "get_screen_state" }
>;

function asJsonObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function decodeVerdict<Op extends ControlOperation>(
  op: Op,
  jsonText: string | null,
  expectedNonce: string,
  meta: Pick<VerdictPendingResult, "resultCode" | "resultType" | "nonce">,
  rawTransport: string,
): ControlResult<Op["op"]> {
  type R = ControlResult<Op["op"]>;
  const fail = (code: ControlErrorCode, detail?: string): R =>
    ({
      ok: false,
      code,
      ...(detail ? { detail } : {}),
      ...(jsonText ? { raw: jsonText } : {}),
    }) as R;
  const good = (data: unknown): R => ({ ok: true, data }) as R;

  if (!jsonText) {
    return fail(
      "CHANNEL_UNAVAILABLE",
      `${op.op}: Verdict ordered-result JSON yok (result=${meta.resultCode ?? "?"})`,
    );
  }

  let parsed: JsonObject;
  try {
    const object = asJsonObject(JSON.parse(jsonText));
    if (!object) return fail("PROTOCOL_VIOLATION", "Verdict sonucu JSON nesnesi değil");
    parsed = object;
  } catch {
    return fail("PROTOCOL_VIOLATION", "Verdict sonucu JSON parse edilemedi");
  }

  const type = typeof parsed.type === "string" ? parsed.type : meta.resultType;
  const jsonNonce = typeof parsed.nonce === "string" ? parsed.nonce : null;
  if (jsonNonce && meta.nonce && jsonNonce !== meta.nonce) {
    return fail("PROTOCOL_VIOLATION", "resultData / extras nonce uyuşmuyor");
  }
  if ((jsonNonce ?? meta.nonce) !== expectedNonce) {
    return fail("PROTOCOL_VIOLATION", "Verdict nonce uyuşmuyor");
  }
  if (
    typeof parsed.type === "string" &&
    meta.resultType &&
    parsed.type !== meta.resultType
  ) {
    return fail("PROTOCOL_VIOLATION", "resultData / extras type uyuşmuyor");
  }
  if (parsed.requestId !== op.requestId) {
    return fail("PROTOCOL_VIOLATION", "Verdict requestId uyuşmuyor");
  }

  if (type === "COMMAND_FAILED") {
    const wireCode = typeof parsed.code === "string" ? parsed.code : "";
    const detail = typeof parsed.detail === "string" ? parsed.detail : undefined;
    const code: ControlErrorCode = CONTROL_ERROR_CODES.has(wireCode)
      ? (wireCode as ControlErrorCode)
      : "HANDLER_FAILED";
    return fail(
      code,
      CONTROL_ERROR_CODES.has(wireCode)
        ? detail
        : [wireCode || "missing_error_code", detail].filter(Boolean).join(": "),
    );
  }

  if (meta.resultCode !== null && meta.resultCode !== RESULT_OK) {
    return fail(
      "PROTOCOL_VIOLATION",
      `başarı JSON'u beklenmeyen result=${meta.resultCode} ile geldi`,
    );
  }

  if (type === "COMMAND_DISPATCHED" || type === "COMMAND_ACCEPTED") {
    if (!VERDICT_MUTATIONS.has(op.op)) {
      return fail("PROTOCOL_VIOLATION", `${op.op}: mutasyon yanıtı sorguya döndü`);
    }
    const completion =
      parsed.completion === "async" || parsed.async === true ? "async" : "sync";
    if (type === "COMMAND_ACCEPTED" && completion !== "async") {
      return fail(
        "PROTOCOL_VIOLATION",
        "COMMAND_ACCEPTED terminal yanıtı async işaretli değil",
      );
    }
    return good({
      accepted: true,
      requestId: op.requestId,
      completion,
      raw: jsonText,
    });
  }

  if (type !== "COMMAND_RESULT") {
    return fail(
      "PROTOCOL_VIOLATION",
      `tanınmayan Verdict result type: ${String(type)}`,
    );
  }
  if (VERDICT_MUTATIONS.has(op.op)) {
    return fail("PROTOCOL_VIOLATION", `${op.op}: sorgu yanıtı mutasyona döndü`);
  }

  const data = asJsonObject(parsed.data);
  if (!data) return fail("PROTOCOL_VIOLATION", "COMMAND_RESULT.data nesnesi yok");

  switch (op.op) {
    case "get_screen_state": {
      const state =
        asJsonObject(data.state) ??
        (data.screen !== undefined || data.shared !== undefined
          ? {
              ...(asJsonObject(data.shared) ? { shared: asJsonObject(data.shared)! } : {}),
              ...(asJsonObject(data.screen) ? { screen: asJsonObject(data.screen)! } : {}),
            }
          : { screen: data });
      return good({ instrumented: true, state, raw: rawTransport });
    }
    case "get_state":
    case "get_run":
    case "get_device_id":
    case "get_request_key":
    case "get_command_result":
    case "sql_named":
      return good(data);
    default:
      return fail("UNKNOWN_COMMAND", op.op);
  }
}

function secureNonce(): string {
  const crypto = globalThis.crypto;
  if (!crypto) throw new Error("secure random unavailable");
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

const es = (key: string, value: string): string[] => [
  "--es",
  key,
  value === "" ? "''" : value,
];

function scalarExtra(key: string, value: string | number | boolean | null): string[] {
  if (value === null) return es(key, "");
  if (typeof value === "boolean") return ["--ez", key, String(value)];
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`sql_named param ${key} must be a safe integer when sent over adb broadcast`);
    }
    return ["--ei", key, String(value)];
  }
  return es(key, value);
}

/**
 * `adb shell` argümanları CİHAZ shell'inde YENİDEN ayrıştırılır: `execFile`
 * yerel bir shell açmaz, ama adb kalan argv'yi boşlukla birleştirip uzak
 * `sh -c`'ye verir. Bu yüzden JSON gövdesi (süslü parantez, çift tırnak,
 * değer içindeki boşluk) burada tek tırnakla korunmalı — `es()`'in boş dizgi
 * için `''` yazması da aynı gerçeğin küçük hâliydi.
 */
function deviceShellQuoted(value: string): string {
  return `'${value.split("'").join("'\\''")}'`;
}

function verdictBroadcastArgs(
  serial: string,
  op: Exclude<ControlOperation, VerdictDumpOperation>,
  ctx: Pick<ChannelContext, "applicationId">,
  nonce: string,
  sensitiveFiles: ReadonlyMap<string, string>,
): string[] {
  const command = op.op === "seed" ? op.verb : op.op;
  const extras = [
    ...es("op", op.op),
    ...es("cmd", command),
    ...es("requestId", op.requestId),
    ...es("scope", op.scope),
    ...es("nonce", nonce),
  ];

  switch (op.op) {
    case "set_run":
      extras.push(...es("runId", op.runId));
      // Empty runId is the legacy "detach" form. It deliberately carries no
      // new HMAC root; the mobile built-in closes the current run.
      if (op.runId !== "") {
        const secretFile = sensitiveFiles.get("secret");
        if (secretFile) extras.push(...es("secretFile", secretFile));
      }
      if (op.wsEnabled !== undefined)
        extras.push("--ez", "wsEnabled", String(op.wsEnabled));
      if (op.wsPort !== undefined)
        extras.push("--ei", "wsPort", String(op.wsPort));
      if (op.skipDeliveryWait !== undefined)
        extras.push("--ez", "skipDeliveryWait", String(op.skipDeliveryWait));
      break;
    case "seed":
      extras.push(...es("verb", op.verb));
      for (const [key, value] of Object.entries(op.params)) {
        if (op.verb === "login" && key === "pin") continue;
        extras.push(...es(key, value));
      }
      if (op.verb === "login") {
        const pinFile = sensitiveFiles.get("pin");
        if (pinFile) extras.push(...es("pinFile", pinFile));
      }
      break;
    case "sql_named": {
      extras.push(...es("name", op.name));
      // Sorgu argümanları TEK bir iç içe `params` nesnesi olarak gider —
      // cihazdaki `sqlNamedHandler` `params["params"]` okur ve WebSocket
      // zarfı da aynı şekli taşır. Parametre başına ayrı extra yollamak
      // (eski hâl) cihazda hiçbir zaman argüman olarak görünmüyordu.
      const queryParams = op.params ?? {};
      for (const [key, value] of Object.entries(queryParams)) {
        if (VERDICT_RESERVED_PARAMS.has(key) || key === "name") {
          throw new Error(`sql_named param uses reserved field: ${key}`);
        }
        if (typeof value === "number" && !Number.isSafeInteger(value)) {
          throw new Error(`sql_named param ${key} must be a safe integer`);
        }
      }
      if (Object.keys(queryParams).length > 0) {
        extras.push(
          "--es",
          "params",
          deviceShellQuoted(JSON.stringify(queryParams)),
        );
      }
      if (op.maxRows !== undefined) extras.push(...scalarExtra("maxRows", op.maxRows));
      break;
    }
    case "navigate":
      extras.push(...es("destination", op.destination));
      break;
    default:
      break;
  }

  return [
    ...(serial ? ["-s", serial] : []),
    "shell",
    "am",
    "broadcast",
    ...(op.wakeStopped ? ["--include-stopped-packages"] : []),
    "-n",
    `${ctx.applicationId}/${VERDICT_CONTROL_RECEIVER}`,
    "-a",
    `${ctx.applicationId}${VERDICT_ACTION_SUFFIX}`,
    ...extras,
  ];
}

interface SensitiveSidecar {
  field: "secret" | "pin";
  fileName: string;
  value: string;
}

function verdictSensitiveSidecars(
  op: Exclude<ControlOperation, VerdictDumpOperation>,
  nonce: string,
): SensitiveSidecar[] {
  const safeNonce = nonce.replace(/[^A-Za-z0-9._-]/g, "");
  if (!safeNonce) throw new Error("sensitive sidecar nonce is not path-safe");
  if (op.op === "set_run" && op.runId !== "") {
    return [{
      field: "secret",
      fileName: `control-${safeNonce}-secret`,
      value: op.secret,
    }];
  }
  if (
    op.op === "seed" &&
    op.verb === "login" &&
    typeof op.params.pin === "string"
  ) {
    return [{
      field: "pin",
      fileName: `control-${safeNonce}-pin`,
      value: op.params.pin,
    }];
  }
  return [];
}

function sensitiveSidecarDirectoryArgs(
  serial: string,
  applicationId: string,
): string[] {
  return [
    ...(serial ? ["-s", serial] : []),
    "shell",
    "run-as",
    applicationId,
    "mkdir",
    "-p",
    "no_backup/verdict/control",
  ];
}

function sensitiveSidecarWriteArgs(
  serial: string,
  applicationId: string,
  fileName: string,
): string[] {
  const relativePath = `no_backup/verdict/control/${fileName}`;
  return [
    ...(serial ? ["-s", serial] : []),
    "shell",
    // One remote-command argument is required: adb otherwise flattens `sh -c`'s script
    // into separate shell tokens. The interpolated values are path-safe by construction.
    `run-as ${applicationId} sh -c 'cat > ${relativePath}'`,
  ];
}

function sensitiveSidecarDeleteArgs(
  serial: string,
  applicationId: string,
  fileName: string,
): string[] {
  return [
    ...(serial ? ["-s", serial] : []),
    "shell",
    "run-as",
    applicationId,
    "rm",
    "-f",
    `no_backup/verdict/control/${fileName}`,
  ];
}

function verdictDumpArgs(
  serial: string,
  op: VerdictDumpOperation,
  ctx: Pick<ChannelContext, "applicationId">,
  nonce: string,
): string[] {
  const component = `${ctx.applicationId}/${VERDICT_DUMP_PROVIDER}`;
  return [
    ...(serial ? ["-s", serial] : []),
    "shell",
    "dumpsys",
    "activity",
    "provider",
    component,
    op.op === "get_screen_state"
      ? "--verdict-state"
      : `--verdict-command=${op.op}`,
    `--request-id=${op.requestId}`,
    `--scope=${op.scope}`,
    `--nonce=${nonce}`,
    ...(op.op === "get_command_result"
      ? [`--command-request-id=${op.targetRequestId}`]
      : []),
  ];
}

export class VerdictChannel implements ControlChannel {
  readonly name = "verdict" as const;

  async run<Op extends ControlOperation>(
    serial: string,
    op: Op,
    ctx: ChannelContext,
  ): Promise<ControlResult<Op["op"]>> {
    if (op.op === "seed" || op.op === "sql_named") {
      const reserved = Object.keys(op.op === "seed" ? op.params : op.params ?? {}).find(
        (key) => VERDICT_RESERVED_PARAMS.has(key) || (op.op === "sql_named" && key === "name"),
      );
      if (reserved) {
        return {
          ok: false,
          code: "INVALID_PARAM",
          detail: `${op.op} parametresi reserved envelope alanını kullanıyor: ${reserved}`,
        } as ControlResult<Op["op"]>;
      }
    }

    let nonce: string;
    try {
      nonce = secureNonce();
    } catch (err) {
      return {
        ok: false,
        code: "CHANNEL_UNAVAILABLE",
        detail: err instanceof Error ? err.message : String(err),
      } as ControlResult<Op["op"]>;
    }

    const isDump =
      op.op === "get_run" ||
      op.op === "get_command_result" ||
      op.op === "get_screen_state";
    const receiverOp = isDump
      ? null
      : (op as Exclude<ControlOperation, VerdictDumpOperation>);
    let sidecars: SensitiveSidecar[] = [];
    if (receiverOp) {
      try {
        sidecars = verdictSensitiveSidecars(receiverOp, nonce);
        if (sidecars.length > 0) {
          await ctx.adb(
            serial,
            sensitiveSidecarDirectoryArgs(serial, ctx.applicationId),
            SENSITIVE_SIDECAR_TIMEOUT_MS,
          );
        }
        for (const sidecar of sidecars) {
          await ctx.adb(
            serial,
            sensitiveSidecarWriteArgs(
              serial,
              ctx.applicationId,
              sidecar.fileName,
            ),
            SENSITIVE_SIDECAR_TIMEOUT_MS,
            sidecar.value,
          );
        }
      } catch (err) {
        for (const sidecar of sidecars) {
          try {
            await ctx.adb(
              serial,
              sensitiveSidecarDeleteArgs(
                serial,
                ctx.applicationId,
                sidecar.fileName,
              ),
              SENSITIVE_SIDECAR_TIMEOUT_MS,
            );
          } catch {
            // The receiver also deletes on every read path; this is best-effort rollback.
          }
        }
        const raw = err instanceof Error ? err.message : String(err);
        invalidateDetectedChannel(serial, ctx);
        return {
          ok: false,
          code: "CHANNEL_UNAVAILABLE",
          detail: scrubSecrets(raw, op),
        } as ControlResult<Op["op"]>;
      }
    }
    const sensitiveFiles = new Map(
      sidecars.map((sidecar) => [sidecar.field, sidecar.fileName] as const),
    );
    const args = isDump
      ? verdictDumpArgs(
          serial,
          op as VerdictDumpOperation,
          ctx,
          nonce,
        )
      : verdictBroadcastArgs(
          serial,
          op as Exclude<ControlOperation, VerdictDumpOperation>,
          ctx,
          nonce,
          sensitiveFiles,
        );

    let stdout: string;
    try {
      stdout = await ctx.adb(
        serial,
        args,
        isDump ? VERDICT_DUMP_TIMEOUT_MS : BROADCAST_TIMEOUT_MS,
      );
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      invalidateDetectedChannel(serial, ctx);
      return {
        ok: false,
        code: "CHANNEL_UNAVAILABLE",
        detail: scrubSecrets(raw, op),
      } as ControlResult<Op["op"]>;
    } finally {
      for (const sidecar of sidecars) {
        try {
          await ctx.adb(
            serial,
            sensitiveSidecarDeleteArgs(
              serial,
              ctx.applicationId,
              sidecar.fileName,
            ),
            SENSITIVE_SIDECAR_TIMEOUT_MS,
          );
        } catch {
          // Receiver deletion is authoritative; host cleanup only covers failed delivery.
        }
      }
    }

    const pending = isDump
      ? {
          resultCode: null,
          dataJson: null,
          extrasJson: firstVerdictJson(stdout),
          resultType: null,
          nonce: null,
        }
      : parseVerdictPendingResult(stdout);
    if (
      pending.dataJson &&
      pending.extrasJson &&
      pending.dataJson !== pending.extrasJson
    ) {
      invalidateDetectedChannel(serial, ctx);
      return {
        ok: false,
        code: "PROTOCOL_VIOLATION",
        detail: "resultData / verdict.result.json uyuşmuyor",
      } as ControlResult<Op["op"]>;
    }
    const result = decodeVerdict(
      op,
      pending.dataJson ?? pending.extrasJson,
      nonce,
      pending,
      stdout,
    );
    if (
      !result.ok &&
      (result.code === "CHANNEL_UNAVAILABLE" ||
        result.code === "PROTOCOL_VIOLATION")
    ) {
      invalidateDetectedChannel(serial, ctx);
    }
    return !result.ok && result.detail
      ? ({
          ...result,
          detail: scrubSecrets(result.detail, op),
        } as ControlResult<Op["op"]>)
      : result;
  }
}

/** Mobil watchdog `GET_STATE`'i 5 s'de bitirir; broadcast'e biraz pay bırak. */
const BROADCAST_TIMEOUT_MS = 15_000;
/** DumpProvider kendi içinde 1 s hard limit uygular; framework aktarımına pay. */
const VERDICT_DUMP_TIMEOUT_MS = 3_000;
/** Private sidecar stage/cleanup contains only one short value. */
const SENSITIVE_SIDECAR_TIMEOUT_MS = 5_000;

/**
 * Bir op'un ÇALIŞTIRILMAYAN, kopyala-yapıştır önizleme komutunu üretir.
 *
 * Debug View'ın "commands" sekmesi kullanıcıya terminale yazabileceği Verdict
 * komutunu gösterir. Hassas sidecar gerektiren işlemler için eksik veya sır
 * sızdıran bir komut üretmek yerine `null` döner.
 *
 * ⚠️ Bu fonksiyon bir taşıma değil, bir GÖSTERİM. Gerçek çağrı
 * `VerdictChannel`dan geçer.
 */
export function previewCommand(
  op: ControlOperation,
  ctx: { applicationId: string; serial?: string },
): string | null {
  const serial = ctx.serial ?? "";
  const nonce = "preview";
  const isDump =
    op.op === "get_run" ||
    op.op === "get_command_result" ||
    op.op === "get_screen_state";
  if (!isDump) {
    const receiverOp = op as Exclude<ControlOperation, VerdictDumpOperation>;
    if (verdictSensitiveSidecars(receiverOp, nonce).length > 0) return null;
    return [
      "adb",
      ...verdictBroadcastArgs(serial, receiverOp, ctx, nonce, new Map()),
    ].join(" ");
  }
  return [
    "adb",
    ...verdictDumpArgs(serial, op as VerdictDumpOperation, ctx, nonce),
  ].join(" ");
}

// ---------------------------------------------------------------------------
//  KANAL TESPİTİ  (C.9 / Faz 4.3b)
// ---------------------------------------------------------------------------

export type ChannelKind = "verdict";
const detectedChannels = new Set<string>();

function detectionKey(serial: string, applicationId: string): string {
  return `${serial}\u0000${applicationId}`;
}

/**
 * Device worker cache'ini kanal/protokol hatasında düşürür.
 * `ctx` yoksa serial'ın tüm flavor kayıtları temizlenir.
 */
export function invalidateDetectedChannel(
  serial: string,
  ctx?: Pick<ChannelContext, "applicationId">,
): void {
  if (ctx) {
    detectedChannels.delete(detectionKey(serial, ctx.applicationId));
    return;
  }
  const prefix = `${serial}\u0000`;
  for (const key of detectedChannels.keys()) {
    if (key.startsWith(prefix)) detectedChannels.delete(key);
  }
}

/**
 * Hangi kanal kullanılacak?
 *
 * **Exit code'a GÜVENİLMEZ** (C.9): `am broadcast` yetkisiz durumda bile `0`
 * döner. Tespit **nonce'lı ordered result** ile yapılır:
 *
 * ```
 * VERDICT_CMD ping { nonce: <rastgele> }
 *   → yanıtta AYNI nonce geri geldi mi?  EVET → verdict
 *   → timeout / nonce uyuşmuyor / yanıt yok → açık hata (fail closed)
 * ```
 *
 * Yalnız kanıtlanmış Verdict sonucu device worker ömrü boyunca cache'lenir.
 * Kanal hatasında cache invalidate edilir ve tespit tekrarlanır.
 */
export async function detectChannel(
  serial: string,
  ctx: ChannelContext,
): Promise<ChannelKind> {
  const key = detectionKey(serial, ctx.applicationId);
  if (detectedChannels.has(key)) return "verdict";

  let nonce: string;
  let stdout: string;
  try {
    nonce = secureNonce();
    stdout = await ctx.adb(
      serial,
      [
        ...(serial ? ["-s", serial] : []),
        "shell",
        "am",
        "broadcast",
        // Capability detection must also work before a recovery `set_run`.
        "--include-stopped-packages",
        "-n",
        `${ctx.applicationId}/${VERDICT_CONTROL_RECEIVER}`,
        "-a",
        `${ctx.applicationId}${VERDICT_ACTION_SUFFIX}`,
        ...es("op", "ping"),
        ...es("cmd", "ping"),
        ...es("requestId", nonce),
        ...es("scope", "verdict-detect"),
        ...es("nonce", nonce),
      ],
      DETECT_TIMEOUT_MS,
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Verdict channel detection failed for ${ctx.applicationId} on ${serial || "default device"}: ${detail}`,
    );
  }

  const pending = parseVerdictPendingResult(stdout);
  let jsonNonce: string | null = null;
  for (const candidate of [pending.dataJson, pending.extrasJson]) {
    if (!candidate) continue;
    try {
      const parsed = asJsonObject(JSON.parse(candidate));
      if (typeof parsed?.nonce === "string") {
        jsonNonce = parsed.nonce;
        break;
      }
    } catch {
      // Ordered-result extras nonce below can still prove the response.
    }
  }
  const proofNonce = pending.nonce ?? jsonNonce;
  if (proofNonce !== nonce) {
    throw new Error(
      `Verdict channel detection failed for ${ctx.applicationId} on ${serial || "default device"}: ` +
        (proofNonce ? "ping nonce mismatch" : "ping nonce proof missing"),
    );
  }

  detectedChannels.add(key);
  return "verdict";
}

export const channelFor = (kind: ChannelKind): ControlChannel => {
  if ((kind as string) !== "verdict") {
    throw new Error(`Unsupported control channel: ${String(kind)}; Verdict is required`);
  }
  return new VerdictChannel();
};

const DETECT_TIMEOUT_MS = 10_000;
