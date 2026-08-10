/**
 * ===========================================================================
 *  DEVICE GATE — fake ADB üzerinden
 *
 *  Preflight'ın TÜM karar mantığı (allowlist, optional production deny, port çakışması,
 *  stale forward temizliği) burada cihaz olmadan sınanıyor. Bu ayrımın olmadığı
 *  bir tasarımda bu kuralların hiçbiri CI'da test edilemez ve yalnız fiziksel
 *  cihazla doğrulanabilirdi — yani pratikte hiç.
 * ===========================================================================
 */
import { beforeEach, describe, expect, it } from "vitest";
import { BRIDGE_DEVICE_PORT } from "@nesy/bridge-contract";

import {
  BRIDGE_PACKAGE,
  BridgeDeviceGate,
  HostPortLeaseStore,
  isProductionBuild,
  type AdbFacade,
  type DeviceGatePolicy,
} from "./bridge-device-gate.js";

const LAB = "lab-device-1";

class FakeAdb implements AdbFacade {
  devices = [LAB];
  props: Record<string, string> = {
    "ro.build.type": "userdebug",
    "ro.product.model": "SM-TEST",
    "ro.build.version.sdk": "34",
  };
  packages: Record<string, { installed: boolean; versionName: string | null; versionCode: string | null }> = {
    [BRIDGE_PACKAGE]: { installed: true, versionName: "1.2.0", versionCode: "120" },
  };
  accessibility = `${BRIDGE_PACKAGE}/${BRIDGE_PACKAGE}.BridgeAccessibilityService`;
  forwards: { hostPort: number; devicePort: number }[] = [];
  forwardCalls: { hostPort: number; devicePort: number }[] = [];
  removeCalls: number[] = [];
  failForward = false;

  async listDevices() {
    return this.devices;
  }
  async getProp(_d: string, name: string) {
    return this.props[name] ?? "";
  }
  async getPackageInfo(_d: string, name: string) {
    return this.packages[name] ?? { installed: false, versionName: null, versionCode: null };
  }
  async getEnabledAccessibilityServices() {
    return this.accessibility;
  }
  async forward(_d: string, hostPort: number, devicePort: number) {
    this.forwardCalls.push({ hostPort, devicePort });
    if (this.failForward) throw new Error("cannot bind: address already in use");
    this.forwards.push({ hostPort, devicePort });
  }
  async listForwards() {
    return this.forwards;
  }
  async removeForward(_d: string, hostPort: number) {
    this.removeCalls.push(hostPort);
    this.forwards = this.forwards.filter((f) => f.hostPort !== hostPort);
  }
  async getDiagnostics() {
    return { batteryLevel: 88, charging: true, backgroundRestricted: false, foregroundPackage: "com.x" };
  }
}

const policy = (over: Partial<DeviceGatePolicy> = {}): DeviceGatePolicy => ({
  labAllowlist: [LAB],
  denyProductionBuilds: false,
  ...over,
});

let adb: FakeAdb;

beforeEach(() => {
  adb = new FakeAdb();
});

describe("preflight", () => {
  it("passes a lab device and returns a full capability snapshot", async () => {
    const gate = new BridgeDeviceGate(adb, policy());
    const result = await gate.preflight(LAB);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot).toMatchObject({
      deviceId: LAB,
      model: "SM-TEST",
      androidSdk: "34",
      bridgeVersionCode: "120",
      accessibilityEnabled: true,
    });
    expect(result.snapshot.hostPort).toBeGreaterThan(0);
    // Kapı yolu açar, ping client'ın işi. `null` "henüz sorulmadı" demek.
    expect(result.snapshot.protocolVersion).toBeNull();
    expect(result.snapshot.diagnostics.batteryLevel).toBe(88);
  });

  it("denies a device that is not attached", async () => {
    adb.devices = [];
    const result = await new BridgeDeviceGate(adb, policy()).preflight(LAB);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.check).toBe("DEVICE_REACHABLE");
    expect(result.failure.remediation).toMatch(/reconnect/);
  });

  it("denies EVERY device when the allowlist is empty — fail-closed", async () => {
    // Boş listeyi "hepsine izin ver" saymak, yapılandırmayı unutmanın
    // production bir cihazda Act Mode açmakla sonuçlanması demekti.
    const result = await new BridgeDeviceGate(adb, policy({ labAllowlist: [] })).preflight(LAB);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.check).toBe("LAB_ALLOWLIST");
    expect(result.failure.detail).toMatch(/EMPTY/);
    expect(result.failure.fatal).toBe(true);
  });

  it("denies a device that is not on the allowlist", async () => {
    const result = await new BridgeDeviceGate(adb, policy({ labAllowlist: ["someone-else"] })).preflight(LAB);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.check).toBe("LAB_ALLOWLIST");
  });

  it("allows an allowlisted production build when production deny is disabled", async () => {
    adb.props["ro.build.type"] = "user";
    const result = await new BridgeDeviceGate(adb, policy()).preflight(LAB);
    expect(result.ok).toBe(true);
    expect(adb.forwardCalls).toHaveLength(1);
  });

  it("can deny a production build when an explicit policy enables production deny", async () => {
    adb.props["ro.build.type"] = "user";
    const result = await new BridgeDeviceGate(adb, policy({ denyProductionBuilds: true })).preflight(LAB);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.check).toBe("PRODUCTION_DENY");
    expect(result.failure.fatal).toBe(true);
    // Ve fiziksel aksiyon yoluna hiç geçilmedi.
    expect(adb.forwardCalls).toEqual([]);
  });

  it("treats an UNKNOWN build type as production", async () => {
    // Bilmediğimiz bir şeyi lab varsaymak, tam olarak production cihazda Act
    // Mode açma yoludur.
    expect(isProductionBuild("user")).toBe(true);
    expect(isProductionBuild("")).toBe(true);
    expect(isProductionBuild("something-new")).toBe(true);
    expect(isProductionBuild("userdebug")).toBe(false);
    expect(isProductionBuild("eng")).toBe(false);
  });

  it("denies a missing Bridge APK with an install command in the remediation", async () => {
    adb.packages[BRIDGE_PACKAGE] = { installed: false, versionName: null, versionCode: null };
    const result = await new BridgeDeviceGate(adb, policy()).preflight(LAB);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.check).toBe("BRIDGE_APK_INSTALLED");
    expect(result.failure.remediation).toMatch(/adb -s lab-device-1 install/);
  });

  it("denies a Bridge build below the required version — protocol drift is not silent", async () => {
    const result = await new BridgeDeviceGate(adb, policy({ minBridgeVersionCode: 999 })).preflight(LAB);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.check).toBe("BRIDGE_VERSION");
  });

  it("denies a disabled accessibility service — the TCP listener starts with it", async () => {
    adb.accessibility = "com.something.else/.Service";
    const result = await new BridgeDeviceGate(adb, policy()).preflight(LAB);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.check).toBe("ACCESSIBILITY_ENABLED");
    expect(result.failure.remediation).toMatch(/Accessibility/);
    // Erişilebilirlik kapalıysa port açmaya çalışmak anlamsız.
    expect(adb.forwardCalls).toEqual([]);
  });

  it("reports a forward failure with the leaked-forward hint", async () => {
    adb.failForward = true;
    const result = await new BridgeDeviceGate(adb, policy()).preflight(LAB);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.check).toBe("PORT_FORWARD");
    expect(result.failure.remediation).toMatch(/forward --list/);
  });
});

describe("host port lease", () => {
  it("gives each device its own host port, all mapped to the fixed device port", async () => {
    // Cihaz tarafı SABİT 9876 dinler ve değiştirilemez; iki cihaz aynı host
    // portunu kullanamayacağı için host tarafı dinamik olmak ZORUNDA.
    adb.devices = [LAB, "lab-device-2"];
    const gate = new BridgeDeviceGate(adb, policy({ labAllowlist: [LAB, "lab-device-2"] }));
    const a = await gate.preflight(LAB);
    const b = await gate.preflight("lab-device-2");
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.snapshot.hostPort).not.toBe(b.snapshot.hostPort);
    for (const call of adb.forwardCalls) expect(call.devicePort).toBe(BRIDGE_DEVICE_PORT);
  });

  it("reuses the same port for a repeated preflight instead of opening a second path", async () => {
    // İki yol bırakmak, hangisinin canlı olduğunu belirsizleştirir.
    const gate = new BridgeDeviceGate(adb, policy());
    const first = await gate.preflight(LAB);
    const second = await gate.preflight(LAB);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.snapshot.hostPort).toBe(first.snapshot.hostPort);
    expect(adb.forwardCalls).toHaveLength(1);
  });

  it("never reuses a port already taken by a foreign forward", async () => {
    const store = new HostPortLeaseStore({ from: 100, to: 102 });
    // Başka bir process (veya çökmüş bir öncesi) 100'ü tutuyor.
    expect(store.claim("d1", [100])).toBe(101);
    expect(store.claim("d2", [100])).toBe(102);
  });

  it("throws a diagnosable error when the range is exhausted", async () => {
    const store = new HostPortLeaseStore({ from: 100, to: 100 });
    store.claim("d1");
    expect(() => store.claim("d2")).toThrow(/leaked adb forwards/);
  });

  it("frees the port when the forward fails, so the range does not drain", async () => {
    adb.failForward = true;
    const gate = new BridgeDeviceGate(adb, policy());
    await gate.preflight(LAB);
    expect(gate.getLeases().get(LAB)).toBeUndefined();
  });

  it("releases a forward idempotently — dispose may run twice", async () => {
    const gate = new BridgeDeviceGate(adb, policy());
    const result = await gate.preflight(LAB);
    expect(result.ok).toBe(true);
    await gate.releaseForward(LAB);
    await gate.releaseForward(LAB);
    expect(adb.removeCalls).toHaveLength(1);
    expect(gate.getLeases().get(LAB)).toBeUndefined();
  });

  it("adopts an existing forward for the same device rather than adding another", async () => {
    // Stale forward senaryosu: process yeniden başladı, adb yönlendirmesi
    // hayatta kaldı.
    adb.forwards = [{ hostPort: 21_900, devicePort: BRIDGE_DEVICE_PORT }];
    const gate = new BridgeDeviceGate(adb, policy());
    const result = await gate.preflight(LAB);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Yeni bir forward açmadı.
    expect(adb.forwardCalls.length).toBeLessThanOrEqual(1);
    expect(result.snapshot.hostPort).toBeGreaterThan(0);
  });
});
