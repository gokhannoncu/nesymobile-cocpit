/**
 * Server Steps — dispatcher / backend actions that have no (or incomplete)
 * mobile UI equivalent and are executed AFTER the Maestro run completes.
 *
 * Node types handled:
 * - VALIDATE_STOPLIST : device JWT + GET_KEY → Task/GetMyScheduleByZoneCode
 *                       (+ admin GetTodayScheduleByCourierZone cross-check)
 * - TOUR_APPROVE      : Task/GetWaitingLeavingRequests → Task/ApproveLeavingPermission
 * - EOD_APPROVE       : Task/ApproveScheduleEndOfDay
 *
 * TOUR/EOD are terminal in their workflows. VALIDATE_STOPLIST may appear mid-graph;
 * its backend oracle is still resolved in this post-Maestro phase so the run cannot
 * go green until the schedule call succeeds.
 */

import {
  resolveBaseUrl,
  nesyHeaders,
  formatDateOnly,
  type NesyCountry,
  type NesyEnvironment,
} from "../nesy-env.js";
import {
  isNesyMobileCountry,
  resolveNesyMobileBaseUrl,
  type NesyMobileCountry,
} from "../nesy-mobile-env.js";
import { getDashboardAdminToken } from "./nesy-admin-token.js";
import { getDeviceBridgeState } from "./test-event-bridge.js";
import { readDeviceCourierAuth } from "./device-courier-auth.js";
import type { OracleEngine } from "./oracle-engine.js";
import type { BackendHttpCapture, DerivedBackendValidation } from "./backend-validation-lane.js";
import {
  completeBackendValidationStep,
  markBackendValidationRunning,
} from "./backend-validation-steps.js";

interface ServerStepNode {
  id: string;
  type: string;
  data?: { config?: Record<string, unknown>; title?: string };
}

export interface ServerStepsContext {
  nodes: ServerStepNode[];
  country: NesyCountry;
  environment: NesyEnvironment;
  deviceId: string | null;
  appId: string;
  oracle: OracleEngine;
  runId?: string;
  backendValidationBySource?: Map<string, DerivedBackendValidation>;
}

const SERVER_STEP_TYPES = new Set(["VALIDATE_STOPLIST", "TOUR_APPROVE", "EOD_APPROVE"]);

export function hasServerSteps(nodes: ServerStepNode[]): boolean {
  return nodes.some((n) => SERVER_STEP_TYPES.has(n.type));
}

export function listServerStepNodes(nodes: ServerStepNode[]): ServerStepNode[] {
  return nodes.filter((n) => SERVER_STEP_TYPES.has(n.type));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(str).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<{ ok: boolean; json: unknown; status: number; capture: BackendHttpCapture }> {
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return {
    ok: res.ok,
    json,
    status: res.status,
    capture: {
      method: "POST",
      url,
      headers,
      requestBody: body,
      status: res.status,
      responseBody: json,
    },
  };
}

async function postJsonAdmin(url: string, token: string, body: unknown) {
  return postJson(url, nesyHeaders(token), body);
}

async function recordServerStepLane(
  ctx: ServerStepsContext,
  node: ServerStepNode,
  passed: boolean,
  detail: string,
  requests: BackendHttpCapture[],
): Promise<void> {
  await oracleRecord(ctx, node, passed, detail);
  const validation = ctx.backendValidationBySource?.get(node.id);
  if (!ctx.runId || !validation) return;
  await completeBackendValidationStep({
    runId: ctx.runId,
    validation,
    passed,
    detail,
    requests,
  });
}

async function oracleRecord(
  ctx: ServerStepsContext,
  node: ServerStepNode,
  passed: boolean,
  detail: string,
): Promise<void> {
  await ctx.oracle.recordBackendVerification(node.id, passed, detail);
}

/** Mark every server-step node as backend-failed (missing country/env/device context). */
export async function failServerSteps(
  nodes: ServerStepNode[],
  oracle: OracleEngine,
  reason: string,
): Promise<void> {
  for (const node of listServerStepNodes(nodes)) {
    await oracle.recordBackendVerification(node.id, false, reason);
  }
}

/**
 * Runs every server step (in node order). Best-effort: failures are recorded as
 * a failed backend oracle for that node — never thrown — so one bad approval
 * doesn't abort the run finalization. Oracle fusion then fails the run.
 */
export async function runServerSteps(ctx: ServerStepsContext): Promise<void> {
  const { nodes, country, environment } = ctx;
  const serverNodes = listServerStepNodes(nodes);
  if (serverNodes.length === 0) return;

  const baseUrl = resolveBaseUrl(country, environment);
  const token = baseUrl ? await getDashboardAdminToken(country, environment) : null;

  for (const node of serverNodes) {
    if (ctx.runId) {
      await markBackendValidationRunning(ctx.runId, node.id);
    }
    try {
      if (node.type === "VALIDATE_STOPLIST") {
        await runValidateStoplist(ctx, node, baseUrl, token);
      } else if (node.type === "TOUR_APPROVE") {
        if (!baseUrl || !token) {
          await recordServerStepLane(
            ctx,
            node,
            false,
            `No admin token / base URL for ${country}/${environment}.`,
            [],
          );
          continue;
        }
        await runTourApprove(ctx, node, baseUrl, token);
      } else if (node.type === "EOD_APPROVE") {
        if (!baseUrl || !token) {
          await recordServerStepLane(
            ctx,
            node,
            false,
            `No admin token / base URL for ${country}/${environment}.`,
            [],
          );
          continue;
        }
        await runEodApprove(ctx, node, baseUrl, token);
      }
    } catch (err) {
      await recordServerStepLane(
        ctx,
        node,
        false,
        `Server step ${node.type} error: ${err instanceof Error ? err.message : String(err)}`,
        [],
      );
    }
  }
}

/** Best-effort scheduleId from the device (GET_STATE schedule_id). */
async function scheduleIdFromDevice(ctx: ServerStepsContext): Promise<string> {
  if (!ctx.deviceId) return "";
  const state = await getDeviceBridgeState(ctx.deviceId, ctx.appId);
  return state?.scheduleId?.trim() ?? "";
}

async function runValidateStoplist(
  ctx: ServerStepsContext,
  node: ServerStepNode,
  dashboardBaseUrl: string,
  adminToken: string | null,
): Promise<void> {
  const { country, environment, deviceId, appId } = ctx;
  const config = asRecord(node.data?.config);
  const requests: BackendHttpCapture[] = [];

  if (!deviceId) {
    await recordServerStepLane(ctx, node, false, "VALIDATE_STOPLIST: no deviceId on run.", requests);
    return;
  }
  if (!isNesyMobileCountry(country)) {
    await recordServerStepLane(
      ctx,
      node,
      false,
      `VALIDATE_STOPLIST: country ${country} has no mobile API base URL.`,
      requests,
    );
    return;
  }

  const mobileBase = resolveNesyMobileBaseUrl(country as NesyMobileCountry, environment);
  const auth = await readDeviceCourierAuth(deviceId, appId);
  if (!auth.token || !auth.xProtectedRequestKey) {
    await recordServerStepLane(
      ctx,
      node,
      false,
      `VALIDATE_STOPLIST: missing courier JWT and/or X-Protected-Request-Key (token=${auth.token ? "yes" : "no"}, key=${auth.xProtectedRequestKey ? "yes" : "no"}).`,
      requests,
    );
    return;
  }

  const bridge = await getDeviceBridgeState(deviceId, appId);
  const zone =
    str(config.courierZoneCode ?? config.zoneCode ?? config.routeNumber) ||
    str(bridge?.routeName) ||
    str(auth.route);
  if (!zone) {
    await recordServerStepLane(
      ctx,
      node,
      false,
      "VALIDATE_STOPLIST: no courier zone (config / GET_STATE / prefs).",
      requests,
    );
    return;
  }

  const mine = await postJson(
    `${mobileBase}/Task/GetMyScheduleByZoneCode/`,
    {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Protected-Request-Key": auth.xProtectedRequestKey,
    },
    { courierZoneCode: zone },
  );
  requests.push(mine.capture);

  const root = asRecord(mine.json);
  const payload = asRecord(root.payload ?? root.Payload);
  const resultCode = Number(root.resultCode ?? root.ResultCode ?? mine.status);
  const scheduleId = str(payload.scheduleId ?? payload.ScheduleId);
  const scheduleStatus = payload.scheduleStatus ?? payload.ScheduleStatus ?? null;
  const courierUsername = str(payload.courierUsername ?? payload.CourierUsername);
  const courierZoneCode = str(payload.courierZoneCode ?? payload.CourierZoneCode);
  const stopList = payload.stopList ?? payload.StopList;
  const stopCount = Array.isArray(stopList) ? stopList.length : 0;

  if (!mine.ok || resultCode !== 200 || !scheduleId) {
    await recordServerStepLane(
      ctx,
      node,
      false,
      `GetMyScheduleByZoneCode failed (HTTP ${mine.status}, resultCode=${resultCode}, zone=${zone}).`,
      requests,
    );
    return;
  }

  const errors: string[] = [];
  if (courierZoneCode && courierZoneCode !== zone) {
    errors.push(`zone mismatch: ${courierZoneCode} != ${zone}`);
  }

  const expectedCourier = str(config.courierUsername ?? config.courierUserName);
  if (expectedCourier && courierUsername && courierUsername !== expectedCourier) {
    errors.push(`courier mismatch: ${courierUsername} != ${expectedCourier}`);
  }

  if (bridge?.scheduleId && bridge.scheduleId !== scheduleId) {
    errors.push(`GET_STATE scheduleId mismatch: ${bridge.scheduleId} != ${scheduleId}`);
  }

  // Admin dashboard cross-check (same zone, same schedule).
  if (dashboardBaseUrl && adminToken) {
    const dash = await postJsonAdmin(
      `${dashboardBaseUrl}/Task/GetTodayScheduleByCourierZone`,
      adminToken,
      zone,
    );
    requests.push(dash.capture);
    const dashPayload = asRecord(asRecord(dash.json).payload ?? asRecord(dash.json).Payload);
    const dashScheduleId = str(dashPayload.scheduleId ?? dashPayload.ScheduleId);
    if (dash.ok && dashScheduleId && dashScheduleId !== scheduleId) {
      errors.push(`admin/mobile scheduleId mismatch: ${dashScheduleId} vs ${scheduleId}`);
    }
  }

  if (errors.length > 0) {
    await recordServerStepLane(
      ctx,
      node,
      false,
      `VALIDATE_STOPLIST backend checks failed: ${errors.join("; ")}`,
      requests,
    );
    return;
  }

  await recordServerStepLane(
    ctx,
    node,
    true,
    `GetMyScheduleByZoneCode OK (scheduleId=${scheduleId}, zone=${courierZoneCode || zone}, courier=${courierUsername || "—"}, status=${scheduleStatus ?? "—"}, stops=${stopCount}).`,
    requests,
  );
}

async function runTourApprove(
  ctx: ServerStepsContext,
  node: ServerStepNode,
  baseUrl: string,
  token: string,
): Promise<void> {
  const config = asRecord(node.data?.config);
  const today = formatDateOnly(new Date());
  const hubIds = toStringArray(config.hubIds ?? config.HubIds);
  const requests: BackendHttpCapture[] = [];

  let scheduleId = str(config.scheduleId);
  let courierUserName = str(config.courierUserName);

  // Resolve schedule + courier from the dispatcher's waiting-requests queue
  // when not pinned in config. Payload is a bare array on RS stage
  // (not { items: [...] }).
  if (!scheduleId || !courierUserName) {
    const waiting = await postJsonAdmin(`${baseUrl}/Task/GetWaitingLeavingRequests`, token, {
      StartDate: today,
      EndDate: today,
      ...(hubIds.length > 0 ? { HubIds: hubIds } : {}),
    });
    requests.push(waiting.capture);
    const root = asRecord(waiting.json);
    const payload = root.payload ?? root.Payload ?? waiting.json;
    const list: unknown[] = Array.isArray(payload)
      ? payload
      : Array.isArray(asRecord(payload).items)
        ? (asRecord(payload).items as unknown[])
        : Array.isArray(asRecord(payload).Items)
          ? (asRecord(payload).Items as unknown[])
          : Array.isArray(asRecord(payload).requests)
            ? (asRecord(payload).requests as unknown[])
            : [];
    const zoneHint = str(config.courierZoneCode ?? config.zoneCode) || "36";
    const match =
      list
        .map(asRecord)
        .find((r) => {
          const zone = str(r.courierZoneCode ?? r.CourierZoneCode);
          const name = str(r.courierUserName ?? r.CourierUserName ?? r.courierUsername ?? r.CourierUsername);
          if (courierUserName && name && name !== courierUserName) return false;
          if (zoneHint && zone && zone !== zoneHint) return false;
          return Boolean(str(r.scheduleId ?? r.ScheduleId));
        }) ?? asRecord(list[0]);
    if (match && Object.keys(match).length) {
      scheduleId = scheduleId || str(match.scheduleId ?? match.ScheduleId);
      courierUserName =
        courierUserName ||
        str(match.courierUserName ?? match.CourierUserName ?? match.courierUsername ?? match.CourierUsername);
    }
  }

  // Waiting list often has courierName but not courierUsername — resolve via
  // GetTodayScheduleByCourierZone when still missing.
  if (scheduleId && !courierUserName) {
    const zone = str(config.courierZoneCode ?? config.zoneCode) || "36";
    const sched = await postJsonAdmin(`${baseUrl}/Task/GetTodayScheduleByCourierZone`, token, zone);
    requests.push(sched.capture);
    const sp = asRecord(asRecord(sched.json).payload ?? asRecord(sched.json).Payload);
    courierUserName = str(sp.courierUsername ?? sp.CourierUsername ?? sp.courierUserName ?? sp.CourierUserName);
  }

  if (!scheduleId) {
    await recordServerStepLane(
      ctx,
      node,
      false,
      "TOUR_APPROVE: no waiting leaving-request scheduleId found.",
      requests,
    );
    return;
  }

  // Proven RS-stage shape (PascalCase + EventLocation required — null NRE's).
  const approve = await postJsonAdmin(`${baseUrl}/Task/ApproveLeavingPermission`, token, {
    TimeSpan: new Date().toISOString(),
    CourierUserNames: courierUserName ? [{ ScheduleId: scheduleId, CourierUserName: courierUserName }] : [],
    ScheduleIds: [scheduleId],
    EventLocation: {
      Latitude: 44.7866,
      Longitude: 20.4489,
      Accuracy: 10,
    },
  });
  requests.push(approve.capture);

  if (approve.ok) {
    await recordServerStepLane(
      ctx,
      node,
      true,
      `Tour approved (scheduleId=${scheduleId}${courierUserName ? `, courier=${courierUserName}` : ""}).`,
      requests,
    );
  } else {
    await recordServerStepLane(
      ctx,
      node,
      false,
      `ApproveLeavingPermission failed (HTTP ${approve.status}) for scheduleId=${scheduleId}.`,
      requests,
    );
  }
}

async function runEodApprove(
  ctx: ServerStepsContext,
  node: ServerStepNode,
  baseUrl: string,
  token: string,
): Promise<void> {
  const config = asRecord(node.data?.config);
  const requests: BackendHttpCapture[] = [];
  const scheduleId = str(config.scheduleId) || (await scheduleIdFromDevice(ctx));

  if (!scheduleId) {
    await recordServerStepLane(ctx, node, false, "EOD_APPROVE: no scheduleId (config or GET_STATE).", requests);
    return;
  }

  const approve = await postJsonAdmin(`${baseUrl}/Task/ApproveScheduleEndOfDay`, token, {
    ScheduleIdList: [scheduleId],
  });
  requests.push(approve.capture);

  if (approve.ok) {
    await recordServerStepLane(ctx, node, true, `End-of-day approved (scheduleId=${scheduleId}).`, requests);
  } else {
    await recordServerStepLane(
      ctx,
      node,
      false,
      `ApproveScheduleEndOfDay failed (HTTP ${approve.status}) for scheduleId=${scheduleId}.`,
      requests,
    );
  }
}
