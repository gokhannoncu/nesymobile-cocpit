/**
 * 401 handling: drop the stale token, refresh once, never loop.
 *
 * A dashboard token expires on its own schedule, so the run holding it when
 * that happens would otherwise fail for a reason that has nothing to do with
 * the product under test. Retrying is bounded on purpose — the dashboard locks
 * accounts and demands a captcha, which costs far more than one refused step.
 */
import { describe, expect, it, vi } from "vitest";

import { createNesyBackofficeAdapter } from "./nesy-backoffice-adapter.js";

const OPERATION = "nesy.backoffice.read-session";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const AUDIT = { recordRequest: true, recordResponse: true, redactFields: [] };

const CALL = {
  operationRef: OPERATION,
  inputs: {},
  timeoutMs: 5_000,
  planStepId: "auth-verify-backend-session",
};

describe("back-office 401 handling", () => {
  it("drops the token, refreshes once and retries", async () => {
    const tokens = ["stale-token", "fresh-token"];
    const onUnauthorized = vi.fn(async () => {});
    const seen: string[] = [];
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const auth = String((init?.headers as Record<string, string>)?.Authorization ?? "");
      seen.push(auth);
      return auth.includes("fresh-token")
        ? jsonResponse(200, { resultCode: 200, payload: { username: "GOKHANADMIN" } })
        : jsonResponse(401, { resultCode: 401, resultMessage: "Unauthorized" });
    });

    const adapter = createNesyBackofficeAdapter({
      credentials: () => ({ baseUrl: "https://dash.example", token: tokens.shift() ?? "fresh-token" }),
      onUnauthorized,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await adapter.call(CALL, AUDIT);

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(["Bearer stale-token", "Bearer fresh-token"]);
    expect(result.terminal.status).toBe('SUCCEEDED');
  });

  it("does not retry when the refreshed token is the same one", async () => {
    // Retrying an unchanged token doubles every failure and buys nothing.
    const onUnauthorized = vi.fn(async () => {});
    const fetchImpl = vi.fn(async () => jsonResponse(401, { resultCode: 401 }));

    const adapter = createNesyBackofficeAdapter({
      credentials: () => ({ baseUrl: "https://dash.example", token: "same-token" }),
      onUnauthorized,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await adapter.call(CALL, AUDIT);

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not retry when the refresh yields no token at all", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(401, { resultCode: 401 }));

    const adapter = createNesyBackofficeAdapter({
      credentials: () => ({ baseUrl: "https://dash.example", token: "stale" }),
      onUnauthorized: async () => {},
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    // `credentials` keeps answering "stale", so the guard above holds; this
    // pins that an empty answer is treated the same way rather than sending an
    // Authorization header with nothing in it.
    await adapter.call(CALL, AUDIT);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("leaves a 401 alone when nobody owns the token", async () => {
    // Without `onUnauthorized` there is no one to invalidate anything, so the
    // adapter must not silently retry — it reports the refusal.
    const fetchImpl = vi.fn(async () => jsonResponse(401, { resultCode: 401, resultMessage: "Unauthorized" }));

    const adapter = createNesyBackofficeAdapter({
      credentials: () => ({ baseUrl: "https://dash.example", token: "stale" }),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await adapter.call(CALL, AUDIT);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect((result.terminal as { error: string }).error).toMatch(/401/);
  });

  it("does not touch the token on a non-401 failure", async () => {
    const onUnauthorized = vi.fn(async () => {});
    const fetchImpl = vi.fn(async () => jsonResponse(500, { resultCode: 500 }));

    const adapter = createNesyBackofficeAdapter({
      credentials: () => ({ baseUrl: "https://dash.example", token: "good-token" }),
      onUnauthorized,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await adapter.call(CALL, AUDIT);

    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
