#!/usr/bin/env node
/**
 * Adım 1 — START FLOW
 * LAUNCH_APP → IF_LOGIN → AUTH_LOGIN(3680) → CHECK_ROUTE → SELECT_ROUTE(36)
 * → VALIDATE_STOPLIST → GET_STATE + backend schedule doğrulama
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

const API = "http://localhost:4001/api";
const DEVICE = "R6CW400BC8N";
const APP = "com.arasdigital.nesymobile.rstest";
const RECEIVER = `${APP}/com.arasdigital.nesymobile.adb.ProtectedRequestKeyReceiver`;
const ZONE = "36";
const PIN = "3680";

async function j(path, init) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const t = await res.text();
  let json = null;
  try {
    json = t ? JSON.parse(t) : null;
  } catch {
    json = { raw: t };
  }
  if (!res.ok) throw new Error(`${path} ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  return json;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    return String(e.stdout || e.stderr || e.message || "");
  }
};

function getState() {
  const out = sh(
    `adb -s ${DEVICE} shell am broadcast -a com.arasdigital.nesymobile.GET_STATE -n ${RECEIVER}`,
  );
  const m = out.match(/data="([\s\S]*)"/);
  if (!m?.[1]?.startsWith("{")) return { raw: out, parsed: null };
  try {
    return { raw: out, parsed: JSON.parse(m[1]) };
  } catch {
    return { raw: out, parsed: null };
  }
}

function isReady(state) {
  if (!state) return false;
  const loggedIn = String(state.is_logged_in).toLowerCase() === "true";
  const routeOk =
    String(state.route_selected).toLowerCase() === "true" ||
    String(state.route_name || "").includes(ZONE);
  const screen = String(state.current_screen || "");
  const onStops =
    /StopList|StopsFragment|stop/i.test(screen) ||
    String(state.schedule_loaded).toLowerCase() === "true";
  return loggedIn && routeOk && onStops;
}

async function poll(runId, timeoutMs = 4 * 60_000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    await sleep(4000);
    last = await j(`/workflows/runs/${runId}/status`);
    process.stdout.write(".");
    if (!["running", "pending", "queued"].includes(last.runStatus)) break;
  }
  console.log(`\n  → ${last?.runStatus}`);
  for (const st of last?.steps ?? []) {
    console.log(
      `    ${String(st.nodeType).padEnd(22)} ${st.status}${st.errorMessage ? " - " + String(st.errorMessage).slice(0, 120) : ""}`,
    );
  }
  return last;
}

function decodeXml(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Same sources as Debug View: prefs JWT + GET_KEY protected header. */
function readCourierMobileAuth() {
  const prefsFile = `shared_prefs/${APP}_preferences.xml`;
  const prefs = sh(`adb -s ${DEVICE} exec-out run-as ${APP} cat ${prefsFile}`);
  const tokenRaw = prefs.match(
    /<string name="(?:token|accessToken|access_token|jwt)">([\s\S]*?)<\/string>/,
  )?.[1];
  const token = tokenRaw ? decodeXml(tokenRaw).replace(/\s+/g, "").trim() : null;
  const keyOut = sh(
    `adb -s ${DEVICE} shell am broadcast -n ${RECEIVER} -a com.arasdigital.nesymobile.GET_KEY`,
  );
  const key =
    keyOut.match(/\bdata="((?:\\"|[^"])*)"/)?.[1]?.replace(/\\"/g, '"') ||
    keyOut.match(/\bresult="((?:\\"|[^"])*)"/)?.[1]?.replace(/\\"/g, '"') ||
    null;
  return { token, xProtectedRequestKey: key, isLogin: /name="isLogin" value="true"/.test(prefs) };
}

async function validateBackendSchedule() {
  const env = fs.readFileSync("apps/api/.env", "utf8");
  const base = (env.match(/^NESY_RS_STAGE_BASE_URL=(.+)$/m) || [])[1]?.trim().replace(/["']/g, "");
  const mobileBase =
    (env.match(/^NESY_RS_STAGE_MOBILE_BASE_URL=(.+)$/m) || [])[1]?.trim().replace(/["']/g, "") ||
    "https://nesy-staging-mobile-api.cityexpress.rs";

  const login = await j("/nesy/auth/login", {
    method: "POST",
    body: JSON.stringify({ country: "RS", environment: "stage" }),
  });
  const adminToken = login.result?.payload?.token;
  if (!adminToken) throw new Error("admin login failed");

  // Dashboard zone schedule (admin) — cross-check
  const dash = await (
    await fetch(`${base}/Task/GetTodayScheduleByCourierZone`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(ZONE),
    })
  ).json();

  const payload = dash.payload;
  const checks = {
    ok: true,
    errors: [],
    scheduleId: payload?.scheduleId ?? null,
    scheduleStatus: payload?.scheduleStatus ?? null,
    courierUsername: payload?.courierUsername ?? null,
    courierZoneCode: payload?.courierZoneCode ?? null,
    stopCount: payload?.stopList?.length ?? 0,
  };

  if (!payload || !payload.scheduleId) {
    checks.ok = false;
    checks.errors.push("no schedule for zone " + ZONE);
  } else {
    if (String(payload.courierZoneCode) !== ZONE) {
      checks.ok = false;
      checks.errors.push(`zone mismatch: ${payload.courierZoneCode} != ${ZONE}`);
    }
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const waiting = await (
      await fetch(`${base}/Task/GetWaitingLeavingRequests`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ StartDate: iso, EndDate: iso, HubIds: ["11"] }),
      })
    ).json();
    const list = Array.isArray(waiting.payload) ? waiting.payload : [];
    const zoneMatches = list.filter((x) => String(x.courierZoneCode) === ZONE);
    const scheduleIds = new Set(
      [payload.scheduleId, ...zoneMatches.map((x) => x.scheduleId)].filter(Boolean),
    );
    checks.waitingForZone = zoneMatches.length;
    checks.uniqueScheduleIds = [...scheduleIds];
    if (scheduleIds.size > 1) {
      checks.ok = false;
      checks.errors.push(`duplicate schedules for zone ${ZONE}: ${[...scheduleIds].join(", ")}`);
    }
    const expectedUser = "G.ONCU";
    if (payload.courierUsername && payload.courierUsername !== expectedUser) {
      checks.ok = false;
      checks.errors.push(`courier mismatch: ${payload.courierUsername} != ${expectedUser}`);
    }
  }

  // Mobile protected call — courier JWT (shared_prefs) + X-Protected-Request-Key (GET_KEY)
  const auth = readCourierMobileAuth();
  checks.courierAuth = {
    isLogin: auth.isLogin,
    tokenLen: auth.token?.length ?? 0,
    protectedKeyLen: auth.xProtectedRequestKey?.length ?? 0,
  };
  if (!auth.token || !auth.xProtectedRequestKey) {
    checks.ok = false;
    checks.errors.push("missing courier JWT and/or X-Protected-Request-Key from device");
    checks.getMyScheduleByZoneCode = { error: "no device courier auth" };
    return checks;
  }

  const mine = await fetch(`${mobileBase}/Task/GetMyScheduleByZoneCode/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
      "X-Protected-Request-Key": auth.xProtectedRequestKey,
      Accept: "application/json",
    },
    body: JSON.stringify({ courierZoneCode: ZONE }),
  });
  const mj = await mine.json().catch(() => ({}));
  const mp = mj.payload ?? mj.Payload ?? null;
  const myScheduleId = mp?.scheduleId ?? mp?.ScheduleId ?? null;
  checks.getMyScheduleByZoneCode = {
    http: mine.status,
    resultCode: mj.resultCode ?? mj.ResultCode,
    hasPayload: !!mp,
    scheduleId: myScheduleId,
    scheduleStatus: mp?.scheduleStatus ?? mp?.ScheduleStatus ?? null,
    courierUsername: mp?.courierUsername ?? mp?.CourierUsername ?? null,
    courierZoneCode: mp?.courierZoneCode ?? mp?.CourierZoneCode ?? null,
    stopCount: (mp?.stopList ?? mp?.StopList ?? [])?.length ?? 0,
    responseBytes: Buffer.byteLength(JSON.stringify(mj)),
    source: "device JWT + GET_KEY → mobile API",
  };

  if (mine.status !== 200 || Number(mj.resultCode ?? mj.ResultCode) !== 200 || !myScheduleId) {
    checks.ok = false;
    checks.errors.push("GetMyScheduleByZoneCode failed with courier JWT+key");
  } else if (checks.scheduleId && myScheduleId !== checks.scheduleId) {
    checks.ok = false;
    checks.errors.push(
      `mobile/admin scheduleId mismatch: ${myScheduleId} vs ${checks.scheduleId}`,
    );
  }

  return checks;
}

const report = {
  pin: PIN,
  route: ZONE,
  preflight: null,
  run: null,
  postState: null,
  backend: null,
  ready: false,
};

console.log("== PREFLIGHT GET_STATE ==");
const pre = getState();
report.preflight = pre.parsed;
console.log(JSON.stringify(pre.parsed, null, 2));

if (isReady(pre.parsed)) {
  console.log("\nAlready login+route+stops → ready (skip START run)");
  report.ready = true;
} else {
  console.log("\n== RUN 00 · START FLOW ==");
  sh("adb forward --remove-all");
  const list = await j(`/workflows?search=${encodeURIComponent("00 · START")}`);
  const wf = (list.data || []).find((w) => w.name.includes("00 · START"));
  const started = await j(`/workflows/${wf.id}/run`, {
    method: "POST",
    body: JSON.stringify({
      selectedDeviceId: DEVICE,
      country: "RS",
      environment: "stage",
    }),
  });
  report.run = await poll(started.data.runId);
}

console.log("\n== POST GET_STATE ==");
await sleep(2000);
const post = getState();
report.postState = post.parsed;
console.log(JSON.stringify(post.parsed, null, 2));

console.log("\n== BACKEND SCHEDULE VALIDATE ==");
report.backend = await validateBackendSchedule();
console.log(JSON.stringify(report.backend, null, 2));

report.ready =
  (report.run?.runStatus === "success" || report.ready) &&
  isReady(report.postState) &&
  report.backend.ok;

console.log("\n========== START STEP RESULT ==========");
console.log("ready:", report.ready);
console.log("workflow:", report.run?.runStatus ?? "skipped(already-ready)");
console.log("GET_STATE screen:", report.postState?.current_screen);
console.log("GET_STATE login/route/schedule:", {
  login: report.postState?.is_logged_in,
  route: report.postState?.route_selected,
  route_name: report.postState?.route_name,
  schedule_id: report.postState?.schedule_id,
  schedule_loaded: report.postState?.schedule_loaded,
});
console.log("backend:", report.backend.ok ? "OK" : report.backend.errors.join("; "));

fs.writeFileSync(".tmp-e2e/start-step-result.json", JSON.stringify(report, null, 2));
process.exitCode = report.ready ? 0 : 2;
