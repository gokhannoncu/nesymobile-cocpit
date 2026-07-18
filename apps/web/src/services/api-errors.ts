import { API_BASE } from "@/services/api";

/** Browser `fetch` network failures (API down, CORS, wrong URL). */
export function formatApiNetworkError(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return `Cannot reach API at ${API_BASE}. Is the API running on port 4001?`;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

/** Fired when a Data Center Nesy call reports an expired/invalid session (401). */
export const NESY_UNAUTHORIZED_EVENT = "nesy-unauthorized";

export class NesyUnauthorizedError extends Error {
  constructor(message = "Nesy session expired. Please reconnect.") {
    super(message);
    this.name = "NesyUnauthorizedError";
  }
}

let unauthorizedNotified = false;
let unauthorizedResetTimer: ReturnType<typeof setTimeout> | undefined;

/** Notify auth layer once (deduped briefly so parallel 401s don't loop). */
export function notifyNesyUnauthorized(): void {
  if (typeof window === "undefined") return;
  if (unauthorizedNotified) return;
  unauthorizedNotified = true;
  window.dispatchEvent(new Event(NESY_UNAUTHORIZED_EVENT));
  if (unauthorizedResetTimer) clearTimeout(unauthorizedResetTimer);
  unauthorizedResetTimer = setTimeout(() => {
    unauthorizedNotified = false;
  }, 2500);
}

function blobLooksUnauthorized(text: string): boolean {
  if (!text) return false;
  if (/"status"\s*:\s*401\b/.test(text)) return true;
  if (/"title"\s*:\s*"Unauthorized"/i.test(text)) return true;
  if (/\bUnauthorized\b/i.test(text) && /\b401\b/.test(text)) return true;
  return false;
}

/** True when HTTP or proxied Nesy upstream status is 401 / Unauthorized. */
export function isNesyUnauthorizedResponse(res: Response, body: unknown): boolean {
  if (res.status === 401) return true;

  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>;
    if (o.status === 401) return true;
    const parts = [o.message, o.detail, o.error, o.title]
      .filter((v): v is string => typeof v === "string")
      .join("\n");
    if (blobLooksUnauthorized(parts)) return true;
  }

  if (typeof body === "string" && blobLooksUnauthorized(body)) return true;
  return false;
}

/**
 * If the failed response is unauthorized, notify auth + throw.
 * Otherwise no-op (caller throws a normal error).
 */
export function throwIfNesyUnauthorized(res: Response, body: unknown): void {
  if (!isNesyUnauthorizedResponse(res, body)) return;
  notifyNesyUnauthorized();
  throw new NesyUnauthorizedError();
}

/** Shared Data Center error path: logout on 401, else throw with API message. */
export function throwDataCenterApiError(
  res: Response,
  body: unknown,
  fallback: string,
): never {
  throwIfNesyUnauthorized(res, body);
  const message =
    body &&
    typeof body === "object" &&
    typeof (body as { message?: unknown }).message === "string" &&
    (body as { message: string }).message.trim()
      ? (body as { message: string }).message
      : fallback;
  throw new Error(message);
}
