import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRunTelemetry: vi.fn(),
}));

vi.mock("../services/run-telemetry-read-model.js", () => ({
  getRunTelemetry: mocks.getRunTelemetry,
}));

vi.mock("../services/verdict-runtime-read-model.js", () => ({
  getEvidenceJourney: vi.fn(async () => ({ items: [] })),
  getRunDetail: vi.fn(async () => null),
  getWorkflowCatalog: vi.fn(async () => ({ items: [] })),
  queryRunHistory: vi.fn(async () => ({ items: [] })),
}));

vi.mock("./verdict-phase6-contracts.routes.js", () => ({
  __phase6ContractSingletons: {
    evidenceSources: {
      list: vi.fn(async () => []),
      listForRun: vi.fn(async () => []),
    },
    domainPackReads: {
      listRunTargetResolutions: vi.fn(async () => []),
    },
    deviceReadiness: { get: vi.fn(async () => ({})) },
    testProfiles: { list: vi.fn(async () => []) },
    testCampaigns: { get: vi.fn(() => null) },
  },
}));

import { verdictRuntimeRoutes } from "./verdict-runtime.routes.js";

afterEach(() => {
  mocks.getRunTelemetry.mockReset();
});

describe("GET /runtime/runs/:runId/telemetry", () => {
  async function telemetryApp() {
    mocks.getRunTelemetry.mockResolvedValue({
      apiVersion: "verdict-run-telemetry.v1",
      runId: "run-1",
      measurementState: "UNAVAILABLE",
      summary: {},
    });
    const app = Fastify();
    await app.register(verdictRuntimeRoutes);
    return app;
  }

  it("withholds captured body text unless the caller asks for it", async () => {
    // Fail-closed. A forgotten parameter, or a direct request that never went
    // through the permission check, must under-fetch rather than over-share.
    const app = await telemetryApp();

    await app.inject({ method: "GET", url: "/runtime/runs/run-1/telemetry" });

    expect(mocks.getRunTelemetry).toHaveBeenCalledWith("run-1", {
      includeBodyText: false,
    });
  });

  it("passes the body permission through when it is explicitly stated", async () => {
    const app = await telemetryApp();

    await app.inject({
      method: "GET",
      url: "/runtime/runs/run-1/telemetry?includeBodyText=true",
    });

    expect(mocks.getRunTelemetry).toHaveBeenCalledWith("run-1", {
      includeBodyText: true,
    });
  });

  it("treats any value other than the exact opt-in as a refusal", async () => {
    const app = await telemetryApp();

    for (const value of ["1", "yes", "TRUE", ""]) {
      mocks.getRunTelemetry.mockClear();
      await app.inject({
        method: "GET",
        url: `/runtime/runs/run-1/telemetry?includeBodyText=${value}`,
      });
      expect(mocks.getRunTelemetry).toHaveBeenCalledWith("run-1", {
        includeBodyText: false,
      });
    }
  });

  it("returns the dedicated telemetry DTO", async () => {
    mocks.getRunTelemetry.mockResolvedValue({
      apiVersion: "verdict-run-telemetry.v1",
      runId: "run-1",
      measurementState: "UNAVAILABLE",
      summary: {},
    });
    const app = Fastify();
    await app.register(verdictRuntimeRoutes);

    const response = await app.inject({
      method: "GET",
      url: "/runtime/runs/run-1/telemetry",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      apiVersion: "verdict-run-telemetry.v1",
      runId: "run-1",
    });
    await app.close();
  });

  it("distinguishes missing runs from unavailable storage", async () => {
    const missingApp = Fastify();
    mocks.getRunTelemetry.mockResolvedValueOnce(null);
    await missingApp.register(verdictRuntimeRoutes);
    const missing = await missingApp.inject({
      method: "GET",
      url: "/runtime/runs/missing/telemetry",
    });
    expect(missing.statusCode).toBe(404);
    await missingApp.close();

    const unavailableApp = Fastify();
    mocks.getRunTelemetry.mockRejectedValueOnce(new Error("db offline"));
    await unavailableApp.register(verdictRuntimeRoutes);
    const unavailable = await unavailableApp.inject({
      method: "GET",
      url: "/runtime/runs/run-1/telemetry",
    });
    expect(unavailable.statusCode).toBe(503);
    expect(unavailable.json()).toMatchObject({ status: "unavailable" });
    await unavailableApp.close();
  });
});
