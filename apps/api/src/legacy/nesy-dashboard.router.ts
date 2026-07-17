// @ts-nocheck
import { Router, type Router as RouterType } from "express";
import {
  type NesyCountry,
  type NesyEnvironment,
  resolveBaseUrl,
  nesyPortalHeaders,
} from "../nesy-env.js";

const router: RouterType = Router();

type NesyEnvelope = {
  resultCode?: number;
  ResultCode?: number;
  resultMessage?: string;
  ResultMessage?: string;
  payload?: unknown;
};

function pinFromNesyPayload(payload: unknown): string {
  if (payload == null) return "";
  if (typeof payload === "string") return payload.trim();
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const pin = pinFromNesyPayload(item);
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

async function postNesyJson(
  baseUrl: string,
  relativePath: string,
  token: string,
  body: unknown
): Promise<{ ok: true; json: NesyEnvelope } | { ok: false; status: number; text: string }> {
  const path = relativePath.replace(/^\//, "");
  const response = await fetch(`${baseUrl}/${path}`, {
    method: "POST",
    headers: nesyPortalHeaders(token),
    body: JSON.stringify(body ?? {}),
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

interface AuthContextBody {
  token?: string;
  country?: NesyCountry;
  environment?: NesyEnvironment;
}

/** Nesy User/GetAllUsers — Dashboard user-management ile aynı gövde */
router.post("/users", async (req, res) => {
  try {
    const body = req.body as AuthContextBody & {
      includePassiveUsers?: boolean;
      fullName?: string;
      roles?: string[];
      hubIds?: Array<{ id?: number; Id?: number; value?: string; Value?: string }>;
      skipCount?: number;
      maxResultCount?: number;
      userId?: string;
      UserId?: string;
    };

    const { token, country, environment } = body;
    if (!token || !country || !environment) {
      res.status(400).json({ message: "token, country, environment are required." });
      return;
    }

    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }

    const hubIds =
      body.hubIds?.map((h) => ({
        Id: h.Id ?? h.id ?? 0,
        Value: h.Value ?? h.value ?? "",
      })) ?? [];

    const uid = (body.userId ?? body.UserId)?.trim();

    const nesyBody = {
      IncludePassiveUsers: body.includePassiveUsers ?? false,
      FullName: body.fullName ?? "",
      Roles: body.roles ?? [],
      SkipCount: typeof body.skipCount === "number" ? body.skipCount : 0,
      MaxResultCount: typeof body.maxResultCount === "number" ? body.maxResultCount : 10,
      HubIds: hubIds,
      phoneNumber: "",
      ...(uid ? { UserId: uid } : {}),
    };

    const result = await postNesyJson(baseUrl, "User/GetAllUsers", token, nesyBody);
    if (!result.ok) {
      res.status(502).json({ message: result.text, status: result.status });
      return;
    }

    const payload = result.json.payload as
      | {
          items?: unknown[];
          totalCount?: number;
          Items?: unknown[];
          TotalCount?: number;
        }
      | undefined;

    const items = payload?.items ?? payload?.Items ?? [];
    const totalCount = payload?.totalCount ?? payload?.TotalCount ?? items.length;

    res.json({ data: { items, totalCount } });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error during Nesy user list.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/** Nesy Role/GetRoles — boş gövde */
router.post("/roles", async (req, res) => {
  try {
    const body = req.body as AuthContextBody;
    const { token, country, environment } = body;
    if (!token || !country || !environment) {
      res.status(400).json({ message: "token, country, environment are required." });
      return;
    }
    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }
    const result = await postNesyJson(baseUrl, "Role/GetRoles", token, {});
    if (!result.ok) {
      res.status(502).json({ message: result.text, status: result.status });
      return;
    }
    res.json({ data: result.json.payload ?? [] });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error during Nesy Role/GetRoles.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/** Nesy Geocode/GetAllHubs — Dashboard: WithoutPolygonList + WithoutFilter */
router.post("/hubs", async (req, res) => {
  try {
    const body = req.body as AuthContextBody & {
      withoutPolygonList?: boolean;
      withoutFilter?: boolean;
    };
    const { token, country, environment } = body;
    if (!token || !country || !environment) {
      res.status(400).json({ message: "token, country, environment are required." });
      return;
    }
    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }
    const nesyBody = {
      HubIds: [] as string[],
      WithoutPolygonList: body.withoutPolygonList ?? false,
      WithoutFilter: body.withoutFilter ?? true,
    };
    const result = await postNesyJson(baseUrl, "Geocode/GetAllHubs", token, nesyBody);
    if (!result.ok) {
      res.status(502).json({ message: result.text, status: result.status });
      return;
    }
    res.json({ data: result.json.payload ?? [] });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error during Nesy Geocode/GetAllHubs.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/** Nesy User/GetUserDevices — gövde: { userId } */
router.post("/user-devices", async (req, res) => {
  try {
    const body = req.body as AuthContextBody & { userId?: string };
    const { token, country, environment, userId } = body;
    if (!token || !country || !environment) {
      res.status(400).json({ message: "token, country, environment are required." });
      return;
    }
    if (!userId?.trim()) {
      res.status(400).json({ message: "userId is required." });
      return;
    }
    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }
    const result = await postNesyJson(baseUrl, "User/GetUserDevices", token, {
      userId: userId.trim(),
    });
    if (!result.ok) {
      res.status(502).json({ message: result.text, status: result.status });
      return;
    }
    const payload = result.json.payload;
    const rows = Array.isArray(payload) ? payload : [];
    const devices =
      rows.length > 0 && typeof rows[0] === "object" && rows[0] !== null && "devices" in rows[0]
        ? (rows[0] as { devices?: string[] }).devices
        : (rows[0] as { Devices?: string[] } | undefined)?.Devices;
    res.json({
      data: {
        devices: Array.isArray(devices) ? devices : [],
        raw: payload,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error during Nesy User/GetUserDevices.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/** Nesy Tracking/GetCourierDeviceInfo — selected courier mobile device snapshot */
router.post("/courier-device-info", async (req, res) => {
  try {
    const body = req.body as AuthContextBody & { userId?: string };
    const { token, country, environment, userId } = body;
    if (!token || !country || !environment) {
      res.status(400).json({ message: "token, country, environment are required." });
      return;
    }
    if (!userId?.trim()) {
      res.status(400).json({ message: "userId is required." });
      return;
    }
    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }
    const result = await postNesyJson(baseUrl, "Tracking/GetCourierDeviceInfo", token, {
      CourierUserId: userId.trim(),
    });
    if (!result.ok) {
      res.status(502).json({ message: result.text, status: result.status });
      return;
    }
    res.json({ data: result.json.payload ?? null });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error during Nesy Tracking/GetCourierDeviceInfo.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Nesy User/SetUserDevice — Dashboard ile aynı: tam cihaz listesini gönderir.
 * Yeni cihaz: devices = mevcut + yeni, addedDeviceId = yeni id.
 * Silme: devices = filtrelenmiş liste (Angular deleteDevice ile aynı).
 * Boş dizi tüm cihazları siler (backend davranışı).
 */
router.post("/user-devices/set", async (req, res) => {
  try {
    const body = req.body as AuthContextBody & {
      userId?: string;
      devices?: unknown;
      addedDeviceId?: string;
    };
    const { token, country, environment } = body;
    if (!token || !country || !environment) {
      res.status(400).json({ message: "token, country, environment are required." });
      return;
    }
    if (!body.userId?.trim()) {
      res.status(400).json({ message: "userId is required." });
      return;
    }
    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }

    const rawDevices = Array.isArray(body.devices) ? body.devices : [];
    const devices = rawDevices.map((d) => String(d).trim()).filter(Boolean);

    const nesyBody: {
      userId: string;
      devices: string[];
      addedDeviceId?: string;
    } = {
      userId: body.userId.trim(),
      devices,
    };
    const addId = body.addedDeviceId?.trim();
    if (addId) {
      nesyBody.addedDeviceId = addId;
    }

    const result = await postNesyJson(baseUrl, "User/SetUserDevice", token, nesyBody);
    if (!result.ok) {
      res.status(502).json({ message: result.text, status: result.status });
      return;
    }
    res.json({ data: result.json.payload ?? null });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error during Nesy User/SetUserDevice.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/** Nesy User/GetMyPinCode — boş gövde (oturumdaki portal kullanıcısı) */
router.post("/user-pin/my", async (req, res) => {
  try {
    const body = req.body as AuthContextBody;
    const { token, country, environment } = body;
    if (!token || !country || !environment) {
      res.status(400).json({ message: "token, country, environment are required." });
      return;
    }
    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }
    const result = await postNesyJson(baseUrl, "User/GetMyPinCode", token, {});
    if (!result.ok) {
      res.status(502).json({ message: result.text, status: result.status });
      return;
    }
    const raw = result.json.payload;
    res.json({ data: { pin: pinFromNesyPayload(raw), raw } });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error during Nesy User/GetMyPinCode.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/** Nesy User/GetUserDevicePinCode — { userId } */
router.post("/user-pin/device", async (req, res) => {
  try {
    const body = req.body as AuthContextBody & { userId?: string };
    const { token, country, environment, userId } = body;
    if (!token || !country || !environment) {
      res.status(400).json({ message: "token, country, environment are required." });
      return;
    }
    if (!userId?.trim()) {
      res.status(400).json({ message: "userId is required." });
      return;
    }
    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }
    const result = await postNesyJson(baseUrl, "User/GetUserDevicePinCode", token, {
      UserId: userId.trim(),
    });
    if (!result.ok) {
      res.status(502).json({ message: result.text, status: result.status });
      return;
    }
    const raw = result.json.payload;
    res.json({ data: { pin: pinFromNesyPayload(raw), raw } });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error during Nesy User/GetUserDevicePinCode.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/** Nesy User/GetUserGeneratePinCode — boş gövde */
router.post("/user-pin/generate", async (req, res) => {
  try {
    const body = req.body as AuthContextBody;
    const { token, country, environment } = body;
    if (!token || !country || !environment) {
      res.status(400).json({ message: "token, country, environment are required." });
      return;
    }
    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }
    const result = await postNesyJson(baseUrl, "User/GetUserGeneratePinCode", token, {});
    if (!result.ok) {
      res.status(502).json({ message: result.text, status: result.status });
      return;
    }
    const raw = result.json.payload;
    let pin = pinFromNesyPayload(raw);
    if (!pin && typeof raw === "object" && raw !== null) {
      const o = raw as Record<string, unknown>;
      const nested = o.payload ?? o.Payload;
      pin = pinFromNesyPayload(nested);
    }
    res.json({ data: { pin, raw } });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error during Nesy User/GetUserGeneratePinCode.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/** Nesy User/SetUserGeneratePinCode — oturum kullanıcısı PIN şablonu (genelde “kendi” PIN) */
router.post("/user-pin/set-generated", async (req, res) => {
  try {
    const body = req.body as AuthContextBody & { pinCode?: string; PinCode?: string };
    const { token, country, environment } = body;
    if (!token || !country || !environment) {
      res.status(400).json({ message: "token, country, environment are required." });
      return;
    }
    const pinCode = (body.pinCode ?? body.PinCode ?? "").trim();
    if (!pinCode) {
      res.status(400).json({ message: "pinCode is required." });
      return;
    }
    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }
    const result = await postNesyJson(baseUrl, "User/SetUserGeneratePinCode", token, {
      pinCode,
    });
    if (!result.ok) {
      res.status(502).json({ message: result.text, status: result.status });
      return;
    }
    res.json({ data: result.json.payload ?? null });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error during Nesy User/SetUserGeneratePinCode.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/** Nesy User/SetUserPin — { userId, userPinCode } */
router.post("/user-pin/set", async (req, res) => {
  try {
    const body = req.body as AuthContextBody & { userId?: string; userPinCode?: string };
    const { token, country, environment } = body;
    if (!token || !country || !environment) {
      res.status(400).json({ message: "token, country, environment are required." });
      return;
    }
    const userId = body.userId?.trim();
    const userPinCode = body.userPinCode?.trim();
    if (!userId || !userPinCode) {
      res.status(400).json({ message: "userId and userPinCode are required." });
      return;
    }
    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }
    const result = await postNesyJson(baseUrl, "User/SetUserPin", token, {
      userId,
      userPinCode,
    });
    if (!result.ok) {
      res.status(502).json({ message: result.text, status: result.status });
      return;
    }
    res.json({ data: result.json.payload ?? null });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error during Nesy User/SetUserPin.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/** Nesy User/GetMyInfo — oturumdaki kullanıcı; payload içinde Mongo kullanıcı id (genelde Id) */
router.post("/my-info", async (req, res) => {
  try {
    const body = req.body as AuthContextBody;
    const { token, country, environment } = body;
    if (!token || !country || !environment) {
      res.status(400).json({ message: "token, country, environment are required." });
      return;
    }
    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }
    const result = await postNesyJson(baseUrl, "User/GetMyInfo", token, {});
    if (!result.ok) {
      res.status(502).json({ message: result.text, status: result.status });
      return;
    }
    res.json({ data: result.json.payload ?? null });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error during Nesy User/GetMyInfo.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/** Nesy User/ManageUser — nesy-admin / Action_ManageUsers (proxy) */
router.post("/user/manage", async (req, res) => {
  try {
    const body = req.body as AuthContextBody & Record<string, unknown>;
    const { token, country, environment } = body;
    if (!token || !country || !environment) {
      res.status(400).json({ message: "token, country, environment are required." });
      return;
    }
    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }

    const { token: _t, country: _c, environment: _e, ...nesyManage } = body;
    if (!nesyManage || typeof nesyManage !== "object" || Object.keys(nesyManage).length === 0) {
      res.status(400).json({ message: "Manage user payload fields are required." });
      return;
    }

    const result = await postNesyJson(baseUrl, "User/ManageUser", token, nesyManage);
    if (!result.ok) {
      res.status(502).json({ message: result.text, status: result.status });
      return;
    }
    res.json({ data: result.json.payload ?? null });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error during Nesy User/ManageUser.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/shipment/search-by-filter", async (req, res) => {
  try {
    const { token, country, environment, barcode, filterType } = req.body as AuthContextBody & {
      barcode?: string;
      filterType?: number;
    };
    if (!token || !country || !environment) {
      res.status(400).json({ message: "token, country, environment are required." });
      return;
    }
    if (!barcode?.trim()) {
      res.status(400).json({ message: "barcode is required." });
      return;
    }
    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `No base URL configured for ${country}/${environment}.` });
      return;
    }
    const upstream = await fetch(`${baseUrl}/Shipment/GetShipmentsByFilter`, {
      method: "POST",
      headers: nesyPortalHeaders(token),
      body: JSON.stringify([{ value: barcode.trim(), filterType: filterType ?? 1 }]),
    });
    const text = await upstream.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      res.status(502).json({ message: "Invalid JSON from Nesy Shipment.", raw: text });
      return;
    }
    if (!upstream.ok) {
      res.status(upstream.status).json({ message: text || upstream.statusText });
      return;
    }
    res.json(json);
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error during Shipment filter search.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/tracking/search", async (req, res) => {
  try {
    const { token, country, environment, waybillNumber } = req.body as AuthContextBody & {
      waybillNumber?: string;
    };
    if (!token || !country || !environment) {
      res.status(400).json({ message: "token, country, environment are required." });
      return;
    }
    if (!waybillNumber?.trim()) {
      res.status(400).json({ message: "waybillNumber is required." });
      return;
    }
    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `No base URL configured for ${country}/${environment}.` });
      return;
    }
    const url = `${baseUrl}/Tracking/GetTrackingInfoByTrackingNumber`;
    const upstream = await fetch(url, {
      method: "POST",
      headers: nesyPortalHeaders(token),
      body: JSON.stringify({ TrackingNumber: waybillNumber.trim() }),
    });
    const text = await upstream.text();
    let json: Record<string, unknown> = {};
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      res.status(502).json({ message: "Invalid JSON from Nesy Tracking.", raw: text });
      return;
    }
    if (!upstream.ok) {
      res.status(upstream.status).json({ message: text || upstream.statusText });
      return;
    }
    res.json(json);
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error during Tracking search.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
