/**
 * ===========================================================================
 *  BRIDGE CONTRACT — sözleşme, parite ve yasak testleri
 *
 *  Bu suite'in en önemli işi bir REGRESYON KORUMASI: sözleşmenin cihazdaki
 *  gerçek protokolden ayrışmasını yakalamak. Host tarafında bir tip eklemek
 *  bedava; o tipin cihazda karşılığı olmadığını fark etmek ise gerçek DUT'ta
 *  `unsupported_command` almakla olur. Aşağıdaki parite testleri o anı öne
 *  çeker.
 * ===========================================================================
 */
import { describe, expect, it } from "vitest";

import {
  ADMISSION_LANES,
  BRIDGE_ACTION_METHODS,
  BRIDGE_COMMANDS,
  BRIDGE_DEVICE_PORT,
  BRIDGE_ERROR_CODES,
  BRIDGE_HOST_ERROR_CODES,
  BRIDGE_LIMITS,
  BRIDGE_MAX_FRAME_BYTES,
  BRIDGE_NOT_MEASURED,
  BRIDGE_PROTOCOL_VERSION,
  BRIDGE_V1_DEVICE_GAPS,
  BridgeActionLifecycle,
  DEFAULT_WAIT_CANDIDATE_LIMIT,
  LANE_CONCURRENCY,
  LANE_PRIORITY,
  admitDeviceCommand,
  admitMutationTarget,
  canClaimDevice,
  classifyDeviceError,
  cancelScopeFor,
  classifyInteractionOrigin,
  clampSwipeDurationMs,
  clampTapTimeoutMs,
  clampWaitTimeoutMs,
  decodeResult,
  capabilityManifestFromDeviceResponse,
  deriveCapabilityManifest,
  deviceReleaseByMs,
  dumpScopeToParams,
  encodeCommand,
  fingerprintStrength,
  isBridgeCommand,
  isMeasured,
  isMutationCommand,
  isPersistentTarget,
  isRetryableDeviceError,
  isRetryableHostError,
  laneForCommand,
  mayActOnResolution,
  mayAutoRetry,
  looksLikeMillisecondEpoch,
  monotonicRunEpoch,
  HOST_SUPPORTS_WAIT_ANY,
  planWaitExecution,
  redactForLog,
  validateWaitPlan,
  waitNodeParams,
  type BridgeCommandEnvelope,
  type TargetFingerprint,
  type UiWaitPlan,
} from "./index.js";

const scope = { runId: "run-1", sessionId: "sess-1", runEpoch: 1 };

const cmd = (
  command: BridgeCommandEnvelope["command"],
  params?: Record<string, unknown>,
): BridgeCommandEnvelope => ({
  ...scope,
  requestId: "req-1",
  protocolVersion: BRIDGE_PROTOCOL_VERSION,
  command,
  ...(params === undefined ? {} : { params }),
});

// ===========================================================================
//  Cihazla parite
// ===========================================================================

describe("device protocol parity", () => {
  it("pins protocol version, loopback port and frame ceiling", () => {
    // ProtocolV1.kt → VERSION = 1 ; BridgeTcpServer.kt → PORT = 9876
    expect(BRIDGE_PROTOCOL_VERSION).toBe(1);
    expect(BRIDGE_DEVICE_PORT).toBe(9876);
    expect(BRIDGE_MAX_FRAME_BYTES).toBeGreaterThan(1024 * 1024);
  });

  it("carries EXACTLY the commands the device dispatches", () => {
    // ProtocolV1.dispatchCommand'ın `when` bloğunun birebir kopyası. Buraya bir
    // komut eklemek, cihazda karşılığı olmadan eklenirse gerçek DUT'ta
    // `unsupported_command` demektir — bu test o anı öne çeker.
    expect([...BRIDGE_COMMANDS].sort()).toEqual(
      [
        "activate_id",
        "back",
        "cancel_request",
        "capabilities",
        "collection_info",
        "dump",
        "find_id",
        "find_text",
        "handshake",
        "input_text",
        "ping",
        "screenshot",
        "scroll_to_item",
        "swipe",
        "tap_id",
        "tap_text",
        "wait_any",
        "wait_node",
      ].sort(),
    );
  });

  it("claims wait_any/cancel/capabilities after Mobile M3; still rejects push/register_watch", () => {
    expect(BRIDGE_V1_DEVICE_GAPS.waitAny).toBe(true);
    expect(BRIDGE_V1_DEVICE_GAPS.cancelRequest).toBe(true);
    expect(BRIDGE_V1_DEVICE_GAPS.capabilitiesCommand).toBe(true);
    // Bu sonuncusu İSTENEN durumdur: B2 request-response kalır.
    expect(BRIDGE_V1_DEVICE_GAPS.unsolicitedPush).toBe(false);
    expect(isBridgeCommand("wait_any")).toBe(true);
    expect(isBridgeCommand("cancel_request")).toBe(true);
    expect(isBridgeCommand("capabilities")).toBe(true);
    expect(isBridgeCommand("register_watch")).toBe(false);
  });

  it("pins the device limit constants", () => {
    expect(BRIDGE_LIMITS.maxWaitTimeoutMs).toBe(120_000);
    expect(BRIDGE_LIMITS.deviceWaitPollIntervalMs).toBe(50);
    expect(BRIDGE_LIMITS.maxTapTimeoutMs).toBe(10_000);
    expect(BRIDGE_LIMITS.maxSwipeDurationMs).toBe(10_000);
    expect(BRIDGE_LIMITS.requestIdCacheTtlMs).toBe(300_000);
  });

  it("carries every device error code and keeps host codes separate", () => {
    for (const code of [
      "invalid_json",
      "missing_request_id",
      "unsupported_protocol_version",
      "missing_command",
      "unsupported_command",
      "handshake_required",
      "request_id_conflict",
      "internal_error",
      "interrupted",
      "stale_run",
      "wrong_session",
      "root_unavailable",
      "tree_access_unavailable",
      "stale_tree",
      "not_found",
      "ambiguous",
      "timeout",
      "action_unavailable",
    ]) {
      expect(BRIDGE_ERROR_CODES).toContain(code);
    }
    // Host kodları cihaz kodlarıyla KARIŞMAZ: bir teşhis okuyan kişi "bunu
    // cihaz mı söyledi, host mu uydurdu" sorusunu ayırt edebilmeli.
    for (const hostCode of BRIDGE_HOST_ERROR_CODES) {
      expect(BRIDGE_ERROR_CODES).not.toContain(hostCode);
    }
  });

  it("treats runEpoch as a TAKEOVER token, not just a fencing field", () => {
    // Gerçek cihaza karşı ilk smoke'ta öğrenildi: handshake `stale_run` ile
    // reddedildi çünkü cihazda önceki bir oturumdan kalan aktif scope vardı.
    // `ProtocolV1.activateScope`: yüksek epoch DEVRALIR, eşit/düşük REDDEDİLİR.
    expect(canClaimDevice(5, null)).toEqual({ claim: true });
    expect(canClaimDevice(6, 5)).toEqual({ claim: true });
    expect(canClaimDevice(5, 5)).toEqual({ claim: false, reason: "STALE_EPOCH", minimumEpoch: 6 });
    expect(canClaimDevice(4, 5)).toEqual({ claim: false, reason: "STALE_EPOCH", minimumEpoch: 6 });
  });

  it("generates a MILLISECOND epoch — a second-based one can never take over", () => {
    // Gerçek cihazda yaşandı: aktif scope `runEpoch=1785610650611` (milisaniye)
    // tutuyordu ve saniye tabanlı bir epoch sonsuza kadar `stale_run` alıyordu.
    // Devralma `>` karşılaştırması olduğu için birimi büyük seçen, küçük seçeni
    // kalıcı olarak dışarıda bırakıyor.
    const earlier = monotonicRunEpoch(1_760_000_000_000);
    const later = monotonicRunEpoch(1_760_000_005_000);
    expect(later).toBeGreaterThan(earlier);
    expect(Number.isInteger(earlier)).toBe(true);
    expect(looksLikeMillisecondEpoch(earlier)).toBe(true);

    // Sahadaki gerçek değer devralınabilir olmalı.
    const observedInTheField = 1_785_610_650_611;
    expect(canClaimDevice(monotonicRunEpoch(Date.now()), observedInTheField).claim).toBe(true);
    // Saniye tabanlı bir epoch onu devralAMAZ — bu testin koruduğu regresyon.
    expect(canClaimDevice(Math.floor(Date.now() / 1000), observedInTheField).claim).toBe(false);
    expect(looksLikeMillisecondEpoch(Math.floor(Date.now() / 1000))).toBe(false);
  });

  it("classifies dynamic missing_*/invalid_* codes structurally", () => {
    // Cihaz kodları `missing_$key`/`invalid_$key` şablonuyla ÜRETİR, yani
    // taksonomi alan adları kadar açık uçlu. Kapalı bir union'a bağlanmak,
    // yarın eklenen bir alanın hatasını "beklenmeyen hata"ya çevirip hangi
    // alanın hatalı olduğunu kaybetmek olurdu.
    expect(classifyDeviceError("stale_run")).toEqual({ family: "SCOPE" });
    expect(classifyDeviceError("ambiguous")).toEqual({ family: "SELECTION" });
    expect(classifyDeviceError("timeout")).toEqual({ family: "WAIT" });
    // Gerçek cihazda görülenler:
    expect(classifyDeviceError("invalid_match_by")).toEqual({ family: "PARAMETER", field: "match_by" });
    expect(classifyDeviceError("missing_value")).toEqual({ family: "PARAMETER", field: "value" });
    expect(classifyDeviceError("invalid_until")).toEqual({ family: "PARAMETER", field: "until" });
    // Henüz var olmayan bir alan bile yapısal olarak tanınır.
    expect(classifyDeviceError("invalid_somethingNew")).toEqual({
      family: "PARAMETER",
      field: "somethingNew",
    });
    // Şablona UYMAYAN bir kod dürüstçe UNKNOWN döner. `PARAMETER` demek,
    // hakkında hiçbir şey bilmediğimiz bir kodu bir alan hatası gibi
    // göstermek olurdu.
    expect(classifyDeviceError("totally_new_failure_mode")).toEqual({ family: "UNKNOWN" });
  });

  it("pins the four action-method evidence values", () => {
    expect([...BRIDGE_ACTION_METHODS]).toEqual(["gesture", "semantic", "global", "capture"]);
  });

  it("pins the not_measured sentinel and keeps it distinct from false", () => {
    expect(BRIDGE_NOT_MEASURED).toBe("not_measured");
    // "ölçemedim" ile "hayır" aynı şey değil; ikincisine yuvarlamak ölçüm
    // boşluğunu ürün bulgusuna çevirir.
    expect(isMeasured(false)).toBe(true);
    expect(isMeasured(BRIDGE_NOT_MEASURED)).toBe(false);
  });
});

// ===========================================================================
//  Domain sızıntısı
// ===========================================================================

describe("domain leakage guard", () => {
  it("contains no business concept anywhere in the exported surface", async () => {
    // Sözleşmenin tamamını metin olarak tarar: bir tip adı, bir union üyesi ya
    // da bir yorum satırı olarak sızması fark etmez, hepsi aynı ihlaldir.
    const modules = await Promise.all([
      import("./protocol.js"),
      import("./targets.js"),
      import("./lifecycle.js"),
      import("./wait.js"),
      import("./admission.js"),
      import("./codec.js"),
    ]);
    const surface = JSON.stringify(
      modules.map((m) => Object.entries(m).map(([k, v]) => [k, typeof v === "function" ? "fn" : v])),
    ).toUpperCase();

    for (const forbidden of [
      "OPEN_STOP",
      "APPROVE_TOUR",
      "COURIER_LOGIN",
      "PARCEL",
      '"STOP"',
      '"TOUR"',
    ]) {
      expect(surface).not.toContain(forbidden);
    }
  });
});

// ===========================================================================
//  Envelope codec
// ===========================================================================

describe("envelope codec", () => {
  it("encodes scope and params flat, the way the device parses them", () => {
    const line = encodeCommand(cmd("tap_id", { value: "btn_ok", exact: true }));
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(parsed).toMatchObject({
      requestId: "req-1",
      protocolVersion: 1,
      command: "tap_id",
      runId: "run-1",
      sessionId: "sess-1",
      runEpoch: 1,
      // Cihaz params'ı nested değil ÜST SEVİYEDE okur (`request.opt("value")`).
      value: "btn_ok",
      exact: true,
    });
    expect(line).not.toContain("\n");
  });

  it("refuses a blank requestId and a non-positive epoch before spending a round-trip", () => {
    expect(() => encodeCommand({ ...cmd("ping"), requestId: "  " })).toThrow(/non-empty/);
    expect(() => encodeCommand({ ...cmd("ping"), runEpoch: 0 })).toThrow(/positive integer/);
    // parseRunScope kesirli epoch'u da reddeder.
    expect(() => encodeCommand({ ...cmd("ping"), runEpoch: 1.5 })).toThrow(/positive integer/);
  });

  it("decodes a device response and PRESERVES unknown additive fields", () => {
    const result = decodeResult(
      JSON.stringify({
        ok: true,
        requestId: "req-1",
        monoTs: 123,
        protocolVersion: 1,
        treeGen: 7,
        // Cihazın ileride ekleyebileceği bir alan. Düşürmek teşhisi sessizce
        // zayıflatır.
        futurePlatformHint: "something-new",
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.envelope.treeGen).toBe(7);
    expect(result.envelope.futurePlatformHint).toBe("something-new");
  });

  it("rejects malformed, non-object and version-mismatched frames", () => {
    expect(decodeResult("{not json")).toMatchObject({ ok: false, reason: "INVALID_JSON" });
    expect(decodeResult("[1,2]")).toMatchObject({ ok: false, reason: "NOT_AN_OBJECT" });
    expect(decodeResult('"a string"')).toMatchObject({ ok: false, reason: "NOT_AN_OBJECT" });
    expect(decodeResult(JSON.stringify({ requestId: "r", monoTs: 1 }))).toMatchObject({
      ok: false,
      reason: "MISSING_OK",
    });
    expect(
      decodeResult(JSON.stringify({ ok: true, requestId: "r", protocolVersion: 2 })),
    ).toMatchObject({ ok: false, reason: "PROTOCOL_VERSION_MISMATCH" });
  });

  it("refuses an unaddressed frame — protocol v1 has no unsolicited push", () => {
    // register_watch/push negatif testi: adressiz bir frame pending map'te
    // eşleşemez, dolayısıyla toleranslı davranmak onu sessizce yutmak olurdu.
    expect(decodeResult(JSON.stringify({ ok: true, requestId: null, monoTs: 1 }))).toMatchObject({
      ok: false,
      reason: "MISSING_REQUEST_ID",
    });
    expect(decodeResult(JSON.stringify({ ok: true, event: "node_appeared" }))).toMatchObject({
      ok: false,
      reason: "MISSING_REQUEST_ID",
    });
  });

  it("rejects an oversized frame instead of buffering it", () => {
    const huge = JSON.stringify({ ok: true, requestId: "r", monoTs: 1, data: "x".repeat(2048) });
    expect(decodeResult(huge, 512)).toMatchObject({ ok: false, reason: "FRAME_TOO_LARGE" });
  });

  it("never logs typed text or screenshot bytes", () => {
    // Bunlar parola, kimlik numarası veya ekranın tamamı olabilir. "Sadece
    // debug için" loglamak, log toplayıcıya kişisel veri sızdırmanın en yaygın
    // yoludur.
    const logged = redactForLog({
      ok: true,
      requestId: "req-1",
      monoTs: 1,
      protocolVersion: 1,
      data: "iVBORw0KGgoAAAANS".repeat(50),
      text: "hunter2-secret",
    });
    expect(logged).not.toContain("hunter2");
    expect(logged).not.toContain("iVBORw0");
    expect(logged).toContain("redacted");
  });

  it("redacts the typed value of input_text commands too", () => {
    const logged = redactForLog(cmd("input_text", { value: "1234-5678-9012" }));
    expect(logged).not.toContain("1234-5678");
  });
});

// ===========================================================================
//  Hedef çözümleme
// ===========================================================================

describe("target fingerprint", () => {
  const weak: TargetFingerprint = { version: 1, selector: { by: "text", value: "Onayla" }, rowIndexHint: 3 };

  it("rates a row-key fingerprint STRONG and a bare row hint WEAK", () => {
    expect(fingerprintStrength({ version: 1, selector: { by: "id", value: "x" }, rowKey: "k-9" })).toBe(
      "STRONG",
    );
    expect(fingerprintStrength({ version: 1, selector: { by: "id", value: "btn" }, expectedId: "btn" })).toBe(
      "MODERATE",
    );
    expect(fingerprintStrength({ version: 1, selector: { by: "text", value: "" }, rowIndexHint: 2 })).toBe(
      "WEAK",
    );
  });

  it("refuses a mutation whose only identity is a row index", () => {
    // Liste kayarsa aksiyon BAŞKA bir kayda iner ve hiçbir yerde hata çıkmaz —
    // bir şeye dokunuldu ve bir şey oldu.
    expect(isPersistentTarget(weak)).toBe(false);
    const admission = admitMutationTarget(weak);
    expect(admission.accepted).toBe(false);
    if (admission.accepted) return;
    expect(admission.reason).toBe("ROW_INDEX_HINT_NOT_IDENTITY");
    expect(admission.detail).toMatch(/row index is not an identity/);
  });

  it("accepts a row hint when it accompanies a stable row key", () => {
    const strong: TargetFingerprint = { ...weak, rowKey: "entity-42" };
    expect(admitMutationTarget(strong).accepted).toBe(true);
  });

  it("permits an action ONLY on a unique resolution", () => {
    const base = { fingerprint: weak, strength: "WEAK" } as const;
    expect(mayActOnResolution({ ...base, outcome: "RESOLVED_UNIQUE" })).toBe(true);
    for (const outcome of [
      "AMBIGUOUS",
      "NOT_FOUND",
      "STALE_TREE",
      "TREE_UNAVAILABLE",
      "REJECTED_WEAK_TARGET",
    ] as const) {
      expect(mayActOnResolution({ ...base, outcome })).toBe(false);
    }
  });

  it("clamps timeouts to the device ceilings instead of out-waiting the device", () => {
    expect(clampTapTimeoutMs(999_999)).toBe(BRIDGE_LIMITS.maxTapTimeoutMs);
    expect(clampTapTimeoutMs(undefined)).toBe(BRIDGE_LIMITS.defaultTapTimeoutMs);
    expect(clampTapTimeoutMs(-5)).toBe(BRIDGE_LIMITS.defaultTapTimeoutMs);
    expect(clampWaitTimeoutMs(999_999)).toBe(BRIDGE_LIMITS.maxWaitTimeoutMs);
    expect(clampSwipeDurationMs(999_999)).toBe(BRIDGE_LIMITS.maxSwipeDurationMs);
  });

  it("emits the dump scope shape the device parses, with no full fallback", () => {
    expect(dumpScopeToParams({ kind: "full" })).toEqual({ scope: "full" });
    expect(dumpScopeToParams({ kind: "depth", maxDepth: 2 })).toEqual({ scope: "depth", maxDepth: 2 });
    expect(dumpScopeToParams({ kind: "subtree", rootId: "list", rowIndex: 4 })).toEqual({
      scope: "subtree",
      rootId: "list",
      rowIndex: 4,
    });
    // Scoped bir dump isteğinin çıktısında "full" GEÇMEZ — fallback yok.
    expect(JSON.stringify(dumpScopeToParams({ kind: "subtree", rootId: "list" }))).not.toContain("full");
  });
});

// ===========================================================================
//  Action lifecycle
// ===========================================================================

describe("action lifecycle", () => {
  const fp: TargetFingerprint = { version: 1, selector: { by: "id", value: "btn_ok" }, rowKey: "k" };

  it("records phases and reaches exactly one terminal state", () => {
    const lc = new BridgeActionLifecycle("req-1", "tap_id", fp);
    lc.mark("ACCEPTED", 1).mark("DISPATCHED", 2).mark("GESTURE_STARTED", 3).mark("GESTURE_COMPLETED", 4);
    const record = lc.finish("SUCCEEDED");
    expect(record.terminalState).toBe("SUCCEEDED");
    expect(record.markers.map((m) => m.phase)).toEqual([
      "ACCEPTED",
      "DISPATCHED",
      "GESTURE_STARTED",
      "GESTURE_COMPLETED",
    ]);
    expect(lc.isTerminal()).toBe(true);
  });

  it("refuses to overwrite a terminal state or append after it", () => {
    // İki kez terminal yazmak SESSİZ bir kanıt kaybıdır: ikinci yazım
    // birincisini ezer ve gerçekte ne olduğu kaybolur.
    const lc = new BridgeActionLifecycle("req-2", "tap_text", fp);
    lc.finish("UNKNOWN_EFFECT", "UNKNOWN_EFFECT");
    expect(() => lc.finish("SUCCEEDED")).toThrow(/already terminal/);
    expect(() => lc.mark("OBSERVED", 9)).toThrow(/already terminal/);
  });

  it("auto-retries ONLY what provably never reached the device", () => {
    expect(mayAutoRetry("REJECTED")).toBe(true);
    // Etki gerçekleşmiş olabilir; tekrar göndermek çift onay üretir.
    expect(mayAutoRetry("UNKNOWN_EFFECT")).toBe(false);
    expect(mayAutoRetry("SUCCEEDED")).toBe(false);
    expect(mayAutoRetry("FAILED")).toBe(false);
    expect(mayAutoRetry("CANCELLED")).toBe(false);
  });

  it("classifies a touch outside the injected window as MANUAL, and no window as UNKNOWN", () => {
    const lc = new BridgeActionLifecycle("req-3", "tap_id", fp);
    lc.mark("GESTURE_STARTED", 1_000).mark("GESTURE_COMPLETED", 1_200);
    const window = lc.injectedGestureWindow();
    expect(window).toEqual({ startMonoTs: 1_000, endMonoTs: 1_200 });
    expect(classifyInteractionOrigin(1_100, window)).toBe("BRIDGE_INJECTED");
    expect(classifyInteractionOrigin(1_500, window)).toBe("MANUAL");
    // "Bizden geldiğini kanıtlayamıyorum" ≠ "kullanıcı dokundu".
    expect(classifyInteractionOrigin(1_100, null)).toBe("UNKNOWN");
  });

  it("has no gesture window until BOTH markers exist", () => {
    const lc = new BridgeActionLifecycle("req-4", "tap_id", fp);
    lc.mark("GESTURE_STARTED", 1_000);
    expect(lc.injectedGestureWindow()).toBeNull();
  });
});

// ===========================================================================
//  Retry sınıflandırması
// ===========================================================================

describe("retry classification", () => {
  it("never retries an unknown-effect mutation", () => {
    expect(isRetryableHostError("UNKNOWN_EFFECT")).toBe(false);
    expect(isRetryableHostError("WAIT_CONNECTION_LOST")).toBe(true);
    expect(isRetryableHostError("HOST_TIMEOUT")).toBe(true);
    expect(isRetryableHostError("BRIDGE_UNAVAILABLE")).toBe(true);
    expect(isRetryableHostError("PROTOCOL_VIOLATION")).toBe(false);
  });

  it("never retries a fencing or selection failure", () => {
    // Fencing kararı değişmez; ağaç aynıysa ambiguity de aynıdır. Retry
    // etmek yalnız aynı cevabı üretir ve gerçek sorunu (selector) gizler.
    expect(isRetryableDeviceError("stale_run")).toBe(false);
    expect(isRetryableDeviceError("wrong_session")).toBe(false);
    expect(isRetryableDeviceError("ambiguous")).toBe(false);
    expect(isRetryableDeviceError("not_found")).toBe(false);
    expect(isRetryableDeviceError("root_unavailable")).toBe(true);
  });

  it("classifies mutation commands correctly — the retry decision depends on it", () => {
    for (const c of ["tap_id", "tap_text", "input_text", "swipe", "back", "activate_id", "scroll_to_item"] as const) {
      expect(isMutationCommand(c)).toBe(true);
    }
    for (const c of ["dump", "find_id", "find_text", "screenshot", "wait_node", "ping"] as const) {
      expect(isMutationCommand(c)).toBe(false);
    }
  });
});

// ===========================================================================
//  wait_any temeli
// ===========================================================================

describe("wait plan", () => {
  const appear = (value: string) => ({
    selector: { by: "id" as const, value },
    until: "APPEAR" as const,
  });

  const plan: UiWaitPlan = {
    timeoutMs: 5_000,
    expected: [{ key: "route", predicate: appear("route_root") }],
    interrupts: [{ key: "error", predicate: appear("error_dialog"), expected: false }],
  };

  it("validates and normalizes a sound plan", () => {
    const result = validateWaitPlan(plan);
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.plan.candidateLimit).toBe(DEFAULT_WAIT_CANDIDATE_LIMIT);
  });

  it("rejects a plan that can only ever time out", () => {
    expect(validateWaitPlan({ timeoutMs: 1_000, expected: [] })).toMatchObject({
      valid: false,
      reason: "NO_EXPECTED_TARGET",
    });
  });

  it("rejects duplicate keys — the result key must identify which condition fired", () => {
    expect(
      validateWaitPlan({
        timeoutMs: 1_000,
        expected: [{ key: "same", predicate: appear("a") }],
        interrupts: [{ key: "same", predicate: appear("b") }],
      }),
    ).toMatchObject({ valid: false, reason: "DUPLICATE_TARGET_KEY" });
  });

  it("rejects an out-of-range timeout or candidate limit", () => {
    expect(validateWaitPlan({ ...plan, timeoutMs: 0 })).toMatchObject({
      valid: false,
      reason: "TIMEOUT_OUT_OF_RANGE",
    });
    expect(validateWaitPlan({ ...plan, candidateLimit: 0 })).toMatchObject({
      valid: false,
      reason: "CANDIDATE_LIMIT_OUT_OF_RANGE",
    });
    expect(validateWaitPlan({ ...plan, candidateLimit: 65 })).toMatchObject({
      valid: false,
      reason: "CANDIDATE_LIMIT_OUT_OF_RANGE",
    });
  });

  it("clamps the plan timeout to the device ceiling", () => {
    const result = validateWaitPlan({ ...plan, timeoutMs: 999_999 });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.plan.timeoutMs).toBe(BRIDGE_LIMITS.maxWaitTimeoutMs);
  });

  it("races wait_node legs when the device lacks wait_any (legacy fallback)", () => {
    const strategy = planWaitExecution(plan, { supportsWaitAny: false });
    expect(strategy.kind).toBe("RACED_WAIT_NODE");
    if (strategy.kind !== "RACED_WAIT_NODE") return;
    // Kesintiler ÖNCE: eşit anda gelen iki yanıtta bir hata dialogunun beklenen
    // hedefe yenilmesi, hatayı başarı olarak raporlamak olurdu.
    expect(strategy.legs[0]).toMatchObject({ key: "error", isInterrupt: true });
    expect(strategy.legs[1]).toMatchObject({ key: "route", isInterrupt: false });
  });

  it("collapses to a single wait_any only when the host implements it too", () => {
    // Çağıran arayüzü değişmeden tek komuta inebilmeli.
    const strategy = planWaitExecution(plan, { supportsWaitAny: true }, true);
    expect(strategy.kind).toBe("SINGLE_WAIT_ANY");
    // Default modern baseline also collapses once the host side is in.
    expect(planWaitExecution(plan, deriveCapabilityManifest(1), true).kind).toBe("SINGLE_WAIT_ANY");
  });

  it("keeps racing wait_node while the host has no wait_any path", () => {
    // Selecting on the device capability alone sent every wait on a real device
    // into a host branch that only throws, killing the run at its first wait.
    expect(planWaitExecution(plan, { supportsWaitAny: true }, false).kind).toBe("RACED_WAIT_NODE");
    // And the shipped default must be the safe one until the branch exists.
    expect(HOST_SUPPORTS_WAIT_ANY).toBe(false);
    expect(planWaitExecution(plan, deriveCapabilityManifest(1)).kind).toBe("RACED_WAIT_NODE");
  });

  it("emits wait_node params the device parses, carrying no dump request", () => {
    const params = waitNodeParams(
      { selector: { by: "text", value: "Devam", exact: false }, until: "DISAPPEAR", stableForMs: 250 },
      3_000,
    );
    // Alan adları CİHAZIN beklediği adlar: `by` (matchBy değil) ve `settleMs`
    // (stableForMs değil). İkisi de gerçek DUT smoke'unda yakalandı.
    expect(params).toEqual({
      by: "text",
      value: "Devam",
      until: "disappear",
      timeoutMs: 3_000,
      exact: false,
      settleMs: 250,
    });
    // Hot path'te full dump YOK (acceptance 17).
    expect(JSON.stringify(params)).not.toContain("scope");
    expect(JSON.stringify(params)).not.toContain("dump");
  });

  it("reports that a cancel only releases the HOST until the device learns cancel_request", () => {
    // Bunu "iptal edildi" diye raporlayıp geçmek yanlış olurdu: aynı hedefe
    // hemen yeni bir bekleme açan çağıran cihazda iki bekleme yaratır.
    expect(cancelScopeFor({ supportsCancelRequest: false })).toBe("HOST_ONLY");
    expect(cancelScopeFor({ supportsCancelRequest: true })).toBe("HOST_AND_DEVICE");
    expect(deviceReleaseByMs(5_000, 1_200)).toBe(3_800);
    expect(deviceReleaseByMs(5_000, 9_000)).toBe(0);
  });
});

// ===========================================================================
//  Admission
// ===========================================================================

describe("command admission", () => {
  it("keeps a single mutation lane and never starves CONTROL", () => {
    expect(LANE_CONCURRENCY.MUTATION).toBe(1);
    expect(LANE_CONCURRENCY.HEAVY_OBS).toBe(1);
    expect(LANE_PRIORITY.CONTROL).toBeGreaterThan(LANE_PRIORITY.WAIT);
    expect(LANE_PRIORITY.CONTROL).toBeGreaterThan(LANE_PRIORITY.MUTATION);
    expect(LANE_PRIORITY.CONTROL).toBe(Math.max(...ADMISSION_LANES.map((l) => LANE_PRIORITY[l])));
  });

  it("routes each command to its lane", () => {
    expect(laneForCommand("ping")).toBe("CONTROL");
    expect(laneForCommand("handshake")).toBe("CONTROL");
    expect(laneForCommand("capabilities")).toBe("CONTROL");
    expect(laneForCommand("cancel_request")).toBe("CONTROL");
    expect(laneForCommand("tap_id")).toBe("MUTATION");
    expect(laneForCommand("input_text")).toBe("MUTATION");
    expect(laneForCommand("wait_node")).toBe("WAIT");
    expect(laneForCommand("wait_any")).toBe("WAIT");
    expect(laneForCommand("find_id")).toBe("OBSERVATION");
    // screenshot her zaman ağır: base64 PNG'yi yanıtın içinde taşır.
    expect(laneForCommand("screenshot")).toBe("HEAVY_OBS");
    // Aynı komut adının iki maliyeti olabilir; karar çağıranın.
    expect(laneForCommand("dump")).toBe("OBSERVATION");
    expect(laneForCommand("dump", true)).toBe("HEAVY_OBS");
  });

  it("denies an Inspector mutation while a run owns the device", () => {
    const decision = admitDeviceCommand(
      {
        deviceId: "dev-1",
        command: "tap_id",
        lane: "MUTATION",
        requestId: "r",
        actorKind: "INSPECTOR",
      },
      { activeRunId: "run-9", deviceReady: true },
    );
    expect(decision.admitted).toBe(false);
    if (decision.admitted) return;
    expect(decision.reason).toBe("ACTIVE_RUN_MUTATION_LOCK");
    // Devralma mümkün ama AÇIK olmak zorunda.
    expect(decision.overridable).toBe(true);
    expect(decision.detail).toMatch(/contaminate/);
  });

  it("allows an Inspector mutation under explicit takeover", () => {
    expect(
      admitDeviceCommand(
        {
          deviceId: "dev-1",
          command: "tap_id",
          lane: "MUTATION",
          requestId: "r",
          actorKind: "INSPECTOR",
          takeover: true,
        },
        { activeRunId: "run-9", deviceReady: true },
      ).admitted,
    ).toBe(true);
  });

  it("never lets one automated run take over another's mutation lane", () => {
    const decision = admitDeviceCommand(
      {
        deviceId: "dev-1",
        command: "tap_id",
        lane: "MUTATION",
        requestId: "r",
        runId: "run-2",
        actorKind: "AUTOMATED_RUN",
        // Bir otomatik koşu devralamaz: devralma insan kararıdır.
        takeover: true,
      },
      { activeRunId: "run-9", deviceReady: true },
    );
    expect(decision.admitted).toBe(false);
    if (decision.admitted) return;
    expect(decision.overridable).toBe(false);
  });

  it("admits observation and control even while a foreign run holds the device", () => {
    for (const [command, lane] of [
      ["find_id", "OBSERVATION"],
      ["ping", "CONTROL"],
      ["wait_node", "WAIT"],
    ] as const) {
      expect(
        admitDeviceCommand(
          { deviceId: "d", command, lane, requestId: "r", runId: "run-2", actorKind: "AUTOMATED_RUN" },
          { activeRunId: "run-9", deviceReady: true },
        ).admitted,
      ).toBe(true);
    }
  });

  it("fails closed when the device has not passed preflight", () => {
    const decision = admitDeviceCommand(
      { deviceId: "d", command: "find_id", lane: "OBSERVATION", requestId: "r", actorKind: "SYSTEM" },
      { activeRunId: null, deviceReady: false },
    );
    expect(decision.admitted).toBe(false);
    if (decision.admitted) return;
    expect(decision.reason).toBe("DEVICE_NOT_READY");
    expect(decision.overridable).toBe(false);
  });
});

// ===========================================================================
//  Capability manifest
// ===========================================================================

describe("capability manifest", () => {
  it("derives the modern Mobile M3 baseline from the protocol version", () => {
    const manifest = deriveCapabilityManifest(1);
    expect(manifest.protocolVersion).toBe(1);
    expect(manifest.commands).toEqual(BRIDGE_COMMANDS);
    expect(manifest.supportsWaitAny).toBe(true);
    expect(manifest.supportsCancelRequest).toBe(true);
    expect(manifest.supportsUnsolicitedPush).toBe(false);
    expect(manifest.limits.maxWaitTimeoutMs).toBe(120_000);
  });

  it("parses a device capabilities response and drops unknown commands", () => {
    const manifest = capabilityManifestFromDeviceResponse({
      protocolVersion: 1,
      commands: ["wait_any", "cancel_request", "capabilities", "register_watch", "ping"],
      supportsWaitAny: true,
      supportsCancelRequest: true,
      supportsUnsolicitedPush: false,
      limits: { maxWaitTimeoutMs: 120_000 },
    });
    expect(manifest.supportsWaitAny).toBe(true);
    expect(manifest.supportsCancelRequest).toBe(true);
    expect(manifest.supportsUnsolicitedPush).toBe(false);
    expect(manifest.commands).toContain("wait_any");
    expect(manifest.commands).not.toContain("register_watch" as never);
  });

  it("fail-closed keeps push unsupported even if a buggy device claims it", () => {
    const claimed = capabilityManifestFromDeviceResponse({
      supportsUnsolicitedPush: true,
      commands: ["ping"],
    });
    expect(claimed.supportsUnsolicitedPush).toBe(false);
  });
});
