/**
 * ===========================================================================
 *  DEVICE PREFLIGHT VE PORT LEASE  (Plan D.3 · RUN_PLAY 3.6)
 *
 *  ## Neden fail-closed
 *
 *  Bir Bridge komutu "çalışmadı"ysa sebebi düzinelerce olabilir: APK kurulu
 *  değil, erişilebilirlik servisi kapalı, `adb forward` başka bir cihaza
 *  bağlanmış, cihaz production. Bunları koşu sırasında keşfetmek, hepsinin
 *  "adım başarısız" diye raporlanmasına yol açar — ve gerçek sebep hiçbir
 *  yerde yazılı olmaz.
 *
 *  Preflight bu yüzden ÖNCE koşar ve her başarısızlık için EXACT sebep +
 *  yapılacak eylem üretir (`BridgePreflightFailure.remediation`). Sessiz
 *  fallback yok: Bridge yoksa legacy runner'a veya `adb shell input tap`'e
 *  düşmüyoruz (RUN_PLAY §13). O fallback, testin fiziksel aksiyon kanıtını
 *  sessizce koordinat tabanlı bir tap'e indirir.
 *
 *  ## Neden dinamik host portu
 *
 *  Cihaz tarafı SABİT `127.0.0.1:9876` dinler (`BridgeTcpServer`); değiştiremez.
 *  İki cihaz aynı host portunu kullanamayacağı için host tarafı DİNAMİK olmak
 *  zorunda: `adb forward tcp:<dynamic> tcp:9876`. `--no-rebind` şart —
 *  onsuz ikinci bir `forward` sessizce ilkini çalar ve iki cihaz aynı porttan
 *  konuşmaya başlar, yani komutlar YANLIŞ CİHAZA gider.
 * ===========================================================================
 */
import { BRIDGE_DEVICE_PORT } from "@nesy/bridge-contract";

/** Bridge APK'sının paket adı — cihazda `com.verdict.bridge` olarak kurulu. */
export const BRIDGE_PACKAGE = "com.verdict.bridge";

/** Erişilebilirlik servisinin tam bileşen adı. */
export const BRIDGE_ACCESSIBILITY_COMPONENT = `${BRIDGE_PACKAGE}/${BRIDGE_PACKAGE}.BridgeAccessibilityService`;

/** Host tarafı dinamik port aralığı. Ephemeral aralığın dışında seçildi. */
export const HOST_PORT_RANGE = { from: 21_876, to: 21_975 } as const;

export type PreflightCheck =
  | "DEVICE_REACHABLE"
  | "LAB_ALLOWLIST"
  | "PRODUCTION_DENY"
  | "BRIDGE_APK_INSTALLED"
  | "BRIDGE_VERSION"
  | "ACCESSIBILITY_ENABLED"
  | "PORT_FORWARD"
  | "BRIDGE_PING";

export interface BridgePreflightFailure {
  check: PreflightCheck;
  detail: string;
  /** Operatörün yapacağı somut eylem. Bunu yazmamak teşhisi yarım bırakır. */
  remediation: string;
  /** Bu hata cihaz/ortam politikası gereği mi (retry anlamsız)? */
  fatal: boolean;
}

export interface BridgeDeviceCapabilitySnapshot {
  deviceId: string;
  model: string | null;
  androidSdk: string | null;
  bridgeVersionName: string | null;
  bridgeVersionCode: string | null;
  accessibilityEnabled: boolean;
  hostPort: number;
  protocolVersion: number | null;
  /** Teşhis: pil ve arka plan kısıtlamaları uzun beklemeleri sessizce öldürür. */
  diagnostics: {
    batteryLevel: number | null;
    charging: boolean | null;
    /** Samsung freecess / app standby gibi kısıtlamalar. */
    backgroundRestricted: boolean | null;
    foregroundPackage: string | null;
  };
  checkedAt: number;
}

export type BridgePreflightResult =
  | { ok: true; snapshot: BridgeDeviceCapabilitySnapshot }
  | { ok: false; failure: BridgePreflightFailure; partial: Partial<BridgeDeviceCapabilitySnapshot> };

/**
 * ADB yüzeyi — port olarak soyutlandı.
 *
 * Gerçek `adb` yerine test edilebilir bir arayüz olması şart: preflight'ın
 * TÜM karar mantığı (allowlist, production deny, port çakışması, stale forward
 * temizliği) cihaz olmadan sınanabilmeli. Aksi halde bu kuralların hiçbiri
 * CI'da test edilemez ve yalnız fiziksel cihazla doğrulanabilirdi.
 */
export interface AdbFacade {
  /** `adb devices -l` — bağlı cihaz kimlikleri. */
  listDevices(): Promise<string[]>;
  /** `adb -s <id> shell getprop <name>` */
  getProp(deviceId: string, name: string): Promise<string>;
  /** `adb -s <id> shell dumpsys package <pkg>` benzeri — kurulu mu, hangi sürüm. */
  getPackageInfo(
    deviceId: string,
    packageName: string,
  ): Promise<{ installed: boolean; versionName: string | null; versionCode: string | null }>;
  /** `settings get secure enabled_accessibility_services` */
  getEnabledAccessibilityServices(deviceId: string): Promise<string>;
  /** `adb -s <id> forward --no-rebind tcp:<host> tcp:<device>` */
  forward(deviceId: string, hostPort: number, devicePort: number): Promise<void>;
  /** `adb -s <id> forward --list` */
  listForwards(deviceId: string): Promise<{ hostPort: number; devicePort: number }[]>;
  /** `adb -s <id> forward --remove tcp:<host>` */
  removeForward(deviceId: string, hostPort: number): Promise<void>;
  /** Teşhis alanları. Başarısızlığı preflight'ı bozmaz. */
  getDiagnostics(deviceId: string): Promise<BridgeDeviceCapabilitySnapshot["diagnostics"]>;
}

export interface DeviceGatePolicy {
  /**
   * Lab allowlist. Boş bırakılırsa HİÇBİR cihaz kabul edilmez.
   *
   * Boş listeyi "hepsine izin ver" saymak, yapılandırmayı unutmanın production
   * bir cihazda Act Mode açmakla sonuçlanması demekti. Fail-closed.
   */
  labAllowlist: readonly string[];
  /**
   * Production işareti taşıyan cihazlar reddedilir.
   *
   * `ro.build.type === "user"` ve release-signed bir build production sayılır;
   * lab cihazları `userdebug`/`eng` olur. Bu kontrol allowlist'ten SONRA gelir
   * ama onu geçersiz kılabilir: allowlist'e yanlışlıkla eklenmiş bir production
   * cihaz yine reddedilir.
   */
  denyProductionBuilds: boolean;
  /** Beklenen minimum Bridge sürüm kodu. `null` ise sürüm zorlanmaz. */
  minBridgeVersionCode?: number;
}

/**
 * Host portu tahsis defteri.
 *
 * Bellek içi olması kasıtlı: `adb forward` zaten process ömrüne bağlı değil,
 * ama tahsis kararı öyle. Kalıcı bir kayıt tutmak, çökmüş bir process'in
 * portlarını sonsuza kadar "kullanımda" göstermeye yol açardı; oysa doğru
 * kaynak `adb forward --list`, ve `claim` onu okuyarak karar veriyor.
 */
export class HostPortLeaseStore {
  private readonly leases = new Map<string, number>();

  constructor(private readonly range: { from: number; to: number } = HOST_PORT_RANGE) {}

  get(deviceId: string): number | undefined {
    return this.leases.get(deviceId);
  }

  /**
   * Cihaz için bir host portu ayırır.
   *
   * `takenElsewhere` gerçek `adb forward --list` çıktısından gelir: aynı
   * makinede başka bir process (veya çökmüş bir öncesi) portu tutuyor olabilir
   * ve yalnız kendi defterimize bakmak onu görmezdi.
   */
  claim(deviceId: string, takenElsewhere: readonly number[] = []): number {
    const existing = this.leases.get(deviceId);
    if (existing !== undefined) return existing;

    const taken = new Set<number>([...this.leases.values(), ...takenElsewhere]);
    for (let port = this.range.from; port <= this.range.to; port += 1) {
      if (taken.has(port)) continue;
      this.leases.set(deviceId, port);
      return port;
    }
    throw new Error(
      `no free host port in [${this.range.from}, ${this.range.to}] for ${deviceId}; ` +
        "leaked adb forwards are the usual cause — check `adb forward --list`",
    );
  }

  release(deviceId: string): number | undefined {
    const port = this.leases.get(deviceId);
    this.leases.delete(deviceId);
    return port;
  }

  entries(): { deviceId: string; hostPort: number }[] {
    return [...this.leases].map(([deviceId, hostPort]) => ({ deviceId, hostPort }));
  }
}

/** `ro.build.type` değerlerinden hangileri lab kabul edilir. */
const LAB_BUILD_TYPES: ReadonlySet<string> = new Set(["userdebug", "eng"]);

export function isProductionBuild(buildType: string): boolean {
  // Bilinmeyen bir build type PRODUCTION sayılır. Bilmediğimiz bir şeyi lab
  // varsaymak, tam olarak production cihazda Act Mode açma yoludur.
  return !LAB_BUILD_TYPES.has(buildType.trim());
}

/**
 * Cihaz kapısı — preflight ve port lease.
 */
export class BridgeDeviceGate {
  constructor(
    private readonly adb: AdbFacade,
    private readonly policy: DeviceGatePolicy,
    private readonly leases = new HostPortLeaseStore(),
    private readonly now: () => number = Date.now,
  ) {}

  getLeases(): HostPortLeaseStore {
    return this.leases;
  }

  async preflight(deviceId: string): Promise<BridgePreflightResult> {
    const partial: Partial<BridgeDeviceCapabilitySnapshot> = { deviceId };

    // 1. Cihaz gerçekten bağlı mı.
    const devices = await this.adb.listDevices();
    if (!devices.includes(deviceId)) {
      return {
        ok: false,
        partial,
        failure: {
          check: "DEVICE_REACHABLE",
          detail: `${deviceId} is not in \`adb devices\` (${devices.length} device(s) attached)`,
          remediation: "reconnect the device and confirm USB debugging is authorised",
          fatal: false,
        },
      };
    }

    // 2. Lab allowlist — BOŞ LİSTE HİÇBİR ŞEYE İZİN VERMEZ.
    if (this.policy.labAllowlist.length === 0 || !this.policy.labAllowlist.includes(deviceId)) {
      return {
        ok: false,
        partial,
        failure: {
          check: "LAB_ALLOWLIST",
          detail:
            this.policy.labAllowlist.length === 0
              ? "the lab allowlist is EMPTY; an empty allowlist denies every device on purpose"
              : `${deviceId} is not on the lab allowlist`,
          remediation: `add ${deviceId} to the lab allowlist only if it is a dedicated test device`,
          fatal: true,
        },
      };
    }

    // 3. Optional production deny — allowlist'i geçersiz kılabilir.
    if (this.policy.denyProductionBuilds) {
      const buildType = (await this.adb.getProp(deviceId, "ro.build.type")).trim();
      if (isProductionBuild(buildType)) {
        return {
          ok: false,
          partial,
          failure: {
            check: "PRODUCTION_DENY",
            detail: `ro.build.type=${buildType || "<empty>"} is not a lab build; Act Mode is refused on production devices`,
            remediation:
              "use a userdebug/eng lab device; injecting gestures into a production build is denied by policy",
            fatal: true,
          },
        };
      }
    }

    const [model, sdk] = await Promise.all([
      this.adb.getProp(deviceId, "ro.product.model").catch(() => ""),
      this.adb.getProp(deviceId, "ro.build.version.sdk").catch(() => ""),
    ]);
    partial.model = model || null;
    partial.androidSdk = sdk || null;

    // 4. Bridge APK kurulu mu, sürümü ne. Android PackageManager bazı cihazlarda
    // kısa süreliğine ADB shell'i kilitleyebiliyor; accessibility + TCP yolunu
    // ayrıca kanıtladığımız için metadata okunamaması tek başına fatal değil.
    const pkg = await this.adb.getPackageInfo(deviceId, BRIDGE_PACKAGE).catch(() => null);
    if (pkg !== null && !pkg.installed) {
      return {
        ok: false,
        partial,
        failure: {
          check: "BRIDGE_APK_INSTALLED",
          detail: `${BRIDGE_PACKAGE} is not installed`,
          remediation: `install the Verdict Bridge APK: adb -s ${deviceId} install -r -t verdict-bridge.apk`,
          fatal: false,
        },
      };
    }
    partial.bridgeVersionName = pkg?.versionName ?? null;
    partial.bridgeVersionCode = pkg?.versionCode ?? null;

    const minVersion = this.policy.minBridgeVersionCode;
    if (minVersion !== undefined && pkg !== null) {
      const actual = Number(pkg.versionCode ?? "0");
      if (!Number.isFinite(actual) || actual < minVersion) {
        return {
          ok: false,
          partial,
          failure: {
            check: "BRIDGE_VERSION",
            detail: `bridge versionCode ${String(pkg.versionCode)} is below the required ${String(minVersion)}`,
            remediation: "install the matching Bridge build; protocol drift is not tolerated silently",
            fatal: false,
          },
        };
      }
    }

    // 5. Erişilebilirlik servisi açık mı. Bu ADB settings okuması bazı cihazlarda
    // kısa süreli takılabiliyor; okunamazsa fatal sayma, gerçek kanıtı port +
    // Bridge protocol handshake versin.
    const services = await this.adb.getEnabledAccessibilityServices(deviceId).catch(() => null);
    const accessibilityEnabled = services === null ? null : services.includes(BRIDGE_PACKAGE);
    if (accessibilityEnabled !== null) partial.accessibilityEnabled = accessibilityEnabled;
    if (accessibilityEnabled === false) {
      return {
        ok: false,
        partial,
        failure: {
          check: "ACCESSIBILITY_ENABLED",
          detail: `${BRIDGE_ACCESSIBILITY_COMPONENT} is not in enabled_accessibility_services`,
          remediation:
            "enable the Verdict Bridge accessibility service in Settings → Accessibility; " +
            "the TCP listener only starts with the service",
          fatal: false,
        },
      };
    }

    // 6. Port forward. Stale forward'ları temizle, sonra --no-rebind ile bağla.
    let hostPort: number;
    try {
      hostPort = await this.ensureForward(deviceId);
    } catch (err) {
      return {
        ok: false,
        partial,
        failure: {
          check: "PORT_FORWARD",
          detail: err instanceof Error ? err.message : String(err),
          remediation: `check \`adb -s ${deviceId} forward --list\` for leaked forwards`,
          fatal: false,
        },
      };
    }
    partial.hostPort = hostPort;

    const diagnostics = await this.adb
      .getDiagnostics(deviceId)
      .catch(() => ({ batteryLevel: null, charging: null, backgroundRestricted: null, foregroundPackage: null }));

    return {
      ok: true,
      snapshot: {
        deviceId,
        model: model || null,
        androidSdk: sdk || null,
        bridgeVersionName: pkg?.versionName ?? null,
        bridgeVersionCode: pkg?.versionCode ?? null,
        accessibilityEnabled: accessibilityEnabled ?? true,
        hostPort,
        // Ping gerçek client'ın işi; kapı yalnız yolu açar. `null` burada
        // "henüz sorulmadı" demek, "başarısız" demek değil.
        protocolVersion: null,
        diagnostics,
        checkedAt: this.now(),
      },
    };
  }

  /**
   * Port yönlendirmesini kurar; gerekiyorsa stale olanı temizler.
   *
   * `--no-rebind` YOKSA ikinci bir `forward` sessizce ilkini çalar ve iki cihaz
   * aynı host portundan konuşur — komutlar yanlış cihaza gider ve hiçbir yerde
   * hata çıkmaz. Bu yüzden çakışma varsa önce KALDIRIP sonra bağlanıyoruz,
   * `--no-rebind`in reddini bir hata olarak görüyoruz.
   */
  async ensureForward(deviceId: string): Promise<number> {
    const existing = await this.adb.listForwards(deviceId);
    const alreadyBound = existing.find((f) => f.devicePort === BRIDGE_DEVICE_PORT);
    if (alreadyBound) {
      // Aynı cihaz için zaten bir forward var; onu yeniden kullan. Yeni bir
      // port açmak, cihazda iki yol bırakıp hangisinin canlı olduğunu
      // belirsizleştirir.
      const claimed = this.leases.get(deviceId);
      if (claimed === alreadyBound.hostPort) return claimed;
      this.leases.release(deviceId);
      const reclaimed = this.leases.claim(deviceId, [alreadyBound.hostPort].filter((p) => p !== alreadyBound.hostPort));
      if (reclaimed !== alreadyBound.hostPort) {
        // Defter ile gerçeklik ayrışmış: gerçekliğe uy.
        this.leases.release(deviceId);
        await this.adb.removeForward(deviceId, alreadyBound.hostPort);
      } else {
        return reclaimed;
      }
    }

    const takenElsewhere = existing.map((f) => f.hostPort);
    const hostPort = this.leases.claim(deviceId, takenElsewhere);
    try {
      await this.adb.forward(deviceId, hostPort, BRIDGE_DEVICE_PORT);
    } catch (err) {
      // Tahsis defterini gerçeklikle tutarlı bırak: başarısız bir forward'ın
      // portu "kullanımda" kalmamalı, yoksa aralık zamanla tükenir.
      this.leases.release(deviceId);
      throw new Error(
        `adb forward tcp:${hostPort} → tcp:${BRIDGE_DEVICE_PORT} failed: ` +
          (err instanceof Error ? err.message : String(err)),
      );
    }
    return hostPort;
  }

  /** Yönlendirmeyi ve tahsisi bırakır. Idempotent (RUN_PLAY §13). */
  async releaseForward(deviceId: string): Promise<void> {
    const port = this.leases.release(deviceId);
    if (port === undefined) return;
    // Zaten kaldırılmış olması hata değil: dispose iki kez çağrılabilir.
    await this.adb.removeForward(deviceId, port).catch(() => undefined);
  }
}
