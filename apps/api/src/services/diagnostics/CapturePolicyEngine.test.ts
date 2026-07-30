import { describe, expect, it } from "vitest";
import {
  CapturePolicyEngine,
  DEFAULT_DIAGNOSTIC_CAPTURE_POLICY,
  type DiagnosticCaptureAudit,
  type DiagnosticHealthSnapshot,
  type DiagnosticOsExecutor,
  type MemoryPressureDetected,
} from "./CapturePolicyEngine.js";

function policy(overrides?: {
  d1Quota?: number;
  d1CooldownMs?: number;
  d2Enabled?: boolean;
  d3Enabled?: boolean;
}) {
  return {
    enabled: {
      ...DEFAULT_DIAGNOSTIC_CAPTURE_POLICY.enabled,
      D2_PERFETTO:
        overrides?.d2Enabled ?? DEFAULT_DIAGNOSTIC_CAPTURE_POLICY.enabled.D2_PERFETTO,
      D3_HEAPDUMP:
        overrides?.d3Enabled ?? DEFAULT_DIAGNOSTIC_CAPTURE_POLICY.enabled.D3_HEAPDUMP,
    },
    cooldownMs: {
      ...DEFAULT_DIAGNOSTIC_CAPTURE_POLICY.cooldownMs,
      D1_MEMINFO:
        overrides?.d1CooldownMs ??
        DEFAULT_DIAGNOSTIC_CAPTURE_POLICY.cooldownMs.D1_MEMINFO,
    },
    quotaPerRun: {
      ...DEFAULT_DIAGNOSTIC_CAPTURE_POLICY.quotaPerRun,
      D1_MEMINFO:
        overrides?.d1Quota ?? DEFAULT_DIAGNOSTIC_CAPTURE_POLICY.quotaPerRun.D1_MEMINFO,
    },
    inhibitDuringCriticalSpan: true,
    minFreeSpaceMultiplier: 3,
  };
}

function context(
  overrides: Partial<MemoryPressureDetected> = {},
): MemoryPressureDetected {
  return {
    event: "MEMORY_PRESSURE_DETECTED",
    serial: "emulator-5554",
    packageName: "com.arasdigital.nesymobile.automation",
    runId: "run-1",
    sessionId: "session-1",
    screen: "DeliveryScreen",
    operation: "loadDeliveries",
    spanId: "span-42",
    buildProfile: "test",
    requestedBy: "cockpit-user",
    memoryBeforeMb: 100,
    memoryPeakMb: 120,
    ...overrides,
  };
}

function fixture(options?: {
  health?: Partial<DiagnosticHealthSnapshot>;
  capturePolicy?: ReturnType<typeof policy>;
}) {
  let now = 1_000_000;
  let captureSequence = 0;
  let markerSequence = 9000;
  let freeBytes = 1024 * 1024 * 1024;
  const audits: DiagnosticCaptureAudit[] = [];
  const osCalls: string[] = [];
  const markerLabels: string[] = [];
  const currentHealth: DiagnosticHealthSnapshot = {
    pid: 321,
    apiLevel: 35,
    profileable: true,
    inCriticalSpan: false,
    screen: "DeliveryScreen",
    operation: "loadDeliveries",
    spanId: "span-42",
    ...options?.health,
  };

  const diagnostics: DiagnosticOsExecutor = {
    async captureMeminfo(input) {
      osCalls.push(`meminfo:${input.pid}`);
      return { artifactPath: `/artifacts/${input.captureId}/meminfo.txt` };
    },
    async capturePerfetto(input) {
      osCalls.push("perfetto");
      return { artifactPath: `/artifacts/${input.captureId}/trace.perfetto-trace` };
    },
    async captureHeapDump(input) {
      osCalls.push(`heap:${input.packageName}`);
      return { artifactPath: `/artifacts/${input.captureId}/heap.hprof` };
    },
    async deviceFreeBytes() {
      return freeBytes;
    },
    async storeMappingFile(captureId) {
      return `/artifacts/${captureId}/mapping.txt`;
    },
  };

  const engine = new CapturePolicyEngine({
    diagnostics,
    healthProbe: {
      async getHealth() {
        return { ...currentHealth };
      },
    },
    markerGateway: {
      async markDiagnostic(input) {
        markerLabels.push(input.label);
        markerSequence += 1;
        return String(markerSequence);
      },
    },
    auditSink: {
      async record(audit) {
        audits.push(audit);
      },
    },
    policy: options?.capturePolicy,
    now: () => now,
    newCaptureId: () => {
      captureSequence += 1;
      return `cap-${captureSequence}`;
    },
  });

  return {
    engine,
    audits,
    osCalls,
    markerLabels,
    health: currentHealth,
    advance(ms: number) {
      now += ms;
    },
    setFreeBytes(value: number) {
      freeBytes = value;
    },
  };
}

describe("CapturePolicyEngine ladder", () => {
  it("takes D1 on first pressure and adds D2 on the second consecutive pressure in the same span", async () => {
    const f = fixture();

    const first = await f.engine.onMemoryPressure(context());
    const second = await f.engine.onMemoryPressure(context());

    expect(first.map((outcome) => outcome.status)).toEqual(["captured"]);
    expect(second.map((outcome) => [outcome.status, outcome.level])).toEqual([
      ["skipped", "D1_MEMINFO"],
      ["captured", "D2_PERFETTO"],
    ]);
    expect(f.osCalls).toEqual(["meminfo:321", "perfetto"]);
    expect(f.markerLabels).toEqual([
      "meminfo_pre",
      "meminfo_post",
      "perfetto_pre",
      "perfetto_post",
    ]);
    expect(f.audits.some((audit) => audit.level === "D3_HEAPDUMP")).toBe(false);
  });

  it("earns D2 immediately when a span grows by more than 64 MiB", async () => {
    const f = fixture();

    const outcomes = await f.engine.onMemoryPressure(
      context({ memoryBeforeMb: 20, memoryPeakMb: 85 }),
    );

    expect(outcomes.map((outcome) => outcome.level)).toEqual([
      "D1_MEMINFO",
      "D2_PERFETTO",
    ]);
  });
});

describe("CapturePolicyEngine safety gates", () => {
  it("records CRITICAL-span skips and runs one deferred capture after get_health clears", async () => {
    const f = fixture({ health: { inCriticalSpan: true } });

    const blocked = await f.engine.onMemoryPressure(context());
    expect(blocked).toEqual([
      {
        status: "skipped",
        captureId: "cap-1",
        level: "D1_MEMINFO",
        skippedReason: "critical_span",
      },
    ]);
    expect(f.osCalls).toEqual([]);

    f.health.inCriticalSpan = false;
    const drained = await f.engine.drainCriticalSpanQueue("run-1");

    expect(drained[0]?.status).toBe("captured");
    expect(f.osCalls).toEqual(["meminfo:321"]);
    expect(f.audits.map((audit) => audit.status)).toEqual(["skipped", "captured"]);
  });

  it("uses get_health apiLevel/profileable and stops D2 below API 29", async () => {
    const f = fixture({ health: { apiLevel: 28, profileable: false } });

    const outcomes = await f.engine.onMemoryPressure(
      context({ memoryBeforeMb: 1, memoryPeakMb: 100 }),
    );

    expect(outcomes[0]?.status).toBe("captured");
    expect(outcomes[1]).toEqual({
      status: "skipped",
      captureId: "cap-2",
      level: "D2_PERFETTO",
      skippedReason: "api_too_low",
    });
    expect(f.osCalls).toEqual(["meminfo:321"]);
  });

  it("enforces D1 cooldown and then run quota with explicit skipped audits", async () => {
    const f = fixture({
      capturePolicy: policy({ d1Quota: 2, d1CooldownMs: 30_000, d2Enabled: false }),
    });

    expect((await f.engine.onMemoryPressure(context()))[0]?.status).toBe("captured");
    expect((await f.engine.onMemoryPressure(context({ spanId: "span-other" })))[0]).toMatchObject({
      status: "skipped",
      skippedReason: "cooldown",
    });

    f.advance(30_000);
    expect((await f.engine.onMemoryPressure(context({ spanId: "span-third" })))[0]?.status).toBe(
      "captured",
    );
    f.advance(30_000);
    expect((await f.engine.onMemoryPressure(context({ spanId: "span-fourth" })))[0]).toMatchObject({
      status: "skipped",
      skippedReason: "quota",
    });

    expect(f.audits.map((audit) => audit.skippedReason)).toEqual([
      null,
      "cooldown",
      null,
      "quota",
    ]);
  });

  it("keeps D3 explicit, checks 3x disk, stores mapping, and marks it sensitive", async () => {
    const f = fixture({ capturePolicy: policy({ d3Enabled: true }) });
    const request = {
      ...context(),
      mappingFilePath: "/build/outputs/mapping/automationRelease/mapping.txt",
      expectedDumpBytes: 200 * 1024 * 1024,
    };

    expect(await f.engine.requestHeapDump(request)).toMatchObject({
      status: "skipped",
      skippedReason: "opt_in_missing",
    });

    f.setFreeBytes(599 * 1024 * 1024);
    expect(
      await f.engine.requestHeapDump({
        ...request,
        optIn: { approvedBy: "qa-lead", approvedAt: new Date("2026-07-30T10:00:00Z") },
      }),
    ).toMatchObject({
      status: "skipped",
      skippedReason: "low_disk",
    });

    f.setFreeBytes(700 * 1024 * 1024);
    const captured = await f.engine.requestHeapDump({
      ...request,
      optIn: { approvedBy: "qa-lead", approvedAt: new Date("2026-07-30T10:00:00Z") },
    });

    expect(captured.status).toBe("captured");
    if (captured.status === "captured") {
      expect(captured.capture.sensitive).toBe(true);
      expect(captured.capture.mappingFileRef).toMatch(/mapping\.txt$/);
    }
    expect(f.osCalls).toContain("heap:com.arasdigital.nesymobile.automation");
    expect(f.audits.at(-1)).toMatchObject({
      status: "captured",
      sensitive: true,
      optInApprovedBy: "qa-lead",
    });
  });

  it("forbids D3 on automationRelease even with an approval", async () => {
    const f = fixture({ capturePolicy: policy({ d3Enabled: true }) });

    const outcome = await f.engine.requestHeapDump({
      ...context({ buildProfile: "automationRelease" }),
      optIn: { approvedBy: "qa-lead", approvedAt: new Date() },
    });

    expect(outcome).toMatchObject({
      status: "skipped",
      skippedReason: "opt_in_missing",
    });
    expect(f.osCalls).toEqual([]);
  });
});
