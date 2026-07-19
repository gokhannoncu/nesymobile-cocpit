import { API_BASE } from "@/services/api";
import { formatApiNetworkError, throwDataCenterApiError } from "@/services/api-errors";
import type { BffCustomerPayload } from "@/services/customer";

export interface PickupRecord {
  id: string;
  createdAt: string;
  pickupType: string;
  shipmentId: string;
  assignStatus: string;
  taskId: string | null;
  branchId: string | null;
  courierZoneCode: string | null;
  country: string | null;
  environment: string | null;
  data: Record<string, unknown>;
}

interface PickupScope {
  country: string;
  environment: string;
}

export async function createPickup(params: {
  token: string;
  country: string;
  environment: string;
  pickupType: "remote" | "customer";
  shipmentCount: number;
  pickUpDateOffsetDays?: number;
  pickupEndTime?: string;
  parcelWeight?: number;
  branchId?: string;
  courierZoneCode?: string;
  customer?: BffCustomerPayload;
  happyPathOrigin?: boolean;
}): Promise<PickupRecord> {
  const res = await fetch(`${API_BASE}/pickups/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throwDataCenterApiError(res, body, `Pickup creation failed (${res.status})`);
  }

  const json = (await res.json()) as { data: PickupRecord };
  return json.data;
}

export async function assignPickup(params: {
  pickupDbId: string;
  token: string;
  country: string;
  environment: string;
  branchId?: string;
  courierZoneCode?: string;
}): Promise<{ assignStatus: string; taskId: string }> {
  const { pickupDbId, ...body } = params;
  const res = await fetch(`${API_BASE}/pickups/${pickupDbId}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throwDataCenterApiError(res, errBody, `Assign failed (${res.status})`);
  }

  const json = (await res.json()) as { data: { assignStatus: string; taskId: string } };
  return json.data;
}

export async function deletePickups(ids: string[]): Promise<number> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/pickups/bulk/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
  } catch (error) {
    throw new Error(formatApiNetworkError(error, "Delete failed."));
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throwDataCenterApiError(res, body, `Delete failed (${res.status})`);
  }

  const json = (await res.json()) as { deleted: number };
  return json.deleted;
}

export async function fetchPickups(scope?: PickupScope): Promise<PickupRecord[]> {
  const params = new URLSearchParams();
  if (scope?.country && scope.environment) {
    params.set("country", scope.country);
    params.set("environment", scope.environment);
  }
  const query = params.toString();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/pickups${query ? `?${query}` : ""}`);
  } catch (error) {
    throw new Error(formatApiNetworkError(error, "Failed to load pickups."));
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throwDataCenterApiError(res, body, `Failed to load pickups (${res.status})`);
  }
  const json = (await res.json()) as { data: PickupRecord[] };
  return json.data;
}

export async function getPickup(pickupDbId: string): Promise<PickupRecord> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/pickups/${pickupDbId}`);
  } catch (error) {
    throw new Error(formatApiNetworkError(error, "Failed to load pickup."));
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throwDataCenterApiError(res, body, `Failed to fetch pickup (${res.status})`);
  }
  const json = (await res.json()) as { data: PickupRecord };
  return json.data;
}

export async function getPickupNesyUrl(pickupDbId: string): Promise<string> {
  const res = await fetch(`${API_BASE}/pickups/${pickupDbId}/nesy-url`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throwDataCenterApiError(res, body, `Failed to build Nesy URL (${res.status})`);
  }
  const json = (await res.json()) as { data: { url: string } };
  return json.data.url;
}

export interface PickupTaskDetailData {
  taskId: string;
  branchId: string;
  courierZoneCode: string;
  waybillNumber: string;
  resolvedDate?: string;
  match: Record<string, unknown>;
}

export async function getPickupTaskDetail(params: {
  token: string;
  country: string;
  environment: string;
  shipmentId: string;
  startDate?: string;
  endDate?: string;
}): Promise<PickupTaskDetailData> {
  const res = await fetch(`${API_BASE}/pickups/task-detail`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throwDataCenterApiError(res, body, `Pickup task detail failed (${res.status})`);
  }
  const json = (await res.json()) as { data: PickupTaskDetailData };
  return json.data;
}
