/** Shared helpers for Nesy customer search (SearchCustomerByAll). */

export function extractSearchRows(data: unknown): Array<Record<string, unknown>> {
  if (data == null) return [];
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  if (typeof data === "object" && data !== null) {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.items)) {
      return o.items as Array<Record<string, unknown>>;
    }
    if (Array.isArray(o.data)) {
      return o.data as Array<Record<string, unknown>>;
    }
    const raw = o.raw as Record<string, unknown> | undefined;
    const cqr = raw?.customerQueryResult as { items?: unknown[] } | undefined;
    if (cqr && Array.isArray(cqr.items)) {
      return cqr.items as Array<Record<string, unknown>>;
    }
  }
  return [];
}

export function pickRowId(row: Record<string, unknown>): number {
  const v = row.customerId ?? row.CustomerId ?? row.id;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = Number(v);
  if (Number.isFinite(n)) return n;
  return NaN;
}

export function pickRowCenter(row: Record<string, unknown>): string {
  const v = row.hubId ?? row.centerNo ?? row.customerCenter ?? row.CustomerCenter;
  if (v != null && String(v).trim()) return String(v).trim();
  return "1";
}

export function pickRowIdString(row: Record<string, unknown>): string {
  if (row.customerId != null && String(row.customerId).trim() !== "") {
    return String(row.customerId).trim();
  }
  const n = pickRowId(row);
  return Number.isFinite(n) ? String(n) : "";
}

export function rowLabel(row: Record<string, unknown>): string {
  const id = pickRowId(row);
  const name = String(
    row.name ?? row.fullName ?? row.shortName ?? row.displayName ?? "",
  ).trim();
  const city = String(row.city ?? row.addressCity ?? "").trim();
  return [Number.isFinite(id) ? String(id) : "?", name, city].filter(Boolean).join(" \u00b7 ");
}

export function rowDisplayName(row: Record<string, unknown>): string {
  return String(
    row.name ?? row.fullName ?? row.shortName ?? row.displayName ?? "Unknown",
  ).trim();
}

export function rowDisplayCity(row: Record<string, unknown>): string {
  return String(row.city ?? row.addressCity ?? "").trim();
}

/** Maps a single search query to SearchCustomerByAll params (nesyapps create-shipment pattern). */
export function buildSearchParams(query: string): {
  customerId?: string;
  name?: string;
} {
  const trimmed = query.trim();
  const pattern = /[a-zA-Z]+/;
  if (!pattern.test(trimmed)) {
    return { customerId: trimmed };
  }
  return { name: trimmed };
}
