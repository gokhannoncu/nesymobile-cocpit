/**
 * Server Steps — dispatcher-side actions that have no mobile UI equivalent and
 * are executed AFTER the Maestro run completes.
 *
 * The mobile courier can only *request* a tour start / end of day; a dispatcher
 * must approve it. These flows call the Nesy Task/* endpoints directly with a
 * dashboard admin token and resolve the corresponding node's "backend" oracle.
 *
 * Node types handled:
 * - TOUR_APPROVE : Task/GetWaitingLeavingRequests → Task/ApproveLeavingPermission
 * - EOD_APPROVE  : Task/ApproveScheduleEndOfDay
 *
 * Both are terminal in their workflows (LOAD & TOUR, END OF DAY), so running
 * them after Maestro preserves ordering without interleaving mid-run.
 */

import {
  resolveBaseUrl,
  nesyHeaders,
  formatDateOnly,
  type NesyCountry,
  type NesyEnvironment,
} from "../nesy-env.js";
import { getDashboardAdminToken } from "./nesy-admin-token.js";
import { getDeviceBridgeState } from "./test-event-bridge.js";
import type { OracleEngine } from "./oracle-engine.js";

interface ServerStepNode {
  id: string;
  type: string;
  data?: { config?: Record<string, unknown> };
}

export interface ServerStepsContext {
  nodes: ServerStepNode[];
  country: NesyCountry;
  environment: NesyEnvironment;
  deviceId: string | null;
  appId: string;
  oracle: OracleEngine;
}

const SERVER_STEP_TYPES = new Set(["TOUR_APPROVE", "EOD_APPROVE"]);

export function hasServerSteps(nodes: ServerStepNode[]): boolean {
  return nodes.some((n) => SERVER_STEP_TYPES.has(n.type));
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

async function postJson(url: string, token: string, body: unknown): Promise<{ ok: boolean; json: unknown; status: number }> {
  const res = await fetch(url, {
    method: "POST",
    headers: nesyHeaders(token),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok: res.ok, json, status: res.status };
}

/**
 * Runs every server step (in node order). Best-effort: failures are recorded as
 * a failed backend oracle for that node — never thrown — so one bad approval
 * doesn't abort the run finalization.
 */
export async function runServerSteps(ctx: ServerStepsContext): Promise<void> {
  const { nodes, country, environment, oracle } = ctx;
  const serverNodes = nodes.filter((n) => SERVER_STEP_TYPES.has(n.type));
  if (serverNodes.length === 0) return;

  const baseUrl = resolveBaseUrl(country, environment);
  const token = baseUrl ? await getDashboardAdminToken(country, environment) : null;

  for (const node of serverNodes) {
    if (!baseUrl || !token) {
      await oracle.recordBackendVerification(node.id, false, `No admin token / base URL for ${country}/${environment}.`);
      continue;
    }
    try {
      if (node.type === "TOUR_APPROVE") {
        await runTourApprove(ctx, node, baseUrl, token);
      } else if (node.type === "EOD_APPROVE") {
        await runEodApprove(ctx, node, baseUrl, token);
      }
    } catch (err) {
      await oracle.recordBackendVerification(
        node.id,
        false,
        `Server step ${node.type} error: ${err instanceof Error ? err.message : String(err)}`,
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

async function runTourApprove(
  ctx: ServerStepsContext,
  node: ServerStepNode,
  baseUrl: string,
  token: string,
): Promise<void> {
  const { oracle } = ctx;
  const config = asRecord(node.data?.config);
  const today = formatDateOnly(new Date());
  const hubIds = toStringArray(config.hubIds ?? config.HubIds);

  let scheduleId = str(config.scheduleId);
  let courierUserName = str(config.courierUserName);

  // Resolve schedule + courier from the dispatcher's waiting-requests queue
  // when not pinned in config.
  if (!scheduleId || !courierUserName) {
    const waiting = await postJson(`${baseUrl}/Task/GetWaitingLeavingRequests`, token, {
      StartDate: today,
      EndDate: today,
      ...(hubIds.length > 0 ? { HubIds: hubIds } : {}),
    });
    const payload = asRecord(asRecord(waiting.json).payload ?? asRecord(waiting.json).Payload ?? waiting.json);
    const list =
      (Array.isArray(payload.items) && payload.items) ||
      (Array.isArray(payload.Items) && payload.Items) ||
      (Array.isArray(payload.requests) && payload.requests) ||
      (Array.isArray(waiting.json) && (waiting.json as unknown[])) ||
      [];
    const match = list
      .map(asRecord)
      .find((r) => !courierUserName || str(r.courierUserName ?? r.CourierUserName) === courierUserName) ?? asRecord(list[0]);
    if (match) {
      scheduleId = scheduleId || str(match.scheduleId ?? match.ScheduleId);
      courierUserName = courierUserName || str(match.courierUserName ?? match.CourierUserName);
    }
  }

  if (!scheduleId) {
    await oracle.recordBackendVerification(node.id, false, "TOUR_APPROVE: no waiting leaving-request scheduleId found.");
    return;
  }

  const approve = await postJson(`${baseUrl}/Task/ApproveLeavingPermission`, token, {
    CourierUserNames: courierUserName ? [{ ScheduleId: scheduleId, CourierUserName: courierUserName }] : [],
    scheduleIds: [scheduleId],
    eventLocation: null,
  });

  if (approve.ok) {
    await oracle.recordBackendVerification(
      node.id,
      true,
      `Tour approved (scheduleId=${scheduleId}${courierUserName ? `, courier=${courierUserName}` : ""}).`,
    );
  } else {
    await oracle.recordBackendVerification(
      node.id,
      false,
      `ApproveLeavingPermission failed (HTTP ${approve.status}) for scheduleId=${scheduleId}.`,
    );
  }
}

async function runEodApprove(
  ctx: ServerStepsContext,
  node: ServerStepNode,
  baseUrl: string,
  token: string,
): Promise<void> {
  const { oracle } = ctx;
  const config = asRecord(node.data?.config);
  const scheduleId = str(config.scheduleId) || (await scheduleIdFromDevice(ctx));

  if (!scheduleId) {
    await oracle.recordBackendVerification(node.id, false, "EOD_APPROVE: no scheduleId (config or GET_STATE).");
    return;
  }

  const approve = await postJson(`${baseUrl}/Task/ApproveScheduleEndOfDay`, token, {
    ScheduleIdList: [scheduleId],
  });

  if (approve.ok) {
    await oracle.recordBackendVerification(node.id, true, `End-of-day approved (scheduleId=${scheduleId}).`);
  } else {
    await oracle.recordBackendVerification(
      node.id,
      false,
      `ApproveScheduleEndOfDay failed (HTTP ${approve.status}) for scheduleId=${scheduleId}.`,
    );
  }
}
