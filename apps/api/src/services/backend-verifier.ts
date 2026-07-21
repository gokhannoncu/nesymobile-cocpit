/**
 * Backend Verifier — server-side confirmation that a mobile operation actually
 * reached the Nesy backend.
 *
 * The mobile "backend" oracle (logcat BACKEND_CONFIRMED) only proves the app
 * *thinks* it synced. This verifier independently polls the real backend
 * (EventTower/GetEvents) for the expected event code(s) — the ground truth a
 * green screen can't fake. Triggered by the NESY_BACKEND_CHECK Maestro marker.
 *
 * Auth: a dashboard admin token (Auth/LoginDashboard), cached per country/env.
 * Barcode → shipmentId resolution goes through Shipment/GetShipmentsByFilter.
 */

import {
  resolveBaseUrl,
  nesyHeaders,
  nesyPortalHeaders,
  type NesyCountry,
  type NesyEnvironment,
} from "../nesy-env.js";
import { getDashboardAdminToken } from "./nesy-admin-token.js";

export interface BackendVerifyRequest {
  country: NesyCountry;
  environment: NesyEnvironment;
  /** Barcode / waybill / shipmentId the operation acted on. */
  shipmentRef: string;
  /** Expected event short codes ("DELY") or numeric codes ("40"); any match passes. */
  codes: string[];
  /** Poll attempts after the initial delay (default 3). */
  attempts?: number;
  /** Delay between poll attempts, ms (default 3000). */
  intervalMs?: number;
}

export interface BackendVerifyResult {
  passed: boolean;
  detail: string;
  shipmentId?: string;
  matchedCode?: string;
  foundCodes?: string[];
}

/** Short code ⇄ numeric code map for the events the happy-path flows assert. */
const EVENT_CODE_MAP: Record<string, string> = {
  INIT: "10", DELY: "40", CASH: "41", PICK: "44", DEPS: "71",
  FDLY: "131", NSYS: "250", CODC: "268", CODH: "269", RFT: "997",
};
const NUMERIC_TO_SHORT: Record<string, string> = Object.fromEntries(
  Object.entries(EVENT_CODE_MAP).map(([short, num]) => [num, short]),
);

/** All string forms an expected code can take (short + numeric), upper-cased. */
function expandCode(code: string): Set<string> {
  const up = code.trim().toUpperCase();
  const set = new Set<string>([up]);
  if (EVENT_CODE_MAP[up]) set.add(EVENT_CODE_MAP[up]);
  if (NUMERIC_TO_SHORT[up]) set.add(NUMERIC_TO_SHORT[up]);
  return set;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export class BackendVerifier {
  /** Resolves a barcode/waybill to a shipmentId; returns the ref unchanged on failure. */
  private async resolveShipmentId(
    baseUrl: string,
    token: string,
    ref: string,
  ): Promise<string> {
    try {
      const res = await fetch(`${baseUrl}/Shipment/GetShipmentsByFilter`, {
        method: "POST",
        headers: nesyPortalHeaders(token),
        body: JSON.stringify([{ value: ref, filterType: 1 }]),
      });
      if (!res.ok) return ref;
      const json = await res.json();
      const root = asRecord(json);
      const payload = root.payload ?? root.Payload ?? json;
      // RS stage often returns a bare array in payload (not { items: [...] }).
      const items: unknown[] = Array.isArray(payload)
        ? payload
        : Array.isArray(asRecord(payload).items)
          ? (asRecord(payload).items as unknown[])
          : Array.isArray(asRecord(payload).Items)
            ? (asRecord(payload).Items as unknown[])
            : Array.isArray(root.items)
              ? (root.items as unknown[])
              : [];
      const first = asRecord(items[0]);
      const id =
        first.shipmentId ??
        first.ShipmentId ??
        first.waybillNumber ??
        first.WaybillNumber ??
        first.id ??
        first.Id ??
        first.shipmentID;
      return typeof id === "string" && id.trim() ? id.trim() : typeof id === "number" ? String(id) : ref;
    } catch {
      return ref;
    }
  }

  /** Collects the event code strings present on a GetEvents response. */
  private extractFoundCodes(eventsJson: unknown): string[] {
    const payload = asRecord(asRecord(eventsJson).payload ?? asRecord(eventsJson).Payload ?? eventsJson);
    const list =
      (Array.isArray(payload.eventDetailList) && payload.eventDetailList) ||
      (Array.isArray(payload.EventDetailList) && payload.EventDetailList) ||
      (Array.isArray(payload.events) && payload.events) ||
      [];
    const found: string[] = [];
    for (const raw of list) {
      const ev = asRecord(raw);
      for (const field of ["eventShortCode", "EventShortCode", "eventCode", "EventCode", "eventId", "EventId"]) {
        const v = ev[field];
        if (typeof v === "string" && v.trim()) found.push(v.trim().toUpperCase());
        else if (typeof v === "number") found.push(String(v));
      }
    }
    return found;
  }

  async verify(req: BackendVerifyRequest): Promise<BackendVerifyResult> {
    const { country, environment, shipmentRef, codes } = req;
    // RS stage delivery (esp. COD/fiscal) often lands events 20–90s after UI finish.
    const attempts = req.attempts ?? 20;
    const intervalMs = req.intervalMs ?? 5000;

    if (!shipmentRef || codes.length === 0) {
      return { passed: false, detail: "Missing shipmentRef or expected codes." };
    }

    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) return { passed: false, detail: `No base URL for ${country}/${environment}.` };

    const token = await getDashboardAdminToken(country, environment);
    if (!token) return { passed: false, detail: "Could not obtain admin token for backend verification." };

    const shipmentId = await this.resolveShipmentId(baseUrl, token, shipmentRef);
    const expected = new Set<string>();
    for (const c of codes) for (const form of expandCode(c)) expected.add(form);

    let lastFound: string[] = [];
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const res = await fetch(`${baseUrl}/EventTower/GetEvents`, {
          method: "POST",
          headers: nesyHeaders(token),
          body: JSON.stringify({ ShipmentId: shipmentId }),
        });
        if (res.ok) {
          const json = await res.json();
          lastFound = this.extractFoundCodes(json);
          // Require every requested code (e.g. DELY+CODH), not just the first hit.
          const missing = codes.filter((c) => {
            const forms = expandCode(c);
            return ![...forms].some((f) => lastFound.includes(f));
          });
          if (missing.length === 0) {
            const matched = codes.join(",");
            return {
              passed: true,
              detail: `Backend event(s) [${matched}] found for shipment ${shipmentId} (attempt ${attempt}/${attempts}).`,
              shipmentId,
              matchedCode: matched,
              foundCodes: lastFound,
            };
          }
        }
      } catch (err) {
        console.warn(`[BackendVerifier] GetEvents attempt ${attempt} failed:`, err instanceof Error ? err.message : err);
      }
      if (attempt < attempts) await sleep(intervalMs);
    }

    return {
      passed: false,
      detail:
        `Expected event(s) [${codes.join(", ")}] not found for shipment ${shipmentId} after ${attempts} attempts. ` +
        `Seen: [${lastFound.join(", ") || "none"}].`,
      shipmentId,
      foundCodes: lastFound,
    };
  }
}
