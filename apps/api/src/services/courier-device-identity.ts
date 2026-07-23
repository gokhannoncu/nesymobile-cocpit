/**
 * Resolve courier hub (branchId) + zone from the logged-in device.
 * Never falls back to country-hardcoded hubs (11/36/100).
 */

import { getDeviceBridgeState } from "./test-event-bridge.js";
import {
  parseScheduleIdParts,
  readDeviceCourierAuth,
  type DeviceCourierAuth,
} from "./device-courier-auth.js";

export interface CourierDeviceIdentity {
  branchId: string;
  zone: string;
  hubName: string | null;
  source: string;
  auth: DeviceCourierAuth;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

/**
 * Priority: shared_prefs branchId+route → GET_STATE schedule_id / route_name → fail.
 */
export async function resolveCourierDeviceIdentity(
  deviceId: string,
  appId: string,
): Promise<CourierDeviceIdentity | null> {
  const auth = await readDeviceCourierAuth(deviceId, appId);
  const bridge = await getDeviceBridgeState(deviceId, appId);
  const raw = (bridge?.raw ?? {}) as Record<string, unknown>;

  const branchFromBridge =
    str(raw.branch_id) ||
    str(raw.branchId) ||
    str(raw.hub_id) ||
    str(raw.hubId);
  const zoneFromBridge = str(bridge?.routeName) || str(raw.route_name) || str(raw.route);

  const scheduleParts = parseScheduleIdParts(str(bridge?.scheduleId) || str(raw.schedule_id));

  const branchId = str(auth.branchId) || branchFromBridge || scheduleParts?.branchId || "";
  const zone = str(auth.route) || zoneFromBridge || scheduleParts?.zone || "";

  if (!branchId || !zone) return null;

  const sources: string[] = [];
  if (auth.branchId) sources.push("prefs.branchId");
  else if (branchFromBridge) sources.push("GET_STATE.hub");
  else if (scheduleParts?.branchId) sources.push("schedule_id.hub");

  if (auth.route) sources.push("prefs.route");
  else if (zoneFromBridge) sources.push("GET_STATE.route");
  else if (scheduleParts?.zone) sources.push("schedule_id.zone");

  return {
    branchId,
    zone,
    hubName: auth.hubName,
    source: sources.join("+") || "device",
    auth,
  };
}
