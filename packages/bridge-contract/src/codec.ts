/**
 * ===========================================================================
 *  ENVELOPE CODEC  (Plan D.3)
 *
 *  Wire ile tip sistemi arasındaki TEK geçiş noktası. Ayrı bir dosya olması
 *  kasıtlı: `JSON.parse` sonucunu bir `BridgeResultEnvelope` gibi kullanmak
 *  derleyicinin şikâyet etmediği ama tamamen dayanaksız bir iddiadır, ve o
 *  iddianın repo içinde tek bir yerde yapılması gerekiyor.
 *
 *  ## Bilinmeyen alanlar KORUNUR, bilinmeyen frame'ler REDDEDİLİR
 *
 *  İkisi farklı kararlar:
 *
 *  - Cihaz ileride yanıta yeni bir alan eklerse (additive), host onu düşürmez.
 *    Düşürmek teşhisi sessizce zayıflatır: yeni bir `platformErrorCode`
 *    eklendiğinde host onu görmezse arıza sebebi kaybolur.
 *  - Ama İSTENMEMİŞ bir frame (bilinmeyen `requestId`, ya da hiç `requestId`
 *    olmayan bir push) fail-closed reddedilir. Protocol v1'de unsolicited push
 *    YOKTUR (RUN_PLAY §14.7); toleranslı davranmak, ileride yanlışlıkla
 *    eklenen bir push'un sessizce yutulmasına yol açardı.
 * ===========================================================================
 */
import {
  BRIDGE_MAX_FRAME_BYTES,
  BRIDGE_PROTOCOL_VERSION,
  type BridgeCommandEnvelope,
  type BridgeResultEnvelope,
} from "./protocol.js";

/** Komut zarfını tek satır NDJSON'a çevirir. */
export function encodeCommand(envelope: BridgeCommandEnvelope): string {
  if (envelope.requestId.trim() === "") {
    // Cihaz da reddederdi (`missing_request_id`), ama bir round-trip harcamak
    // ve hatayı uzakta görmek yerine burada patlamak teşhisi kolaylaştırır.
    throw new Error("requestId must be a non-empty string");
  }
  if (!Number.isInteger(envelope.runEpoch) || envelope.runEpoch <= 0) {
    throw new Error(`runEpoch must be a positive integer, got ${String(envelope.runEpoch)}`);
  }

  const wire: Record<string, unknown> = {
    requestId: envelope.requestId,
    protocolVersion: envelope.protocolVersion,
    command: envelope.command,
    runId: envelope.runId,
    sessionId: envelope.sessionId,
    runEpoch: envelope.runEpoch,
    ...(envelope.params ?? {}),
  };

  const line = JSON.stringify(wire);
  if (line.includes("\n")) {
    // NDJSON'da satır sonu çerçeve ayırıcısıdır. `JSON.stringify` bunu üretmez
    // (kaçırır), ama iddiayı test edilebilir kılmak için kontrol ediliyor.
    throw new Error("encoded command contains a newline; NDJSON framing would break");
  }
  return line;
}

export type DecodeFailureReason =
  | "INVALID_JSON"
  | "NOT_AN_OBJECT"
  | "MISSING_OK"
  | "MISSING_REQUEST_ID"
  | "PROTOCOL_VERSION_MISMATCH"
  | "FRAME_TOO_LARGE";

export type DecodeResult =
  | { ok: true; envelope: BridgeResultEnvelope }
  | { ok: false; reason: DecodeFailureReason; detail: string };

/**
 * Bir NDJSON satırını yanıt zarfına çözer.
 *
 * `requestId` yokluğu REDDEDİLİR. Cihaz bazı envelope hatalarında
 * `requestId: null` döndürebilir (`invalid_json`, `missing_request_id`) — o
 * durumda satır bir yanıt değil, bir protokol şikâyetidir ve pending map'te
 * eşleşeceği bir istek yoktur. Onu "yanıt" gibi kabul etmek, hangi isteğin
 * başarısız olduğunu bilmeden bir isteği çözmek olurdu.
 */
export function decodeResult(line: string, maxBytes = BRIDGE_MAX_FRAME_BYTES): DecodeResult {
  if (Buffer.byteLength(line, "utf8") > maxBytes) {
    return {
      ok: false,
      reason: "FRAME_TOO_LARGE",
      detail: `frame exceeds ${maxBytes} bytes`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch (err) {
    return {
      ok: false,
      reason: "INVALID_JSON",
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "NOT_AN_OBJECT", detail: `expected a JSON object, got ${typeof parsed}` };
  }

  const record = parsed as Record<string, unknown>;

  if (typeof record.ok !== "boolean") {
    return { ok: false, reason: "MISSING_OK", detail: "response has no boolean `ok` field" };
  }
  if (typeof record.requestId !== "string" || record.requestId === "") {
    return {
      ok: false,
      reason: "MISSING_REQUEST_ID",
      detail:
        "response has no usable requestId; protocol v1 has no unsolicited push, so an " +
        "unaddressed frame cannot be matched to a pending request and is refused",
    };
  }
  if (record.protocolVersion !== undefined && record.protocolVersion !== BRIDGE_PROTOCOL_VERSION) {
    return {
      ok: false,
      reason: "PROTOCOL_VERSION_MISMATCH",
      detail: `expected protocolVersion ${BRIDGE_PROTOCOL_VERSION}, got ${String(record.protocolVersion)}`,
    };
  }

  // `monoTs` yokluğu hata değil: bazı envelope hatalarında cihaz onu koyar ama
  // güvenmek zorunda değiliz. Eksikse 0 kabul edilir ve alan korunur.
  const envelope = {
    ...record,
    ok: record.ok,
    requestId: record.requestId,
    monoTs: typeof record.monoTs === "number" ? record.monoTs : 0,
    protocolVersion:
      typeof record.protocolVersion === "number" ? record.protocolVersion : BRIDGE_PROTOCOL_VERSION,
  } as BridgeResultEnvelope;

  return { ok: true, envelope };
}

/**
 * Hassas alanları maskeleyerek loglanabilir bir özet üretir.
 *
 * `input_text` metni ve `screenshot` verisi ASLA loglanmaz: birincisi parola/
 * TC kimlik/adres olabilir, ikincisi ekranın tamamıdır. Bunları "sadece debug
 * için" loglamak, log toplayıcıya kişisel veri sızdırmanın en yaygın yoludur.
 */
export function redactForLog(envelope: BridgeCommandEnvelope | BridgeResultEnvelope): string {
  const record = envelope as Record<string, unknown>;
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === "data" || key === "text" || key === "value" || key === "params") {
      safe[key] = typeof value === "string" ? `«${String(value.length)} chars redacted»` : "«redacted»";
      continue;
    }
    if (typeof value === "string" && value.length > 120) {
      safe[key] = `«${String(value.length)} chars truncated»`;
      continue;
    }
    safe[key] = value;
  }
  return JSON.stringify(safe);
}
