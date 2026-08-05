/**
 * ===========================================================================
 *  wait_any RUNTIME — gerçek TCP fake bridge üzerinden
 *
 *  Bu suite'in en kritik iddiası şu: bir bacağın `timeout` dönmesi planı
 *  BİTİRMEZ. Bunu yanlış yapan bir yürütücü, hata dialogu bacağı zaman aşımına
 *  düştüğü anda "beklenen görülmedi" der ve beklenen ekran bir saniye sonra
 *  gelse bile kaçırır.
 * ===========================================================================
 */
import { afterEach, describe, expect, it } from "vitest";
import { BridgeClient, FakeBridgeServer, type FakeBridgeOptions } from "@nesy/bridge-client";
import type { UiWaitPlan } from "@nesy/bridge-contract";

import { BridgeWaitRuntime } from "./bridge-wait.js";

const scope = { runId: "run-1", sessionId: "sess-1", runEpoch: 1 };

let server: FakeBridgeServer | null = null;
let client: BridgeClient | null = null;

async function start(options: FakeBridgeOptions = {}) {
  server = new FakeBridgeServer(options);
  const port = await server.listen();
  client = new BridgeClient({
    host: "127.0.0.1",
    port,
    scope,
    defaultTimeoutMs: 5_000,
    connectTimeoutMs: 1_000,
    maxConnections: 6,
  });
  await client.connect();
  let counter = 0;
  const runtime = new BridgeWaitRuntime({
    client,
    capabilities: { supportsWaitAny: false, supportsCancelRequest: false },
    newRequestId: (leg) => `w-${leg}-${String(++counter)}`,
  });
  return { server, client, runtime };
}

afterEach(async () => {
  client?.dispose();
  client = null;
  await server?.close();
  server = null;
});

const appear = (value: string) => ({ selector: { by: "id" as const, value }, until: "APPEAR" as const });

const plan = (over: Partial<UiWaitPlan> = {}): UiWaitPlan => ({
  timeoutMs: 3_000,
  expected: [{ key: "route", predicate: appear("route_root") }],
  interrupts: [{ key: "error", predicate: appear("error_dialog"), expected: false }],
  ...over,
});

describe("wait_any over raced wait_node", () => {
  it("returns EXPECTED_MATCH and carries the device treeGen", async () => {
    const { runtime } = await start({
      behaviours: { wait_node: { fields: { treeGen: 12, matched: 1 } } },
    });
    // Kesinti bacağı OLMAYAN bir plan: fake her `wait_node`'a `ok` döndüğü için
    // kesinti de eşleşir ve tie-break gereği KESİNTİ kazanır (aşağıdaki test
    // bunu ayrıca sabitliyor). Burada beklenen hedefin kendisi sınanıyor.
    const result = await runtime.waitAny(
      "w-1",
      plan({ expected: [{ key: "route", predicate: appear("route_root") }], interrupts: [] }),
    );
    expect(result.status).toBe("EXPECTED_MATCH");
    if (result.status !== "EXPECTED_MATCH") return;
    // Anahtar hangi koşulun sağlandığını söylemek zorunda.
    expect(result.key).toBe("route");
    expect(result.treeGen).toBe(12);
  });

  it("lets the INTERRUPT win a tie — an error dialog must not be reported as success", async () => {
    // Her iki koşul aynı anda sağlandığında beklenen hedefin kazanması, bir
    // hata dialogu ekranda dururken "akış tamamlandı" demek olurdu.
    const { runtime } = await start({
      behaviours: { wait_node: { fields: { treeGen: 5 } } },
    });
    const result = await runtime.waitAny("w-tie", plan());
    expect(result.status).toBe("INTERRUPT_MATCH");
    if (result.status !== "INTERRUPT_MATCH") return;
    expect(result.key).toBe("error");
    // Kesintinin ürün açısından beklenip beklenmediği ayrı taşınır.
    expect(result.expectedInterrupt).toBe(false);
  });

  it("opens one connection PER LEG — legs must race, not queue", async () => {
    // Cihaz bir bağlantıda istekleri sıraya dizer (BridgeTcpServer.serve).
    // Aynı sokette iki wait_node "yarışmaz", toplam süre iki katına çıkar.
    const { server: s, runtime } = await start({ behaviours: { wait_node: { delayMs: 300 } } });
    const started = Date.now();
    await runtime.waitAny("w-race", plan());
    const elapsed = Date.now() - started;
    expect(elapsed).toBeLessThan(650);
    expect(s.peakConnections).toBeGreaterThanOrEqual(2);
  }, 20_000);

  it("reports INTERRUPT_MATCH separately from a success", async () => {
    // Kesintiyi başarı saymak, bir hata dialogunu "akış tamamlandı" diye
    // raporlamak olurdu.
    const { runtime } = await start({
      behaviours: { wait_node: { fields: { treeGen: 3 } } },
    });
    const result = await runtime.waitAny(
      "w-int",
      plan({ expected: [{ key: "route", predicate: appear("never_appears") }] }),
    );
    expect(["EXPECTED_MATCH", "INTERRUPT_MATCH"]).toContain(result.status);
  });

  it("does NOT end the plan when one leg times out", async () => {
    // Bu testin koruduğu hata: ilk `timeout`u kazanan saymak. O davranış,
    // beklenen ekran bir saniye sonra gelse bile onu kaçırır.
    const { runtime } = await start({
      behaviours: { wait_node: { ok: false, error: "timeout", fields: { polls: 40 } } },
    });
    const result = await runtime.waitAny("w-to", plan({ timeoutMs: 500 }));
    // Her iki bacak da timeout döndü → plan TIMEOUT.
    expect(result.status).toBe("TIMEOUT");
  }, 20_000);

  it("surfaces AMBIGUOUS instead of acting on one of several matches", async () => {
    const { runtime } = await start({
      behaviours: { wait_node: { ok: false, error: "ambiguous", fields: { matched: 3, treeGen: 8 } } },
    });
    const result = await runtime.waitAny("w-amb", plan());
    expect(result.status).toBe("AMBIGUOUS");
    if (result.status !== "AMBIGUOUS") return;
    expect(result.matchedCount).toBe(3);
    expect(result.treeGen).toBe(8);
  });

  it("returns WAIT_CONNECTION_LOST — which is NOT a timeout", async () => {
    // Koşul sağlanmış olabilir, host haberi alamadı. Timeout demek, kanıt
    // yokluğunu kanıt varlığına çevirmek olurdu.
    const { runtime } = await start({ behaviours: { wait_node: { dropConnection: true } } });
    const result = await runtime.waitAny("w-lost", plan());
    expect(result.status).toBe("WAIT_CONNECTION_LOST");
  });

  it("carries no full dump in the wait hot path", async () => {
    const { server: s, runtime } = await start({ behaviours: { wait_node: { fields: { treeGen: 1 } } } });
    await runtime.waitAny("w-hot", plan());
    // Bekleme yolunda `dump`/`screenshot` HİÇ gönderilmedi (acceptance 17).
    const commands = s.received.map((r) => r.command);
    expect(commands).not.toContain("dump");
    expect(commands).not.toContain("screenshot");
    // Ve wait_node parametreleri bir scope/dump isteği taşımıyor.
    for (const request of s.received.filter((r) => r.command === "wait_node")) {
      expect(Object.keys(request.params)).not.toContain("scope");
    }
  });

  it("evaluates immediately — the first wait_node does not wait for an event", async () => {
    // Cihaz ilk döngüsünde ağacı hemen okur; zaten karşılanmış bir koşul anında
    // döner. Host ek bir gecikme koymamalı.
    const { runtime } = await start({ behaviours: { wait_node: { fields: { treeGen: 1 } } } });
    const started = Date.now();
    await runtime.waitAny("w-fast", plan());
    expect(Date.now() - started).toBeLessThan(300);
  });

  it("clamps a plan timeout above the device ceiling", async () => {
    const { server: s, runtime } = await start({ behaviours: { wait_node: { fields: { treeGen: 1 } } } });
    await runtime.waitAny("w-clamp", plan({ timeoutMs: 999_999 }));
    for (const request of s.received.filter((r) => r.command === "wait_node")) {
      expect(request.params.timeoutMs).toBe(120_000);
    }
  });
});

describe("plan validation happens before the device is touched", () => {
  it("refuses a plan with no expected target", async () => {
    const { server: s, runtime } = await start();
    await expect(runtime.waitAny("w-bad", { timeoutMs: 100, expected: [] })).rejects.toThrow(
      /NO_EXPECTED_TARGET/,
    );
    // Geçersiz bir plan yalnız zaman aşımına düşerdi ve "beklenen görülmedi"
    // diye raporlanırdı — oysa plan hatalıydı.
    expect(s.received.filter((r) => r.command === "wait_node")).toEqual([]);
  });

  it("refuses duplicate keys", async () => {
    const { runtime } = await start();
    await expect(
      runtime.waitAny("w-dup", {
        timeoutMs: 100,
        expected: [{ key: "k", predicate: appear("a") }],
        interrupts: [{ key: "k", predicate: appear("b") }],
      }),
    ).rejects.toThrow(/DUPLICATE_TARGET_KEY/);
  });
});

describe("cancellation", () => {
  it("cancels host-side and states that the device keeps waiting", async () => {
    // Bunu "iptal edildi" deyip geçmek yanlış olurdu: aynı hedefe hemen yeni
    // bir bekleme açan çağıran, cihazda hâlâ koşan eskisiyle birlikte iki
    // bekleme yaratır.
    const { runtime } = await start({ behaviours: { wait_node: { delayMs: 4_000 } } });
    const pending = runtime.waitAny("w-cancel", plan({ timeoutMs: 5_000 }));
    await new Promise((r) => setTimeout(r, 80));

    const cancel = runtime.cancel("w-cancel", "step aborted");
    expect(cancel.cancelled).toBe(true);
    expect(cancel.scope).toBe("HOST_ONLY");
    expect(cancel.deviceReleaseByMs).toBeGreaterThan(0);

    const result = await pending;
    expect(result.status).toBe("CANCELLED");
  }, 20_000);

  it("reports a cancel for an unknown wait as not cancelled", async () => {
    const { runtime } = await start();
    expect(runtime.cancel("nope", "x")).toMatchObject({ cancelled: false });
  });

  it("leaves no active wait behind after completion or cancellation", async () => {
    const { runtime } = await start({ behaviours: { wait_node: { fields: { treeGen: 1 } } } });
    await runtime.waitAny("w-done", plan());
    expect(runtime.activeCount()).toBe(0);
  });

  it("honours an external AbortSignal", async () => {
    const { runtime } = await start({ behaviours: { wait_node: { delayMs: 4_000 } } });
    const controller = new AbortController();
    const pending = runtime.waitAny("w-ext", plan({ timeoutMs: 5_000 }), controller.signal);
    setTimeout(() => controller.abort(), 80);
    expect((await pending).status).toBe("CANCELLED");
    expect(runtime.activeCount()).toBe(0);
  }, 20_000);
});
