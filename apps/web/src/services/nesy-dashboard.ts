import { API_BASE } from "@/services/api";
import { throwDataCenterApiError } from "@/services/api-errors";
import type { NesyCountry, NesyEnvironment } from "@/services/nesy-auth";

export type NesyDashboardAuth = {
  token: string;
  country: NesyCountry;
  environment: NesyEnvironment;
};

export type NesyHubOption = { hubId: string; hubName: string };

export type NesyRoleOption = {
  uniqueName: string;
  displayName: string;
};

export function normalizeHub(raw: Record<string, unknown>): NesyHubOption {
  return {
    hubId: String(raw.hubId ?? raw.HubId ?? ""),
    hubName: String(raw.hubName ?? raw.HubName ?? ""),
  };
}

export function normalizeRole(raw: Record<string, unknown>): NesyRoleOption {
  return {
    uniqueName: String(raw.uniqueName ?? raw.UniqueName ?? ""),
    displayName: String(raw.displayName ?? raw.DisplayName ?? raw.uniqueName ?? ""),
  };
}

export function normalizeDashboardUser(raw: Record<string, unknown>) {
  const userId = String(raw.userId ?? raw.UserId ?? "");
  const stateRaw = raw.state ?? raw.State;
  let statusLabel = "Active";
  if (stateRaw === false || stateRaw === "Passive" || stateRaw === "passive") {
    statusLabel = "Inactive";
  } else if (stateRaw != null && String(stateRaw).toLowerCase() === "passive") {
    statusLabel = "Inactive";
  }

  return {
    userId,
    username: String(raw.username ?? raw.Username ?? ""),
    fullName: String(raw.fullName ?? raw.FullName ?? ""),
    role: String(raw.role ?? raw.Role ?? ""),
    email: String(raw.email ?? raw.Email ?? ""),
    phoneNumber: String(raw.phoneNumber ?? raw.PhoneNumber ?? ""),
    hubName: String(raw.hubName ?? raw.HubName ?? ""),
    /** Portal branch hub id (`UserViewModel.BranchId`) — Nesy PIN hub eşlemesi için `HubId.ToString()` ile aynı alan */
    hubId: String(raw.branchId ?? raw.BranchId ?? raw.hubId ?? raw.HubId ?? ""),
    status: statusLabel,
  };
}

async function readJson(res: Response) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throwDataCenterApiError(res, json, `Request failed (${res.status})`);
  }
  return json;
}

/** Nesy GetMyInfo payload/result içinden Mongo ObjectId çıkarımı */
function extractUserMongoIdFromGetMyInfoPayload(payload: unknown): string | null {
  const tryObj = (o: Record<string, unknown>): string | null => {
    for (const k of ["Id", "id", "UserId", "userId", "_id"]) {
      const v = o[k];
      if (v == null) continue;
      const s = typeof v === "string" ? v.trim() : String(v).trim();
      if (/^[a-f\d]{24}$/i.test(s)) return s;
    }
    return null;
  };

  if (payload != null && typeof payload === "object") {
    const top = tryObj(payload as Record<string, unknown>);
    if (top) return top;
    const nested =
      (payload as Record<string, unknown>).payload ?? (payload as Record<string, unknown>).Payload;
    if (nested && typeof nested === "object") return tryObj(nested as Record<string, unknown>);
  }
  return null;
}

export async function fetchDashboardUsers(
  auth: NesyDashboardAuth,
  params: {
    includePassiveUsers: boolean;
    fullName: string;
    roles: string[];
    hubIds: Array<{ Id: number; Value: string }>;
    skipCount: number;
    maxResultCount: number;
    /** Nesy User/GetAllUsers için tek kullanıcı filtreleri */
    userId?: string;
  }
) {
  const body: Record<string, unknown> = {
      token: auth.token,
      country: auth.country,
      environment: auth.environment,
      includePassiveUsers: params.includePassiveUsers,
      fullName: params.fullName,
      roles: params.roles,
      hubIds: params.hubIds,
      skipCount: params.skipCount,
      maxResultCount: params.maxResultCount,
  };
  if (params.userId?.trim()) {
    body.userId = params.userId.trim();
  }
  const res = await fetch(`${API_BASE}/nesy/dashboard/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await readJson(res);
  return json.data as { items: Record<string, unknown>[]; totalCount: number };
}

export async function fetchDashboardRoles(auth: NesyDashboardAuth): Promise<NesyRoleOption[]> {
  const res = await fetch(`${API_BASE}/nesy/dashboard/roles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: auth.token,
      country: auth.country,
      environment: auth.environment,
    }),
  });
  const json = await readJson(res);
  const data = json.data;
  if (!Array.isArray(data)) return [];
  return data.map((row) => normalizeRole(row as Record<string, unknown>));
}

export async function fetchDashboardHubs(auth: NesyDashboardAuth): Promise<NesyHubOption[]> {
  const res = await fetch(`${API_BASE}/nesy/dashboard/hubs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: auth.token,
      country: auth.country,
      environment: auth.environment,
      withoutPolygonList: false,
      withoutFilter: true,
    }),
  });
  const json = await readJson(res);
  const data = json.data;
  if (!Array.isArray(data)) return [];
  return data.map((row) => normalizeHub(row as Record<string, unknown>)).filter((h) => h.hubId);
}

/** User/GetMyInfo — Nesy’nin bağlamdaki kullanıcısı; Id = Mongo kullanıcı id */
export async function fetchDashboardMyInfo(auth: NesyDashboardAuth): Promise<{
  userId: string;
  raw: unknown;
}> {
  const res = await fetch(`${API_BASE}/nesy/dashboard/my-info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: auth.token,
      country: auth.country,
      environment: auth.environment,
    }),
  });
  const json = await readJson(res);
  const raw = json.data;
  const userId = extractUserMongoIdFromGetMyInfoPayload(raw) ?? "";
  return { userId, raw };
}

export async function fetchUserDevices(
  auth: NesyDashboardAuth,
  userId: string
): Promise<{ devices: string[] }> {
  const res = await fetch(`${API_BASE}/nesy/dashboard/user-devices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: auth.token,
      country: auth.country,
      environment: auth.environment,
      userId,
    }),
  });
  const json = await readJson(res);
  const devices = (json.data?.devices as string[] | undefined) ?? [];
  return { devices: Array.isArray(devices) ? devices : [] };
}

export type CourierDeviceInfo = {
  courierUserId: string;
  deviceId: string;
  deviceModelName: string;
  deviceChargeStatus: string;
  deviceApplicationVersion: string;
  appVersion: string;
  raw: unknown;
};

function readString(raw: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = raw[key];
    if (value == null) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return "";
}

function isVersionLike(value: string): boolean {
  return /^\d+(?:[._-]\d+){1,4}(?:[-+][\w.-]+)?$/i.test(value.trim());
}

function normalizeCourierDeviceInfo(raw: unknown): CourierDeviceInfo | null {
  if (raw == null || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const deviceApplicationVersion = readString(row, "deviceApplicationVersion", "DeviceApplicationVersion");
  const deviceModelName = readString(row, "deviceModelName", "DeviceModelName");
  const appVersion = isVersionLike(deviceApplicationVersion)
    ? deviceApplicationVersion
    : isVersionLike(deviceModelName)
      ? deviceModelName
      : deviceApplicationVersion || deviceModelName;

  return {
    courierUserId: readString(row, "courierUserId", "CourierUserId"),
    deviceId: readString(row, "deviceId", "DeviceId"),
    deviceModelName,
    deviceChargeStatus: readString(row, "deviceChargeStatus", "DeviceChargeStatus"),
    deviceApplicationVersion,
    appVersion,
    raw,
  };
}

export async function fetchCourierDeviceInfo(
  auth: NesyDashboardAuth,
  userId: string
): Promise<CourierDeviceInfo | null> {
  const res = await fetch(`${API_BASE}/nesy/dashboard/courier-device-info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: auth.token,
      country: auth.country,
      environment: auth.environment,
      userId,
    }),
  });
  const json = await readJson(res);
  return normalizeCourierDeviceInfo(json.data);
}

export async function setUserDevicesOnNesy(
  auth: NesyDashboardAuth,
  params: { userId: string; devices: string[]; addedDeviceId?: string }
): Promise<unknown> {
  const res = await fetch(`${API_BASE}/nesy/dashboard/user-devices/set`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: auth.token,
      country: auth.country,
      environment: auth.environment,
      userId: params.userId,
      devices: params.devices,
      ...(params.addedDeviceId ? { addedDeviceId: params.addedDeviceId } : {}),
    }),
  });
  const json = await readJson(res);
  return json.data;
}

/** User/GetMyPinCode — oturumdaki kullanıcı */
export async function fetchDashboardMyPin(auth: NesyDashboardAuth): Promise<{ pin: string; raw: unknown }> {
  const res = await fetch(`${API_BASE}/nesy/dashboard/user-pin/my`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: auth.token,
      country: auth.country,
      environment: auth.environment,
    }),
  });
  const json = await readJson(res);
  const data = json.data as { pin?: string; raw?: unknown };
  return { pin: typeof data?.pin === "string" ? data.pin : "", raw: data?.raw };
}

/** User/GetUserDevicePinCode */
export async function fetchDashboardUserDevicePin(
  auth: NesyDashboardAuth,
  userId: string
): Promise<{ pin: string; raw: unknown }> {
  const res = await fetch(`${API_BASE}/nesy/dashboard/user-pin/device`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: auth.token,
      country: auth.country,
      environment: auth.environment,
      userId,
    }),
  });
  const json = await readJson(res);
  const data = json.data as { pin?: string; raw?: unknown };
  return { pin: typeof data?.pin === "string" ? data.pin : "", raw: data?.raw };
}

/** User/GetUserGeneratePinCode */
export async function fetchDashboardGeneratedPin(auth: NesyDashboardAuth): Promise<{ pin: string; raw: unknown }> {
  const res = await fetch(`${API_BASE}/nesy/dashboard/user-pin/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: auth.token,
      country: auth.country,
      environment: auth.environment,
    }),
  });
  const json = await readJson(res);
  const data = json.data as { pin?: string; raw?: unknown };
  return { pin: typeof data?.pin === "string" ? data.pin : "", raw: data?.raw };
}

/** User/SetUserGeneratePinCode — genelde portal oturum kullanıcısı */
export async function setDashboardGeneratePinCode(auth: NesyDashboardAuth, pinCode: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}/nesy/dashboard/user-pin/set-generated`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: auth.token,
      country: auth.country,
      environment: auth.environment,
      pinCode,
    }),
  });
  const json = await readJson(res);
  return json.data;
}

/** User/SetUserPin */
export async function setDashboardUserPin(
  auth: NesyDashboardAuth,
  params: { userId: string; userPinCode: string }
): Promise<unknown> {
  const res = await fetch(`${API_BASE}/nesy/dashboard/user-pin/set`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: auth.token,
      country: auth.country,
      environment: auth.environment,
      userId: params.userId,
      userPinCode: params.userPinCode,
    }),
  });
  const json = await readJson(res);
  return json.data;
}

function pickRecordStr(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = record[key];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

const REGEX_HEX_MONGO_OBJECT_ID = /^[a-f\d]{24}$/i;

function coerceMongoHex24UserId(raw: unknown): string | null {
  if (raw == null) return null;
  const s = typeof raw === "string" ? raw.trim() : String(raw).trim();
  return REGEX_HEX_MONGO_OBJECT_ID.test(s) ? s : null;
}

/** Oturum (login/`user`) ve Nesy liste satırında olabilecek kullanıcı kimliği alanları */
function mongoUserIdCandidateFromDashboardRecord(record: Record<string, unknown> | undefined): string | null {
  if (!record) return null;
  for (const key of ["userId", "UserId", "id", "Id", "_id", "user_id"]) {
    const x = coerceMongoHex24UserId(record[key]);
    if (x) return x;
  }
  return null;
}

function decodeJwtPayloadJson(token: string | null | undefined): Record<string, unknown> | null {
  const t = token?.trim();
  if (!t) return null;
  const parts = t.split(".");
  if (parts.length < 2 || !parts[1]) return null;
  try {
    const b64url = parts[1];
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = atob(b64 + pad);
    const o = JSON.parse(json) as unknown;
    return typeof o === "object" && o !== null ? (o as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function mongoUserIdCandidateFromJwt(token: string | null | undefined): string | null {
  const p = decodeJwtPayloadJson(token);
  if (!p) return null;
  for (const key of ["userId", "UserId", "sub", "nameid", "user_id", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"]) {
    const x = coerceMongoHex24UserId(p[key]);
    if (x) return x;
  }
  for (const v of Object.values(p)) {
    const x = typeof v === "string" ? coerceMongoHex24UserId(v) : null;
    if (x) return x;
  }
  return null;
}

function isActiveDashboardState(raw: unknown): boolean {
  if (raw === false) return false;
  if (raw === true) return true;
  const s = String(raw ?? "").toLowerCase();
  if (s === "passive" || s.includes("inactive")) return false;
  return true;
}

/**
 * Oturum kullanıcısının liste satırı + seçili courier hub → User/ManageUser gövdesi (primary BranchId + HubName).
 */
export function buildManageUserApplyCourierHubPayload(
  sessionRow: Record<string, unknown>,
  courierBranchId: string,
  courierHubName: string
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
    UserId: pickRecordStr(sessionRow, "userId", "UserId"),
    IsActive: isActiveDashboardState(sessionRow.state ?? sessionRow.State),
    FullName: pickRecordStr(sessionRow, "fullName", "FullName"),
    RoleUniqueName: pickRecordStr(sessionRow, "role", "Role"),
    Email: pickRecordStr(sessionRow, "email", "Email"),
    PhoneNumber: pickRecordStr(sessionRow, "phoneNumber", "PhoneNumber"),
    PasswordDoNotExpire: Boolean(sessionRow.passwordDoNotExpire ?? sessionRow.PasswordDoNotExpire ?? true),
    BranchId: courierBranchId.trim(),
    HubName: courierHubName.trim(),
    LanguageCode: pickRecordStr(sessionRow, "languageCode", "LanguageCode") || "",
    IsEurodisCreatorUser: Boolean(
      sessionRow.isEurodisCreatorUser ?? sessionRow.IsEurodisCreatorUser ?? true,
    ),
    IsEurodisAllowedUser: Boolean(
      sessionRow.isEurodisAllowedUser ?? sessionRow.IsEurodisAllowedUser ?? true,
    ),
    IsTifCreatorUser: Boolean(sessionRow.isTifCreatorUser ?? sessionRow.IsTifCreatorUser ?? true),
    AdditionalHubIds: [] as string[],
    OohId: pickRecordStr(sessionRow, "oohId", "OohId"),
    OohName: pickRecordStr(sessionRow, "oohName", "OohName"),
    PartnerId: pickRecordStr(sessionRow, "partnerId", "PartnerId"),
    CustomerApiKey: pickRecordStr(sessionRow, "customerApiKey", "CustomerApiKey"),
    CustomerId: customerIdNum,
    CashRegisterKey: sessionRow.cashRegisterKey ?? sessionRow.CashRegisterKey ?? null,
    BFFPermissionGroupNames: permissionGroupNames,
    PreferredLayoutId: sessionRow.preferredLayoutId ?? sessionRow.PreferredLayoutId ?? null,
    noPartner: true,
  };
}

/** GetAllUsers — UserId filtresi; üst liste aramasına gerek yoktur */
export async function fetchDashboardUserRowByUserId(
  auth: NesyDashboardAuth,
  userId: string
): Promise<Record<string, unknown> | null> {
  const id = userId.trim();
  if (!id) return null;
  const { items } = await fetchDashboardUsers(auth, {
    includePassiveUsers: true,
    fullName: "",
    roles: [],
    hubIds: [],
    skipCount: 0,
    maxResultCount: 10,
    userId: id,
  });
  const row = items?.[0];
  return row && typeof row === "object" ? (row as Record<string, unknown>) : null;
}

async function resolveDashboardSessionRowForManageUser(
  auth: NesyDashboardAuth,
  opts: {
    dashboardUserSnapshot?: Record<string, unknown>;
    bearerToken?: string | null;
  }
): Promise<Record<string, unknown> | null> {
  const snap = opts.dashboardUserSnapshot ?? {};

  const fromDashboard = mongoUserIdCandidateFromDashboardRecord(snap);
  if (fromDashboard) {
    const row = await fetchDashboardUserRowByUserId(auth, fromDashboard);
    if (row) return row;
  }

  const fromJwt = mongoUserIdCandidateFromJwt(opts.bearerToken);
  if (fromJwt && fromJwt !== fromDashboard) {
    const row = await fetchDashboardUserRowByUserId(auth, fromJwt);
    if (row) return row;
  }

  const un = pickRecordStr(snap, "username", "Username", "userName", "UserName").trim();
  if (un) return fetchDashboardUserRowByExactUsername(auth, un);
  return null;
}

/** Tam profil/satır yoksa: login kullanıcı alanları ile minimum ManageUser (User/ManageUser toleransına bağlı) */
function buildManageUserApplyCourierHubPayloadFromLoginSnapshot(
  dashboardUserSnapshot: Record<string, unknown>,
  explicitUserId: string,
  courierBranchId: string,
  courierHubName: string
): Record<string, unknown> {
  return {
    UserId: explicitUserId.trim(),
    IsActive: true,
    FullName: pickRecordStr(dashboardUserSnapshot, "fullName", "FullName"),
    RoleUniqueName: pickRecordStr(dashboardUserSnapshot, "role", "Role"),
    Email: pickRecordStr(dashboardUserSnapshot, "email", "Email"),
    PhoneNumber: "",
    PasswordDoNotExpire: true,
    BranchId: courierBranchId.trim(),
    HubName: courierHubName.trim(),
    LanguageCode: "",
    IsEurodisCreatorUser: true,
    IsEurodisAllowedUser: true,
    IsTifCreatorUser: true,
    AdditionalHubIds: [] as string[],
    OohId: "",
    OohName: "",
    PartnerId: "",
    CustomerApiKey: "",
    CustomerId: 0,
    CashRegisterKey: null,
    BFFPermissionGroupNames: [],
    PreferredLayoutId: null,
    noPartner: true,
  };
}

/**
 * Oturum kullanıcısı için User/ManageUser gövdesi: Connect’teki `user` + UserId filtreli satır; yoksa JWT’deki id + ince gövde.
 * Kullanıcının tabloda görünmesi gerekmez.
 */
export async function buildCourierHubManageUserPayload(
  auth: NesyDashboardAuth,
  courierBranchId: string,
  courierHubName: string,
  opts: {
    dashboardUserSnapshot?: Record<string, unknown>;
    bearerToken?: string | null;
    /** Connect’te çözümlenen oturum Mongo UserId (GetAllUsers + username); tam ManageUser satırını tek istekte yüklemek için */
    sessionUserId?: string | null;
  }
): Promise<Record<string, unknown>> {
  const sid = opts.sessionUserId?.trim();
  const snapForThin = opts.dashboardUserSnapshot ?? {};
  if (sid) {
    const rowFromSessionId = await fetchDashboardUserRowByUserId(auth, sid);
    if (rowFromSessionId && pickRecordStr(rowFromSessionId, "userId", "UserId")) {
      return buildManageUserApplyCourierHubPayload(rowFromSessionId, courierBranchId, courierHubName);
    }
    /** GetAllUsers(+UserId) bazen liste döndürmez; oturum id’si Connect’te zaten doğrulanmışsa ince gövde yeterli */
    return buildManageUserApplyCourierHubPayloadFromLoginSnapshot(snapForThin, sid, courierBranchId, courierHubName);
  }

  const snap = opts.dashboardUserSnapshot ?? {};
  const row = await resolveDashboardSessionRowForManageUser(auth, {
    dashboardUserSnapshot: snap,
    bearerToken: opts.bearerToken,
  });
  if (row && pickRecordStr(row, "userId", "UserId")) {
    return buildManageUserApplyCourierHubPayload(row, courierBranchId, courierHubName);
  }
  const id =
    mongoUserIdCandidateFromDashboardRecord(snap) ?? mongoUserIdCandidateFromJwt(opts.bearerToken);
  if (id) {
    return buildManageUserApplyCourierHubPayloadFromLoginSnapshot(snap, id, courierBranchId, courierHubName);
  }
  throw new Error(
    "ManageUser için UserId çıkarılamadı — Connect sonrası çözümleme yapılmamış olabilir; Connect’i yenileyin.",
  );
}

/** GetAllUsers + tam kullanıcı adı (FullName parametresinde username ile de aranıyor; sayfa sayfa) */
export async function fetchDashboardUserRowByExactUsername(
  auth: NesyDashboardAuth,
  usernameExact: string
): Promise<Record<string, unknown> | null> {
  const needle = usernameExact.trim().toLowerCase();
  if (!needle) return null;

  const needleNorm = needle;
  let skip = 0;
  const pageSize = 200;
  /** Nesy yüzbinlerce satır döndürebilir; üst güvenlik sınırı */
  const maxSkipped = 20000;

  while (skip < maxSkipped) {
    const { items, totalCount } = await fetchDashboardUsers(auth, {
      includePassiveUsers: true,
      fullName: usernameExact.trim(),
      roles: [],
      hubIds: [],
      skipCount: skip,
      maxResultCount: pageSize,
    });

    const row = items.find((r) => {
      const u = pickRecordStr(r as Record<string, unknown>, "username", "Username", "userName", "UserName").toLowerCase();
      return u === needleNorm;
    });

    if (row) return row as Record<string, unknown>;

    if (items.length === 0 || skip + items.length >= totalCount) return null;
    skip += items.length;
  }

  return null;
}

/**
 * Connect sonrası oturumu temsil eden Mongo UserId:
 * 1) **User/GetMyInfo** (en güvenilir — Nesy oturumu üzerinden Id)
 * 2) Login payload / JWT
 * 3) kullanıcı adıyla **GetAllUsers** ile arama (sayfalı)
 */
export async function resolveSessionDashboardUserId(
  auth: NesyDashboardAuth,
  loginUser: Record<string, unknown> | null | undefined,
  bearerToken: string | null
): Promise<string | null> {
  try {
    const { userId: fromMyInfo } = await fetchDashboardMyInfo(auth);
    if (fromMyInfo.trim()) return fromMyInfo.trim();
  } catch {
    /** Eski Nesy kurulumları / policy GetMyInfo vermeyebilir */
  }

  const snap = loginUser && typeof loginUser === "object" ? loginUser : {};
  const fromSnap = mongoUserIdCandidateFromDashboardRecord(snap);
  if (fromSnap) return fromSnap;

  const fromJwt = mongoUserIdCandidateFromJwt(bearerToken);
  if (fromJwt) return fromJwt;

  const username = pickRecordStr(snap, "username", "Username", "userName", "UserName").trim();
  if (!username) return null;

  const row = await fetchDashboardUserRowByExactUsername(auth, username);
  if (!row) return null;
  const uid = pickRecordStr(row, "userId", "UserId").trim();
  return uid || null;
}

/** Nesy User/ManageUser — Nesy rolünde Action_ManageUsers gerekir */
export async function dashboardManageUser(
  auth: NesyDashboardAuth,
  managePayload: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(`${API_BASE}/nesy/dashboard/user/manage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: auth.token,
      country: auth.country,
      environment: auth.environment,
      ...managePayload,
    }),
  });
  const json = await readJson(res);
  return json.data;
}

export interface TrackingShipmentInfo {
  trackingNumber?: string;
  waybillNumber?: string;
  legacyShortBarcode?: string | string[];
  shipmentStatus?: string;
  shipmentItemCount?: number;
  sender?: string;
  senderInfo?: { name?: string };
  eventType?: string;
  eventTypeDescription?: string;
  eventTypeConsigneeDescription?: string;
  status?: string;
  gsmNumber?: string;
  deliveryCode?: number;
  deliveryFailurePhotoUrl?: string | null;
  trackingRedirectUrl?: string;
  codAmount?: string | number;
  currency?: string;
  senderCustomerId?: string;
  eventTypeCode?: string | null;
}

export interface TrackingSearchResult {
  scheduleId?: string;
  stopId?: string;
  taskId?: string;
  courierName?: string;
  courierUserId?: string;
  taskParty?: string;
  taskType?: string;
  taskAddress?: string;
  taskStatus?: string;
  hashCode?: string;
  latitude?: number;
  longitude?: number;
  progressRate?: number;
  isUrlExpired?: boolean;
  etaRangeStart?: string;
  etaRangeEnd?: string;
  trackingShipmentList?: TrackingShipmentInfo[];
  shipmentList?: TrackingShipmentInfo[];
  raw: Record<string, unknown>;
}

function pick(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (obj[key] !== undefined) return obj[key];
  }
  return undefined;
}

const TASK_TYPE_MAP: Record<number, string> = {
  0: "Pickup",
  1: "Pickup",
  2: "Delivery",
  3: "Return",
};

function normalizeTrackingResponse(json: Record<string, unknown>): TrackingSearchResult {
  const payload = (json.payload ?? json.Payload ?? json) as Record<string, unknown>;
  const courierInfo = (pick(payload, "courierInfo", "CourierInfo") ?? {}) as Record<string, unknown>;
  const recipientInfo = (pick(payload, "recipientInfo", "RecipientInfo") ?? {}) as Record<string, unknown>;

  const rawTaskType = pick(payload, "taskType", "TaskType");
  const taskType = typeof rawTaskType === "number"
    ? (TASK_TYPE_MAP[rawTaskType] ?? `Type ${rawTaskType}`)
    : (typeof rawTaskType === "string" ? rawTaskType : undefined);

  return {
    scheduleId: (pick(payload, "scheduleId", "ScheduleId") as string) ?? undefined,
    stopId: stringifyObjectId(pick(payload, "stopId", "StopId")),
    taskId: stringifyObjectId(pick(payload, "taskId", "TaskId")),
    courierName: (pick(courierInfo, "courierName", "CourierName") as string)
      ?? (pick(payload, "courierName", "CourierName") as string)
      ?? undefined,
    courierUserId: (pick(courierInfo, "courierUserId", "CourierUserId") as string)
      ?? (pick(payload, "courierUserId", "CourierUserId") as string)
      ?? undefined,
    taskParty: (pick(recipientInfo, "name", "Name") as string)
      ?? (pick(payload, "taskParty", "TaskParty") as string)
      ?? undefined,
    taskType,
    taskAddress: (pick(recipientInfo, "address", "Address") as string)
      ?? (pick(payload, "taskAddress", "TaskAddress") as string)
      ?? undefined,
    taskStatus: (pick(payload, "taskStatus", "TaskStatus") as string) ?? undefined,
    hashCode: (pick(payload, "hashCode", "HashCode") as string) ?? undefined,
    latitude: (pick(payload, "latitude", "Latitude") as number) ?? undefined,
    longitude: (pick(payload, "longitude", "Longitude") as number) ?? undefined,
    progressRate: (pick(payload, "progressRate", "ProgressRate") as number) ?? undefined,
    isUrlExpired: (pick(payload, "isUrlExpired", "IsUrlExpired") as boolean) ?? undefined,
    trackingShipmentList: normalizeShipmentList(pick(payload, "trackingShipmentList", "TrackingShipmentList")),
    shipmentList: normalizeShipmentList(pick(payload, "shipmentList", "ShipmentList", "trackingShipmentList", "TrackingShipmentList")),
    raw: json,
  };
}

function stringifyObjectId(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    return (obj.$oid ?? obj.Timestamp ?? JSON.stringify(value)) as string;
  }
  return undefined;
}

function normalizeShipmentList(raw: unknown): TrackingShipmentInfo[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.map((item: Record<string, unknown>) => ({
    trackingNumber: (pick(item, "trackingNumber", "TrackingNumber") as string) ?? undefined,
    waybillNumber: (pick(item, "waybillNumber", "WaybillNumber") as string) ?? undefined,
    legacyShortBarcode: pick(item, "legacyShortBarcode", "LegacyShortBarcode") as string | string[] | undefined,
    shipmentStatus: (pick(item, "shipmentStatus", "ShipmentStatus") as string) ?? undefined,
    shipmentItemCount: (pick(item, "shipmentItemCount", "ShipmentItemCount") as number) ?? undefined,
    sender: (pick(item, "sender", "Sender") as string) ?? undefined,
    senderInfo: pick(item, "senderInfo", "SenderInfo") as TrackingShipmentInfo["senderInfo"],
    eventType: (pick(item, "eventType", "EventType") as string) ?? undefined,
    eventTypeDescription: (pick(item, "eventTypeDescription", "EventTypeDescription") as string) ?? undefined,
    eventTypeConsigneeDescription: (pick(item, "eventTypeConsigneeDescription", "EventTypeConsigneeDescription") as string) ?? undefined,
    status: (pick(item, "status", "Status") as string) ?? undefined,
    gsmNumber: (pick(item, "gsmNumber", "GsmNumber") as string) ?? undefined,
    senderCustomerId: (pick(item, "senderCustomerId", "SenderCustomerId") as string) ?? undefined,
  }));
}

export async function searchShipmentByLegacyBarcode(
  auth: NesyDashboardAuth,
  barcode: string
): Promise<{ shipmentId?: string; waybillNumber?: string; raw: unknown }> {
  const res = await fetch(`${API_BASE}/nesy/dashboard/shipment/search-by-filter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: auth.token,
      country: auth.country,
      environment: auth.environment,
      barcode,
      filterType: 1,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throwDataCenterApiError(res, body, `Shipment search failed (${res.status})`);
  }
  const json = await res.json();
  const payload = json?.payload ?? json?.Payload ?? json;
  if (Array.isArray(payload) && payload.length > 0) {
    const first = payload[0] as Record<string, unknown>;
    const shipmentId = (first.shipmentId ?? first.ShipmentId ?? first.waybillNumber ?? first.WaybillNumber) as string | undefined;
    const waybillNumber = (first.waybillNumber ?? first.WaybillNumber ?? first.shipmentId ?? first.ShipmentId) as string | undefined;
    return { shipmentId, waybillNumber, raw: json };
  }
  if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
    const obj = payload as Record<string, unknown>;
    const shipmentId = (obj.shipmentId ?? obj.ShipmentId ?? obj.waybillNumber ?? obj.WaybillNumber) as string | undefined;
    const waybillNumber = (obj.waybillNumber ?? obj.WaybillNumber ?? obj.shipmentId ?? obj.ShipmentId) as string | undefined;
    return { shipmentId, waybillNumber, raw: json };
  }
  return { raw: json };
}

export async function searchTrackingByWaybill(
  auth: NesyDashboardAuth,
  waybillNumber: string
): Promise<TrackingSearchResult> {
  const res = await fetch(`${API_BASE}/nesy/dashboard/tracking/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: auth.token,
      country: auth.country,
      environment: auth.environment,
      waybillNumber,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throwDataCenterApiError(res, body, `Tracking search failed (${res.status})`);
  }
  const json = (await res.json()) as Record<string, unknown>;
  return normalizeTrackingResponse(json);
}
