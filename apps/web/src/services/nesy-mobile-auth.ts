import { API_BASE } from "@/services/api";
import {
  type NesyMobileCountry,
  type NesyMobileEnvironment,
} from "@/services/nesy-mobile-env";

export const NESY_MOBILE_AUTH_CACHE_KEY = "nesy-mobile-auth";

export interface NesyMobileLoginResponse {
  message: string;
  country: NesyMobileCountry;
  environment: NesyMobileEnvironment;
  baseUrl: string;
  status: number;
  durationMs: number;
  applicationId: string;
  adbDeviceId: string | null;
  xProtectedRequestKey: string;
  result: unknown;
  /** API sets false when Nesy returns HTTP 200 but business resultCode ≠ 200 (e.g. wrong PIN). */
  loginSucceeded?: boolean;
  nesyResultCode?: number | null;
  nesyResultMessage?: string | null;
}

export interface NesyMobileAuthCache {
  country: NesyMobileCountry;
  environment: NesyMobileEnvironment;
  baseUrl: string;
  bearerToken: string | null;
  xProtectedRequestKey: string | null;
  response: NesyMobileLoginResponse;
  cachedAt: string;
}

export interface LoginMobileDeviceParams {
  country: NesyMobileCountry;
  environment: NesyMobileEnvironment;
  deviceCode: string;
  pinCode: string;
  pushRegistrationId: string;
  adbDeviceId?: string;
  applicationId?: string;
  /** Nesy Auth/LoginDevice cevabını alır; Android ADB ile korumalı anahtar istemez. */
  skipAdb?: boolean;
}

export interface NesyMobileAdbDevice {
  id: string;
  status: string;
  modelName: string;
  appDeviceId?: string;
  product?: string;
  transportId?: string;
  label: string;
  manufacturer?: string;
  marketName?: string;
  androidVersion?: string;
  batteryLevel?: number | null;
  wifiEnabled?: boolean | null;
  lastSeenAt?: string;
}

export interface NesyMobileAdbDevicesResponse {
  adbCommand: string;
  devices: NesyMobileAdbDevice[];
}

export async function listNesyMobileAdbDevices(
  applicationId?: string
): Promise<NesyMobileAdbDevicesResponse> {
  const params = new URLSearchParams();
  if (applicationId?.trim()) {
    params.set("applicationId", applicationId.trim());
  }
  const query = params.toString();
  const response = await fetch(`${API_BASE}/nesy/mobile-auth/adb-devices${query ? `?${query}` : ""}`);
  const json = await response.json();
  if (!response.ok) {
    console.error("[nesy-mobile-auth] ADB devices API failed", json);
    throw new Error(json?.message ?? "ADB devices could not be listed.");
  }

  return json as NesyMobileAdbDevicesResponse;
}

export async function loginNesyMobileDevice(
  params: LoginMobileDeviceParams
): Promise<NesyMobileLoginResponse> {
  const response = await fetch(`${API_BASE}/nesy/mobile-auth/login-device`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const json = await response.json();
  if (!response.ok) {
    console.error("[nesy-mobile-auth] LoginDevice API failed", json);
    const detail = typeof json?.error === "string" ? ` ${json.error}` : "";
    throw new Error(`${json?.message ?? "Nesy mobile login request failed."}${detail}`);
  }

  return json as NesyMobileLoginResponse;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unwrapNesyMobileLoginResult(
  result: unknown
): Record<string, unknown> | null {
  if (!isObject(result)) return null;
  const hasCode =
    "resultCode" in result ||
    "ResultCode" in result ||
    "resultMessage" in result ||
    "ResultMessage" in result;
  if (hasCode) return result;
  const inner = result.result ?? result.Result;
  if (isObject(inner)) return inner;
  return null;
}

function readNesyMobileLoginDeviceResultFields(result: unknown): {
  resultCode: number | null;
  resultMessage: string | null;
} {
  const layer = unwrapNesyMobileLoginResult(result);
  if (!layer) return { resultCode: null, resultMessage: null };
  const rcRaw = layer.resultCode ?? layer.ResultCode;
  const rmRaw = layer.resultMessage ?? layer.ResultMessage;
  let resultCode: number | null = null;
  if (typeof rcRaw === "number" && !Number.isNaN(rcRaw)) resultCode = rcRaw;
  else if (typeof rcRaw === "string" && rcRaw.trim()) {
    const n = Number.parseInt(rcRaw, 10);
    if (!Number.isNaN(n)) resultCode = n;
  }
  const resultMessage =
    typeof rmRaw === "string" && rmRaw.trim() ? rmRaw.trim() : null;
  return { resultCode, resultMessage };
}

/** Nesy LoginDevice often returns HTTP 200 with resultCode !== 200 when PIN or device is wrong. */
export function nesyMobileLoginDeviceBusinessFailure(result: unknown): {
  failed: boolean;
  resultCode: number | null;
  resultMessage: string | null;
} {
  const { resultCode, resultMessage } =
    readNesyMobileLoginDeviceResultFields(result);
  if (resultCode == null) {
    return { failed: false, resultCode, resultMessage };
  }
  if (resultCode === 200) {
    return { failed: false, resultCode, resultMessage };
  }
  return { failed: true, resultCode, resultMessage };
}

/** User-facing text when LoginDevice response has no extractable bearer token. */
export function describeNesyMobileMissingBearerError(
  response: NesyMobileLoginResponse
): string {
  if (response.loginSucceeded === false && response.message?.trim()) {
    return response.message.trim();
  }
  const biz = nesyMobileLoginDeviceBusinessFailure(response.result);
  if (biz.failed || biz.resultMessage) {
    const tail =
      biz.resultCode != null && biz.resultMessage
        ? `${biz.resultMessage} (resultCode ${biz.resultCode})`
        : biz.resultMessage
          ? biz.resultMessage
          : biz.resultCode != null
            ? `resultCode ${biz.resultCode}`
            : "";
    if (tail) {
      return `Giriş tamamlanamadı: ${tail}. Bearer token alınamadı.`;
    }
  }
  return "Bearer token response içinde bulunamadı.";
}

function findToken(value: unknown): string | null {
  if (!isObject(value)) return null;

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    if (
      typeof nestedValue === "string" &&
      nestedValue.trim() &&
      (normalizedKey === "token" ||
        normalizedKey === "access_token" ||
        normalizedKey === "accesstoken" ||
        normalizedKey === "bearertoken" ||
        normalizedKey === "jwt")
    ) {
      return nestedValue.trim();
    }

    const nestedToken = findToken(nestedValue);
    if (nestedToken) return nestedToken;
  }

  return null;
}

export function extractBearerToken(response: NesyMobileLoginResponse): string | null {
  return findToken(response.result);
}

export function loadNesyMobileAuthCache(): NesyMobileAuthCache | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(NESY_MOBILE_AUTH_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as NesyMobileAuthCache;
    if (!parsed.country || !parsed.environment || !parsed.response || !parsed.xProtectedRequestKey) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveNesyMobileAuthCache(cache: NesyMobileAuthCache) {
  try {
    localStorage.setItem(NESY_MOBILE_AUTH_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // storage can be full or disabled
  }
}
