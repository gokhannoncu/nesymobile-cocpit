/**
 * ===========================================================================
 *  BRIDGE DEVICE MANAGER — uçtan uca, gerçek TCP fake bridge üzerinden
 *
 *  Buradaki testlerin ortak konusu şu: bir fiziksel aksiyonun cihaza GİTMEMESİ
 *  gereken durumlar. Hepsi sessiz arıza üreten yollar — bir tap "başarılı"
 *  döner, yanlış satıra iner, ve hiçbir yerde hata çıkmaz.
 * ===========================================================================
 */
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { BridgeClient, FakeBridgeServer, type FakeBridgeOptions } from "@nesy/bridge-client";
import type { TargetFingerprint } from "@nesy/bridge-contract";

import { resetAdmissionSchedulersForTests } from "./bridge-admission.js";
import {
  BRIDGE_PACKAGE,
  BridgeDeviceGate,
  type AdbFacade,
} from "./bridge-device-gate.js";
import { BridgeDeviceManager, BridgeUnavailableError } from "./bridge-device-manager.js";

const DEVICE = "lab-1";
const scope = { runId: "run-1", sessionId: "sess-1", runEpoch: 2 };

class FakeAdb implements AdbFacade {
  installed = true;
  accessibility = `${BRIDGE_PACKAGE}/${BRIDGE_PACKAGE}.BridgeAccessibilityService`;
  buildType = "userdebug";
  forwards: { hostPort: number; devicePort: number }[] = [];
  removed: number[] = [];
  constructor(private readonly hostPort: number) {}
  async listDevices() {
    return [DEVICE];
  }
  async getProp(_d: string, name: string) {
    if (name === "ro.build.type") return this.buildType;
    if (name === "ro.product.model") return "SM-TEST";
    return "34";
  }
  async getPackageInfo() {
    return { installed: this.installed, versionName: "1.0.0", versionCode: "100" };
  }
  async getEnabledAccessibilityServices() {
    return this.accessibility;
  }
  async forward(_d: string, hostPort: number, devicePort: number) {
    this.forwards.push({ hostPort, devicePort });
  }
  async listForwards() {
    return this.forwards;
  }
  async removeForward(_d: string, hostPort: number) {
    this.removed.push(hostPort);
  }
  async getDiagnostics() {
    return { batteryLevel: 50, charging: false, backgroundRestricted: false, foregroundPackage: null };
  }
  /** Gerçek fake bridge portunu manager'a taşımak için. */
  actualPort() {
    return this.hostPort;
  }
}

let server: FakeBridgeServer | null = null;
let manager: BridgeDeviceManager | null = null;
let artifactRoot: string | null = null;

async function start(options: FakeBridgeOptions = {}, adbOver: Partial<FakeAdb> = {}) {
  resetAdmissionSchedulersForTests();
  server = new FakeBridgeServer(options);
  const port = await server.listen();
  const adb = Object.assign(new FakeAdb(port), adbOver);
  const gate = new BridgeDeviceGate(adb, { labAllowlist: [DEVICE], denyProductionBuilds: true });
  artifactRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bridge-artifacts-"));
  manager = new BridgeDeviceManager({
    deviceId: DEVICE,
    gate,
    scope,
    artifactRoot,
    // Kapının verdiği dinamik port yerine fake sunucunun GERÇEK portuna bağlan:
    // bu test port tahsisini değil, manager akışını sınıyor.
    createClient: (_host, _leasePort, s) =>
      new BridgeClient({ host: "127.0.0.1", port, scope: s, defaultTimeoutMs: 3_000, maxConnections: 6 }),
  });
  return { server, manager, adb, gate };
}

afterEach(async () => {
  await manager?.dispose();
  manager = null;
  await server?.close();
  server = null;
  if (artifactRoot) await fs.rm(artifactRoot, { recursive: true, force: true });
  artifactRoot = null;
});

const strong: TargetFingerprint = {
  version: 1,
  selector: { by: "id", value: "btn_confirm" },
  rowKey: "entity-42",
};
const weak: TargetFingerprint = {
  version: 1,
  selector: { by: "text", value: "Onayla" },
  rowIndexHint: 3,
};

describe("readiness", () => {
  it("connects after preflight and exposes the capability snapshot", async () => {
    const { manager: m } = await start();
    const snapshot = await m.ensureReady();
    expect(snapshot.deviceId).toBe(DEVICE);
    expect(snapshot.protocolVersion).toBe(1);
    expect(m.getCapabilities()?.supportsWaitAny).toBe(false);
    expect(m.getScheduler().getState().deviceReady).toBe(true);
  });

  it("throws BridgeUnavailableError with remediation instead of falling back", async () => {
    // Fallback cazip görünür — "en azından bir şey yapmış oluruz" — ama
    // yaptığı şey kanıtı sessizce koordinat tabanlı bir tap'e indirmek.
    const { manager: m } = await start({}, { installed: false } as Partial<FakeAdb>);
    const error = await m.ensureReady().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BridgeUnavailableError);
    expect((error as BridgeUnavailableError).failure.check).toBe("BRIDGE_APK_INSTALLED");
    expect((error as BridgeUnavailableError).failure.remediation).toMatch(/install/);
    // Ve komut gönderme yolu kapalı kaldı.
    expect(m.getScheduler().getState().deviceReady).toBe(false);
  });

  it("refuses a production device before any socket is opened", async () => {
    const { manager: m, server: s } = await start({}, { buildType: "user" } as Partial<FakeAdb>);
    await expect(m.ensureReady()).rejects.toBeInstanceOf(BridgeUnavailableError);
    expect(s.received).toEqual([]);
  });
});

describe("target admission before any physical action", () => {
  it("REJECTS a row-index-only target without touching the device", async () => {
    const { manager: m, server: s } = await start();
    await m.ensureReady();
    const before = s.received.length;

    const record = await m.act("tap_text", weak);
    expect(record.terminalState).toBe("REJECTED");
    expect(record.error).toBe("ROW_INDEX_HINT_NOT_IDENTITY");
    // Cihaza HİÇ gitmedi → hiçbir şey olmadığı kesin → güvenle tekrar denenebilir.
    expect(s.received.length).toBe(before);
  });

  it("does not tap an AMBIGUOUS target", async () => {
    const { manager: m, server: s } = await start({
      behaviours: { find_id: { ok: false, error: "ambiguous", fields: { matched: 2, treeGen: 4 } } },
    });
    await m.ensureReady();
    const record = await m.act("tap_id", strong);
    expect(record.terminalState).toBe("FAILED");
    expect(record.error).toBe("ambiguous");
    expect(record.resolution?.outcome).toBe("AMBIGUOUS");
    // Çözümleme çağrıldı ama tap GÖNDERİLMEDİ.
    expect(s.received.map((r) => r.command)).toContain("find_id");
    expect(s.received.map((r) => r.command)).not.toContain("tap_id");
  });

  it("does not tap when the tree is stale", async () => {
    const { manager: m, server: s } = await start({
      behaviours: { find_id: { ok: false, error: "stale_tree", fields: { treeGen: 9 } } },
    });
    await m.ensureReady();
    const record = await m.act("tap_id", strong);
    expect(record.terminalState).toBe("FAILED");
    expect(record.resolution?.outcome).toBe("STALE_TREE");
    expect(s.received.map((r) => r.command)).not.toContain("tap_id");
  });

  it("sends expectTreeGen so a tree change is REFUSED rather than mis-tapped", async () => {
    const { manager: m, server: s } = await start({
      behaviours: {
        find_id: { fields: { treeGen: 17, id: "btn_confirm" } },
        tap_id: { fields: { method: "gesture", gestureStartMonoTs: 100, gestureEndMonoTs: 180 } },
      },
    });
    await m.ensureReady();
    const record = await m.act("tap_id", strong);
    expect(record.terminalState).toBe("SUCCEEDED");
    const tap = s.received.find((r) => r.command === "tap_id");
    expect(tap?.params.expectTreeGen).toBe(17);
    // Jest penceresi kanıt olarak saklandı — elle dokunuş kirlenmesini ayırt
    // etmenin tek yolu.
    expect(record.markers.map((mk) => mk.phase)).toContain("GESTURE_STARTED");
    expect(record.markers.map((mk) => mk.phase)).toContain("GESTURE_COMPLETED");
    expect(record.method).toBe("gesture");
  });

  it("reports UNKNOWN_EFFECT when the tap response is lost", async () => {
    // Bu kaydın `FAILED` olması, retry'ı meşrulaştırıp onay tuşuna ikinci kez
    // basmakla sonuçlanırdı.
    const { manager: m } = await start({
      behaviours: {
        find_id: { fields: { treeGen: 1, id: "btn_confirm" } },
        tap_id: { dropConnection: true },
      },
    });
    await m.ensureReady();
    const record = await m.act("tap_id", strong);
    expect(record.terminalState).toBe("UNKNOWN_EFFECT");
    expect(record.error).toBe("UNKNOWN_EFFECT");
  });

  it("keeps a full action log with exactly one terminal state each", async () => {
    const { manager: m } = await start({
      behaviours: { find_id: { fields: { treeGen: 1 } }, tap_id: { fields: { method: "semantic" } } },
    });
    await m.ensureReady();
    await m.act("tap_id", strong);
    await m.act("tap_text", weak);
    const log = m.getActionLog();
    expect(log).toHaveLength(2);
    for (const record of log) expect(record.terminalState).not.toBeNull();
  });
});

describe("scoped dump", () => {
  it("never falls back to a full dump when a scoped read fails", async () => {
    const { manager: m, server: s } = await start({
      behaviours: { dump: { ok: false, error: "root_unavailable" } },
    });
    await m.ensureReady();
    const envelope = await m.dump({ kind: "subtree", rootId: "list_root", maxDepth: 2 });
    expect(envelope.ok).toBe(false);
    // Tek bir dump isteği gitti ve `full` DEĞİLDİ.
    const dumps = s.received.filter((r) => r.command === "dump");
    expect(dumps).toHaveLength(1);
    expect(dumps[0]?.params.scope).toBe("subtree");
  });
});

describe("screenshot artifact", () => {
  it("writes the PNG to disk and never logs the image bytes", async () => {
    const png = Buffer.from("fake-png-bytes-that-are-long-enough-to-matter").toString("base64");
    const logs: string[] = [];
    resetAdmissionSchedulersForTests();
    server = new FakeBridgeServer({
      behaviours: { screenshot: { fields: { format: "png", encoding: "base64", width: 1080, height: 2400, data: png } } },
    });
    const port = await server.listen();
    const adb = new FakeAdb(port);
    const gate = new BridgeDeviceGate(adb, { labAllowlist: [DEVICE], denyProductionBuilds: true });
    artifactRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bridge-artifacts-"));
    manager = new BridgeDeviceManager({
      deviceId: DEVICE,
      gate,
      scope,
      artifactRoot,
      logger: (m) => logs.push(m),
      createClient: (_h, _p, s) => new BridgeClient({ host: "127.0.0.1", port, scope: s, maxConnections: 4 }),
    });
    await manager.ensureReady();

    const artifact = await manager.screenshot({ label: "after-tap" });
    expect(artifact.byteLength).toBeGreaterThan(0);
    expect(artifact.width).toBe(1080);
    expect(await fs.readFile(artifact.filePath)).toEqual(Buffer.from(png, "base64"));

    // Log satırı boyut ve özet taşır, GÖRÜNTÜ taşımaz. Base64'ü loglamak
    // ekranın tamamını log toplayıcıya göndermek olurdu.
    const joined = logs.join("\n");
    expect(joined).toContain("sha256=");
    expect(joined).not.toContain(png);
  });

  it("redacts typed text and image data from a diagnostic summary", async () => {
    const { manager: m } = await start();
    await m.ensureReady();
    const summary = m.describeLast({
      ok: true,
      requestId: "r",
      monoTs: 1,
      protocolVersion: 1,
      data: "SECRET-IMAGE-DATA",
      text: "hunter2",
    });
    expect(summary).not.toContain("hunter2");
    expect(summary).not.toContain("SECRET-IMAGE-DATA");
  });
});

describe("disposal", () => {
  it("releases the socket, the forward and the readiness flag", async () => {
    const { manager: m, adb } = await start();
    await m.ensureReady();
    await m.dispose();
    expect(adb.removed.length).toBeGreaterThanOrEqual(1);
    expect(m.getScheduler().getState().deviceReady).toBe(false);
    expect(m.getSnapshot()).toBeNull();
  });

  it("is idempotent — dispose may run twice", async () => {
    const { manager: m } = await start();
    await m.ensureReady();
    await m.dispose();
    await expect(m.dispose()).resolves.toBeUndefined();
  });
});
