import { API_BASE } from "@/services/api";
import { throwDataCenterApiError } from "@/services/api-errors";

/** BFF `ClientSaveShipment` icin; apps/api `nesy-customer-payload` ile ayni alanlar */
export interface BffCustomerPayload {
  customerId: number;
  customerCenter: string;
  name: string;
  phone: string;
  gsm: string;
  email?: string | null;
  addressStreet: string;
  addressCity: string;
  addressZipCode: string;
  addressCountry: string;
  addressTitle?: string;
  addressText?: string;
  customerPreferences?: Record<string, unknown>;
}

type NesyCreds = {
  token: string;
  country: string;
  environment: string;
};

export async function searchCustomers(
  creds: NesyCreds & {
    /** Nesy API: string (ornegin "10330") */
    customerId?: string | number;
    name?: string;
    oib?: string;
    fullName?: string;
    sorting?: string;
  }
): Promise<unknown> {
  const res = await fetch(`${API_BASE}/customers/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(creds),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throwDataCenterApiError(res, body, `Musteri aramasi basarisiz (${res.status})`);
  }
  const json = (await res.json()) as { data: unknown };
  return json.data;
}

export async function getCustomerDetails(
  creds: NesyCreds & { customerId: string | number; customerCenter: string }
): Promise<unknown> {
  const res = await fetch(`${API_BASE}/customers/details`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(creds),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throwDataCenterApiError(res, body, `Musteri detayi alinamadi (${res.status})`);
  }
  const json = (await res.json()) as { data: unknown };
  return json.data;
}
