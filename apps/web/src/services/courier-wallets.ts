import { API_BASE } from "@/services/api";
import { throwDataCenterApiError } from "@/services/api-errors";

export type CourierWalletListItem = {
  id: string;
  username: string;
  country: string;
  environment: string;
};

export type CourierWalletDetail = CourierWalletListItem & {
  password: string;
  hubName: string;
  hubId: string;
  createdAt: string;
  updatedAt: string;
};

export type CourierWalletSaved = {
  id: string;
  username: string;
  hubName: string;
  hubId: string;
  country: string;
  environment: string;
  createdAt: string;
  updatedAt: string;
};

async function readJson<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({}));
  return json as T;
}

export async function createOrUpdateCourierWallet(body: {
  username: string;
  password: string;
  hubName: string;
  hubId: string;
  country: string;
  environment: string;
}): Promise<CourierWalletSaved> {
  const res = await fetch(`${API_BASE}/courier-wallets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await readJson<{ message?: string; data?: CourierWalletSaved }>(res);
  if (!res.ok) {
    throwDataCenterApiError(res, json, `Save failed (${res.status})`);
  }
  if (!json.data) throw new Error("Invalid response");
  return json.data;
}

export async function fetchCourierWalletList(
  country: string,
  environment: string,
): Promise<CourierWalletListItem[]> {
  const params = new URLSearchParams({ country, environment });
  const res = await fetch(`${API_BASE}/courier-wallets?${params.toString()}`);
  const json = await readJson<{ data?: CourierWalletListItem[]; message?: string }>(res);
  if (!res.ok) {
    throwDataCenterApiError(res, json, `List failed (${res.status})`);
  }
  return json.data ?? [];
}

export async function fetchCourierWalletById(id: string): Promise<CourierWalletDetail> {
  const res = await fetch(`${API_BASE}/courier-wallets/${encodeURIComponent(id)}`);
  const json = await readJson<{ data?: CourierWalletDetail; message?: string }>(res);
  if (!res.ok) {
    throwDataCenterApiError(res, json, `Fetch failed (${res.status})`);
  }
  if (!json.data) throw new Error("Invalid response");
  return json.data;
}

export async function deleteCourierWallet(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/courier-wallets/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (res.status === 204) return;
  const json = await readJson<{ message?: string }>(res);
  throwDataCenterApiError(res, json, `Delete failed (${res.status})`);
}
