/**
 * ===========================================================================
 *  VerdictChannel ve ortak control-channel yardımcılarının testleri
 *
 *  İki katman:
 *   1) Kanal-agnostik sözleşme paketi (`runControlChannelContract`).
 *   2) Verdict yönlendirme ve `am` çıktı parse testleri.
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
import { beforeEach, describe, expect, it } from "vitest";
import { asSecret, newRequestId } from "@nesy/control-contract";
import type { ControlOperation } from "@nesy/control-contract";
import {
  previewCommand,
  VerdictChannel,
  channelFor,
  detectChannel,
  invalidateDetectedChannel,
  parseBroadcastPayload,
  parseResultCode,
  parseVerdictPendingResult,
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

/** Verdict receiver'ın PendingResult data + extras tel biçimi. */
const verdictCompleted = (
  code: number,
  json: string,
  type: string,
  nonce: string,
): string =>
  `Broadcasting: Intent { act=${APP_ID}.VERDICT_CMD cmp=${APP_ID}/com.verdict.sdk.core.VerdictControlReceiver }\n` +
  `Broadcast completed: result=${code}, data="${json}", extras: Bundle[{` +
  `verdict.result.json=${json}, verdict.result.type=${type}, nonce=${nonce}}]\n`;

function argumentValue(args: string[], key: string): string | undefined {
  const at = args.indexOf(key);
  return at < 0 ? undefined : args[at + 1];
}

function verdictNonce(args: string[]): string {
  const dumpNonce = args.find((arg) => arg.startsWith("--nonce="));
  return dumpNonce?.slice("--nonce=".length) ?? argumentValue(args, "nonce") ?? "";
}

function verdictSuccessJson(op: ControlOperation, nonce: string): string {
  const base = {
    requestId: op.requestId,
    accepted: true,
    nonce,
  };
  switch (op.op) {
    case "set_run":
    case "end_run":
    case "reset_state":
    case "seed":
    case "navigate":
      return JSON.stringify({
        type: "COMMAND_DISPATCHED",
        ...base,
        completion: "sync",
      });
    case "get_state":
      return JSON.stringify({
        type: "COMMAND_RESULT",
        ...base,
        data: {
          runId: "run-1",
          sessionId: "s1",
          seq: 7,
          currentScreen: "StopList",
        },
      });
    case "get_run":
      return JSON.stringify({
        type: "COMMAND_RESULT",
        ...base,
        data: { runId: "run-1", sessionId: "s1", seq: 7 },
      });
    case "get_device_id":
      return JSON.stringify({
        type: "COMMAND_RESULT",
        ...base,
        data: { deviceId: "abc123deviceid" },
      });
    case "get_request_key":
      return JSON.stringify({
        type: "COMMAND_RESULT",
        ...base,
        data: { key: "keymaterial-xyz" },
      });
    case "get_command_result":
      return JSON.stringify({
        type: "COMMAND_RESULT",
        ...base,
        data: { state: "pending" },
      });
    case "get_screen_state":
      return JSON.stringify({
        type: "COMMAND_RESULT",
        ...base,
        data: { currentScreen: "StopList", screenStackAvailable: false },
      });
  }
}

const verdictRunnerReturning =
  (op: ControlOperation, capture?: string[][]): AdbRunner =>
  (_serial, args) => {
    capture?.push(args);
    const nonce = verdictNonce(args);
    const json = verdictSuccessJson(op, nonce);
    const type = String(JSON.parse(json).type);
    return Promise.resolve(
      args.includes("dumpsys")
        ? `PROVIDER ${APP_ID}/.VerdictDumpProvider\n${json}\n`
        : verdictCompleted(-1, json, type, nonce),
    );
  };

const ctxWith = (adb: AdbRunner): ChannelContext => ({
  applicationId: APP_ID,
  adb,
});

// ---------------------------------------------------------------------------
//  1) Kanal-agnostik sözleşme
// ---------------------------------------------------------------------------

runControlChannelContract("VerdictChannel", (): ChannelHarness => {
  const channel = new VerdictChannel();
  const responding = (op?: ControlOperation): AdbRunner => (_serial, args) => {
    const isDump = args.includes("dumpsys");
    if (!op) {
      return Promise.resolve(
        isDump ? "PROVIDER dump completed without Verdict JSON\n" : completed(0),
      );
    }
    const nonce = verdictNonce(args);
    const json = verdictSuccessJson(op, nonce);
    const type =
      JSON.parse(json).type as "COMMAND_DISPATCHED" | "COMMAND_RESULT";
    return Promise.resolve(
      isDump ? `PROVIDER ${APP_ID}/.VerdictDumpProvider\n${json}\n` : verdictCompleted(-1, json, type, nonce),
    );
  };
  return {
    channel,
    supported: sampleOperations().map((op) => op.op),
    silent: () => ctxWith(responding()),
    failing: (message) =>
      ctxWith(() => Promise.reject(new Error(`adb failed: ${message}`))),
    succeeding: (op) => ctxWith(responding(op)),
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

describe("parseVerdictPendingResult", () => {
  it("resultData ve PendingResult extras JSON'unu birlikte okur", () => {
    const json =
      '{"type":"COMMAND_RESULT","requestId":"r1","accepted":true,"nonce":"n1","data":{"pong":true}}';
    expect(
      parseVerdictPendingResult(
        verdictCompleted(-1, json, "COMMAND_RESULT", "n1"),
      ),
    ).toEqual({
      resultCode: -1,
      dataJson: json,
      extrasJson: json,
      resultType: "COMMAND_RESULT",
      nonce: "n1",
    });
  });

  it("resultData yoksa verdict.result.json extras'ına düşer", () => {
    const json =
      '{"type":"COMMAND_FAILED","requestId":"r1","accepted":false,"code":"TIMEOUT","nonce":"n1"}';
    const stdout =
      `Broadcast completed: result=2, extras: Bundle[{nonce=n1, ` +
      `verdict.result.type=COMMAND_FAILED, verdict.result.json=${json}}]\n`;
    const parsed = parseVerdictPendingResult(stdout);
    expect(parsed.dataJson).toBeNull();
    expect(parsed.extrasJson).toBe(json);
    expect(parsed.resultType).toBe("COMMAND_FAILED");
    expect(parsed.nonce).toBe("n1");
  });
});

// ---------------------------------------------------------------------------
//  3) Verdict yönlendirme
// ---------------------------------------------------------------------------

describe("Verdict yönlendirme", () => {
  const env = () => ({ requestId: newRequestId("verdict"), scope: "run-1" });

  it("tüm broadcast'leri explicit VerdictControlReceiver component'ine yollar", async () => {
    const args: string[][] = [];
    const op: ControlOperation = { ...env(), op: "get_device_id" };
    const res = await new VerdictChannel().run(
      SERIAL,
      op,
      ctxWith(verdictRunnerReturning(op, args)),
    );
    expect(res.ok).toBe(true);
    expect(args[0]).toContain("-n");
    expect(args[0]).toContain(
      `${APP_ID}/com.verdict.sdk.core.VerdictControlReceiver`,
    );
    expect(args[0]).toContain(`${APP_ID}.VERDICT_CMD`);
  });

  it("set_run secret'ını stdin sidecar'a taşır; broadcast argv'sine koymaz", async () => {
    const calls: Array<{ args: string[]; stdin?: string }> = [];
    const secret = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const op: ControlOperation = {
      ...env(),
      op: "set_run",
      runId: "run-9",
      secret: asSecret(secret),
      wsEnabled: true,
      wsPort: 8765,
      skipDeliveryWait: true,
    };
    const runner: AdbRunner = (_serial, args, _timeoutMs, stdin) => {
      calls.push({ args, ...(stdin === undefined ? {} : { stdin }) });
      if (!args.includes("broadcast")) return Promise.resolve("");
      const nonce = verdictNonce(args);
      const json = verdictSuccessJson(op, nonce);
      return Promise.resolve(
        verdictCompleted(-1, json, "COMMAND_DISPATCHED", nonce),
      );
    };
    await new VerdictChannel().run(
      SERIAL,
      op,
      ctxWith(runner),
    );
    const stage = calls.find((call) => call.stdin !== undefined)!;
    const broadcast = calls.find((call) => call.args.includes("broadcast"))!.args;
    expect(stage.stdin).toBe(secret);
    expect(stage.args.join(" ")).not.toContain(secret);
    expect(argumentValue(broadcast, "op")).toBe("set_run");
    expect(argumentValue(broadcast, "cmd")).toBe("set_run");
    expect(argumentValue(broadcast, "runId")).toBe("run-9");
    expect(argumentValue(broadcast, "secret")).toBeUndefined();
    expect(argumentValue(broadcast, "secretFile")).toMatch(
      /^control-[A-Za-z0-9._-]+-secret$/,
    );
    expect(broadcast.join(" ")).not.toContain(secret);
    expect(broadcast).toContain("--ez");
    expect(argumentValue(broadcast, "wsEnabled")).toBe("true");
    expect(broadcast).toContain("--ei");
    expect(argumentValue(broadcast, "wsPort")).toBe("8765");
    expect(argumentValue(broadcast, "skipDeliveryWait")).toBe("true");
    expect(calls.some((call) => call.args.includes("rm"))).toBe(true);
  });

  it("login PIN'ini de stdin sidecar'a taşır; broadcast argv'sine koymaz", async () => {
    const calls: Array<{ args: string[]; stdin?: string }> = [];
    const pin = "482913";
    const op: ControlOperation = {
      ...env(),
      op: "seed",
      verb: "login",
      params: { username: "field-user", pin },
    };
    const runner: AdbRunner = (_serial, args, _timeoutMs, stdin) => {
      calls.push({ args, ...(stdin === undefined ? {} : { stdin }) });
      if (!args.includes("broadcast")) return Promise.resolve("");
      const nonce = verdictNonce(args);
      const json = verdictSuccessJson(op, nonce);
      return Promise.resolve(
        verdictCompleted(-1, json, "COMMAND_DISPATCHED", nonce),
      );
    };

    await new VerdictChannel().run(SERIAL, op, ctxWith(runner));

    const stage = calls.find((call) => call.stdin !== undefined)!;
    const broadcast = calls.find((call) => call.args.includes("broadcast"))!.args;
    expect(stage.stdin).toBe(pin);
    expect(stage.args.join(" ")).not.toContain(pin);
    expect(argumentValue(broadcast, "pin")).toBeUndefined();
    expect(argumentValue(broadcast, "pinFile")).toMatch(
      /^control-[A-Za-z0-9._-]+-pin$/,
    );
    expect(argumentValue(broadcast, "username")).toBe("field-user");
    expect(broadcast.join(" ")).not.toContain(pin);
  });

  it("seed verb'ünü cmd + verb olarak, navigate destination'ı parametre olarak taşır", async () => {
    const seedArgs: string[][] = [];
    const seed: ControlOperation = {
      ...env(),
      op: "seed",
      verb: "select_route",
      params: { route: "R7" },
    };
    await new VerdictChannel().run(
      SERIAL,
      seed,
      ctxWith(verdictRunnerReturning(seed, seedArgs)),
    );
    expect(argumentValue(seedArgs[0]!, "op")).toBe("seed");
    expect(argumentValue(seedArgs[0]!, "cmd")).toBe("select_route");
    expect(argumentValue(seedArgs[0]!, "verb")).toBe("select_route");
    expect(argumentValue(seedArgs[0]!, "route")).toBe("R7");

    const navArgs: string[][] = [];
    const navigate: ControlOperation = {
      ...env(),
      op: "navigate",
      destination: "stop_list",
    };
    await new VerdictChannel().run(
      SERIAL,
      navigate,
      ctxWith(verdictRunnerReturning(navigate, navArgs)),
    );
    expect(argumentValue(navArgs[0]!, "destination")).toBe("stop_list");
  });

  it("seed params envelope alanını ezmeye çalışırsa coded error döner, throw etmez", async () => {
    const op: ControlOperation = {
      ...env(),
      op: "seed",
      verb: "login",
      params: { requestId: "shadowed" },
    };
    const res = await new VerdictChannel().run(
      SERIAL,
      op,
      ctxWith(() => Promise.reject(new Error("adb çağrılmamalı"))),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("INVALID_PARAM");
  });

  it("get_run, get_command_result ve screen state explicit DumpProvider component'ini kullanır", async () => {
    const operations: ControlOperation[] = [
      { ...env(), op: "get_run" },
      { ...env(), op: "get_command_result", targetRequestId: "async-7" },
      { ...env(), op: "get_screen_state" },
    ];
    for (const op of operations) {
      const args: string[][] = [];
      const res = await new VerdictChannel().run(
        SERIAL,
        op,
        ctxWith(verdictRunnerReturning(op, args)),
      );
      expect(res.ok).toBe(true);
      expect(args[0]!.join(" ")).toContain(
        `${APP_ID}/com.verdict.sdk.core.VerdictDumpProvider`,
      );
      expect(args[0]).not.toContain("am");
      if (op.op === "get_command_result") {
        expect(args[0]).toContain("--command-request-id=async-7");
      } else if (op.op === "get_run") {
        expect(args[0]).toContain("--verdict-command=get_run");
      } else if (res.ok) {
        expect((res.data as { instrumented: boolean }).instrumented).toBe(true);
      }
    }
  });

  it("channelFor verdict için gerçek implementasyon döndürür", () => {
    expect(channelFor("verdict")).toBeInstanceOf(VerdictChannel);
  });

  it("eski legacy değeri runtime'da fail closed olur", () => {
    const fromUntypedCaller = channelFor as (kind: string) => VerdictChannel;
    expect(() => fromUntypedCaller("legacy")).toThrow(
      "Unsupported control channel: legacy; Verdict is required",
    );
  });
});

// ---------------------------------------------------------------------------
//  4) Nonce'lı kanal tespiti
// ---------------------------------------------------------------------------

describe("detectChannel", () => {
  beforeEach(() => {
    invalidateDetectedChannel(SERIAL);
  });

  it("explicit ping'in AYNI nonce yanıtında verdict döner", async () => {
    const calls: string[][] = [];
    const kind = await detectChannel(
      SERIAL,
      ctxWith((_serial, args) => {
        calls.push(args);
        const nonce = argumentValue(args, "nonce")!;
        const json = JSON.stringify({
          type: "COMMAND_RESULT",
          requestId: nonce,
          accepted: true,
          nonce,
          data: { pong: true },
        });
        return Promise.resolve(
          verdictCompleted(-1, json, "COMMAND_RESULT", nonce),
        );
      }),
    );
    expect(kind).toBe("verdict");
    expect(calls[0]).toContain("-n");
    expect(calls[0]).toContain(
      `${APP_ID}/com.verdict.sdk.core.VerdictControlReceiver`,
    );
    expect(calls[0]).toContain("--include-stopped-packages");
  });

  it("nonce uyuşmazsa exit code 0 olsa bile fail closed olur", async () => {
    await expect(
      detectChannel(
        SERIAL,
        ctxWith((_serial, args) => {
          const requestId = argumentValue(args, "requestId")!;
          const json = JSON.stringify({
            type: "COMMAND_RESULT",
            requestId,
            accepted: true,
            nonce: "wrong-nonce",
            data: { pong: true },
          });
          return Promise.resolve(
            verdictCompleted(-1, json, "COMMAND_RESULT", "wrong-nonce"),
          );
        }),
      ),
    ).rejects.toThrow("ping nonce mismatch");
  });

  it("timeout / adb hatasında fail closed olur", async () => {
    await expect(
      detectChannel(
        SERIAL,
        ctxWith(() => Promise.reject(new Error("timeout"))),
      ),
    ).rejects.toThrow("Verdict channel detection failed");
  });

  it("başarısız ping'i cache'lemez; sonraki çağrı yeniden dener", async () => {
    let calls = 0;
    const ctx = ctxWith((_serial, args) => {
      calls += 1;
      if (calls === 1) return Promise.reject(new Error("first ping timeout"));
      const nonce = argumentValue(args, "nonce")!;
      const json = JSON.stringify({
        type: "COMMAND_RESULT",
        requestId: nonce,
        accepted: true,
        nonce,
        data: { pong: true },
      });
      return Promise.resolve(verdictCompleted(-1, json, "COMMAND_RESULT", nonce));
    });

    await expect(detectChannel(SERIAL, ctx)).rejects.toThrow("first ping timeout");
    await expect(detectChannel(SERIAL, ctx)).resolves.toBe("verdict");
    expect(calls).toBe(2);
  });

  it("worker ömründe cache'ler; invalidate sonrası yeniden ping atar", async () => {
    let calls = 0;
    const ctx = ctxWith((_serial, args) => {
      calls += 1;
      const nonce = argumentValue(args, "nonce")!;
      const json = JSON.stringify({
        type: "COMMAND_RESULT",
        requestId: nonce,
        accepted: true,
        nonce,
        data: { pong: true },
      });
      return Promise.resolve(verdictCompleted(-1, json, "COMMAND_RESULT", nonce));
    });
    expect(await detectChannel(SERIAL, ctx)).toBe("verdict");
    expect(await detectChannel(SERIAL, ctx)).toBe("verdict");
    expect(calls).toBe(1);
    invalidateDetectedChannel(SERIAL, ctx);
    expect(await detectChannel(SERIAL, ctx)).toBe("verdict");
    expect(calls).toBe(2);
  });
});

// ---------------------------------------------------------------------------
//  5) previewCommand — Debug View kopyala-yapıştır satırı
// ---------------------------------------------------------------------------

describe("previewCommand", () => {
  const env = () => ({ requestId: newRequestId("t"), scope: "run-1" });

  it("Verdict receiver ve applicationId-scoped action üretir", () => {
    const op: ControlOperation = { ...env(), op: "get_request_key" };
    const preview = previewCommand(op, { applicationId: APP_ID, serial: SERIAL });
    expect(preview).toContain(
      `adb -s ${SERIAL} shell am broadcast -n ${APP_ID}/com.verdict.sdk.core.VerdictControlReceiver`,
    );
    expect(preview).toContain(`-a ${APP_ID}.VERDICT_CMD`);
    expect(preview).toContain("--es op get_request_key");
    expect(preview).toContain("--es nonce preview");
    expect(preview).not.toContain("ProtectedRequestKeyReceiver");
  });

  it("hassas sidecar gerektiren op için eksik preview üretmez", () => {
    expect(
      previewCommand(
        {
          ...env(),
          op: "set_run",
          runId: "run-1",
          secret: asSecret("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"),
        },
        { applicationId: APP_ID },
      ),
    ).toBeNull();
  });

  it("dump op için VerdictDumpProvider preview'ı üretir", () => {
    const preview = previewCommand(
      { ...env(), op: "get_run" },
      { applicationId: APP_ID, serial: SERIAL },
    );
    expect(preview).toContain(
      `dumpsys activity provider ${APP_ID}/com.verdict.sdk.core.VerdictDumpProvider`,
    );
    expect(preview).toContain("--verdict-command=get_run");
  });
});
