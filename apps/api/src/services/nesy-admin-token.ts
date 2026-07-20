/**
 * Cached Nesy dashboard admin token (Auth/LoginDashboard) used by server-side
 * automation steps: backend event verification, tour approval, end-of-day
 * approval. One process-wide cache keyed by country/environment.
 */

import { resolveBaseUrl, type NesyCountry, type NesyEnvironment } from "../nesy-env.js";

const TOKEN_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { token: string; at: number }>();

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export async function getDashboardAdminToken(
  country: NesyCountry,
  environment: NesyEnvironment,
): Promise<string | null> {
  const key = `${country}/${environment}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TOKEN_TTL_MS) return cached.token;

  const baseUrl = resolveBaseUrl(country, environment);
  if (!baseUrl) return null;
  const username = process.env[`NESY_${country}_${environment.toUpperCase()}_USERNAME`]?.trim();
  const password = process.env[`NESY_${country}_${environment.toUpperCase()}_PASSWORD`]?.trim();
  if (!username || !password) return null;

  try {
    const res = await fetch(`${baseUrl}/Auth/LoginDashboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Username: username, Password: password, CaptchaToken: null }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    const json = asRecord(await res.json());
    const payload = asRecord(json.payload ?? json.Payload);
    const token =
      typeof payload.token === "string"
        ? payload.token
        : typeof payload.Token === "string"
          ? (payload.Token as string)
          : "";
    if (!token) return null;
    cache.set(key, { token, at: Date.now() });
    return token;
  } catch (err) {
    console.warn("[NesyAdminToken] LoginDashboard failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
