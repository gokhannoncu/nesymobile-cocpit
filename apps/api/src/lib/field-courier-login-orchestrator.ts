import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prisma } from "@nesy/db";
import {
  getEnvValue,
  isDashboardConfigured,
  isNesyDashboardCountry,
  isNesyEnvironment,
  nesyPortalHeaders,
  resolveBaseUrl,
  type NesyDashboardCountry,
  type NesyEnvironment,
} from "../nesy-env.js";
import {
  isNesyMobileCountry,
  isNesyMobileEnvironment,
  resolveNesyMobileApplicationId,
  type NesyMobileCountry,
  type NesyMobileEnvironment,
} from "../nesy-mobile-env.js";

const execFileAsync = promisify(execFile);

const GET_DEVICE_ID_ACTION = "com.arasdigital.nesymobile.GET_DEVICE_ID";
const PROTECTED_KEY_RECEIVER_CLASS =
  "com.arasdigital.nesymobile.adb.ProtectedRequestKeyReceiver";
const SYSTEM_WORKFLOW_SLUG = "field-courier-login";
const AUTOMATION_API_ORIGIN =
  process.env.AUTOMATION_API_ORIGIN?.trim() || "http://localhost:3008";

export type FieldLoginStepId =
  | "validate_device"
  | "resolve_courier"
  | "align_hub"
  | "fetch_pin"
  | "read_device_code"
  | "register_device"
  | "maestro_login"
  | "restore_hub"
  | "persist";

export type FieldLoginStepStatus = "pending" | "active" | "done" | "error" | "skipped";

export type FieldLoginStep = {
  id: FieldLoginStepId;
  label: string;
  detail: string | null;
  status: FieldLoginStepStatus;
};

export type FieldLoginSessionStatus = "running" | "success" | "failed";

export type FieldLoginSessionInput = {
  country: string;
  environment: string;
  /** Default create flow searches shipment/courier. Replay skips search. */
  mode?: "create" | "replay";
  trackingNumber?: string;
  barcode?: string;
  legacyBarcode?: string;
  courierName?: string;
  courierUsername?: string;
  /** Required for replay — known courier from history. */
  courierUserId?: string;
  hubId?: string;
  hubName?: string;
};

export type FieldLoginSession = {
  id: string;
  status: FieldLoginSessionStatus;
  steps: FieldLoginStep[];
  errorMessage: string | null;
  failedStep: FieldLoginStepId | null;
  historyId: string | null;
  createdAt: string;
  updatedAt: string;
  input: FieldLoginSessionInput;
};

type NesyEnvelope = {
  resultCode?: number;
  ResultCode?: number;
  resultMessage?: string;
  ResultMessage?: string;
  payload?: unknown;
};

type CourierResolved = {
  userId: string;
  username: string;
  fullName: string;
  hubId: string;
  hubName: string;
  raw: Record<string, unknown>;
};

type AdminProfile = {
  userId: string;
  username: string;
  hubId: string;
  hubName: string;
  row: Record<string, unknown>;
};

const STEP_DEFS: Array<{ id: FieldLoginStepId; label: string }> = [
  { id: "validate_device", label: "Validate ADB device" },
  { id: "resolve_courier", label: "Resolve courier" },
  { id: "align_hub", label: "Align admin hub" },
  { id: "fetch_pin", label: "Fetch courier PIN" },
  { id: "read_device_code", label: "Read device code" },
  { id: "register_device", label: "Register device on courier" },
  { id: "maestro_login", label: "Login on device (Maestro)" },
  { id: "restore_hub", label: "Restore admin hub" },
  { id: "persist", label: "Save history" },
];

const sessions = new Map<string, FieldLoginSession>();
const listeners = new Map<string, Set<(session: FieldLoginSession) => void>>();

function nowIso() {
  return new Date().toISOString();
}

function pickStr(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = record[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return "";
}

const REGEX_HEX_MONGO_OBJECT_ID = /^[a-f\d]{24}$/i;

function coerceMongoHex24(raw: unknown): string | null {
  if (raw == null) return null;
  const s = typeof raw === "string" ? raw.trim() : String(raw).trim();
  return REGEX_HEX_MONGO_OBJECT_ID.test(s) ? s : null;
}

/** Same field order as Connection / nesy-dashboard `mongoUserIdCandidateFromDashboardRecord`. */
function mongoIdFromRecord(record: Record<string, unknown> | undefined): string | null {
  if (!record) return null;
  for (const key of ["userId", "UserId", "id", "Id", "_id", "user_id"]) {
    const x = coerceMongoHex24(record[key]);
    if (x) return x;
  }
  return null;
}

function extractUserMongoIdFromGetMyInfoPayload(payload: unknown): string | null {
  const tryObj = (o: Record<string, unknown>): string | null => {
    for (const k of ["Id", "id", "UserId", "userId", "_id"]) {
      const x = coerceMongoHex24(o[k]);
      if (x) return x;
    }
    return null;
  };
  if (payload != null && typeof payload === "object") {
    const top = tryObj(payload as Record<string, unknown>);
    if (top) return top;
    const nested =
      (payload as Record<string, unknown>).payload ??
      (payload as Record<string, unknown>).Payload;
    if (nested && typeof nested === "object") {
      return tryObj(nested as Record<string, unknown>);
    }
  }
  return null;
}

function mongoIdFromJwt(token: string | null | undefined): string | null {
  const t = token?.trim();
  if (!t) return null;
  const parts = t.split(".");
  if (parts.length < 2 || !parts[1]) return null;
  try {
    const b64url = parts[1];
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = Buffer.from(b64 + pad, "base64").toString("utf8");
    const o = JSON.parse(json) as Record<string, unknown>;
    for (const key of [
      "userId",
      "UserId",
      "sub",
      "nameid",
      "user_id",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
    ]) {
      const x = coerceMongoHex24(o[key]);
      if (x) return x;
    }
    for (const v of Object.values(o)) {
      if (typeof v === "string") {
        const x = coerceMongoHex24(v);
        if (x) return x;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** Login snapshot thin row — same idea as Connection `buildManageUserApplyCourierHubPayloadFromLoginSnapshot`. */
function buildThinAdminRowFromLogin(
  loginUser: Record<string, unknown>,
  userId: string,
): Record<string, unknown> {
  const username = pickStr(loginUser, "username", "Username", "userName", "UserName");
  const fullName = pickStr(loginUser, "fullName", "FullName");
  const role = pickStr(loginUser, "role", "Role");
  const email = pickStr(loginUser, "email", "Email");
  const hubName = pickStr(loginUser, "hubName", "HubName");
  const branchId = pickStr(loginUser, "branchId", "BranchId", "hubId", "HubId");
  return {
    userId,
    UserId: userId,
    username,
    Username: username,
    fullName,
    FullName: fullName,
    role,
    Role: role,
    email,
    Email: email,
    hubName,
    HubName: hubName,
    branchId,
    BranchId: branchId,
  };
}

async function findUserRowByExactUsername(
  baseUrl: string,
  token: string,
  usernameExact: string,
): Promise<Record<string, unknown> | null> {
  const needle = usernameExact.trim().toLowerCase();
  if (!needle) return null;
  let skip = 0;
  const pageSize = 200;
  const maxSkipped = 20_000;
  while (skip < maxSkipped) {
    const body: Record<string, unknown> = {
      // false = Active only (Nesy naming is inverted; see getAllUsers)
      IncludePassiveUsers: false,
      FullName: usernameExact.trim(),
      Roles: [],
      SkipCount: skip,
      MaxResultCount: pageSize,
      HubIds: [],
      phoneNumber: "",
    };
    const result = await postNesyJson(baseUrl, "User/GetAllUsers", token, body);
    if (!result.ok) throw new Error(result.text);
    const payload = result.json.payload as
      | { items?: unknown[]; Items?: unknown[]; totalCount?: number; TotalCount?: number }
      | undefined;
    const items = (payload?.items ?? payload?.Items ?? []).filter(
      (i): i is Record<string, unknown> => !!i && typeof i === "object",
    );
    const totalCount = payload?.totalCount ?? payload?.TotalCount ?? items.length;
    const row = items.find((r) => {
      const u = pickStr(r, "username", "Username", "userName", "UserName").toLowerCase();
      return u === needle;
    });
    if (row) return row;
    if (items.length === 0 || skip + items.length >= totalCount) return null;
    skip += items.length;
  }
  return null;
}

function createInitialSteps(mode: "create" | "replay" = "create"): FieldLoginStep[] {
  return STEP_DEFS.map((s) => {
    let label = s.label;
    if (mode === "replay") {
      if (s.id === "resolve_courier") label = "Load courier";
      if (s.id === "fetch_pin") label = "Verify courier PIN";
    }
    return {
      id: s.id,
      label,
      detail: null,
      status: "pending" as const,
    };
  });
}

function cloneSession(session: FieldLoginSession): FieldLoginSession {
  return {
    ...session,
    steps: session.steps.map((s) => ({ ...s })),
    input: { ...session.input },
  };
}

function emit(session: FieldLoginSession) {
  const set = listeners.get(session.id);
  if (!set) return;
  const snap = cloneSession(session);
  for (const fn of set) {
    try {
      fn(snap);
    } catch {
      /* ignore listener errors */
    }
  }
}

function updateSession(
  session: FieldLoginSession,
  patch: Partial<Pick<FieldLoginSession, "status" | "errorMessage" | "failedStep" | "historyId">>,
) {
  Object.assign(session, patch, { updatedAt: nowIso() });
  sessions.set(session.id, session);
  emit(session);
}

function setStep(
  session: FieldLoginSession,
  id: FieldLoginStepId,
  status: FieldLoginStepStatus,
  detail?: string | null,
) {
  const step = session.steps.find((s) => s.id === id);
  if (!step) return;
  step.status = status;
  if (detail !== undefined) step.detail = detail;
  session.updatedAt = nowIso();
  sessions.set(session.id, session);
  emit(session);
}

export function getFieldLoginSession(id: string): FieldLoginSession | null {
  const s = sessions.get(id);
  return s ? cloneSession(s) : null;
}

export function subscribeFieldLoginSession(
  id: string,
  listener: (session: FieldLoginSession) => void,
): () => void {
  let set = listeners.get(id);
  if (!set) {
    set = new Set();
    listeners.set(id, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
    if (set && set.size === 0) listeners.delete(id);
  };
}

async function postNesyJson(
  baseUrl: string,
  relativePath: string,
  token: string,
  body: unknown,
): Promise<{ ok: true; json: NesyEnvelope } | { ok: false; status: number; text: string }> {
  const path = relativePath.replace(/^\//, "");
  const response = await fetch(`${baseUrl}/${path}`, {
    method: "POST",
    headers: nesyPortalHeaders(token),
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(45_000),
  });
  const text = await response.text();
  let json: NesyEnvelope = {};
  try {
    json = text ? (JSON.parse(text) as NesyEnvelope) : {};
  } catch {
    return { ok: false, status: response.status, text: text || "Invalid JSON from Nesy." };
  }
  if (!response.ok) {
    return { ok: false, status: response.status, text: text || response.statusText };
  }
  const rc = json.resultCode ?? json.ResultCode;
  if (rc != null && rc !== 200) {
    const msg = json.resultMessage ?? json.ResultMessage ?? `Nesy resultCode ${rc}`;
    return { ok: false, status: 502, text: msg };
  }
  return { ok: true, json };
}

async function loginDashboard(
  country: NesyDashboardCountry,
  environment: NesyEnvironment,
): Promise<{ token: string; user: Record<string, unknown> }> {
  if (!isDashboardConfigured(country, environment)) {
    throw new Error(`${country}/${environment} dashboard credentials are not configured.`);
  }
  const baseUrl = resolveBaseUrl(country, environment);
  const username = getEnvValue(country, environment, "USERNAME");
  const password = getEnvValue(country, environment, "PASSWORD");
  const response = await fetch(`${baseUrl}/Auth/LoginDashboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      Username: username,
      Password: password,
      CaptchaToken: null,
    }),
    signal: AbortSignal.timeout(25_000),
  });
  const result = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error("Nesy LoginDashboard failed.");
  }
  const rc = result.resultCode ?? result.ResultCode;
  if (rc != null && rc !== 200) {
    const msg = String(result.resultMessage ?? result.ResultMessage ?? `resultCode ${rc}`);
    throw new Error(`Nesy LoginDashboard failed: ${msg}`);
  }

  const candidates: Array<Record<string, unknown> | undefined> = [
    result.payload as Record<string, unknown> | undefined,
    result.Payload as Record<string, unknown> | undefined,
    (result.result as Record<string, unknown> | undefined)?.payload as
      | Record<string, unknown>
      | undefined,
    ((result.result as Record<string, unknown> | undefined)?.payload as Record<string, unknown>)
      ?.payload as Record<string, unknown> | undefined,
  ];

  for (const nested of candidates) {
    if (!nested) continue;
    const token =
      typeof nested.token === "string"
        ? nested.token.trim()
        : typeof nested.Token === "string"
          ? nested.Token.trim()
          : "";
    if (token) {
      const user =
        nested.user && typeof nested.user === "object"
          ? (nested.user as Record<string, unknown>)
          : nested.User && typeof nested.User === "object"
            ? (nested.User as Record<string, unknown>)
            : {};
      return { token, user };
    }
  }
  throw new Error("Token not found in LoginDashboard response.");
}

function resolveAdbCommand() {
  const candidates = [
    process.env.NESY_MOBILE_ADB_PATH?.trim(),
    process.env.ANDROID_HOME ? join(process.env.ANDROID_HOME, "platform-tools", "adb") : null,
    process.env.ANDROID_SDK_ROOT
      ? join(process.env.ANDROID_SDK_ROOT, "platform-tools", "adb")
      : null,
    join(homedir(), "Library", "Android", "sdk", "platform-tools", "adb"),
  ].filter((c): c is string => Boolean(c));
  return candidates.find((c) => existsSync(c)) ?? "adb";
}

function parseAdbDevices(stdout: string) {
  return stdout
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id = "", status = ""] = line.split(/\s+/);
      return { id, status };
    })
    .filter((d) => d.id && d.id !== "List");
}

function parseAdbBroadcastData(stdout: string) {
  const dataMatch = stdout.match(/\bdata="((?:\\"|[^"])*)"/);
  if (dataMatch?.[1]) return dataMatch[1].replace(/\\"/g, '"');
  const resultMatch = stdout.match(/\bresult="((?:\\"|[^"])*)"/);
  if (resultMatch?.[1]) return resultMatch[1].replace(/\\"/g, '"');
  return null;
}

async function requireSingleAdbDevice(): Promise<string> {
  const adb = resolveAdbCommand();
  const { stdout } = await execFileAsync(adb, ["devices", "-l"], {
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  });
  const ready = parseAdbDevices(String(stdout)).filter((d) => d.status === "device");
  if (ready.length === 0) {
    throw new Error("No ADB device connected. Connect exactly one device.");
  }
  if (ready.length > 1) {
    throw new Error(
      `Expected exactly one ADB device, found ${ready.length}: ${ready.map((d) => d.id).join(", ")}`,
    );
  }
  return ready[0]!.id;
}

async function readDeviceCode(adbDeviceId: string, applicationId: string): Promise<string> {
  const adb = resolveAdbCommand();
  const receiverComponent = `${applicationId}/${PROTECTED_KEY_RECEIVER_CLASS}`;
  const { stdout } = await execFileAsync(
    adb,
    [
      "-s",
      adbDeviceId,
      "shell",
      "am",
      "broadcast",
      "--include-stopped-packages",
      "-n",
      receiverComponent,
      "-a",
      GET_DEVICE_ID_ACTION,
    ],
    { timeout: 15_000, maxBuffer: 1024 * 1024 },
  );
  const value = parseAdbBroadcastData(String(stdout));
  if (!value) {
    throw new Error(
      `GET_DEVICE_ID returned no data. Ensure ${applicationId} includes ProtectedRequestKeyReceiver. stdout=${String(stdout).trim()}`,
    );
  }
  if (value.startsWith("ERROR:")) {
    throw new Error(`GET_DEVICE_ID error: ${value}`);
  }
  return value;
}

function pinFromPayload(payload: unknown): string {
  if (payload == null) return "";
  if (typeof payload === "string") return payload.trim();
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const pin = pinFromPayload(item);
      if (pin) return pin;
    }
    return "";
  }
  if (typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    for (const key of ["pinCode", "PinCode", "userPinCode", "UserPinCode"] as const) {
      const v = o[key];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number" && Number.isFinite(v)) return String(v);
    }
  }
  return "";
}

function normalizeUserRow(raw: Record<string, unknown>) {
  return {
    userId:
      pickStr(raw, "userId", "UserId") ||
      coerceMongoHex24(raw.id ?? raw.Id ?? raw._id) ||
      "",
    username: pickStr(raw, "username", "Username", "userName", "UserName"),
    fullName: pickStr(raw, "fullName", "FullName"),
    hubName: pickStr(raw, "hubName", "HubName"),
    // BranchId is an int on UserViewModel
    hubId: pickStr(raw, "branchId", "BranchId", "hubId", "HubId"),
    role: pickStr(raw, "role", "Role"),
    email: pickStr(raw, "email", "Email"),
    phoneNumber: pickStr(raw, "phoneNumber", "PhoneNumber"),
    raw,
  };
}

async function getAllUsers(
  baseUrl: string,
  token: string,
  opts: { fullName?: string; userId?: string; maxResultCount?: number },
): Promise<Record<string, unknown>[]> {
  // Nesy GetAllUsers quirk (UserOperation.ApplyFilter):
  //   IncludePassiveUsers=false → Active users only
  //   IncludePassiveUsers=true  → Passiveive users only (NOT "include both")
  // Match Data Center Users default (active list).
  const body: Record<string, unknown> = {
    IncludePassiveUsers: false,
    FullName: opts.fullName ?? "",
    Roles: [],
    SkipCount: 0,
    MaxResultCount: opts.maxResultCount ?? 25,
    HubIds: [],
    phoneNumber: "",
  };
  if (opts.userId?.trim()) body.UserId = opts.userId.trim();
  const result = await postNesyJson(baseUrl, "User/GetAllUsers", token, body);
  if (!result.ok) throw new Error(result.text);
  const payload = result.json.payload as
    | { items?: unknown[]; Items?: unknown[] }
    | unknown[]
    | undefined;
  const items = Array.isArray(payload)
    ? payload
    : ((payload as { items?: unknown[]; Items?: unknown[] } | undefined)?.items ??
      (payload as { Items?: unknown[] } | undefined)?.Items ??
      []);
  return items.filter((i): i is Record<string, unknown> => !!i && typeof i === "object");
}

function stringifyObjectId(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.$oid === "string" && o.$oid.trim()) return o.$oid.trim();
    const nested = coerceMongoHex24(o.Timestamp ?? o.id ?? o.Id);
    if (nested) return nested;
  }
  return "";
}

/**
 * Same extraction as Data Center `normalizeTrackingResponse`
 * (Get user with search dialog).
 */
function extractCourierFromTrackingEnvelope(envelope: Record<string, unknown>): {
  courierName: string;
  courierUserId: string;
  scheduleId: string;
} {
  let payload = (envelope.payload ??
    envelope.Payload ??
    envelope) as Record<string, unknown> | unknown[];
  // GetTrackingInfo can return a list; use the first hit (same as UI showing one card).
  if (Array.isArray(payload)) {
    payload = (payload[0] && typeof payload[0] === "object"
      ? payload[0]
      : {}) as Record<string, unknown>;
  }
  const courierInfo = (payload.courierInfo ??
    payload.CourierInfo ??
    {}) as Record<string, unknown>;

  const courierName =
    pickStr(courierInfo, "courierName", "CourierName") ||
    pickStr(payload, "courierName", "CourierName");

  const courierUserId =
    stringifyObjectId(courierInfo.courierUserId ?? courierInfo.CourierUserId) ||
    stringifyObjectId(payload.courierUserId ?? payload.CourierUserId) ||
    coerceMongoHex24(courierInfo.courierUserId ?? courierInfo.CourierUserId) ||
    coerceMongoHex24(payload.courierUserId ?? payload.CourierUserId) ||
    "";

  const scheduleId = pickStr(payload, "scheduleId", "ScheduleId");
  return { courierName, courierUserId, scheduleId };
}

/** Soft name match like Users search after "Use this courier". */
async function resolveCourierByDisplayName(
  baseUrl: string,
  token: string,
  displayName: string,
): Promise<CourierResolved | null> {
  const needle = displayName.trim().toLowerCase();
  if (!needle) return null;

  const items = await getAllUsers(baseUrl, token, {
    fullName: displayName.trim(),
    maxResultCount: 100,
  });
  const normalized = items.map(normalizeUserRow).filter((u) => u.userId);
  const exact = normalized.filter(
    (u) => u.fullName.toLowerCase() === needle || u.username.toLowerCase() === needle,
  );
  const soft = normalized.filter(
    (u) =>
      u.fullName.toLowerCase().includes(needle) ||
      needle.includes(u.fullName.toLowerCase()) ||
      u.username.toLowerCase().includes(needle),
  );
  const list = exact.length > 0 ? exact : soft;
  if (list.length === 1) {
    const m = list[0]!;
    return {
      userId: m.userId,
      username: m.username,
      fullName: m.fullName || displayName.trim(),
      hubId: m.hubId,
      hubName: m.hubName,
      raw: m.raw,
    };
  }
  if (list.length > 1) {
    throw new Error(
      `Courier "${displayName}" matched ${list.length} users. Provide courier username.`,
    );
  }

  // Paginated exact-username style fallback (FullName search can miss)
  const byUsername = await findUserRowByExactUsername(baseUrl, token, displayName.trim());
  if (byUsername) {
    const m = normalizeUserRow(byUsername);
    if (m.userId) {
      return {
        userId: m.userId,
        username: m.username,
        fullName: m.fullName || displayName.trim(),
        hubId: m.hubId,
        hubName: m.hubName,
        raw: m.raw,
      };
    }
  }
  return null;
}

/**
 * Tracking call matching Data Center proxy: do not hard-fail on non-200 resultCode
 * when a payload with courier info is still present.
 */
async function fetchTrackingEnvelope(
  baseUrl: string,
  token: string,
  waybill: string,
): Promise<Record<string, unknown>> {
  const response = await fetch(`${baseUrl}/Tracking/GetTrackingInfoByTrackingNumber`, {
    method: "POST",
    headers: nesyPortalHeaders(token),
    body: JSON.stringify({ TrackingNumber: waybill }),
    signal: AbortSignal.timeout(45_000),
  });
  const text = await response.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error("Invalid JSON from Nesy Tracking.");
  }
  if (!response.ok) {
    throw new Error(text || `Tracking HTTP ${response.status}`);
  }
  return json;
}

type CachedCourierLogin = {
  courierUserId: string;
  courierUsername: string | null;
  courierFullName: string | null;
  hubId: string | null;
  hubName: string | null;
  waybillNumber: string | null;
  legacyBarcode: string | null;
  barcode: string | null;
};

/** Look up prior field-login row so we can skip shipment search for known couriers. */
async function findCachedCourierLogin(
  country: string,
  environment: string,
  input: FieldLoginSessionInput,
): Promise<CachedCourierLogin | null> {
  const or: Array<Record<string, unknown>> = [];
  const userId = input.courierUserId?.trim();
  const username = input.courierUsername?.trim();
  const fullName = input.courierName?.trim();
  const tracking = input.trackingNumber?.trim();
  const barcode = input.barcode?.trim();
  const legacy = input.legacyBarcode?.trim();

  if (userId) or.push({ courierUserId: userId });
  if (username) {
    or.push({ courierUsername: { equals: username, mode: "insensitive" } });
  }
  if (fullName) {
    or.push({ courierFullName: { equals: fullName, mode: "insensitive" } });
  }
  if (tracking) {
    or.push(
      { waybillNumber: tracking },
      { barcode: tracking },
      { legacyBarcode: tracking },
    );
  }
  if (barcode) {
    or.push({ barcode }, { waybillNumber: barcode }, { legacyBarcode: barcode });
  }
  if (legacy) {
    or.push({ legacyBarcode: legacy }, { waybillNumber: legacy }, { barcode: legacy });
  }
  if (or.length === 0) return null;

  const row = await prisma.fieldCourierLogin.findFirst({
    where: {
      country,
      environment,
      courierUserId: { not: null },
      OR: or,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });
  if (!row?.courierUserId) return null;
  return {
    courierUserId: row.courierUserId,
    courierUsername: row.courierUsername,
    courierFullName: row.courierFullName,
    hubId: row.hubId,
    hubName: row.hubName,
    waybillNumber: row.waybillNumber,
    legacyBarcode: row.legacyBarcode,
    barcode: row.barcode,
  };
}

async function upsertCourierLoginRow(data: {
  country: string;
  environment: string;
  courierUserId: string | null;
  courierUsername: string | null;
  courierFullName: string | null;
  hubId: string | null;
  hubName: string | null;
  waybillNumber: string | null;
  legacyBarcode: string | null;
  barcode: string | null;
  deviceCode: string | null;
  adbDeviceId: string | null;
  adminUserId: string | null;
  adminUsername: string | null;
  status: string;
  errorMessage?: string | null;
  failedStep?: string | null;
  maestroRunId: string | null;
}) {
  // One row per courier; anonymous failures (no userId) stay as plain inserts.
  if (!data.courierUserId) {
    return prisma.fieldCourierLogin.create({ data });
  }

  return prisma.fieldCourierLogin.upsert({
    where: {
      country_environment_courierUserId: {
        country: data.country,
        environment: data.environment,
        courierUserId: data.courierUserId,
      },
    },
    create: data,
    update: {
      courierUsername: data.courierUsername,
      courierFullName: data.courierFullName,
      hubId: data.hubId,
      hubName: data.hubName,
      waybillNumber: data.waybillNumber,
      legacyBarcode: data.legacyBarcode,
      barcode: data.barcode,
      deviceCode: data.deviceCode,
      adbDeviceId: data.adbDeviceId,
      adminUserId: data.adminUserId,
      adminUsername: data.adminUsername,
      status: data.status,
      errorMessage: data.status === "success" ? null : (data.errorMessage ?? null),
      failedStep: data.status === "success" ? null : (data.failedStep ?? null),
      maestroRunId: data.maestroRunId,
    },
  });
}

async function resolveCourierByUserId(
  baseUrl: string,
  token: string,
  courierUserId: string,
  fallback?: {
    username?: string;
    fullName?: string;
    hubId?: string;
    hubName?: string;
  },
): Promise<CourierResolved> {
  const items = await getAllUsers(baseUrl, token, {
    userId: courierUserId,
    maxResultCount: 5,
  });
  const m = items[0] ? normalizeUserRow(items[0]) : null;
  if (m?.userId) {
    return {
      userId: m.userId,
      username: m.username || fallback?.username || "",
      fullName: m.fullName || fallback?.fullName || "",
      hubId: m.hubId || fallback?.hubId || "",
      hubName: m.hubName || fallback?.hubName || "",
      raw: m.raw,
    };
  }

  // History may still have hub/name even if GetAllUsers misses (rare). Prefer live hub.
  if (fallback?.hubId && fallback?.hubName) {
    return {
      userId: courierUserId,
      username: fallback.username || "",
      fullName: fallback.fullName || "",
      hubId: fallback.hubId,
      hubName: fallback.hubName,
      raw: {},
    };
  }

  throw new Error(`No courier found for userId "${courierUserId}".`);
}

async function resolveCourier(
  baseUrl: string,
  token: string,
  input: FieldLoginSessionInput,
): Promise<{
  courier: CourierResolved;
  waybillNumber: string | null;
  legacyBarcode: string | null;
  barcode: string | null;
}> {
  const courierUserId = input.courierUserId?.trim() ?? "";
  const courierUsername = input.courierUsername?.trim() ?? "";
  const courierName = input.courierName?.trim() ?? "";
  let waybill =
    input.trackingNumber?.trim() || input.barcode?.trim() || "";
  const legacyBarcode = input.legacyBarcode?.trim() || "";
  const barcode = input.barcode?.trim() || "";

  if (courierUserId) {
    const courier = await resolveCourierByUserId(baseUrl, token, courierUserId, {
      username: courierUsername || undefined,
      fullName: courierName || undefined,
      hubId: input.hubId?.trim() || undefined,
      hubName: input.hubName?.trim() || undefined,
    });
    return {
      courier,
      waybillNumber: waybill || null,
      legacyBarcode: legacyBarcode || null,
      barcode: barcode || null,
    };
  }

  if (courierUsername) {
    const row = await findUserRowByExactUsername(baseUrl, token, courierUsername);
    if (!row) {
      throw new Error(`No courier found with username "${courierUsername}".`);
    }
    const m = normalizeUserRow(row);
    if (!m.userId) throw new Error("Courier userId missing.");
    return {
      courier: {
        userId: m.userId,
        username: m.username,
        fullName: m.fullName,
        hubId: m.hubId,
        hubName: m.hubName,
        raw: m.raw,
      },
      waybillNumber: waybill || null,
      legacyBarcode: legacyBarcode || null,
      barcode: barcode || null,
    };
  }

  if (courierName) {
    const resolved = await resolveCourierByDisplayName(baseUrl, token, courierName);
    if (!resolved) {
      throw new Error(`No courier found matching name "${courierName}".`);
    }
    return {
      courier: resolved,
      waybillNumber: waybill || null,
      legacyBarcode: legacyBarcode || null,
      barcode: barcode || null,
    };
  }

  if (!waybill && legacyBarcode) {
    const ship = await postNesyJson(baseUrl, "Shipment/GetShipmentsByFilter", token, [
      { value: legacyBarcode, filterType: 1 },
    ]);
    if (!ship.ok) throw new Error(ship.text);
    const payload = ship.json.payload;
    const first = Array.isArray(payload)
      ? (payload[0] as Record<string, unknown> | undefined)
      : payload && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : undefined;
    if (!first) throw new Error(`No shipment found for legacy barcode "${legacyBarcode}".`);
    waybill =
      pickStr(first, "waybillNumber", "WaybillNumber", "shipmentId", "ShipmentId") || "";
    if (!waybill) {
      throw new Error("Legacy barcode search returned a shipment without waybill number.");
    }
  }

  if (!waybill) {
    throw new Error(
      "Provide courier name/username, or tracking/waybill/barcode/legacy barcode.",
    );
  }

  const trackingEnvelope = await fetchTrackingEnvelope(baseUrl, token, waybill);
  const tracked = extractCourierFromTrackingEnvelope(trackingEnvelope);

  if (tracked.courierUserId) {
    const items = await getAllUsers(baseUrl, token, {
      userId: tracked.courierUserId,
      maxResultCount: 5,
    });
    const m = items[0] ? normalizeUserRow(items[0]) : null;
    if (m?.userId) {
      return {
        courier: {
          userId: m.userId,
          username: m.username,
          fullName: m.fullName || tracked.courierName,
          hubId: m.hubId,
          hubName: m.hubName,
          raw: m.raw,
        },
        waybillNumber: waybill,
        legacyBarcode: legacyBarcode || null,
        barcode: barcode || null,
      };
    }
  }

  if (tracked.courierName) {
    const resolved = await resolveCourierByDisplayName(
      baseUrl,
      token,
      tracked.courierName,
    );
    if (resolved) {
      return {
        courier: resolved,
        waybillNumber: waybill,
        legacyBarcode: legacyBarcode || null,
        barcode: barcode || null,
      };
    }
    throw new Error(
      `Tracking found courier "${tracked.courierName}"` +
        (tracked.scheduleId ? ` (schedule ${tracked.scheduleId})` : "") +
        ` but no unique dashboard user matched. Provide courier username.`,
    );
  }

  throw new Error(
    `Could not resolve courier for waybill "${waybill}". Tracking response has no courier name/userId (same fields as Get user with search).`,
  );
}

/**
 * Mirror Connection page resolution (`resolveSessionDashboardUserId` + thin ManageUser fallback):
 * GetMyInfo → login snapshot id → JWT → GetAllUsers(UserId) → paginated username → thin login row.
 */
async function resolveAdminProfile(
  baseUrl: string,
  token: string,
  loginUser: Record<string, unknown>,
): Promise<AdminProfile> {
  let userId = "";

  try {
    const myInfo = await postNesyJson(baseUrl, "User/GetMyInfo", token, {});
    if (myInfo.ok) {
      userId = extractUserMongoIdFromGetMyInfoPayload(myInfo.json.payload) ?? "";
    }
  } catch {
    /* GetMyInfo optional — same as Connection */
  }

  if (!userId) {
    userId = mongoIdFromRecord(loginUser) ?? "";
  }
  if (!userId) {
    userId = mongoIdFromJwt(token) ?? "";
  }

  if (userId) {
    try {
      const items = await getAllUsers(baseUrl, token, { userId, maxResultCount: 5 });
      if (items[0]) {
        const m = normalizeUserRow(items[0]);
        return {
          userId: m.userId || userId,
          username: m.username || pickStr(loginUser, "username", "Username"),
          hubId: m.hubId || pickStr(loginUser, "branchId", "BranchId"),
          hubName: m.hubName || pickStr(loginUser, "hubName", "HubName"),
          row: m.raw,
        };
      }
    } catch {
      /* fall through to username / thin snapshot */
    }
  }

  const username = pickStr(loginUser, "username", "Username", "userName", "UserName");
  if (username) {
    try {
      const row = await findUserRowByExactUsername(baseUrl, token, username);
      if (row) {
        const m = normalizeUserRow(row);
        if (m.userId) {
          return {
            userId: m.userId,
            username: m.username || username,
            hubId: m.hubId || pickStr(loginUser, "branchId", "BranchId"),
            hubName: m.hubName || pickStr(loginUser, "hubName", "HubName"),
            row: m.raw,
          };
        }
      }
    } catch {
      /* fall through to thin snapshot */
    }
  }

  // Connection-compatible thin ManageUser body — does not require the admin to appear in GetAllUsers.
  if (userId) {
    const thin = buildThinAdminRowFromLogin(loginUser, userId);
    const hubId = pickStr(thin, "branchId", "BranchId");
    const hubName = pickStr(thin, "hubName", "HubName");
    return {
      userId,
      username: pickStr(thin, "username", "Username") || username,
      hubId,
      hubName,
      row: thin,
    };
  }

  throw new Error(
    "Could not resolve admin session user for ManageUser. Connect on Data Center → Connection, then retry (need GetMyInfo, login userId, or JWT user id).",
  );
}

function isActiveState(state: unknown): boolean {
  if (state === false) return false;
  if (typeof state === "string" && state.toLowerCase() === "passive") return false;
  return true;
}

function buildManageUserPayload(
  sessionRow: Record<string, unknown>,
  branchId: string,
  hubName: string,
): Record<string, unknown> {
  const cidRaw = sessionRow.customerId ?? sessionRow.CustomerId;
  const customerIdNum =
    typeof cidRaw === "number" && Number.isFinite(cidRaw)
      ? cidRaw
      : parseInt(String(cidRaw ?? "0").replace(/\D/g, "") || "0", 10) || 0;
  const rawBff =
    sessionRow.bffPermissionGroupNames ?? sessionRow.BFFPermissionGroupNames;
  const permissionGroupNames = Array.isArray(rawBff) ? [...rawBff] : [];

  return {
    UserId: pickStr(sessionRow, "userId", "UserId"),
    IsActive: isActiveState(sessionRow.state ?? sessionRow.State),
    FullName: pickStr(sessionRow, "fullName", "FullName"),
    RoleUniqueName: pickStr(sessionRow, "role", "Role"),
    Email: pickStr(sessionRow, "email", "Email"),
    PhoneNumber: pickStr(sessionRow, "phoneNumber", "PhoneNumber"),
    PasswordDoNotExpire: Boolean(
      sessionRow.passwordDoNotExpire ?? sessionRow.PasswordDoNotExpire ?? true,
    ),
    BranchId: branchId.trim(),
    HubName: hubName.trim(),
    LanguageCode: pickStr(sessionRow, "languageCode", "LanguageCode") || "",
    IsEurodisCreatorUser: Boolean(
      sessionRow.isEurodisCreatorUser ?? sessionRow.IsEurodisCreatorUser ?? true,
    ),
    IsEurodisAllowedUser: Boolean(
      sessionRow.isEurodisAllowedUser ?? sessionRow.IsEurodisAllowedUser ?? true,
    ),
    IsTifCreatorUser: Boolean(
      sessionRow.isTifCreatorUser ?? sessionRow.IsTifCreatorUser ?? true,
    ),
    AdditionalHubIds: [] as string[],
    OohId: pickStr(sessionRow, "oohId", "OohId"),
    OohName: pickStr(sessionRow, "oohName", "OohName"),
    PartnerId: pickStr(sessionRow, "partnerId", "PartnerId"),
    CustomerApiKey: pickStr(sessionRow, "customerApiKey", "CustomerApiKey"),
    CustomerId: customerIdNum,
    CashRegisterKey: sessionRow.cashRegisterKey ?? sessionRow.CashRegisterKey ?? null,
    BFFPermissionGroupNames: permissionGroupNames,
    PreferredLayoutId: sessionRow.preferredLayoutId ?? sessionRow.PreferredLayoutId ?? null,
    noPartner: true,
  };
}

async function fetchCourierPin(
  baseUrl: string,
  token: string,
  courierUserId: string,
): Promise<string> {
  const result = await postNesyJson(baseUrl, "User/GetUserDevicePinCode", token, {
    UserId: courierUserId,
  });
  if (!result.ok) throw new Error(result.text);
  return pinFromPayload(result.json.payload);
}

async function getUserDevices(
  baseUrl: string,
  token: string,
  userId: string,
): Promise<string[]> {
  const result = await postNesyJson(baseUrl, "User/GetUserDevices", token, { userId });
  if (!result.ok) throw new Error(result.text);
  const payload = result.json.payload;
  const rows = Array.isArray(payload) ? payload : [];
  const devices =
    rows.length > 0 && typeof rows[0] === "object" && rows[0] !== null && "devices" in rows[0]
      ? (rows[0] as { devices?: string[] }).devices
      : (rows[0] as { Devices?: string[] } | undefined)?.Devices;
  return Array.isArray(devices) ? devices.map(String) : [];
}

async function setUserDevices(
  baseUrl: string,
  token: string,
  userId: string,
  devices: string[],
  addedDeviceId: string,
): Promise<void> {
  const result = await postNesyJson(baseUrl, "User/SetUserDevice", token, {
    userId,
    devices,
    addedDeviceId,
  });
  if (!result.ok) throw new Error(result.text);
}

function buildFieldLoginNodes(
  country: string,
  environment: string,
  pinCode: string,
  applicationId: string,
) {
  const launchId = "node-launch";
  const authId = "node-auth";
  return {
    nodes: [
      {
        id: launchId,
        type: "LAUNCH_APP",
        kind: "action",
        position: { x: 120, y: 80 },
        data: {
          title: "Launch App",
          subtitle: "Maestro Command",
          icon: "Smartphone",
          config: {
            country,
            environment,
            clearState: true,
            applicationId,
          },
        },
        parentId: null,
        children: [],
        branchType: null,
        nextNodeId: authId,
        connections: [],
      },
      {
        id: authId,
        type: "AUTH_LOGIN",
        kind: "action",
        position: { x: 120, y: 240 },
        data: {
          title: "Auth / Login",
          subtitle: "Login Action",
          icon: "UserRound",
          config: { pinCode },
        },
        parentId: null,
        children: [],
        branchType: null,
        nextNodeId: null,
        connections: [],
      },
    ],
    edges: [
      {
        id: "conn-launch-auth",
        sourceNodeId: launchId,
        targetNodeId: authId,
        sourceHandle: "default",
        targetHandle: "top",
      },
    ],
  };
}

async function automationJson(
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const url = `${AUTOMATION_API_ORIGIN.replace(/\/$/, "")}/api${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(60_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (json as { message?: string; error?: string }).message ??
      (json as { error?: string }).error ??
      `Automation API ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

async function ensureAndRunMaestroLogin(params: {
  country: string;
  environment: string;
  pinCode: string;
  applicationId: string;
  adbDeviceId: string;
}): Promise<string> {
  let workflowId: string | null = null;

  try {
    const existing = (await automationJson(`/workflows/${SYSTEM_WORKFLOW_SLUG}`)) as {
      data?: { id?: string };
    };
    workflowId = existing.data?.id ?? null;
  } catch {
    workflowId = null;
  }

  if (!workflowId) {
    const created = (await automationJson("/workflows", {
      method: "POST",
      body: JSON.stringify({
        name: "Field Courier Login",
        description: "System workflow for field support PIN login (LAUNCH_APP + AUTH_LOGIN).",
        category: "system",
        slug: SYSTEM_WORKFLOW_SLUG,
      }),
    })) as { data?: { id?: string; slug?: string } };
    workflowId = created.data?.id ?? null;
    if (!workflowId) throw new Error("Failed to create system workflow field-courier-login.");
  }

  const { nodes, edges } = buildFieldLoginNodes(
    params.country,
    params.environment,
    params.pinCode,
    params.applicationId,
  );

  await automationJson(`/workflows/${workflowId}/versions`, {
    method: "POST",
    body: JSON.stringify({
      nodes,
      edges,
      changelog: "Field courier login PIN injection",
    }),
  });

  const run = (await automationJson(`/workflows/${workflowId}/run`, {
    method: "POST",
    body: JSON.stringify({
      selectedDeviceId: params.adbDeviceId,
      mode: "full",
      country: params.country,
      environment: params.environment,
    }),
  })) as { data?: { runId?: string; status?: string }; runId?: string };

  const runId = run.data?.runId ?? run.runId;
  if (!runId) throw new Error("Automation run did not return runId.");

  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000));
    const statusJson = (await automationJson(`/workflows/runs/${runId}/status`)) as Record<
      string,
      unknown
    >;
    const status = extractAutomationRunStatus(statusJson);

    // Match workflow editor: anything except running/pending is terminal.
    if (status && status !== "running" && status !== "pending") {
      if (
        status === "success" ||
        status === "completed" ||
        status === "complete" ||
        status === "ok"
      ) {
        return runId;
      }
      throw new Error(`Maestro run ended with status "${status}".`);
    }
  }
  throw new Error("Maestro run timed out after 180s.");
}

/** Automation status API may return top-level or `{ data: ... }` (same as web client). */
function extractAutomationRunStatus(payload: Record<string, unknown>): string {
  const nested =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : null;
  const raw =
    payload.runStatus ??
    payload.status ??
    nested?.runStatus ??
    nested?.status ??
    "";
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

export function startFieldLoginSession(input: FieldLoginSessionInput): FieldLoginSession {
  const country = input.country?.trim().toUpperCase() ?? "";
  const environment = input.environment?.trim().toLowerCase() ?? "";
  const mode = input.mode === "replay" ? "replay" : "create";

  if (!isNesyDashboardCountry(country) || !isNesyEnvironment(environment)) {
    throw new Error("country and environment are required (HR|SI|RS|BA|ME / stage|prod).");
  }
  if (!isNesyMobileCountry(country) || !isNesyMobileEnvironment(environment)) {
    throw new Error("country/environment must be a mobile-supported pair.");
  }

  const courierUserId = input.courierUserId?.trim() || "";

  if (mode === "replay") {
    if (!courierUserId) {
      throw new Error("Replay requires courierUserId from history.");
    }
  } else {
    const hasCourier = Boolean(
      input.courierName?.trim() || input.courierUsername?.trim() || courierUserId,
    );
    const hasShipment = Boolean(
      input.trackingNumber?.trim() ||
        input.barcode?.trim() ||
        input.legacyBarcode?.trim(),
    );
    if (!hasCourier && !hasShipment) {
      throw new Error(
        "Provide at least one of: courier name, courier username, tracking, barcode, or legacy barcode.",
      );
    }
  }

  const session: FieldLoginSession = {
    id: randomUUID(),
    status: "running",
    steps: createInitialSteps(mode),
    errorMessage: null,
    failedStep: null,
    historyId: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    input: {
      country,
      environment,
      mode,
      trackingNumber: input.trackingNumber?.trim() || undefined,
      barcode: input.barcode?.trim() || undefined,
      legacyBarcode: input.legacyBarcode?.trim() || undefined,
      courierName: input.courierName?.trim() || undefined,
      courierUsername: input.courierUsername?.trim() || undefined,
      courierUserId: courierUserId || undefined,
      hubId: input.hubId?.trim() || undefined,
      hubName: input.hubName?.trim() || undefined,
    },
  };
  sessions.set(session.id, session);

  void runOrchestrator(session, country, environment).catch((err) => {
    console.error("[field-courier-login] orchestrator crashed", err);
  });

  return cloneSession(session);
}

async function runOrchestrator(
  session: FieldLoginSession,
  country: NesyDashboardCountry & NesyMobileCountry,
  environment: NesyEnvironment & NesyMobileEnvironment,
) {
  const baseUrl = resolveBaseUrl(country, environment);
  if (!baseUrl) {
    fail(session, "validate_device", `Base URL not configured for ${country}/${environment}.`);
    return;
  }

  let hubChanged = false;
  let originalHubId = "";
  let originalHubName = "";
  let adminRow: Record<string, unknown> | null = null;
  let adminUserId: string | null = null;
  let adminUsername: string | null = null;
  let token = "";
  let courier: CourierResolved | null = null;
  let waybillNumber: string | null = null;
  let legacyBarcode: string | null = null;
  let barcode: string | null = null;
  let deviceCode: string | null = null;
  let adbDeviceId: string | null = null;
  let maestroRunId: string | null = null;
  let pinCode = "";
  const applicationId = resolveNesyMobileApplicationId(country, environment);

  const restoreHubIfNeeded = async () => {
    if (!hubChanged || !adminRow || !originalHubId) return;
    setStep(session, "restore_hub", "active", "Restoring original admin hub…");
    try {
      const login = await loginDashboard(country, environment);
      token = login.token;
      const payload = buildManageUserPayload(adminRow, originalHubId, originalHubName);
      const managed = await postNesyJson(baseUrl, "User/ManageUser", token, payload);
      if (!managed.ok) throw new Error(managed.text);
      await loginDashboard(country, environment);
      setStep(session, "restore_hub", "done", `${originalHubName || originalHubId}`);
      hubChanged = false;
    } catch (err) {
      setStep(
        session,
        "restore_hub",
        "error",
        err instanceof Error ? err.message : "Hub restore failed",
      );
    }
  };

  try {
    setStep(session, "validate_device", "active", "Checking connected ADB devices…");
    adbDeviceId = await requireSingleAdbDevice();
    setStep(session, "validate_device", "done", adbDeviceId);

    const isReplay = session.input.mode === "replay";
    setStep(
      session,
      "resolve_courier",
      "active",
      isReplay
        ? "Loading known courier…"
        : "Checking local history, then Nesy dashboard…",
    );
    const login = await loginDashboard(country, environment);
    token = login.token;
    const admin = await resolveAdminProfile(baseUrl, token, login.user);
    adminRow = admin.row;
    adminUserId = admin.userId;
    adminUsername = admin.username;
    originalHubId = admin.hubId;
    originalHubName = admin.hubName;

    // Prefer our DB (1 row / courier): skip shipment search when we already know them.
    const cached = await findCachedCourierLogin(country, environment, session.input);
    let resolveSource: "cache" | "replay" | "search" = "search";

    if (cached?.courierUserId) {
      resolveSource = isReplay ? "replay" : "cache";
      const live = await resolveCourierByUserId(baseUrl, token, cached.courierUserId, {
        username: cached.courierUsername || session.input.courierUsername || undefined,
        fullName: cached.courierFullName || session.input.courierName || undefined,
        hubId: cached.hubId || session.input.hubId || undefined,
        hubName: cached.hubName || session.input.hubName || undefined,
      });
      courier = live;
      waybillNumber =
        session.input.trackingNumber?.trim() ||
        cached.waybillNumber ||
        null;
      legacyBarcode =
        session.input.legacyBarcode?.trim() ||
        cached.legacyBarcode ||
        null;
      barcode = session.input.barcode?.trim() || cached.barcode || null;
    } else {
      const resolved = await resolveCourier(baseUrl, token, session.input);
      courier = resolved.courier;
      waybillNumber = resolved.waybillNumber;
      legacyBarcode = resolved.legacyBarcode;
      barcode = resolved.barcode;
      if (isReplay) resolveSource = "replay";
    }

    const sourceLabel =
      resolveSource === "cache"
        ? "From history · "
        : resolveSource === "replay"
          ? "Replay · "
          : "";
    setStep(
      session,
      "resolve_courier",
      "done",
      `${sourceLabel}${courier.fullName || courier.username} · hub ${courier.hubName || courier.hubId || "—"}`,
    );

    if (!courier.hubId || !courier.hubName) {
      throw Object.assign(new Error("Courier has no hub assigned."), {
        step: "align_hub" as FieldLoginStepId,
      });
    }

    const hubsMatch = Boolean(originalHubId && originalHubId === courier.hubId);

    if (!hubsMatch) {
      setStep(
        session,
        "align_hub",
        "active",
        `Switching admin hub → ${courier.hubName}`,
      );
      const payload = buildManageUserPayload(adminRow, courier.hubId, courier.hubName);
      const managed = await postNesyJson(baseUrl, "User/ManageUser", token, payload);
      if (!managed.ok) throw new Error(managed.text);
      hubChanged = true;
      const relogin = await loginDashboard(country, environment);
      token = relogin.token;
      const refreshedAdmin = await resolveAdminProfile(baseUrl, token, relogin.user);
      adminRow = refreshedAdmin.row;
      setStep(session, "align_hub", "done", courier.hubName);
    } else {
      setStep(session, "align_hub", "skipped", "Admin hub already matches courier hub");
    }

    setStep(
      session,
      "fetch_pin",
      "active",
      isReplay
        ? "Checking whether courier PIN is still active…"
        : "Requesting device PIN…",
    );
    pinCode = await fetchCourierPin(baseUrl, token, courier.userId);

    if (!pinCode || !/^\d{4}$/.test(pinCode)) {
      throw Object.assign(
        new Error(
          isReplay
            ? "Courier PIN is not active (empty or invalid). Generate/reset PIN in Data Center, then retry."
            : "Courier PIN is empty or invalid after hub alignment.",
        ),
        { step: "fetch_pin" as FieldLoginStepId },
      );
    }
    setStep(
      session,
      "fetch_pin",
      "done",
      isReplay ? "PIN still active" : "PIN obtained",
    );

    setStep(
      session,
      "read_device_code",
      "active",
      `Broadcast GET_DEVICE_ID → ${applicationId}`,
    );
    deviceCode = await readDeviceCode(adbDeviceId, applicationId);
    setStep(session, "read_device_code", "done", deviceCode);

    setStep(session, "register_device", "active", "Adding device to courier…");
    const existing = await getUserDevices(baseUrl, token, courier.userId);
    if (!existing.includes(deviceCode)) {
      await setUserDevices(baseUrl, token, courier.userId, [...existing, deviceCode], deviceCode);
      setStep(session, "register_device", "done", `Added ${deviceCode}`);
    } else {
      setStep(session, "register_device", "done", "Device already registered");
    }

    setStep(session, "maestro_login", "active", "LAUNCH_APP + AUTH_LOGIN…");
    maestroRunId = await ensureAndRunMaestroLogin({
      country,
      environment,
      pinCode,
      applicationId,
      adbDeviceId,
    });
    setStep(session, "maestro_login", "done", `run ${maestroRunId}`);

    await restoreHubIfNeeded();
    if (session.steps.find((s) => s.id === "restore_hub")?.status === "pending") {
      setStep(session, "restore_hub", "skipped", "Hub was not changed");
    }

    setStep(session, "persist", "active", "Upserting courier history…");
    const row = await upsertCourierLoginRow({
      country,
      environment,
      courierUserId: courier.userId,
      courierUsername: courier.username || null,
      courierFullName: courier.fullName || null,
      hubId: courier.hubId || null,
      hubName: courier.hubName || null,
      waybillNumber,
      legacyBarcode,
      barcode,
      deviceCode,
      adbDeviceId,
      adminUserId,
      adminUsername,
      status: "success",
      errorMessage: null,
      failedStep: null,
      maestroRunId,
    });
    setStep(session, "persist", "done", row.id);
    updateSession(session, { status: "success", historyId: row.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const stepHint =
      err && typeof err === "object" && "step" in err
        ? ((err as { step?: FieldLoginStepId }).step ?? null)
        : null;
    const active =
      stepHint ??
      session.steps.find((s) => s.status === "active")?.id ??
      "resolve_courier";
    setStep(session, active, "error", message);
    await restoreHubIfNeeded();
    if (session.steps.find((s) => s.id === "restore_hub")?.status === "pending") {
      setStep(session, "restore_hub", "skipped", "Hub was not changed");
    }

    try {
      setStep(session, "persist", "active", "Upserting failed attempt…");
      const row = await upsertCourierLoginRow({
        country,
        environment,
        courierUserId: courier?.userId ?? null,
        courierUsername: courier?.username ?? session.input.courierUsername ?? null,
        courierFullName: courier?.fullName ?? session.input.courierName ?? null,
        hubId: courier?.hubId ?? null,
        hubName: courier?.hubName ?? null,
        waybillNumber,
        legacyBarcode,
        barcode,
        deviceCode,
        adbDeviceId,
        adminUserId,
        adminUsername,
        status: "failed",
        errorMessage: message,
        failedStep: active,
        maestroRunId,
      });
      setStep(session, "persist", "done", row.id);
      updateSession(session, {
        status: "failed",
        errorMessage: message,
        failedStep: active,
        historyId: row.id,
      });
    } catch (persistErr) {
      const persistMsg =
        persistErr instanceof Error ? persistErr.message : "Persist failed";
      setStep(session, "persist", "error", persistMsg);
      updateSession(session, {
        status: "failed",
        errorMessage: `${message} (also failed to persist: ${persistMsg})`,
        failedStep: active,
      });
    }
  }
}

function fail(session: FieldLoginSession, step: FieldLoginStepId, message: string) {
  setStep(session, step, "error", message);
  updateSession(session, { status: "failed", errorMessage: message, failedStep: step });
}
