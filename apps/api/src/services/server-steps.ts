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
  // when not pinned in config. Payload is a bare array on RS stage
  // (not { items: [...] }).
  if (!scheduleId || !courierUserName) {
    const waiting = await postJson(`${baseUrl}/Task/GetWaitingLeavingRequests`, token, {
      StartDate: today,
      EndDate: today,
      ...(hubIds.length > 0 ? { HubIds: hubIds } : {}),
    });
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
    const sched = await postJson(`${baseUrl}/Task/GetTodayScheduleByCourierZone`, token, zone);
    const sp = asRecord(asRecord(sched.json).payload ?? asRecord(sched.json).Payload);
    courierUserName = str(sp.courierUsername ?? sp.CourierUsername ?? sp.courierUserName ?? sp.CourierUserName);
  }

  if (!scheduleId) {
    await oracle.recordBackendVerification(node.id, false, "TOUR_APPROVE: no waiting leaving-request scheduleId found.");
    return;
  }

  // Proven RS-stage shape (PascalCase + EventLocation required — null NRE's).
  const approve = await postJson(`${baseUrl}/Task/ApproveLeavingPermission`, token, {
    TimeSpan: new Date().toISOString(),
    CourierUserNames: courierUserName ? [{ ScheduleId: scheduleId, CourierUserName: courierUserName }] : [],
    ScheduleIds: [scheduleId],
    EventLocation: {
      Latitude: 44.7866,
      Longitude: 20.4489,
      Accuracy: 10,
    },
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
