/**
 * ===========================================================================
 *  LegacyReceiverChannel testleri
 *
 *  İki katman:
 *   1) Kanal-agnostik sözleşme paketi (`runControlChannelContract`) — Faz 4'te
 *      VerdictChannel de AYNI paketi koşacak.
 *   2) Legacy'ye özgü testler: yönlendirme, `am` çıktı parse'ı, hata sözlüğü.
 *
 *  Beklenen `am` çıktıları GERÇEK CİHAZDAN (Samsung SM-A346E / API 36)
 *  kopyalanmıştır — uydurulmamıştır. Ham örnekler:
 *
 *      Broadcasting: Intent { act=… flg=0x400000 cmp=pkg/.Recv (has extras) }
 *      Broadcast completed: result=42, data="A:{"runId":"r1","seq":7}"
 *
 *      Broadcasting: Intent { act=… cmp=com.no.such.pkg/.NoReceiver }
 *      Broadcast completed: result=0
 * ===========================================================================
 */
import { describe, expect, it } from "vitest";
import { asSecret, newRequestId } from "@nesy/control-contract";
import type { ControlOperation } from "@nesy/control-contract";
import {
  LegacyActivityDumpChannel,
  previewCommand,
  LegacyReceiverChannel,
  detectChannel,
  parseScreenStateDump,
  parseBroadcastPayload,
  parseResultCode,
  type AdbRunner,
  type ChannelContext,
} from "./index.js";
import {
  runControlChannelContract,
  sampleOperations,
  type ChannelHarness,
} from "./contract-suite.js";

const APP_ID = "com.arasdigital.nesymobiledev";
const SERIAL = "TESTSERIAL01";

/** Gerçek `am broadcast` çıktısını taklit eder. */
const completed = (code: number, data?: string): string =>
  `Broadcasting: Intent { act=com.arasdigital.nesymobile.X flg=0x400000 cmp=${APP_ID}/.R (has extras) }\n` +
  (data === undefined
    ? `Broadcast completed: result=${code}\n`
    : `Broadcast completed: result=${code}, data="${data}"\n`);

/** Verilen op için legacy receiver'ın DOĞRU başarı payload'ı. */
function successPayload(op: ControlOperation): string | undefined {
  switch (op.op) {
    case "get_state":
      return '{"runId":"run-1","sessionId":"s1","seq":7,"currentScreen":"StopList"}';
    case "get_run":
      return "run-1|s1|7";
    case "get_device_id":
      return "abc123deviceid";
    case "get_request_key":
      return "keymaterial-xyz";
    case "reset_state":
      return '{"reset":"ok"}';
    case "set_run":
      return `OK:${op.runId}`;
    case "navigate":
      return `OK:${op.destination}`;
    case "seed":
      return "OK:select_route";
    default:
      return undefined; // desteklenmeyen op
  }
}

const runnerReturning =
  (stdout: string, capture?: string[][]): AdbRunner =>
  (_serial, args) => {
    capture?.push(args);
    return Promise.resolve(stdout);
  };

const ctxWith = (adb: AdbRunner): ChannelContext => ({
  applicationId: APP_ID,
  adb,
});

// ---------------------------------------------------------------------------
//  1) Kanal-agnostik sözleşme
// ---------------------------------------------------------------------------

runControlChannelContract("LegacyReceiverChannel", (): ChannelHarness => {
  const channel = new LegacyReceiverChannel();
  return {
    channel,
    supported: [
      "get_state",
      "get_run",
      "get_device_id",
      "get_request_key",
      "reset_state",
      "set_run",
      "navigate",
      "seed",
    ],
    // Gerçek cihazda ölçülen "hiçbir şeye ulaşmadı" çıktısı.
    silent: () => ctxWith(runnerReturning(completed(0))),
    failing: (message) =>
      ctxWith(() => Promise.reject(new Error(`adb failed: ${message}`))),
    succeeding: (op) => {
      const payload = successPayload(op);
      return ctxWith(
        runnerReturning(
          payload === undefined ? completed(0) : completed(-1, payload),
        ),
      );
    },
  };
});

// ---------------------------------------------------------------------------
//  2) `am broadcast` çıktı parse'ı
// ---------------------------------------------------------------------------

describe("parseBroadcastPayload", () => {
  it("tırnaksız payload'ı okur", () => {
    expect(parseBroadcastPayload(completed(-1, "abc123"))).toBe("abc123");
  });

  it("İÇİNDE TIRNAK OLAN payload'ı KESMEZ (get_state JSON'u)", () => {
    // Bu, kod tabanındaki iki eski regex varyantının sessizce bozduğu durum.
    const json = '{"runId":"r1","seq":7}';
    expect(parseBroadcastPayload(completed(-1, json))).toBe(json);
  });

  it("payload yoksa null döner", () => {
    expect(parseBroadcastPayload(completed(0))).toBeNull();
  });

  it("boş payload'ı null'dan ayırt eder", () => {
    // data="" → anlamlı "boş yanıt" değil; kanıt sayılmaz.
    expect(parseBroadcastPayload(completed(-1, ""))).toBeNull();
  });

  it("payload'dan SONRA gelen alanlara taşmaz", () => {
    // Mevcut kod tabanındaki fixture (`device-courier-auth.test.ts`) bu biçimi
    // kullanıyor — greedy arama `, end=0`'a taşımamalı.
    expect(
      parseBroadcastPayload(
        'Broadcast completed: result=-1, data="abc+def/ghi=", end=0',
      ),
    ).toBe("abc+def/ghi=");
  });

  it("`, extras: Bundle[…]` ekini payload'a KATMAZ", () => {
    expect(
      parseBroadcastPayload(
        'Broadcast completed: result=-1, data="{"a":1}", extras: Bundle[{k=v}]',
      ),
    ).toBe('{"a":1}');
  });

  it("result=\"…\" biçimine geri düşer", () => {
    expect(parseBroadcastPayload('Broadcast completed: result="fallback"')).toBe(
      "fallback",
    );
  });
});

describe("parseResultCode", () => {
  it("negatif kodu okur (RESULT_OK = -1)", () => {
    expect(parseResultCode(completed(-1, "x"))).toBe(-1);
  });

  it("payload içindeki result= değerine ALDANMAZ", () => {
    expect(parseResultCode(completed(-1, '{"result":-99,"result=":0}'))).toBe(-1);
  });

  it("kod yoksa null", () => {
    expect(parseResultCode("Broadcasting: Intent { }")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
//  3) Yönlendirme — hangi receiver, hangi action, hangi extras
// ---------------------------------------------------------------------------

describe("legacy yönlendirme", () => {
  const env = () => ({ requestId: newRequestId("t"), scope: "run-1" });

  it("explicit component (-n) KULLANIR, action-only göndermez", async () => {
    const args: string[][] = [];
    const op: ControlOperation = { ...env(), op: "get_device_id" };
    await new LegacyReceiverChannel().run(
      SERIAL,
      op,
      ctxWith(runnerReturning(completed(-1, "dev1"), args)),
    );
    expect(args[0]).toContain("-n");
    expect(args[0]).toContain(
      `${APP_ID}/com.arasdigital.nesymobile.adb.ProtectedRequestKeyReceiver`,
    );
    expect(args[0]).toContain("com.arasdigital.nesymobile.GET_DEVICE_ID");
  });

  it("wakeStopped yoksa --include-stopped-packages GÖNDERİLMEZ", async () => {
    const args: string[][] = [];
    await new LegacyReceiverChannel().run(
      SERIAL,
      { ...env(), op: "get_state" },
      ctxWith(runnerReturning(completed(-1, "{}"), args)),
    );
    expect(args[0]).not.toContain("--include-stopped-packages");
  });

  it("wakeStopped:true durmuş uygulamayı uyandırma bayrağını ekler", async () => {
    const args: string[][] = [];
    await new LegacyReceiverChannel().run(
      SERIAL,
      { ...env(), wakeStopped: true, op: "get_device_id" },
      ctxWith(runnerReturning(completed(-1, "dev1"), args)),
    );
    expect(args[0]).toContain("--include-stopped-packages");
    // Bayrak `-n`'den ÖNCE gelmeli; `am` seçenekleri bileşenden sonra kabul etmez.
    expect(args[0]!.indexOf("--include-stopped-packages")).toBeLessThan(
      args[0]!.indexOf("-n"),
    );
  });

  it("serial boşsa -s GÖNDERİLMEZ (tek cihaz varsayan çağıranlar)", async () => {
    const args: string[][] = [];
    await new LegacyReceiverChannel().run(
      "",
      { ...env(), op: "get_request_key" },
      ctxWith(runnerReturning(completed(-1, "key"), args)),
    );
    expect(args[0]).not.toContain("-s");
    expect(args[0]![0]).toBe("shell");
  });

  it("navigate NAV receiver'a gider", async () => {
    const args: string[][] = [];
    const op: ControlOperation = {
      ...env(),
      op: "navigate",
      destination: "stop_list",
    };
    await new LegacyReceiverChannel().run(
      SERIAL,
      op,
      ctxWith(runnerReturning(completed(-1, "OK:stop_list"), args)),
    );
    expect(args[0]).toContain(
      `${APP_ID}/com.arasdigital.nesymobile.adb.TestNavigationReceiver`,
    );
    expect(args[0]).toContain("com.arasdigital.nesymobile.NAV_TO");
    expect(args[0]).toContain("destination");
    expect(args[0]).toContain("stop_list");
  });

  it("set_run secret'ı legacy receiver'a GÖNDERMEZ", async () => {
    const args: string[][] = [];
    const secret = "top-secret-value";
    const op: ControlOperation = {
      ...env(),
      op: "set_run",
      runId: "run-9",
      secret: asSecret(secret),
      wsEnabled: true,
      wsPort: 8765,
    };
    await new LegacyReceiverChannel().run(
      SERIAL,
      op,
      ctxWith(runnerReturning(completed(-1, "OK:run-9"), args)),
    );
    expect(args[0]!.join(" ")).not.toContain(secret);
    expect(args[0]).toContain("run_id");
    expect(args[0]).toContain("ws_enabled");
  });

  it("seed verb + params'ı --es çiftlerine açar", async () => {
    const args: string[][] = [];
    const op: ControlOperation = {
      ...env(),
      op: "seed",
      verb: "select_route",
      params: { route: "R7" },
    };
    await new LegacyReceiverChannel().run(
      SERIAL,
      op,
      ctxWith(runnerReturning(completed(-1, "OK:select_route"), args)),
    );
    expect(args[0]).toContain("verb");
    expect(args[0]).toContain("select_route");
    expect(args[0]).toContain("route");
    expect(args[0]).toContain("R7");
  });

  it("end_run ve get_command_result legacy'de YOK — UNKNOWN_COMMAND", async () => {
    const ch = new LegacyReceiverChannel();
    for (const op of sampleOperations().filter(
      (o) => o.op === "end_run" || o.op === "get_command_result",
    )) {
      const res = await ch.run(
        SERIAL,
        op,
        ctxWith(runnerReturning(completed(-1, "OK:x"))),
      );
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe("UNKNOWN_COMMAND");
    }
  });
});

// ---------------------------------------------------------------------------
//  4) Sonuç çözümleme — hata sözlüğü ve echo doğrulaması
// ---------------------------------------------------------------------------

describe("legacy sonuç çözümleme", () => {
  const env = () => ({ requestId: newRequestId("t"), scope: "run-1" });
  const ch = new LegacyReceiverChannel();

  const run = (op: ControlOperation, stdout: string) =>
    ch.run(SERIAL, op, ctxWith(runnerReturning(stdout)));

  it("ERROR:<KOD> sözlükten doğru koda eşlenir", async () => {
    const cases: Array<[string, string]> = [
      ["ERROR:NO_FOREGROUND_MAIN_ACTIVITY", "WRONG_SCREEN"],
      ["ERROR:UNKNOWN_DESTINATION:foo (known: a,b)", "INVALID_PARAM"],
      ["ERROR:NO_PIN", "MISSING_PARAM"],
      ["ERROR:STATE_TIMEOUT", "TIMEOUT"],
      ["ERROR:INVALID_ACTION", "UNKNOWN_COMMAND"],
      ["ERROR:NAV_FAILED:IllegalStateException", "HANDLER_FAILED"],
      ["ERROR:SOMETHING_BRAND_NEW", "HANDLER_FAILED"],
    ];
    for (const [payload, expected] of cases) {
      const res = await run(
        { ...env(), op: "navigate", destination: "stop_list" },
        completed(0, payload),
      );
      expect(res.ok, payload).toBe(false);
      if (!res.ok) expect(res.code, payload).toBe(expected);
    }
  });

  it("tanınmayan ERROR kodunda ham kod detail'de KORUNUR", async () => {
    const res = await run(
      { ...env(), op: "navigate", destination: "x" },
      completed(0, "ERROR:SOMETHING_BRAND_NEW"),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.detail).toContain("SOMETHING_BRAND_NEW");
  });

  it("reset_state JSON hata biçimini tanır", async () => {
    const disabled = await run(
      { ...env(), op: "reset_state" },
      completed(0, '{"reset":"error","message":"bridge_disabled"}'),
    );
    expect(disabled.ok).toBe(false);
    if (!disabled.ok) expect(disabled.code).toBe("PRECONDITION_FAILED");

    const timeout = await run(
      { ...env(), op: "reset_state" },
      completed(0, '{"reset":"error","message":"timeout"}'),
    );
    expect(timeout.ok).toBe(false);
    if (!timeout.ok) expect(timeout.code).toBe("TIMEOUT");
  });

  it("reset_state başarısı {\"reset\":\"ok\"} ile doğrulanır", async () => {
    const res = await run(
      { ...env(), op: "reset_state" },
      completed(-1, '{"reset":"ok"}'),
    );
    expect(res.ok).toBe(true);
  });

  it("set_run echo'su uyuşmazsa PROTOCOL_VIOLATION", async () => {
    // Başka bir broadcast'in yanıtını okumuş olabiliriz — sessizce kabul edilmez.
    const res = await run(
      {
        ...env(),
        op: "set_run",
        runId: "run-9",
        secret: asSecret("s"),
      },
      completed(-1, "OK:run-DIFFERENT"),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("PROTOCOL_VIOLATION");
  });

  it("get_run biçimi bozuksa PROTOCOL_VIOLATION", async () => {
    const res = await run({ ...env(), op: "get_run" }, completed(-1, "run-1"));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("PROTOCOL_VIOLATION");
  });

  it("get_state JSON'u tam olarak çözülür (tırnak kaybı yok)", async () => {
    const res = await run(
      { ...env(), op: "get_state" },
      completed(-1, '{"runId":"r1","sessionId":"s1","seq":7,"isLogin":false}'),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      const state = res.data as { runId: string; seq: number; isLogin: boolean };
      expect(state.runId).toBe("r1");
      expect(state.seq).toBe(7);
      expect(state.isLogin).toBe(false);
    }
  });

  it("get_state JSON bozuksa PROTOCOL_VIOLATION", async () => {
    const res = await run({ ...env(), op: "get_state" }, completed(-1, "{oops"));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("PROTOCOL_VIOLATION");
  });

  it("result=0 + data yok → CHANNEL_UNAVAILABLE (var olmayan component)", async () => {
    // Gerçek cihazda ölçülen çıktı: bu tam olarak "receiver yok" hâli.
    const res = await run({ ...env(), op: "get_state" }, completed(0));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("CHANNEL_UNAVAILABLE");
  });
});

// ---------------------------------------------------------------------------
//  5) Faz 0.3 değişmezi — kanal tespiti hâlâ legacy
// ---------------------------------------------------------------------------

describe("detectChannel", () => {
  it("Faz 0.3'te DAİMA legacy döner — davranış değişmez", async () => {
    const kind = await detectChannel(
      SERIAL,
      ctxWith(runnerReturning(completed(-1, "anything"))),
    );
    expect(kind).toBe("legacy");
  });
});

// ---------------------------------------------------------------------------
//  6) LegacyActivityDumpChannel — Debug View ekran durumu (C.11.4)
// ---------------------------------------------------------------------------

describe("LegacyActivityDumpChannel", () => {
  const env = () => ({ requestId: newRequestId("t"), scope: "run-1" });
  const ch = new LegacyActivityDumpChannel();
  const DUMP_OK =
    'TASK ...\n  NESY_SCREEN_STATE:{"screen":{"stopCount":12},"shared":{"route":"36"}}\n  more\n';

  it("activity'yi COMPONENT adıyla dump eder ve bayrağı geçirir", async () => {
    const args: string[][] = [];
    await ch.run(
      SERIAL,
      { ...env(), op: "get_screen_state" },
      ctxWith(runnerReturning(DUMP_OK, args)),
    );
    const cmd = args[0]!.join(" ");
    expect(cmd).toContain(`${APP_ID}/com.arasdigital.nesymobile.main.MainActivity`);
    expect(cmd).toContain("--nesy-state");
  });

  it("NESY_SCREEN_STATE gövdesini ayrıştırır", async () => {
    const res = await ch.run(
      SERIAL,
      { ...env(), op: "get_screen_state" },
      ctxWith(runnerReturning(DUMP_OK)),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.instrumented).toBe(true);
      expect(res.data.state?.screen).toEqual({ stopCount: 12 });
      expect(res.data.state?.shared).toEqual({ route: "36" });
    }
  });

  it("işaret yoksa HATA değil — instrumented:false", async () => {
    // Eski build. Dump çalıştı; UI kullanıcıya doğru build istemesini söyler.
    const res = await ch.run(
      SERIAL,
      { ...env(), op: "get_screen_state" },
      ctxWith(runnerReturning("TASK ...\n  no marker here\n")),
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.instrumented).toBe(false);
  });

  it("işaret var ama JSON bozuksa instrumented SAYILMAZ", async () => {
    // Aksi hâlde çağıran "alanlar boş ama build doğru" diye yanlış rapor verir.
    const parsed = parseScreenStateDump("NESY_SCREEN_STATE:{oops\n");
    expect(parsed.instrumented).toBe(false);
    expect(parsed.state).toBeNull();
  });

  it("dump kanalı receiver op'larını TAŞIMAZ", async () => {
    const res = await ch.run(
      SERIAL,
      { ...env(), op: "get_state" },
      ctxWith(runnerReturning(DUMP_OK)),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("UNKNOWN_COMMAND");
  });

  it("receiver kanalı get_screen_state'i TAŞIMAZ", async () => {
    const res = await new LegacyReceiverChannel().run(
      SERIAL,
      { ...env(), op: "get_screen_state" },
      ctxWith(runnerReturning(completed(-1, "x"))),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("UNKNOWN_COMMAND");
  });
});

// ---------------------------------------------------------------------------
//  7) previewCommand — Debug View kopyala-yapıştır satırı
// ---------------------------------------------------------------------------

describe("previewCommand", () => {
  const env = () => ({ requestId: newRequestId("t"), scope: "run-1" });

  it("gerçek yönlendirmeyle AYNI receiver ve action'ı üretir", () => {
    const op: ControlOperation = { ...env(), op: "get_request_key" };
    const preview = previewCommand(op, { applicationId: APP_ID, serial: SERIAL });
    expect(preview).toBe(
      `adb -s ${SERIAL} shell am broadcast -n ${APP_ID}/com.arasdigital.nesymobile.adb.ProtectedRequestKeyReceiver -a com.arasdigital.nesymobile.GET_KEY`,
    );
  });

  it("önizleme ile gerçek çağrı ASLA ayrışmaz", async () => {
    // Tek koruma bu: ikisi de routeLegacy'den geldiği için biri değişirse
    // diğeri de değişir. Elle yazılmış string literal'lerde bu güvence yoktu.
    const op: ControlOperation = { ...env(), op: "get_device_id" };
    const args: string[][] = [];
    await new LegacyReceiverChannel().run(
      SERIAL,
      op,
      ctxWith(runnerReturning(completed(-1, "dev1"), args)),
    );
    const executed = `adb ${args[0]!.join(" ")}`;
    expect(previewCommand(op, { applicationId: APP_ID, serial: SERIAL })).toBe(executed);
  });

  it("legacy'de karşılığı olmayan op için null döner", () => {
    expect(
      previewCommand({ ...env(), op: "end_run" }, { applicationId: APP_ID }),
    ).toBeNull();
  });
});
