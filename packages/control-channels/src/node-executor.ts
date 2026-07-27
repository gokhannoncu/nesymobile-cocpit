/**
 * ===========================================================================
 *  NODE TAŞIMASI — `ControlExecutor` fabrikası  (Plan C.9)
 *
 *  Ayrı bir giriş noktası (`@nesy/control-channels/node`): `node:child_process`
 *  yalnız burada import edilir, böylece tarayıcı paketleri onu asla çekmez.
 *
 *  ### Neden burada
 *
 *  Faz 0.3'ten önce `apps/api` içinde BEŞ bağımsız adb koşucusu vardı
 *  (`device-courier-auth`, `test-event-bridge`, `device-worker`,
 *  `nesy-mobile-auth.router`, `field-courier-login-orchestrator`) ve
 *  `resolveAdbCommand` İKİ kez birebir kopyalanmıştı. Üstelik
 *  `device-courier-auth` çıplak `"adb"` çağırıyordu — `adb` PATH'te değilse
 *  ENOENT ile düşerdi, diğer dosyalar ise SDK yolunu çözüyordu. Aynı ortamda
 *  aynı işin iki farklı sonucu.
 * ===========================================================================
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type {
  ControlExecutor,
  ControlOperation,
  ControlResult,
} from "@nesy/control-contract";
import {
  LegacyReceiverChannel,
  channelFor,
  detectChannel,
  type AdbRunner,
  type ChannelKind,
} from "./index.js";

const execFileAsync = promisify(execFile);

/**
 * `adb` ikilisini bulur. Sıra bilinçli: açık env override → SDK env → macOS
 * varsayılan kurulumu → PATH'e güven.
 *
 * Bu, `nesy-mobile-auth.router.ts` ve `field-courier-login-orchestrator.ts`
 * içindeki iki birebir kopyanın TEK sürümüdür.
 */
export function resolveAdbPath(): string {
  const candidates = [
    process.env.NESY_MOBILE_ADB_PATH?.trim(),
    process.env.ANDROID_HOME
      ? join(process.env.ANDROID_HOME, "platform-tools", "adb")
      : null,
    process.env.ANDROID_SDK_ROOT
      ? join(process.env.ANDROID_SDK_ROOT, "platform-tools", "adb")
      : null,
    join(homedir(), "Library", "Android", "sdk", "platform-tools", "adb"),
  ].filter((c): c is string => Boolean(c));
  return candidates.find((c) => existsSync(c)) ?? "adb";
}

export interface NodeAdbRunnerOptions {
  /** Varsayılan zaman aşımı; çağrı başına geçersiz kılınabilir. */
  defaultTimeoutMs?: number;
  /** `dumpsys`/`logcat` çıktıları büyük olabilir. */
  maxBufferBytes?: number;
}

/**
 * `execFile` tabanlı `AdbRunner`.
 *
 * ⚠️ `adb` **stderr'e yazıp exit 0** dönebilir; `stdout` yine döndürülür ve
 * kanal katmanı payload kanıtı arar. Non-zero exit `execFile` tarafından
 * throw'a çevrilir → kanal `CHANNEL_UNAVAILABLE` üretir.
 */
export function createNodeAdbRunner(
  opts: NodeAdbRunnerOptions = {},
): AdbRunner {
  const adbPath = resolveAdbPath();
  const { defaultTimeoutMs = 15_000, maxBufferBytes = 8 * 1024 * 1024 } = opts;
  return async (_serial, args, timeoutMs) => {
    const result = await execFileAsync(adbPath, args, {
      timeout: timeoutMs ?? defaultTimeoutMs,
      maxBuffer: maxBufferBytes,
    });
    return String(result.stdout ?? "");
  };
}

export interface ControlExecutorOptions {
  /**
   * Cihazdaki `applicationId`. 13 flavor → 13 farklı değer olduğu için
   * çözücü fonksiyon da kabul edilir.
   */
  applicationId: string | ((serial: string) => string | Promise<string>);
  /** Test enjeksiyonu için; verilmezse node koşucusu kurulur. */
  adb?: AdbRunner;
  /**
   * Kanal tespitini atlayıp sabit bir kanal kullan. Faz 0.3'te varsayılan
   * `"legacy"`dir — davranış değişmez.
   */
  forceChannel?: ChannelKind;
  /** Hata/olay günlüğü. */
  onEvent?: (e: ControlExecutorEvent) => void;
}

export interface ControlExecutorEvent {
  serial: string;
  op: ControlOperation["op"];
  requestId: string;
  channel: ChannelKind;
  ok: boolean;
  code?: string;
  detail?: string;
  durationMs: number;
}

/**
 * Sözleşmeyi bir kanala bağlayan yürütücü.
 *
 * **Faz 0.3 değişmezi:** `forceChannel` verilmezse `detectChannel()` çağrılır
 * ve o bugün DAİMA `"legacy"` döndürür. Yani bu executor'a geçmek davranışı
 * değiştirmez; yalnız çağrı yolunu tekilleştirir. Faz 4'te `detectChannel`
 * gerçek tespiti yapmaya başladığında buradaki hiçbir satır değişmez.
 *
 * Tespit sonucu serial başına cache'lenir; kanal hatasında cache DÜŞÜRÜLÜR
 * (uygulama arada güncellenmiş olabilir).
 */
export function createControlExecutor(
  opts: ControlExecutorOptions,
): ControlExecutor {
  const adb = opts.adb ?? createNodeAdbRunner();
  const resolveAppId = (serial: string): string | Promise<string> =>
    typeof opts.applicationId === "function"
      ? opts.applicationId(serial)
      : opts.applicationId;
  const channelCache = new Map<string, ChannelKind>();

  return {
    async run<Op extends ControlOperation>(
      serial: string,
      op: Op,
    ): Promise<ControlResult<Op["op"]>> {
      const startedAt = performance.now();
      const ctx = { applicationId: await resolveAppId(serial), adb };

      let kind: ChannelKind;
      if (opts.forceChannel) {
        kind = opts.forceChannel;
      } else {
        const cached = channelCache.get(serial);
        kind = cached ?? (await detectChannel(serial, ctx));
        channelCache.set(serial, kind);
      }

      const channel =
        kind === "legacy" ? new LegacyReceiverChannel() : channelFor(kind);
      const res = await channel.run(serial, op, ctx);

      // Kanal seviyesinde başarısızlık → tespiti bir dahaki çağrıda yenile.
      if (!res.ok && res.code === "CHANNEL_UNAVAILABLE") {
        channelCache.delete(serial);
      }

      opts.onEvent?.({
        serial,
        op: op.op,
        requestId: op.requestId,
        channel: kind,
        ok: res.ok,
        ...(res.ok ? {} : { code: res.code, detail: res.detail }),
        durationMs: Math.round(performance.now() - startedAt),
      });

      return res;
    },
  };
}
