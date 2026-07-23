/**
 * Device-side courier credentials for protected mobile endpoints.
 * Same sources as Debug View: shared_prefs JWT + GET_KEY broadcast.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const RECEIVER_CLASS = "com.arasdigital.nesymobile.adb.ProtectedRequestKeyReceiver";
const ACTION_GET_KEY = "com.arasdigital.nesymobile.GET_KEY";

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

/** Parse `am broadcast` data=/result= payload for GET_KEY. */
export function parseAdbBroadcastData(stdout: string): string | null {
  const dataMatch = stdout.match(/\bdata="((?:\\"|[^"])*)"/);
  if (dataMatch?.[1]) return dataMatch[1].replace(/\\"/g, '"');
  const resultMatch = stdout.match(/\bresult="((?:\\"|[^"])*)"/);
  if (resultMatch?.[1]) return resultMatch[1].replace(/\\"/g, '"');
  return null;
}

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
  let xProtectedRequestKey: string | null = null;
  try {
    const keyOut = await adb([
      "-s",
      deviceId,
      "shell",
      "am",
      "broadcast",
      "-n",
      `${appId}/${RECEIVER_CLASS}`,
      "-a",
      ACTION_GET_KEY,
    ]);
    xProtectedRequestKey = parseAdbBroadcastData(keyOut);
  } catch (err) {
    console.warn(
      "[device-courier-auth] GET_KEY failed:",
      err instanceof Error ? err.message : err,
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
