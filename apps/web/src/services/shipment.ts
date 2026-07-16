import { API_BASE } from "@/services/api";
import type { BffCustomerPayload } from "@/services/customer";
import type { BffCreateShipmentParties } from "@/lib/nesy-shipment-parties";

export interface ShipmentRecord {
  id: string;
  createdAt: string;
  unloadStatus: string;
  country: string | null;
  environment: string | null;
  data: Record<string, unknown>;
}

interface ShipmentScope {
  country: string;
  environment: string;
}

export async function createSingleShipment(params: {
  token: string;
  country: string;
  environment: string;
  parcelCount: number;
  shipmentType: string;
  codAmount?: number;
  codCurrency?: string;
  iban?: string;
  bicSwift?: string;
  integrationCode1?: string;
  receiverName?: string;
  counterLocationConsigneeId?: string;
  billingOption?: string;
  payerType?: number;
  customer?: BffCustomerPayload;
  parties?: BffCreateShipmentParties;
}): Promise<ShipmentRecord> {
  const res = await fetch(`${API_BASE}/shipments/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ?? `Shipment creation failed (${res.status})`
    );
  }

  const json = (await res.json()) as { data: ShipmentRecord };
  return json.data;
}

export async function unloadParcel(params: {
  shipmentDbId: string;
  token: string;
  country: string;
  environment: string;
  barcode: string;
  isLastParcel: boolean;
}): Promise<Record<string, unknown>> {
  const { shipmentDbId, ...body } = params;
  const res = await fetch(`${API_BASE}/shipments/${shipmentDbId}/unload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      (errBody as { message?: string }).message ?? `Unload failed (${res.status})`
    );
  }

  const json = (await res.json()) as { data: Record<string, unknown> };
  return json.data;
}

export async function deleteShipments(ids: string[]): Promise<number> {
  const res = await fetch(`${API_BASE}/shipments/bulk`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ?? `Delete failed (${res.status})`
    );
  }

  const json = (await res.json()) as { deleted: number };
  return json.deleted;
}

export async function refreshShipmentLastEvents(params: {
  token: string;
  country: string;
  environment: string;
}): Promise<{ total: number; updated: number; failed: number }> {
  const res = await fetch(`${API_BASE}/shipments/refresh-last-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ??
        `Failed to refresh shipment last events (${res.status})`
    );
  }
  const json = (await res.json()) as {
    data: { total: number; updated: number; failed: number };
  };
  return json.data;
}

export async function fetchShipments(scope?: ShipmentScope): Promise<ShipmentRecord[]> {
  const params = new URLSearchParams();
  if (scope?.country && scope.environment) {
    params.set("country", scope.country);
    params.set("environment", scope.environment);
  }
  const query = params.toString();
  const res = await fetch(`${API_BASE}/shipments${query ? `?${query}` : ""}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
      prismaCode?: string;
    };
    const detail = [body.error, body.prismaCode].filter(Boolean).join(" · ");
    throw new Error(
      [body.message, detail].filter(Boolean).join(" — ") ||
        `Failed to fetch shipments (${res.status})`
    );
  }
  const json = (await res.json()) as { data: ShipmentRecord[] };
  return json.data;
}

export async function getShipmentNesyUrl(shipmentDbId: string): Promise<string> {
  const res = await fetch(`${API_BASE}/shipments/${shipmentDbId}/nesy-url`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ?? `Failed to build Nesy URL (${res.status})`
    );
  }
  const json = (await res.json()) as { data: { url: string } };
  return json.data.url;
}

export async function getShipmentDetails(params: {
  token: string;
  country: string;
  environment: string;
  shipmentId: string;
}): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/shipments/details`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ?? `Shipment detayi alinamadi (${res.status})`
    );
  }
  const json = (await res.json()) as { data: Record<string, unknown> };
  return json.data;
}

export async function getShipmentEvents(params: {
  token: string;
  country: string;
  environment: string;
  shipmentId: string;
}): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/shipments/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ?? `Shipment events alinamadi (${res.status})`
    );
  }
  const json = (await res.json()) as { data: Record<string, unknown> };
  return json.data;
}

export async function getShipmentPricing(params: {
  token: string;
  country: string;
  environment: string;
  shipmentId: string;
}): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/shipments/pricing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ?? `Shipment pricing alinamadi (${res.status})`
    );
  }
  const json = (await res.json()) as { data: Record<string, unknown> };
  return json.data;
}

export async function getShipmentDisplayLabel(params: {
  shipmentDbId: string;
  token: string;
  country: string;
  environment: string;
}): Promise<{ content: string }> {
  const { shipmentDbId, ...body } = params;
  const res = await fetch(`${API_BASE}/shipments/${shipmentDbId}/display-label`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      (errBody as { message?: string }).message ?? `Shipment label could not be generated (${res.status})`
    );
  }
  const json = (await res.json()) as { data: { content?: string } };
  if (!json.data?.content) {
    throw new Error("Shipment label response is empty.");
  }
  return { content: json.data.content };
}

export async function getBulkShipmentDisplayLabel(params: {
  shipmentDbIds: string[];
  token: string;
  country: string;
  environment: string;
}): Promise<{ content: string; count: number }> {
  const { shipmentDbIds, ...body } = params;
  const res = await fetch(`${API_BASE}/shipments/display-label/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, ids: shipmentDbIds }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      (errBody as { message?: string }).message ?? `Shipment labels could not be generated (${res.status})`
    );
  }
  const json = (await res.json()) as { data: { content?: string; count?: number } };
  if (!json.data?.content) {
    throw new Error("Shipment label response is empty.");
  }
  return { content: json.data.content, count: json.data.count ?? shipmentDbIds.length };
}
