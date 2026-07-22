#!/usr/bin/env node
/**
 * Courier JWT (shared_prefs) + X-Protected-Request-Key (GET_KEY)
 * → POST Task/GetMyScheduleByZoneCode/ on mobile staging API.
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const DEVICE = "R6CW400BC8N";
const APP = "com.arasdigital.nesymobile.rstest";
const RECEIVER = `${APP}/com.arasdigital.nesymobile.adb.ProtectedRequestKeyReceiver`;
const MOBILE_BASE = "https://nesy-staging-mobile-api.cityexpress.rs";
const ZONE = "36";
const PREFS = `shared_prefs/${APP}_preferences.xml`;

function adb(...args) {
  return execFileSync("adb", ["-s", DEVICE, ...args], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

function decodeXml(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// 1) Prefs → JWT (same source as Debug View / Database Access)
const prefs = adb("exec-out", "run-as", APP, "cat", PREFS);
fs.writeFileSync(".tmp-e2e/prefs.xml", prefs);

const tokenM = prefs.match(/<string name="(?:token|accessToken|access_token|jwt)">([\s\S]*?)<\/string>/);
const routeM = prefs.match(/<string name="route">([^<]+)<\/string>/);
const isLogin = prefs.match(/<boolean name="isLogin" value="(true|false)"/);
if (!tokenM?.[1]) {
  console.error("No courier JWT in shared_prefs");
  process.exit(1);
}
const token = decodeXml(tokenM[1]).replace(/\s+/g, "").trim();
fs.writeFileSync(".tmp-e2e/courier-jwt.txt", token);

let jwtClaims = null;
try {
  const mid = token.split(".")[1];
  jwtClaims = JSON.parse(Buffer.from(mid.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
} catch {}

console.log("prefs", {
  isLogin: isLogin?.[1],
  route: routeM?.[1],
  tokenLen: token.length,
  jwtRole: jwtClaims?.role,
  jwtExp: jwtClaims?.exp ? new Date(jwtClaims.exp * 1000).toISOString() : null,
});

// 2) Protected key (same as Network Inspector / GET_KEY)
const keyOut = adb(
  "shell",
  "am",
  "broadcast",
  "-n",
  RECEIVER,
  "-a",
  "com.arasdigital.nesymobile.GET_KEY",
);
const keyM = keyOut.match(/\bdata="((?:\\"|[^"])*)"/) || keyOut.match(/\bresult="((?:\\"|[^"])*)"/);
if (!keyM?.[1]) {
  console.error("GET_KEY failed", keyOut.slice(0, 400));
  process.exit(1);
}
const xKey = keyM[1].replace(/\\"/g, '"');
console.log("protectedKey len", xKey.length);

// 3) Call GetMyScheduleByZoneCode with courier creds
const body = { courierZoneCode: ZONE };
const res = await fetch(`${MOBILE_BASE}/Task/GetMyScheduleByZoneCode/`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Protected-Request-Key": xKey,
    Accept: "application/json",
  },
  body: JSON.stringify(body),
});
const text = await res.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  json = { raw: text.slice(0, 800) };
}
fs.writeFileSync(".tmp-e2e/get-my-schedule.json", JSON.stringify(json, null, 2));

const p = json.payload ?? json.Payload ?? null;
const scheduleId = p?.scheduleId ?? p?.ScheduleId ?? null;
const status = p?.scheduleStatus ?? p?.ScheduleStatus ?? null;
const zone = p?.courierZoneCode ?? p?.CourierZoneCode ?? null;
const courier = p?.courierUsername ?? p?.CourierUsername ?? null;
const stops = p?.stopList ?? p?.StopList ?? p?.stops ?? [];

console.log("\n== GetMyScheduleByZoneCode ==");
console.log({
  http: res.status,
  resultCode: json.resultCode ?? json.ResultCode,
  resultMessage: json.resultMessage ?? json.ResultMessage,
  hasPayload: !!p,
  scheduleId,
  scheduleStatus: status,
  courierZoneCode: zone,
  courierUsername: courier,
  stopCount: Array.isArray(stops) ? stops.length : null,
  responseBytes: Buffer.byteLength(text),
});

const ok =
  res.status === 200 &&
  Number(json.resultCode ?? json.ResultCode) === 200 &&
  !!scheduleId &&
  String(zone ?? ZONE) === ZONE;

console.log(ok ? "\nREADY: courier GetMyScheduleByZoneCode OK" : "\nFAIL: see .tmp-e2e/get-my-schedule.json");
process.exitCode = ok ? 0 : 2;
