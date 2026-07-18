import { API_BASE } from "@/services/api";
import { throwDataCenterApiError } from "@/services/api-errors";
import type { GenerationJob } from "@/lib/happy-path/happy-path-generation";

export type HappyPathPoolStatus = "Draft" | "Generating" | "Created" | "Failed";

/** @deprecated DB may still store legacy value */
export type HappyPathPoolStatusStored = HappyPathPoolStatus | "Completed";

export interface HappyPathPoolListItem {
  id: string;
  name: string;
  country: string;
  environment: string;
  shipmentCount: number;
  status: HappyPathPoolStatusStored;
  createdDate: string;
}

export function normalizePoolStatus(status: HappyPathPoolStatusStored): HappyPathPoolStatus {
  if (status === "Completed") return "Created";
  return status;
}

export function formatPoolStatusLabel(status: HappyPathPoolStatusStored): string {
  return normalizePoolStatus(status);
}

export interface HappyPathPoolEntryInput {
  typeId: string;
  label: string;
  route: string;
  status: string;
  shipmentId?: string | null;
  pickupId?: string | null;
  unloadStatus?: string | null;
  error?: string | null;
  sortOrder?: number;
}

export interface HappyPathPoolEntry extends HappyPathPoolEntryInput {
  id: string;
  poolId: string;
  createdAt?: string;
  /** Nesy business shipment id (from linked shipment/pickup record) */
  nesyShipmentId?: string | null;
}

export interface HappyPathPoolDetail extends HappyPathPoolListItem {
  assignmentMode: string | null;
  meta: Record<string, unknown> | null;
  entries: HappyPathPoolEntry[];
}

interface PoolScope {
  country: string;
  environment: string;
}

export async function fetchHappyPathPools(
  scope: PoolScope,
): Promise<HappyPathPoolListItem[]> {
  const params = new URLSearchParams({
    country: scope.country,
    environment: scope.environment,
  });
  const res = await fetch(`${API_BASE}/happy-path/pools?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throwDataCenterApiError(res, body, `Failed to load happy path pools (${res.status})`);
  }
  const json = (await res.json()) as { data: HappyPathPoolListItem[] };
  return Array.isArray(json.data) ? json.data : [];
}

export async function fetchHappyPathPoolById(id: string): Promise<HappyPathPoolDetail> {
  const res = await fetch(`${API_BASE}/happy-path/pools/${id}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throwDataCenterApiError(res, body, `Failed to load happy path pool (${res.status})`);
  }
  const json = (await res.json()) as { data: HappyPathPoolDetail };
  return json.data;
}

export async function updateHappyPathPool(
  id: string,
  params: { name: string },
): Promise<HappyPathPoolListItem> {
  const res = await fetch(`${API_BASE}/happy-path/pools/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throwDataCenterApiError(res, body, `Failed to update happy path pool (${res.status})`);
  }
  const json = (await res.json()) as { data: HappyPathPoolListItem };
  return json.data;
}

export async function createHappyPathPool(params: {
  name: string;
  country: string;
  environment: string;
  status: HappyPathPoolStatus;
  shipmentCount: number;
  assignmentMode?: string;
  meta?: Record<string, unknown>;
  entries: HappyPathPoolEntryInput[];
}): Promise<HappyPathPoolListItem> {
  const res = await fetch(`${API_BASE}/happy-path/pools`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throwDataCenterApiError(res, body, `Failed to save happy path pool (${res.status})`);
  }
  const json = (await res.json()) as { data: HappyPathPoolListItem };
  return json.data;
}

export async function deleteHappyPathPool(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/happy-path/pools/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throwDataCenterApiError(res, body, `Failed to delete happy path pool (${res.status})`);
  }
}

export function buildHappyPathPoolName(country: string, environment: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `Happy Path · ${country}/${environment.toUpperCase()} · ${stamp}`;
}

export function resolvePoolStatusFromJobs(
  jobs: GenerationJob[],
): HappyPathPoolStatus {
  const successCount = jobs.filter((j) => j.status === "success").length;
  const failedCount = jobs.filter((j) => j.status === "failed").length;
  if (successCount === 0 && failedCount > 0) return "Failed";
  return "Created";
}

export function jobsToPoolEntries(jobs: GenerationJob[]): HappyPathPoolEntryInput[] {
  return jobs.map((job, index) => ({
    typeId: job.typeId,
    label: job.label,
    route: job.route,
    status: job.status,
    shipmentId: job.route === "shipment" ? job.resultId ?? null : null,
    pickupId:
      job.route === "pickup"
        ? job.resultId ?? null
        : job.linkedPickupId ?? null,
    unloadStatus:
      job.unloadPhase === "success"
        ? "unloaded"
        : job.unloadPhase === "failed"
          ? "unload_failed"
          : null,
    error: job.error ?? job.unloadError ?? null,
    sortOrder: index,
  }));
}
