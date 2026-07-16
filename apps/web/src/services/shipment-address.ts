import { API_BASE } from "@/services/api";

type NesyCreds = {
  token: string;
  country: string;
  environment: string;
};

export async function fetchOohByCity(
  creds: NesyCreds & { city: string },
): Promise<unknown[]> {
  const res = await fetch(`${API_BASE}/shipments/ooh/by-city`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(creds),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ?? `OOH city search failed (${res.status})`,
    );
  }
  const json = (await res.json()) as { data: unknown[] };
  return Array.isArray(json.data) ? json.data : [];
}

export async function fetchOohByZip(
  creds: NesyCreds & { zipCode: string },
): Promise<unknown[]> {
  const res = await fetch(`${API_BASE}/shipments/ooh/by-zip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(creds),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ?? `OOH zip search failed (${res.status})`,
    );
  }
  const json = (await res.json()) as { data: unknown[] };
  return Array.isArray(json.data) ? json.data : [];
}

export async function checkCountryEligible(
  creds: NesyCreds & { countryCode: string },
): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/shipments/country/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(creds),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ?? `Country check failed (${res.status})`,
    );
  }
  const json = (await res.json()) as { data: Record<string, unknown> };
  return json.data ?? {};
}
