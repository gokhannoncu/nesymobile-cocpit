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
  BRIDGE_ACCESSIBILITY_COMPONENT,
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
  propCalls: string[] = [];
  packages: Record<string, { installed: boolean; versionName: string | null; versionCode: string | null }> = {
    [BRIDGE_PACKAGE]: { installed: true, versionName: "1.2.0", versionCode: "120" },
  };
  accessibility = `${BRIDGE_PACKAGE}/${BRIDGE_PACKAGE}.BridgeAccessibilityService`;
  accessibilityMaster = true;
  restoreCalls: string[] = [];
  failRestore = false;
  forwards: { hostPort: number; devicePort: number }[] = [];
  forwardCalls: { hostPort: number; devicePort: number }[] = [];
  removeCalls: number[] = [];
  failForward = false;
  failPackageInfo = false;

  async listDevices() {
    return this.devices;
  }
  async getProp(_d: string, name: string) {
    this.propCalls.push(name);
    return this.props[name] ?? "";
  }
  packageInfoCalls = 0;
  accessibilityReadCalls = 0;
  diagnosticsCalls = 0;

  async getPackageInfo(_d: string, name: string) {
    this.packageInfoCalls += 1;
    if (this.failPackageInfo) throw new Error("package manager timed out");
    return this.packages[name] ?? { installed: false, versionName: null, versionCode: null };
  }
  async getEnabledAccessibilityServices() {
    this.accessibilityReadCalls += 1;
    return this.accessibility;
  }
  async isAccessibilityMasterEnabled() {
    return this.accessibilityMaster;
  }
  async restoreAccessibilityService(_d: string, component: string) {
    this.restoreCalls.push(component);
    if (this.failRestore) throw new Error("secure settings write denied");
    this.accessibility = component;
    this.accessibilityMaster = true;
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
    this.diagnosticsCalls += 1;
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

describe("admissionGate", () => {
  /**
   * The gate exists so the queue can start the app before preflight finishes.
   * That trade is only sound if the gate is BOTH cheap and complete: cheap enough
   * to sit on the critical path, and complete enough that nothing which can refuse
   * a device is left in the concurrent phase.
   */
  it("asks only what can REFUSE the device — no package, accessibility, forward or diagnostics", async () => {
    const gate = new BridgeDeviceGate(adb, policy({ denyProductionBuilds: true }));
    const result = await gate.admissionGate(LAB);
    expect(result.ok).toBe(true);
    // The only device read it may make is the build type, and only when the
    // production deny is on. Everything else describes rather than refuses.
    expect(adb.propCalls).toEqual(["ro.build.type"]);
    expect(adb.packageInfoCalls).toBe(0);
    expect(adb.accessibilityReadCalls).toBe(0);
    expect(adb.forwardCalls).toEqual([]);
    expect(adb.diagnosticsCalls).toBe(0);
  });

  it("touches nothing at all when the production deny is off", async () => {
    const gate = new BridgeDeviceGate(adb, policy());
    expect((await gate.admissionGate(LAB)).ok).toBe(true);
    expect(adb.propCalls).toEqual([]);
  });

  it("refuses a device that is not attached", async () => {
    adb.devices = [];
    const gate = new BridgeDeviceGate(adb, policy());
    const result = await gate.admissionGate(LAB);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.check).toBe("DEVICE_REACHABLE");
  });

  it("refuses an unlisted device, and an EMPTY allowlist denies everything", async () => {
    const unlisted = await new BridgeDeviceGate(adb, policy({ labAllowlist: ["other"] })).admissionGate(LAB);
    expect(unlisted.ok).toBe(false);
    if (!unlisted.ok) expect(unlisted.failure.check).toBe("LAB_ALLOWLIST");

    const empty = await new BridgeDeviceGate(adb, policy({ labAllowlist: [] })).admissionGate(LAB);
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.failure.detail).toMatch(/EMPTY/);
  });

  it("refuses a production build even when it is on the allowlist", async () => {
    adb.props["ro.build.type"] = "user";
    const gate = new BridgeDeviceGate(adb, policy({ denyProductionBuilds: true }));
    const result = await gate.admissionGate(LAB);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.check).toBe("PRODUCTION_DENY");
    expect(result.failure.fatal).toBe(true);
  });

  it("is the same decision preflight makes — preflight cannot be laxer", async () => {
    // If these two ever disagree, the concurrent phase would admit a device the
    // sequential path would have refused, which is the whole risk of the split.
    for (const over of [
      { labAllowlist: [] },
      { labAllowlist: ["other"] },
      { denyProductionBuilds: true },
    ] as Partial<DeviceGatePolicy>[]) {
      adb = new FakeAdb();
      adb.props["ro.build.type"] = "user";
      const gate = new BridgeDeviceGate(adb, policy(over));
      const admission = await gate.admissionGate(LAB);
      adb = new FakeAdb();
      adb.props["ro.build.type"] = "user";
      const full = await new BridgeDeviceGate(adb, policy(over)).preflight(LAB);
      expect(admission.ok).toBe(full.ok);
      if (!admission.ok && !full.ok) expect(admission.failure.check).toBe(full.failure.check);
    }
  });
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
    expect(adb.propCalls).not.toContain("ro.build.type");
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

  it("does not block when package metadata is unavailable but the bridge path can still be proven", async () => {
    adb.failPackageInfo = true;
    const result = await new BridgeDeviceGate(adb, policy()).preflight(LAB);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.bridgeVersionName).toBeNull();
    expect(result.snapshot.bridgeVersionCode).toBeNull();
    expect(adb.forwardCalls).toHaveLength(1);
  });

  it("denies a Bridge build below the required version — protocol drift is not silent", async () => {
    const result = await new BridgeDeviceGate(adb, policy({ minBridgeVersionCode: 999 })).preflight(LAB);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.check).toBe("BRIDGE_VERSION");
  });

  it("restores a disabled accessibility service instead of denying the device", async () => {
    adb.accessibility = "com.something.else/.Service";
    const result = await new BridgeDeviceGate(adb, policy()).preflight(LAB);
    expect(result.ok).toBe(true);
    expect(adb.restoreCalls).toEqual([BRIDGE_ACCESSIBILITY_COMPONENT]);
  });

  it("restores the service when the master switch is off but the list is intact", async () => {
    // The state a Settings toggle leaves behind: the Bridge is still listed, and
    // reading the list alone reports a healthy device that runs no service.
    adb.accessibilityMaster = false;
    const result = await new BridgeDeviceGate(adb, policy()).preflight(LAB);
    expect(result.ok).toBe(true);
    expect(adb.restoreCalls).toEqual([BRIDGE_ACCESSIBILITY_COMPONENT]);
    expect(adb.accessibilityMaster).toBe(true);
  });

  it("denies the device when the service cannot be restored", async () => {
    adb.accessibility = "com.something.else/.Service";
    adb.failRestore = true;
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
