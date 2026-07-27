/**
 * Device-side courier credentials for protected mobile endpoints.
 * Same sources as Debug View: shared_prefs JWT + GET_KEY broadcast.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { newRequestId } from "@nesy/control-contract";
import { parseBroadcastPayload } from "@nesy/control-channels";
import { createControlExecutor } from "@nesy/control-channels/node";

const execFileAsync = promisify(execFile);

export interface DeviceCourierAuth {
  token: string | null;
  xProtectedRequestKey: string | null;
  isLogin: boolean | null;
  /** Selected courier zone / route code (e.g. "36"). */
  route: string | null;
  /** Numeric hub / branch id used by Task APIs (e.g. "11"). */
  branchId: string | null;
  /** Human hub name from prefs when present (e.g. "CEBeograd"). */
  hubName: string | null;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function readStringPref(prefsXml: string, names: string[]): string | null {
  for (const name of names) {
    const match = prefsXml.match(
      new RegExp(`<string name="${name}">([^<]*)</string>`),
    )?.[1];
    if (match != null && match.trim()) return decodeXmlEntities(match).trim();
  }
  return null;
}

function readIntPref(prefsXml: string, names: string[]): string | null {
  for (const name of names) {
    const match = prefsXml.match(
      new RegExp(`<int name="${name}" value="(-?\\d+)"`),
    )?.[1];
    if (match != null && match.trim()) return match.trim();
  }
  return null;
}

/** Extract courier session fields from a shared_prefs XML dump. */
export function parseCourierPrefsXml(
  prefsXml: string,
): Pick<DeviceCourierAuth, "token" | "isLogin" | "route" | "branchId" | "hubName"> {
  const tokenRaw = prefsXml.match(
    /<string name="(?:token|accessToken|access_token|jwt)">([\s\S]*?)<\/string>/,
  )?.[1];
  const token = tokenRaw ? decodeXmlEntities(tokenRaw).replace(/\s+/g, "").trim() : null;
  const isLoginRaw = prefsXml.match(/<boolean name="isLogin" value="(true|false)"/)?.[1];
  const route = readStringPref(prefsXml, ["route", "courierZoneCode", "zoneCode"]);
  const branchId =
    readIntPref(prefsXml, ["branchId", "hubId"]) ||
    readStringPref(prefsXml, ["branchId"]);
  // hubId string is often the hub *name* (CEBeograd), not the numeric id.
  const hubName = readStringPref(prefsXml, ["hubId", "hubName", "branchName"]);
  return {
    token: token || null,
    isLogin: isLoginRaw == null ? null : isLoginRaw === "true",
    route: route || null,
    branchId: branchId || null,
    hubName: hubName || null,
  };
}

/**
 * @deprecated `@nesy/control-channels`'ın `parseBroadcastPayload`'ına takma ad.
 *
 * Eski yerel kopya, payload'ı İLK iç tırnakta kesiyordu; `GET_KEY` /
 * `GET_DEVICE_ID` tırnak içermediği için tesadüfen çalışıyordu ama aynı regex
 * `GET_STATE` JSON'unu bozardı. Tek doğru implementasyon artık pakette.
 */
export const parseAdbBroadcastData = parseBroadcastPayload;

/**
 * schedule_id shapes like `11-36-20260723-1` → hub/branch + zone.
 * Returns null when the pattern does not match.
 */
export function parseScheduleIdParts(scheduleId: string): {
  branchId: string;
  zone: string;
} | null {
  const trimmed = scheduleId.trim();
  const match = trimmed.match(/^(\d+)-(\d+)-\d{8}/);
  if (!match?.[1] || !match[2]) return null;
  return { branchId: match[1], zone: match[2] };
}

async function adb(args: string[], timeoutMs = 15_000): Promise<string> {
  const result = await execFileAsync("adb", args, {
    timeout: timeoutMs,
    maxBuffer: 8 * 1024 * 1024,
  });
  return String(result.stdout ?? "");
}

/**
 * Reads courier JWT (+ login/route/hub) from app shared_prefs and the
 * X-Protected-Request-Key via GET_KEY broadcast.
 */
export async function readDeviceCourierAuth(
  deviceId: string,
  appId: string,
): Promise<DeviceCourierAuth> {
  const prefsPath = `shared_prefs/${appId}_preferences.xml`;
  let prefsXml = "";
  try {
    prefsXml = await adb(["-s", deviceId, "exec-out", "run-as", appId, "cat", prefsPath]);
  } catch (err) {
    console.warn(
      "[device-courier-auth] shared_prefs read failed:",
      err instanceof Error ? err.message : err,
    );
  }

  const prefs = parseCourierPrefsXml(prefsXml);

  // GET_KEY artık kontrol düzlemi sözleşmesinden geçiyor (C.9). Kanal Faz 0.3'te
  // hâlâ `legacy` olduğu için tel üzerindeki komut BİREBİR aynı; değişen tek şey
  // receiver sınıf adı ve action isminin burada HARDCODE olmaması.
  let xProtectedRequestKey: string | null = null;
  const control = createControlExecutor({ applicationId: appId });
  const keyRes = await control.run(deviceId, {
    op: "get_request_key",
    requestId: newRequestId("courier-auth"),
    scope: `courier-auth:${deviceId}`,
  });
  if (keyRes.ok) {
    xProtectedRequestKey = keyRes.data.key;
  } else {
    // `detail` sözleşme katmanında sırlardan arındırılmış geliyor.
    console.warn(
      `[device-courier-auth] GET_KEY failed: ${keyRes.code}`,
      keyRes.detail ?? "",
    );
  }

  return {
    token: prefs.token,
    xProtectedRequestKey,
    isLogin: prefs.isLogin,
    route: prefs.route,
    branchId: prefs.branchId,
    hubName: prefs.hubName,
  };
}
