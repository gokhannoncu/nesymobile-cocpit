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
  route: string | null;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Extract courier session fields from a shared_prefs XML dump. */
export function parseCourierPrefsXml(prefsXml: string): Pick<DeviceCourierAuth, "token" | "isLogin" | "route"> {
  const tokenRaw = prefsXml.match(
    /<string name="(?:token|accessToken|access_token|jwt)">([\s\S]*?)<\/string>/,
  )?.[1];
  const token = tokenRaw ? decodeXmlEntities(tokenRaw).replace(/\s+/g, "").trim() : null;
  const isLoginRaw = prefsXml.match(/<boolean name="isLogin" value="(true|false)"/)?.[1];
  const route = prefsXml.match(/<string name="route">([^<]+)<\/string>/)?.[1]?.trim() ?? null;
  return {
    token: token || null,
    isLogin: isLoginRaw == null ? null : isLoginRaw === "true",
    route: route || null,
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

async function adb(args: string[], timeoutMs = 15_000): Promise<string> {
  const result = await execFileAsync("adb", args, {
    timeout: timeoutMs,
    maxBuffer: 8 * 1024 * 1024,
  });
  return String(result.stdout ?? "");
}

/**
 * Reads courier JWT (+ login/route) from app shared_prefs and the
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
  };
}
