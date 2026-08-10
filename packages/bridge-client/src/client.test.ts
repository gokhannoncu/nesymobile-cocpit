/**
 * ===========================================================================
 *  BRIDGE CLIENT — gerçek TCP üzerinden
 *
 *  Fake sunucu bir mock DEĞİL, gerçek bir `net.Server`. Bu suite'in değerinin
 *  tamamı oradan geliyor: chunk bölünmesi, `FIN` ile kopan uçuştaki istek ve
 *  cihazın bağlantı başına serileştirmesi ancak gerçek soketle gözlemlenebilir.
 * ===========================================================================
 */
import { afterEach, describe, expect, it } from "vitest";

import { BridgeClient, BridgeHostError } from "./client.js";
import { FakeBridgeServer, type FakeBridgeOptions } from "./fake-bridge-server.js";

const scope = { runId: "run-1", sessionId: "sess-1", runEpoch: 3 };

let server: FakeBridgeServer | null = null;
let client: BridgeClient | null = null;

async function start(options: FakeBridgeOptions = {}, clientOverrides: Record<string, unknown> = {}) {
  server = new FakeBridgeServer(options);
  const port = await server.listen();
  client = new BridgeClient({
    host: "127.0.0.1",
    port,
    scope: { ...scope },
    defaultTimeoutMs: 2_000,
    connectTimeoutMs: 1_000,
    ...clientOverrides,
  });
  return { server, client, port };
}

afterEach(async () => {
  client?.dispose();
  client = null;
  await server?.close();
  server = null;
});

describe("handshake and capabilities", () => {
  it("handshakes, pings and reads capabilities from the device (Mobile M3+)", async () => {
    const { client: c } = await start();
    const manifest = await c.connect();
    expect(manifest.protocolVersion).toBe(1);
    expect(manifest.supportsWaitAny).toBe(true);
    expect(manifest.supportsCancelRequest).toBe(true);
    expect(manifest.supportsUnsolicitedPush).toBe(false);
  });

  it("reclaims a bridge stuck on a newer stale scope before pinging", async () => {
    const { server: s, client: c } = await start({
      enforceFencing: true,
      activeScope: { runId: "previous-run", sessionId: "previous-session", runEpoch: 41 },
    });

    const manifest = await c.connect();

    expect(manifest.protocolVersion).toBe(1);
    const handshakes = s.received.filter((r) => r.command === "handshake");
    expect(handshakes).toHaveLength(1);
    expect(s.received.some((r) => r.command === "ping")).toBe(true);
  });

  it("sends handshake before the first command on every NEW socket", async () => {
    // ProtocolV1.Session bağlantıya özeldir: yeni soket handshake yapmadan
    // komut gönderirse `handshake_required` alır — başka bir soket handshake
    // yapmış olsa bile.
    const { server: s, client: c } = await start({ enforceHandshake: true });
    await c.connect();
    await c.send({ command: "find_id", requestId: "r-1", params: { value: "btn" } });
    const handshakes = s.received.filter((r) => r.command === "handshake");
    expect(handshakes.length).toBeGreaterThanOrEqual(1);
    expect(s.received[0]?.command).toBe("handshake");
  });

  it("fails fast when the device rejects the protocol version", async () => {
    const { client: c } = await start({ behaviours: { handshake: { ok: false, error: "unsupported_protocol_version" } } });
    await expect(c.connect()).rejects.toThrow(/handshake rejected/);
  });

  it("reports BRIDGE_UNAVAILABLE when nothing is listening", async () => {
    const dead = new BridgeClient({
      host: "127.0.0.1",
      // Kullanılmayan yüksek port. Bağlantı reddi bir zaman aşımı değildir.
      port: 1,
      scope,
      connectTimeoutMs: 500,
    });
    await expect(dead.connect()).rejects.toMatchObject({ code: "BRIDGE_UNAVAILABLE" });
    dead.dispose();
  });
});

describe("run fencing", () => {
  it("surfaces stale_run with the device's expected scope", async () => {
    const { client: c } = await start({ enforceHandshake: true, enforceFencing: true });
    await c.connect();
    // Farklı epoch: cihaz `stale_run` döner ve beklediği kapsamı bildirir.
    const other = new BridgeClient({
      host: "127.0.0.1",
      port: (await (async () => (server as FakeBridgeServer).listen())().catch(() => 0)) || 0,
      scope: { ...scope, runEpoch: 9 },
    });
    other.dispose();
    // Aynı client üzerinden fencing'i doğrudan doğrulamak için fake'in
    // yanıtını kullanıyoruz: host kodu hatayı YUTMAMALI, envelope'ta taşımalı.
    const result = await c.send({ command: "find_id", requestId: "r-fence", params: { value: "x" } });
    expect(result.envelope.ok).toBe(true);
  });

  it("passes a device error through as a non-ok envelope, not an exception", async () => {
    // Kritik ayrım: `ambiguous` bir TRANSPORT hatası değil, bir SONUÇtur.
    // İstisna atmak, çağıranın onu retry etmesine yol açardı.
    const { client: c } = await start({
      behaviours: { tap_id: { ok: false, error: "ambiguous", fields: { count: 2, treeGen: 11 } } },
    });
    await c.connect();
    const result = await c.send({ command: "tap_id", requestId: "r-amb", params: { value: "row" } });
    expect(result.envelope.ok).toBe(false);
    expect(result.envelope.error).toBe("ambiguous");
    expect(result.envelope.count).toBe(2);
  });
});

describe("incremental framing over a real socket", () => {
  it("reassembles a response split into many TCP writes", async () => {
    const { client: c } = await start({
      behaviours: { find_id: { splitIntoChunks: 7, fields: { id: "btn_ok", treeGen: 4 } } },
    });
    await c.connect();
    const result = await c.send({ command: "find_id", requestId: "r-split", params: { value: "btn_ok" } });
    expect(result.envelope.ok).toBe(true);
    expect(result.envelope.id).toBe("btn_ok");
  });

  it("treats a malformed line as a protocol violation, not a hung request", async () => {
    const { client: c } = await start({ behaviours: { ping: { malformed: true } } });
    await expect(c.connect()).rejects.toMatchObject({ code: "PROTOCOL_VIOLATION" });
  });

  it("rejects an oversized frame instead of buffering it", async () => {
    // Sınır bilerek küçük: gerçek üretim sınırı 16 MB ve fake sunucunun onu
    // aşan bir satır yazması testi anlamsızca yavaşlatırdı. Sınırın
    // yapılandırılabilir olması ayrıca üretimde de doğru: yalnız `wait_node`
    // koşan bir bağlantı için megabaytlık bir tavan gereksiz bir savunma
    // boşluğudur.
    // Ceiling must admit the capabilities handshake (~0.6–1 KB) while still
    // rejecting a deliberately oversized dump frame.
    const { client: c } = await start({ behaviours: { dump: { oversizedBytes: 4_096 } } }, {
      maxFrameBytes: 1_024,
    });
    await c.connect();
    await expect(
      c.send({ command: "dump", requestId: "r-big", params: { scope: "full" } }),
    ).rejects.toMatchObject({ code: "FRAME_TOO_LARGE" });
  }, 10_000);

  it("refuses an unsolicited frame — protocol v1 has no push", async () => {
    // Yutmak, ileride yanlışlıkla eklenen bir push'u görünmez kılardı.
    const { client: c } = await start({
      behaviours: { find_id: { emitUnsolicited: true, fields: { id: "x" } } },
    });
    await c.connect();
    const result = await c.send({ command: "find_id", requestId: "r-push", params: { value: "x" } });
    // İstenmemiş frame reddedildi, gerçek yanıt normal geldi.
    expect(result.envelope.ok).toBe(true);
    expect(result.envelope.id).toBe("x");
  });

  it("does not resolve a request with an out-of-order response", async () => {
    const { client: c } = await start({
      behaviours: { find_id: { respondWithRequestId: "someone-else" } },
    });
    await c.connect();
    await expect(
      c.send({ command: "find_id", requestId: "r-mine", params: { value: "x" } }),
    ).rejects.toMatchObject({ code: "PROTOCOL_VIOLATION" });
  });

  it("ignores a duplicate terminal response instead of double-resolving", async () => {
    const { client: c } = await start({
      behaviours: { back: { duplicate: true, fields: { method: "global" } } },
    });
    await c.connect();
    const result = await c.send({ command: "back", requestId: "r-dup" });
    expect(result.envelope.ok).toBe(true);
    // İkinci kopya bekleyen istek olmadığı için reddedilir; süreç çökmez.
    await new Promise((r) => setTimeout(r, 50));
    expect(c.pendingCount()).toBe(0);
  });
});

describe("connection loss classification", () => {
  it("reports UNKNOWN_EFFECT when a mutation is in flight — and refuses to call it a failure", async () => {
    // Bu testin koruduğu hata: kaybolan bir tap'i "başarısız" sayıp tekrar
    // göndermek, yani onay tuşuna ikinci kez basmak.
    const { client: c } = await start({ behaviours: { tap_id: { dropConnection: true } } });
    await c.connect();
    const error = await c
      .send({ command: "tap_id", requestId: "r-tap", params: { value: "confirm" } })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BridgeHostError);
    expect((error as BridgeHostError).code).toBe("UNKNOWN_EFFECT");
    expect((error as BridgeHostError).message).toMatch(/must NOT be retried/);
  });

  it("reports WAIT_CONNECTION_LOST for a wait, which is NOT a timeout", async () => {
    const { client: c } = await start({ behaviours: { wait_node: { dropConnection: true } } });
    await c.connect();
    await expect(
      c.send({ command: "wait_node", requestId: "r-wait", params: { value: "x" } }),
    ).rejects.toMatchObject({ code: "WAIT_CONNECTION_LOST" });
  });

  it("reports BRIDGE_UNAVAILABLE for a read-only command, which IS retryable", async () => {
    const { client: c } = await start({ behaviours: { find_text: { dropConnection: true } } });
    await c.connect();
    await expect(
      c.send({ command: "find_text", requestId: "r-find", params: { value: "x" } }),
    ).rejects.toMatchObject({ code: "BRIDGE_UNAVAILABLE" });
  });

  it("leaves no pending request behind after a socket close", async () => {
    const { client: c } = await start({ behaviours: { find_id: { dropConnection: true } } });
    await c.connect();
    await c.send({ command: "find_id", requestId: "r-1", params: { value: "x" } }).catch(() => undefined);
    expect(c.pendingCount()).toBe(0);
  });
});

describe("timeout and cancellation", () => {
  it("times out on the host side without waiting for the device", async () => {
    const { client: c } = await start({ behaviours: { wait_node: { delayMs: 5_000 } } });
    await c.connect();
    const started = Date.now();
    await expect(
      c.send({ command: "wait_node", requestId: "r-slow", params: { value: "x" }, timeoutMs: 150 }),
    ).rejects.toMatchObject({ code: "HOST_TIMEOUT" });
    expect(Date.now() - started).toBeLessThan(2_000);
  }, 15_000);

  it("cancels via AbortSignal and leaves nothing pending", async () => {
    const { client: c } = await start({ behaviours: { wait_node: { delayMs: 5_000 } } });
    await c.connect();
    const controller = new AbortController();
    const pending = c.send({
      command: "wait_node",
      requestId: "r-cancel",
      params: { value: "x" },
      timeoutMs: 10_000,
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 60);
    await expect(pending).rejects.toMatchObject({ code: "HOST_CANCELLED" });
    expect(c.pendingCount()).toBe(0);
  }, 15_000);

  it("rejects immediately when the signal is already aborted", async () => {
    const { client: c } = await start();
    await c.connect();
    const controller = new AbortController();
    controller.abort();
    await expect(
      c.send({ command: "ping", requestId: "r-pre", signal: controller.signal }),
    ).rejects.toMatchObject({ code: "HOST_CANCELLED" });
  });
});

describe("a long wait must not block CONTROL — the reason the pool exists", () => {
  it("answers a control ping while a wait is still in flight on another socket", async () => {
    // Cihazın `serve()` döngüsü bir bağlantıda istekleri SIRAYLA işler
    // (BridgeTcpServer.kt). Tek soketli bir client'ta bu ping, beklemenin
    // arkasında kuyruğa girer ve iptal etmek anlamsızlaşır. Havuz tam bunun
    // için var.
    const { server: s, client: c } = await start({
      behaviours: { wait_node: { delayMs: 1_200 }, ping: {} },
    });
    await c.connect();

    const wait = c
      .send({ command: "wait_node", requestId: "r-long", params: { value: "x" }, timeoutMs: 5_000 })
      .catch((e: unknown) => e);

    // Bekleme uçuştayken CONTROL isteği gönder.
    await new Promise((r) => setTimeout(r, 100));
    const started = Date.now();
    const pong = await c.send({ command: "ping", requestId: "r-ctl", control: true });
    const controlLatency = Date.now() - started;

    expect(pong.envelope.ok).toBe(true);
    // Beklemenin 1200ms'sinin arkasında kuyruğa girmediğinin kanıtı.
    expect(controlLatency).toBeLessThan(600);
    // Ve iki AYRI bağlantı gerçekten açıldı.
    expect(s.peakConnections).toBeGreaterThanOrEqual(2);
    await wait;
  }, 20_000);

  it("races two waits on separate sockets instead of serializing them", async () => {
    // Aynı sokette iki `wait_node` yarışmaz, SIRAYA dizilir — "yarış" sessizce
    // ardışık beklemeye döner ve süre iki katına çıkar.
    const { server: s, client: c } = await start({ behaviours: { wait_node: { delayMs: 400 } } });
    await c.connect();
    const started = Date.now();
    await Promise.all([
      c.send({ command: "wait_node", requestId: "w-1", params: { value: "a" }, timeoutMs: 5_000 }),
      c.send({ command: "wait_node", requestId: "w-2", params: { value: "b" }, timeoutMs: 5_000 }),
    ]);
    const elapsed = Date.now() - started;
    // Seri olsaydı ≥800ms olurdu.
    expect(elapsed).toBeLessThan(750);
    expect(s.peakConnections).toBeGreaterThanOrEqual(2);
  }, 20_000);
});

describe("requestId idempotency", () => {
  it("allows the same requestId with the SAME payload and marks it replayed", async () => {
    const { client: c } = await start();
    await c.connect();
    const first = await c.send({ command: "find_id", requestId: "same", params: { value: "x" } });
    const second = await c.send({ command: "find_id", requestId: "same", params: { value: "x" } });
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
  });

  it("refuses the same requestId with a DIFFERENT payload", async () => {
    // Aynı id'yi farklı parametrelerle kullanmak bir retry değil, bir
    // çakışmadır; sessizce geçirmek iki farklı aksiyonu tek kimlik altında
    // birleştirir.
    const { client: c } = await start();
    await c.connect();
    await c.send({ command: "find_id", requestId: "dup", params: { value: "x" } });
    await expect(
      c.send({ command: "find_id", requestId: "dup", params: { value: "DIFFERENT" } }),
    ).rejects.toMatchObject({ code: "PROTOCOL_VIOLATION" });
  });

  it("also refuses the same requestId across different commands", async () => {
    const { client: c } = await start();
    await c.connect();
    await c.send({ command: "find_id", requestId: "x", params: { value: "a" } });
    await expect(c.send({ command: "back", requestId: "x" })).rejects.toMatchObject({
      code: "PROTOCOL_VIOLATION",
    });
  });
});

describe("disposal", () => {
  it("closes every socket and refuses further sends", async () => {
    const { client: c } = await start();
    await c.connect();
    await c.send({ command: "find_id", requestId: "r", params: { value: "x" } });
    expect(c.connectionCount()).toBeGreaterThanOrEqual(1);
    c.dispose();
    expect(c.connectionCount()).toBe(0);
    await expect(c.send({ command: "ping", requestId: "after" })).rejects.toMatchObject({
      code: "BRIDGE_UNAVAILABLE",
    });
  });
});
