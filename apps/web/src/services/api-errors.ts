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
