/**
 * ===========================================================================
 *  GERÇEK ADB CEPHESİ  (Plan D.3 · RUN_PLAY 3.6)
 *
 *  `AdbFacade`ın tek gerçek implementasyonu. Ayrı bir dosya olmasının nedeni,
 *  `bridge-device-gate.ts`ın TAMAMEN test edilebilir kalması: kapının içindeki
 *  hiçbir karar (allowlist, production deny, port çakışması, stale forward)
 *  `execFile` çağırmıyor, dolayısıyla hepsi cihazsız sınanabiliyor.
 *
 *  Buradaki kod ise cihazsız sınanamaz ve bilinçli olarak KARAR İÇERMEZ:
 *  yalnız komut çalıştırır ve çıktıyı ayrıştırır.
 * ===========================================================================
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getAdbPathHint, resolveAdbPath } from "@nesy/platform-paths";

import type { AdbFacade, BridgeDeviceCapabilitySnapshot, DeviceGatePolicy } from "./bridge-device-gate.js";

const execFileAsync = promisify(execFile);

/** `adb` yolu — PATH'te olmayabilir; platform-paths ipucunu da dener. */
function adbBinary(): string {
  const resolved = resolveAdbPath();
  if (resolved === null) {
    throw new Error(`adb binary not found. ${getAdbPathHint()}`);
  }
  return resolved;
}

async function adb(args: string[], timeoutMs = 10_000): Promise<string> {
  const result = await execFileAsync(adbBinary(), args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 });
  return String(result.stdout);
}

/**
 * @param exec Test seam. Defaults to the real `adb` child process.
 */
export function createAdbFacade(exec: (args: string[], timeoutMs?: number) => Promise<string> = adb): AdbFacade {
  const adb = exec
  return {
    async listDevices() {
      const out = await adb(["devices"]);
      return out
        .split("\n")
        .slice(1)
        .map((line) => line.trim())
        .filter((line) => line !== "" && !line.startsWith("*"))
        // Yalnız `device` durumundakiler: `unauthorized`/`offline` bir cihaz
        // bağlı GÖRÜNÜR ama hiçbir komutu kabul etmez, ve onu hazır saymak
        // preflight'ı bir sonraki adımda anlamsız bir hatayla patlatır.
        .filter((line) => /\bdevice\b/.test(line))
        .map((line) => line.split(/\s+/)[0] ?? "")
        .filter((id) => id !== "");
    },

    async getProp(deviceId, name) {
      return (await adb(["-s", deviceId, "shell", "getprop", name])).trim();
    },

    async getPackageInfo(deviceId, packageName) {
      // `dumpsys package` çıktısı sürümler arasında değişir; bu yüzden
      // "kurulu mu" sorusu `pm list packages` ile, sürüm ise dumpsys ile
      // ayrı ayrı yanıtlanıyor. Tek çıktıya güvenmek, bir Android sürümünde
      // sessizce "kurulu değil" demeye yol açardı.
      const list = await adb(["-s", deviceId, "shell", "pm", "list", "packages", packageName]);
      const installed = list.split("\n").some((line) => line.trim() === `package:${packageName}`);
      if (!installed) return { installed: false, versionName: null, versionCode: null };

      const info = await adb(["-s", deviceId, "shell", "dumpsys", "package", packageName]).catch(() => "");
      const versionName = /versionName=([^\s]+)/.exec(info)?.[1] ?? null;
      const versionCode = /versionCode=(\d+)/.exec(info)?.[1] ?? null;
      return { installed: true, versionName, versionCode };
    },

    async getEnabledAccessibilityServices(deviceId) {
      const out = await adb([
        "-s",
        deviceId,
        "shell",
        "settings",
        "get",
        "secure",
        "enabled_accessibility_services",
      ]);
      const value = out.trim();
      // `null` string'i gerçek bir değer değil, "hiç ayarlanmamış" demek.
      return value === "null" ? "" : value;
    },

    async isAccessibilityMasterEnabled(deviceId) {
      const out = await adb([
        "-s",
        deviceId,
        "shell",
        "settings",
        "get",
        "secure",
        "accessibility_enabled",
      ]);
      return out.trim() === "1";
    },

    async restoreAccessibilityService(deviceId, component) {
      // Writing `accessibility_enabled=1` on its own does NOT rebind the service:
      // measured on a Samsung SM-A346E where the master switch read 1, the service
      // was still listed, and no bridge process existed. AccessibilityManagerService
      // only re-binds when the SERVICE LIST transitions, so the list is cleared and
      // rewritten to force that transition.
      //
      // THE MASTER SWITCH IS NEVER WRITTEN TO 0 HERE, and that ordering is the
      // point. This used to begin with `accessibility_enabled=0` and end with
      // `=1`, four separate adb calls with no transaction between them. Anything
      // that killed the host mid-sequence — an API restart under `tsx watch`, a
      // cancelled command — left the DEVICE with accessibility globally disabled
      // and the service still listed. Observed exactly that: master `0`, service
      // present, no bridge process, and the only visible symptom was "the bridge
      // suddenly broke". That is not a test-harness failure, it is the harness
      // silently turning off an accessibility feature on someone's phone.
      //
      // The list transition alone still forces the rebind, so every interruption
      // point now leaves the device no worse than "a service is missing from the
      // list", which the next preflight detects and repairs.
      await adb(["-s", deviceId, "shell", "settings", "delete", "secure", "enabled_accessibility_services"]);
      await adb([
        "-s",
        deviceId,
        "shell",
        "settings",
        "put",
        "secure",
        "enabled_accessibility_services",
        component,
      ]);
      await adb(["-s", deviceId, "shell", "settings", "put", "secure", "accessibility_enabled", "1"]);
    },

    async forward(deviceId, hostPort, devicePort) {
      // `--no-rebind` ŞART: onsuz ikinci bir forward sessizce ilkini çalar ve
      // iki cihaz aynı host portundan konuşur — komutlar YANLIŞ cihaza gider.
      await adb(["-s", deviceId, "forward", "--no-rebind", `tcp:${String(hostPort)}`, `tcp:${String(devicePort)}`]);
    },

    async listForwards(deviceId) {
      const out = await adb(["-s", deviceId, "forward", "--list"]).catch(() => "");
      return out
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith(deviceId))
        .flatMap((line) => {
          const match = /tcp:(\d+)\s+tcp:(\d+)/.exec(line);
          if (!match) return [];
          return [{ hostPort: Number(match[1]), devicePort: Number(match[2]) }];
        });
    },

    async removeForward(deviceId, hostPort) {
      await adb(["-s", deviceId, "forward", "--remove", `tcp:${String(hostPort)}`]);
    },

    async getDiagnostics(deviceId): Promise<BridgeDeviceCapabilitySnapshot["diagnostics"]> {
      // Teşhis alanları BEST-EFFORT: biri okunamazsa preflight'ı bozmaz.
      // Bozması yanlış olurdu — pil seviyesini okuyamamak Bridge'in
      // çalışmadığı anlamına gelmez.
      const battery = await adb(["-s", deviceId, "shell", "dumpsys", "battery"]).catch(() => "");
      const level = /level:\s*(\d+)/.exec(battery)?.[1];
      const acPowered = /AC powered:\s*(true|false)/.exec(battery)?.[1];
      const usbPowered = /USB powered:\s*(true|false)/.exec(battery)?.[1];

      const focus = await adb(["-s", deviceId, "shell", "dumpsys", "window", "displays"]).catch(() => "");
      const foreground = /mCurrentFocus=.*?\s([A-Za-z0-9_.]+)\//.exec(focus)?.[1] ?? null;

      // Samsung freecess / app standby: uzun beklemeleri sessizce öldürür, bu
      // yüzden teşhiste görünmesi gerekiyor.
      const standby = await adb([
        "-s",
        deviceId,
        "shell",
        "dumpsys",
        "deviceidle",
        "get",
        "light",
      ]).catch(() => "");

      return {
        batteryLevel: level === undefined ? null : Number(level),
        charging: acPowered === undefined && usbPowered === undefined ? null : acPowered === "true" || usbPowered === "true",
        backgroundRestricted: standby.trim() === "" ? null : /IDLE/i.test(standby),
        foregroundPackage: foreground,
      };
    },
  };
}

/**
 * Lab allowlist'i ortamdan okur.
 *
 * `VERDICT_BRIDGE_LAB_DEVICES` virgülle ayrılmış cihaz kimlikleri. TANIMSIZ
 * bırakılırsa liste BOŞ kalır ve kapı HİÇBİR cihazı kabul etmez. Production
 * build ayrımı yapılmaz; operatör izni allowlist üzerinden verilir.
 */
export function resolveDeviceGatePolicy(): DeviceGatePolicy {
  const raw = process.env.VERDICT_BRIDGE_LAB_DEVICES ?? "";
  const labAllowlist = raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id !== "");
  const minVersion = Number(process.env.VERDICT_BRIDGE_MIN_VERSION_CODE ?? "");
  return {
    labAllowlist,
    denyProductionBuilds: false,
    ...(Number.isFinite(minVersion) && minVersion > 0 ? { minBridgeVersionCode: minVersion } : {}),
  };
}
