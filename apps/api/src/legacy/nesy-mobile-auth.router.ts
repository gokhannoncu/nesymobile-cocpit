// @ts-nocheck
import { Router, type Router as RouterType } from "express";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  isNesyMobileCountry,
  isNesyMobileEnvironment,
  resolveNesyMobileApplicationId,
  resolveNesyMobileBaseUrl,
  type NesyMobileCountry,
  type NesyMobileEnvironment,
} from "../nesy-mobile-env.js";

interface LoginDeviceRequestBody {
  country?: string;
  environment?: string;
  deviceCode?: string;
  pinCode?: string;
  pushRegistrationId?: string;
  adbDeviceId?: string;
  applicationId?: string;
  /** When true, skip ADB protected key fetch (auth simulation / tooling only). */
  skipAdb?: boolean;
}

interface AuthenticatedMobileRequestBody {
  country?: string;
  environment?: string;
  bearerToken?: string;
  xProtectedRequestKey?: string;
}

interface SelectRouteRequestBody extends AuthenticatedMobileRequestBody {
  courierZone?: string;
  oldScheduleId?: string;
  changeRoute?: boolean;
}

interface AdbDevice {
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

function isNesyJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unwrapNesyMobileLoginResult(
  result: unknown
): Record<string, unknown> | null {
  if (!isNesyJsonObject(result)) return null;
  const hasCode =
    "resultCode" in result ||
    "ResultCode" in result ||
    "resultMessage" in result ||
    "ResultMessage" in result;
  if (hasCode) return result;
  const inner = result.result ?? result.Result;
  if (isNesyJsonObject(inner)) return inner;
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
function nesyMobileLoginDeviceBusinessFailure(result: unknown): {
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

const router: RouterType = Router();
const execFileAsync = promisify(execFile);
const GET_PROTECTED_KEY_ACTION = "com.arasdigital.nesymobile.GET_KEY";
const GET_DEVICE_ID_ACTION = "com.arasdigital.nesymobile.GET_DEVICE_ID";
const PROTECTED_KEY_RECEIVER_CLASS =
  "com.arasdigital.nesymobile.adb.ProtectedRequestKeyReceiver";

class NesyMobileUpstreamError extends Error {
  constructor(
    message: string,
    readonly endpoint: string,
    readonly status: number,
    readonly result: unknown,
  ) {
    super(message);
  }
}

function getErrorWithOutput(error: unknown) {
  const outputError = error as { message?: unknown; stdout?: unknown; stderr?: unknown };

  return {
    message: error instanceof Error ? error.message : "Unknown ADB error",
    stdout: typeof outputError.stdout === "string" ? outputError.stdout : null,
    stderr: typeof outputError.stderr === "string" ? outputError.stderr : null,
  };
}

function createAdbError(message: string, stdout?: string, stderr?: string) {
  return Object.assign(new Error(message), {
    stdout: stdout ?? null,
    stderr: stderr ?? null,
  });
}

function resolveAdbCommand() {
  const candidates = [
    process.env.NESY_MOBILE_ADB_PATH?.trim(),
    process.env.ANDROID_HOME ? join(process.env.ANDROID_HOME, "platform-tools", "adb") : null,
    process.env.ANDROID_SDK_ROOT ? join(process.env.ANDROID_SDK_ROOT, "platform-tools", "adb") : null,
    join(homedir(), "Library", "Android", "sdk", "platform-tools", "adb"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find((candidate) => existsSync(candidate)) ?? "adb";
}

function parseAdbDevices(stdout: string): AdbDevice[] {
  return stdout
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id = "", status = "", ...details] = line.split(/\s+/);
      const detailMap = new Map(
        details
          .map((detail) => detail.split(":"))
          .filter((parts): parts is [string, string] => parts.length === 2 && Boolean(parts[0])),
      );
      const modelName = detailMap.get("model")?.replace(/_/g, " ") || "Unknown model";
      const product = detailMap.get("product");
      const transportId = detailMap.get("transport_id");

      return {
        id,
        status,
        modelName,
        appDeviceId: undefined,
        product,
        transportId,
        label: `${id} | ${modelName}`,
      };
    })
    .filter((device) => device.id);
}

async function runAdbShell(params: {
  adbCommand: string;
  adbDeviceId: string;
  shellArgs: string[];
  timeout?: number;
}) {
  const result = await execFileAsync(
    params.adbCommand,
    ["-s", params.adbDeviceId, "shell", ...params.shellArgs],
    {
      timeout: params.timeout ?? 5_000,
      maxBuffer: 1024 * 1024,
    },
  );
  return String(result.stdout).trim();
}

async function readAdbProp(params: {
  adbCommand: string;
  adbDeviceId: string;
  prop: string;
}) {
  try {
    return await runAdbShell({
      adbCommand: params.adbCommand,
      adbDeviceId: params.adbDeviceId,
      shellArgs: ["getprop", params.prop],
    });
  } catch {
    return "";
  }
}

function parseBatteryLevel(stdout: string) {
  const match = stdout.match(/level:\s*(\d+)/i);
  if (!match) return null;
  const level = Number.parseInt(match[1], 10);
  if (Number.isNaN(level)) return null;
  return Math.max(0, Math.min(100, level));
}

async function readBatteryLevel(params: {
  adbCommand: string;
  adbDeviceId: string;
}) {
  try {
    const stdout = await runAdbShell({
      adbCommand: params.adbCommand,
      adbDeviceId: params.adbDeviceId,
      shellArgs: ["dumpsys", "battery"],
    });
    return parseBatteryLevel(stdout);
  } catch {
    return null;
  }
}

async function readWifiEnabled(params: {
  adbCommand: string;
  adbDeviceId: string;
}) {
  try {
    const stdout = await runAdbShell({
      adbCommand: params.adbCommand,
      adbDeviceId: params.adbDeviceId,
      shellArgs: ["settings", "get", "global", "wifi_on"],
    });
    if (stdout === "1") return true;
    if (stdout === "0") return false;
    return null;
  } catch {
    return null;
  }
}

async function hydrateAdbDeviceDetails(params: {
  adbCommand: string;
  device: AdbDevice;
}) {
  const { adbCommand, device } = params;
  const lastSeenAt = new Date().toISOString();

  if (device.status !== "device") {
    return { ...device, lastSeenAt };
  }

  const [
    manufacturer,
    marketName,
    odmMarketName,
    vendorMarketName,
    androidVersion,
    batteryLevel,
    wifiEnabled,
  ] = await Promise.all([
    readAdbProp({ adbCommand, adbDeviceId: device.id, prop: "ro.product.manufacturer" }),
    readAdbProp({ adbCommand, adbDeviceId: device.id, prop: "ro.product.marketname" }),
    readAdbProp({ adbCommand, adbDeviceId: device.id, prop: "ro.product.odm.marketname" }),
    readAdbProp({ adbCommand, adbDeviceId: device.id, prop: "ro.product.vendor.marketname" }),
    readAdbProp({ adbCommand, adbDeviceId: device.id, prop: "ro.build.version.release" }),
    readBatteryLevel({ adbCommand, adbDeviceId: device.id }),
    readWifiEnabled({ adbCommand, adbDeviceId: device.id }),
  ]);

  const displayModel = marketName || odmMarketName || vendorMarketName || device.modelName;

  return {
    ...device,
    manufacturer: manufacturer || undefined,
    marketName: displayModel || undefined,
    androidVersion: androidVersion || undefined,
    batteryLevel,
    wifiEnabled,
    label: `${device.id} | ${displayModel || device.modelName}`,
    lastSeenAt,
  };
}

async function requestAppValueFromAdb(params: {
  adbCommand: string;
  adbDeviceId?: string;
  applicationId: string;
  action: string;
}) {
  const receiverComponent = `${params.applicationId}/${PROTECTED_KEY_RECEIVER_CLASS}`;
  const args = [
    ...(params.adbDeviceId ? ["-s", params.adbDeviceId] : []),
    "shell",
    "am",
    "broadcast",
    "-n",
    receiverComponent,
    "-a",
    params.action,
  ];
  const result = await execFileAsync(params.adbCommand, args, {
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
  });
  const value = parseAdbBroadcastData(String(result.stdout));

  if (!value) {
    throw createAdbError("ADB broadcast completed without result data.", String(result.stdout));
  }

  if (value.startsWith("ERROR:")) {
    throw createAdbError(`Android receiver returned ${value}.`, String(result.stdout));
  }

  return value;
}

async function listAdbDevices(applicationId?: string) {
  const adbCommand = resolveAdbCommand();
  const { stdout } = await execFileAsync(adbCommand, ["devices", "-l"], {
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  });

  const devices = await Promise.all(
    parseAdbDevices(String(stdout)).map(async (parsedDevice) => {
      const device = await hydrateAdbDeviceDetails({ adbCommand, device: parsedDevice });
      if (device.status !== "device" || !applicationId) return device;

      try {
        const appDeviceId = await requestAppValueFromAdb({
          adbCommand,
          adbDeviceId: device.id,
          applicationId,
          action: GET_DEVICE_ID_ACTION,
        });
        return {
          ...device,
          appDeviceId,
        };
      } catch (error) {
        const output = getErrorWithOutput(error);
        console.warn("[nesy-mobile-auth] App device ID could not be read from ADB device", {
          adbDeviceId: device.id,
          applicationId,
          error: output.message,
          stderr: output.stderr,
        });
        return device;
      }
    }),
  );

  return {
    adbCommand,
    devices,
  };
}

function validateMobileAuth(body: AuthenticatedMobileRequestBody) {
  const country = body.country;
  const environment = body.environment;
  const bearerToken = body.bearerToken?.trim();
  const xProtectedRequestKey = body.xProtectedRequestKey?.trim();

  if (!country || !isNesyMobileCountry(country)) {
    return { error: "country is required and must be one of HR, SI, RS, BA, ME." };
  }

  if (!environment || !isNesyMobileEnvironment(environment)) {
    return { error: "environment is required and must be stage or prod." };
  }

  if (!bearerToken) {
    return { error: "bearerToken is required. Execute mobile auth first." };
  }

  if (!xProtectedRequestKey) {
    return { error: "xProtectedRequestKey is required. Execute mobile auth first." };
  }

  return { country, environment, bearerToken, xProtectedRequestKey };
}

async function postNesyMobile(
  baseUrl: string,
  endpoint: string,
  bearerToken: string,
  body: unknown,
  xProtectedRequestKey?: string,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${bearerToken}`,
  };

  if (xProtectedRequestKey) {
    headers["X-Protected-Request-Key"] = xProtectedRequestKey;
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  let result: unknown = responseText;
  try {
    result = responseText ? JSON.parse(responseText) : null;
  } catch {
    result = responseText;
  }

  if (!response.ok) {
    throw new NesyMobileUpstreamError(
      `${endpoint} failed with HTTP ${response.status}`,
      endpoint,
      response.status,
      result,
    );
  }

  return result;
}

async function tryPostNesyMobile(
  baseUrl: string,
  endpoint: string,
  bearerToken: string,
  body: unknown,
  xProtectedRequestKey?: string,
) {
  try {
    return await postNesyMobile(baseUrl, endpoint, bearerToken, body, xProtectedRequestKey);
  } catch (error) {
    if (error instanceof NesyMobileUpstreamError) {
      return {
        resultCode: error.status,
        resultMessage: error.message,
        payload: null,
        upstreamError: {
          endpoint: error.endpoint,
          status: error.status,
          result: error.result,
        },
      };
    }

    throw error;
  }
}

function parseAdbBroadcastData(stdout: string) {
  const dataMatch = stdout.match(/\bdata="((?:\\"|[^"])*)"/);
  if (dataMatch?.[1]) {
    return dataMatch[1].replace(/\\"/g, "\"");
  }

  const resultMatch = stdout.match(/\bresult="((?:\\"|[^"])*)"/);
  if (resultMatch?.[1]) {
    return resultMatch[1].replace(/\\"/g, "\"");
  }

  return null;
}

async function requestProtectedRequestKeyFromAdb(params: {
  adbDeviceId?: string;
  applicationId: string;
}) {
  const adbCommand = resolveAdbCommand();
  try {
    return await requestAppValueFromAdb({
      adbCommand,
      adbDeviceId: params.adbDeviceId,
      applicationId: params.applicationId,
      action: GET_PROTECTED_KEY_ACTION,
    });
  } catch (error) {
    const output = getErrorWithOutput(error);
    console.error("[nesy-mobile-auth] ADB protected key broadcast failed", {
      adbCommand,
      applicationId: params.applicationId,
      adbDeviceId: params.adbDeviceId ?? null,
      error: output.message,
      stdout: output.stdout,
      stderr: output.stderr,
    });
    throw error;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function compactRoute(route: unknown) {
  const item = asRecord(route);
  return {
    routeName: item.routeName,
    routeType: item.routeType,
    routeNumber: item.routeNumber,
    daysOfWeek: item.daysOfWeek,
    taskType: item.taskType,
    pakHeader: item.pakHeader,
    isAutoDeps: item.isAutoDeps,
    autoDeps: item.isAutoDeps,
    canCreatePostponementSchedule: item.canCreatePostponementSchedule,
  };
}

function getRouteName(route: { routeName?: unknown }) {
  return typeof route.routeName === "string" ? route.routeName : "";
}

function sortRoutesLikeAndroid(routes: ReturnType<typeof compactRoute>[]) {
  const numericRoutes = routes
    .filter((route) => /^-?\d+$/.test(getRouteName(route)))
    .sort((a, b) => Number(getRouteName(a)) - Number(getRouteName(b)));
  const nonNumericRoutes = routes.filter((route) => !/^-?\d+$/.test(getRouteName(route)));
  return [...numericRoutes, ...nonNumericRoutes];
}

router.get("/adb-devices", async (req, res) => {
  try {
    const applicationId =
      typeof req.query.applicationId === "string" ? req.query.applicationId.trim() : undefined;
    const result = await listAdbDevices(applicationId);
    res.json(result);
  } catch (error) {
    const output = getErrorWithOutput(error);
    res.status(500).json({
      message: "ADB devices could not be listed.",
      error: output.message,
      adbStdout: output.stdout,
      adbStderr: output.stderr,
    });
  }
});

router.post("/login-device", async (req, res) => {
  try {
    const body = req.body as LoginDeviceRequestBody;
    const country = body.country;
    const environment = body.environment;
    const deviceCode = body.deviceCode?.trim();
    const pinCode = body.pinCode?.trim();
    const pushRegistrationId = body.pushRegistrationId?.trim() ?? "";
    const adbDeviceId = body.adbDeviceId?.trim() || process.env.NESY_MOBILE_ADB_DEVICE_ID?.trim();

    if (!country || !isNesyMobileCountry(country)) {
      res.status(400).json({ message: "country is required and must be one of HR, SI, RS, BA, ME." });
      return;
    }

    if (!environment || !isNesyMobileEnvironment(environment)) {
      res.status(400).json({ message: "environment is required and must be stage or prod." });
      return;
    }

    if (!deviceCode) {
      res.status(400).json({ message: "deviceCode is required." });
      return;
    }

    if (!pinCode) {
      res.status(400).json({ message: "pinCode is required." });
      return;
    }

    const applicationId =
      body.applicationId?.trim() ||
      resolveNesyMobileApplicationId(country, environment) ||
      process.env.NESY_MOBILE_ANDROID_APPLICATION_ID?.trim();

    if (!applicationId) {
      res.status(400).json({
        message:
          "applicationId is required. Provide it in the request body or NESY_MOBILE_ANDROID_APPLICATION_ID.",
      });
      return;
    }

    const baseUrl = resolveNesyMobileBaseUrl(
      country as NesyMobileCountry,
      environment as NesyMobileEnvironment
    );
    const loginUrl = `${baseUrl}/Auth/LoginDevice/`;
    const startedAt = Date.now();
    const nesyResponse = await fetch(loginUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        Accept: "application/json",
      },
      body: JSON.stringify({
        DeviceCode: deviceCode,
        PinCode: pinCode,
        PushRegistrationId: pushRegistrationId,
      }),
    });

    const responseText = await nesyResponse.text();
    let result: unknown = responseText;
    try {
      result = responseText ? JSON.parse(responseText) : null;
    } catch {
      result = responseText;
    }

    if (!nesyResponse.ok) {
      res.status(502).json({
        message: "Nesy mobile login request failed.",
        country,
        environment,
        baseUrl,
        status: nesyResponse.status,
        durationMs: Date.now() - startedAt,
        result,
      });
      return;
    }

    const biz = nesyMobileLoginDeviceBusinessFailure(result);
    if (biz.failed) {
      const detail =
        biz.resultMessage && biz.resultCode != null
          ? `${biz.resultMessage} (resultCode ${biz.resultCode})`
          : biz.resultMessage
            ? biz.resultMessage
            : biz.resultCode != null
              ? `resultCode ${biz.resultCode}`
              : "unknown response";
      res.json({
        message: `Login could not be completed: ${detail}. Bearer token was not generated.`,
        country,
        environment,
        baseUrl,
        status: nesyResponse.status,
        durationMs: Date.now() - startedAt,
        applicationId,
        adbDeviceId: adbDeviceId ?? null,
        xProtectedRequestKey: "",
        result,
        loginSucceeded: false,
        nesyResultCode: biz.resultCode,
        nesyResultMessage: biz.resultMessage,
      });
      return;
    }

    const skipAdb = body.skipAdb === true;
    if (skipAdb) {
      res.json({
        message: "Nesy mobile login successful (ADB skipped).",
        country,
        environment,
        baseUrl,
        status: nesyResponse.status,
        durationMs: Date.now() - startedAt,
        applicationId,
        adbDeviceId: adbDeviceId ?? null,
        xProtectedRequestKey: "",
        result,
        loginSucceeded: true,
        nesyResultCode: biz.resultCode,
        nesyResultMessage: biz.resultMessage,
      });
      return;
    }

    let xProtectedRequestKey: string;
    try {
      xProtectedRequestKey = await requestProtectedRequestKeyFromAdb({
        adbDeviceId,
        applicationId,
      });
    } catch (keyError) {
      const output = getErrorWithOutput(keyError);
      const adbCommand = resolveAdbCommand();
      console.error("[nesy-mobile-auth] Login succeeded but protected key fetch failed", {
        country,
        environment,
        baseUrl,
        applicationId,
        adbCommand,
        adbDeviceId: adbDeviceId ?? null,
        error: output.message,
        stdout: output.stdout,
        stderr: output.stderr,
      });
      res.status(502).json({
        message: "Nesy mobile login succeeded, but protected request key could not be fetched from Android app.",
        country,
        environment,
        baseUrl,
        status: nesyResponse.status,
        durationMs: Date.now() - startedAt,
        applicationId,
        adbCommand,
        adbDeviceId: adbDeviceId ?? null,
        error: output.message,
        adbStdout: output.stdout,
        adbStderr: output.stderr,
      });
      return;
    }

    res.json({
      message: "Nesy mobile login successful.",
      country,
      environment,
      baseUrl,
      status: nesyResponse.status,
      durationMs: Date.now() - startedAt,
      applicationId,
      adbDeviceId: adbDeviceId ?? null,
      xProtectedRequestKey,
      result,
      loginSucceeded: true,
      nesyResultCode: biz.resultCode,
      nesyResultMessage: biz.resultMessage,
    });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error during Nesy mobile login.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/route-context", async (req, res) => {
  try {
    const auth = validateMobileAuth(req.body as AuthenticatedMobileRequestBody);
    if ("error" in auth) {
      res.status(400).json({ message: auth.error });
      return;
    }

    const baseUrl = resolveNesyMobileBaseUrl(auth.country, auth.environment);
    const startedAt = Date.now();
    const emptyBody = "{}";

    const [hubResponse, scheduleResponse] = await Promise.all([
      postNesyMobile(baseUrl, "/Geocode/GetUserHub/", auth.bearerToken, emptyBody),
      postNesyMobile(baseUrl, "/Task/CheckHasCourierTodaySchedule/", auth.bearerToken, emptyBody),
    ]);

    const schedulePayload = asRecord(asRecord(scheduleResponse).payload);
    const activeRoute =
      typeof schedulePayload.route === "string" && schedulePayload.route.trim()
        ? schedulePayload.route.trim()
        : "";
    const hasCourierTodaySchedule = schedulePayload.hasCourierTodaySchedule === true;
    const myScheduleResponse =
      hasCourierTodaySchedule && activeRoute
        ? await tryPostNesyMobile(
            baseUrl,
            "/Task/GetMyScheduleByZoneCode/",
            auth.bearerToken,
            { courierZoneCode: activeRoute },
            auth.xProtectedRequestKey,
          )
        : null;
    const selectedRoutesResponse =
      hasCourierTodaySchedule && activeRoute
        ? null
        : await postNesyMobile(
            baseUrl,
            "/Task/GetTodaySelectedScheduleRouteList",
            auth.bearerToken,
            emptyBody,
          );

    const hubPayload = asRecord(asRecord(hubResponse).payload);
    const routeList = sortRoutesLikeAndroid(
      Array.isArray(hubPayload.routeList) ? hubPayload.routeList.map(compactRoute) : []
    );

    const compactHubResponse = {
      ...asRecord(hubResponse),
      payload: {
        ...hubPayload,
        routeList,
      },
    };

    res.json({
      message: "Nesy mobile route context loaded.",
      country: auth.country,
      environment: auth.environment,
      baseUrl,
      durationMs: Date.now() - startedAt,
      hub: {
        ...hubPayload,
        routeList,
      },
      schedule: schedulePayload,
      mySchedule: myScheduleResponse,
      selectedRoutes: selectedRoutesResponse ? asRecord(selectedRoutesResponse).payload ?? null : null,
      raw: {
        hub: compactHubResponse,
        schedule: scheduleResponse,
        mySchedule: myScheduleResponse,
        selectedRoutes: selectedRoutesResponse,
      },
    });
  } catch (error) {
    if (error instanceof NesyMobileUpstreamError) {
      res.status(502).json({
        message: "Nesy mobile route context request failed.",
        endpoint: error.endpoint,
        status: error.status,
        result: error.result,
        error: error.message,
      });
      return;
    }

    res.status(500).json({
      message: "Unexpected error while loading mobile route context.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/select-route", async (req, res) => {
  try {
    const body = req.body as SelectRouteRequestBody;
    const auth = validateMobileAuth(body);
    if ("error" in auth) {
      res.status(400).json({ message: auth.error });
      return;
    }

    const courierZone = body.courierZone?.trim();
    const oldScheduleId = body.oldScheduleId?.trim();
    const changeRoute = body.changeRoute === true;
    if (!courierZone) {
      res.status(400).json({ message: "courierZone is required." });
      return;
    }

    if (changeRoute && !oldScheduleId) {
      res.status(400).json({ message: "oldScheduleId is required for route change." });
      return;
    }

    const baseUrl = resolveNesyMobileBaseUrl(auth.country, auth.environment);
    const startedAt = Date.now();
    const routeChangeResult =
      changeRoute && oldScheduleId
        ? await postNesyMobile(
            baseUrl,
            "/Task/CourierRouteChange/",
            auth.bearerToken,
            { CourierOldScheduleId: oldScheduleId },
          )
        : null;
    const routeChangeMessage = asRecord(routeChangeResult).resultMessage;

    if (
      routeChangeMessage === "You cannot change the route because you have at least one delivery task." ||
      routeChangeMessage === "The chosen schedule is already in use by another courier."
    ) {
      res.status(409).json({
        message: String(routeChangeMessage),
        country: auth.country,
        environment: auth.environment,
        baseUrl,
        durationMs: Date.now() - startedAt,
        routeChangeResult,
      });
      return;
    }

    const result = await postNesyMobile(
      baseUrl,
      "/Task/CreateEmptyScheduleDocument/",
      auth.bearerToken,
      { courierZone },
    );

    res.json({
      message: "Nesy mobile route selected.",
      country: auth.country,
      environment: auth.environment,
      baseUrl,
      durationMs: Date.now() - startedAt,
      routeChangeResult,
      result,
    });
  } catch (error) {
    if (error instanceof NesyMobileUpstreamError) {
      res.status(502).json({
        message: "Nesy mobile route selection request failed.",
        endpoint: error.endpoint,
        status: error.status,
        result: error.result,
        error: error.message,
      });
      return;
    }

    res.status(500).json({
      message: "Unexpected error while selecting mobile route.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
