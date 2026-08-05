import { describe, expect, it } from "vitest";
import * as CompilerExports from "./index.js";
import { scanExportSurface, findDomainLeakage } from "@nesy/workflow-contract";
import type { BridgeFlowPlan } from "./bridgeflow-plan.js";

describe("@nesy/bridgeflow-compiler", () => {
  // ─── 4C.19 Domain leakage guard ─────────────────────────────────
  describe("4C.19 domain leakage guard", () => {
    it("exports no domain business tokens", () => {
      const hits = scanExportSurface("@nesy/bridgeflow-compiler", CompilerExports as unknown as Record<string, unknown>);
      expect(hits).toEqual([]);
    });

    it("exports no executor/runtime types", () => {
      const forbidden = [
        "BridgeFlowExecutor",
        "executePlan",
        "dispatchBridgeCommand",
        "dispatchSdkCommand",
        "DeviceWorker",
        "RunLease",
        "TestExecutionQueue",
        "TestDataBroker",
        "WorkerHeartbeat",
      ];
      const found = Object.keys(CompilerExports).filter((name) => forbidden.includes(name));
      expect(found).toEqual([]);
    });

    it("detects known domain tokens in text", () => {
      expect(findDomainLeakage("OPEN_STOP", "test").map((h) => h.token)).toContain("OPEN_STOP");
      expect(findDomainLeakage("courierLogin", "test").map((h) => h.token)).toContain("COURIER");
      expect(findDomainLeakage("parcelCount", "test").map((h) => h.token)).toContain("PARCEL");
    });

    it("does not flag generic compiler terms", () => {
      const safe = ["BridgeFlowPlan", "CompileResult", "CompiledUiWaitPlan", "CompileIssue", "canonicalizePlanDocument"];
      for (const term of safe) {
        expect(findDomainLeakage(term, "test")).toEqual([]);
      }
    });
  });

  // ─── Canonical determinism ──────────────────────────────────────
  describe("canonical determinism", () => {
    it("produces identical output for key-reordered objects", () => {
      const a = { z: 1, a: 2, m: { c: 3, b: 4 } };
      const b = { a: 2, m: { b: 4, c: 3 }, z: 1 };
      expect(CompilerExports.canonicalizePlanDocument(a)).toBe(CompilerExports.canonicalizePlanDocument(b));
    });

    it("drops undefined but preserves null", () => {
      const a = { x: 1, y: undefined };
      const b = { x: 1, z: null };
      expect(CompilerExports.canonicalizePlanDocument(a)).toBe('{"x":1}');
      expect(CompilerExports.canonicalizePlanDocument(b)).toBe('{"x":1,"z":null}');
    });

    it("refuses NaN", () => {
      expect(() => CompilerExports.canonicalizePlanDocument({ x: Number.NaN })).toThrow(/non-finite/);
    });

    it("refuses Infinity", () => {
      expect(() => CompilerExports.canonicalizePlanDocument({ x: Infinity })).toThrow(/non-finite/);
    });

    it("preserves array order", () => {
      const a = { items: [3, 1, 2] };
      expect(CompilerExports.canonicalizePlanDocument(a)).toBe('{"items":[3,1,2]}');
    });

    it("digestPlanDocument is stable", () => {
      const doc = { a: 1, b: 2 };
      expect(CompilerExports.digestPlanDocument(doc)).toBe(CompilerExports.digestPlanDocument(doc));
    });

    it("digestPlanDocument uses sha256 prefix", () => {
      const digest = CompilerExports.digestPlanDocument({ test: true });
      expect(digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    });

    it("planDocumentsEqual ignores key order", () => {
      const a = { z: 1, a: 2 };
      const b = { a: 2, z: 1 };
      expect(CompilerExports.planDocumentsEqual(a, b)).toBe(true);
    });

    it("planDocumentsEqual detects value differences", () => {
      const a = { x: 1 };
      const b = { x: 2 };
      expect(CompilerExports.planDocumentsEqual(a, b)).toBe(false);
    });

    it("computePlanHash ignores compiledAt audit metadata", () => {
      const basePlan = makeHashablePlan();
      const first = CompilerExports.computePlanHash({
        ...basePlan,
        provenance: { ...basePlan.provenance, compiledAt: "2026-08-05T12:00:00.000Z" },
      });
      const second = CompilerExports.computePlanHash({
        ...basePlan,
        provenance: { ...basePlan.provenance, compiledAt: "2026-08-05T12:05:00.000Z" },
      });

      expect(first).toEqual(second);
    });

    it("computePlanHash changes when executable plan content changes", () => {
      const basePlan = makeHashablePlan();
      const first = CompilerExports.computePlanHash(basePlan);
      const second = CompilerExports.computePlanHash({
        ...basePlan,
        entryStepId: "different-entry",
      });

      expect(first).not.toEqual(second);
    });
  });

  // ─── Compile issues ─────────────────────────────────────────────
  describe("compile issues", () => {
    it("createIssue sets severity from COMPILE_ISSUE_SEVERITIES", () => {
      const issue = CompilerExports.createIssue("UNKNOWN_MACRO", "test message");
      expect(issue.severity).toBe("ERROR");
      expect(issue.code).toBe("UNKNOWN_MACRO");
      expect(issue.message).toBe("test message");
    });

    it("createIssue with options", () => {
      const issue = CompilerExports.createIssue("WEAK_TARGET_ROW_INDEX", "row index only", {
        path: "steps[0].targetRef",
        sourceRef: "target-1",
        suggestion: "Add ACCESSIBILITY_ID",
      });
      expect(issue.severity).toBe("WARNING");
      expect(issue.path).toBe("steps[0].targetRef");
      expect(issue.sourceRef).toBe("target-1");
      expect(issue.suggestion).toBe("Add ACCESSIBILITY_ID");
    });

    it("hasErrors detects errors", () => {
      expect(CompilerExports.hasErrors([CompilerExports.createIssue("UNKNOWN_MACRO", "fail")])).toBe(true);
    });

    it("hasErrors returns false for warnings only", () => {
      expect(CompilerExports.hasErrors([CompilerExports.createIssue("WEAK_TARGET_ROW_INDEX", "warn")])).toBe(false);
    });

    it("hasErrors returns false for empty", () => {
      expect(CompilerExports.hasErrors([])).toBe(false);
    });

    it("COMPILE_ISSUE_SEVERITIES covers all issue codes", () => {
      // Every code should have a severity mapping
      const severities = CompilerExports.COMPILE_ISSUE_SEVERITIES;
      expect(Object.keys(severities).length).toBeGreaterThan(30);
      for (const severity of Object.values(severities)) {
        expect(["ERROR", "WARNING", "INFO"]).toContain(severity);
      }
    });
  });

  // ─── Contract type surface ──────────────────────────────────────
  describe("contract type surface", () => {
    it("BRIDGEFLOW_PLAN_SCHEMA_VERSION is 1", () => {
      expect(CompilerExports.BRIDGEFLOW_PLAN_SCHEMA_VERSION).toBe(1);
    });

    it("FULL_DUMP_HOT_PATH_FORBIDDEN is true", () => {
      expect(CompilerExports.FULL_DUMP_HOT_PATH_FORBIDDEN).toBe(true);
    });

    it("FACT_DELIVERY_LANES contains exactly two lanes", () => {
      expect(CompilerExports.FACT_DELIVERY_LANES).toEqual(["RECEIPT_SAFE", "ORDERED_REQUIRED"]);
    });

    it("AMBIGUITY_POLICIES contains exactly three policies", () => {
      expect(CompilerExports.AMBIGUITY_POLICIES).toEqual(["FAIL", "OPERATOR_ATTENTION", "BEST_CANDIDATE"]);
    });

    it("DEPENDENCY_FAILURE_MODEL is BLOCKED", () => {
      expect(CompilerExports.DEPENDENCY_FAILURE_MODEL).toBe("BLOCKED");
    });

    it("exports compileDomainWorkflow function", () => {
      expect(typeof CompilerExports.compileDomainWorkflow).toBe("function");
    });

    it("exports compileTestProfile function", () => {
      expect(typeof CompilerExports.compileTestProfile).toBe("function");
    });

    it("exports previewCompile function", () => {
      expect(typeof CompilerExports.previewCompile).toBe("function");
    });

    it("exports validateDomainMacros function", () => {
      expect(typeof CompilerExports.validateDomainMacros).toBe("function");
    });

    it("exports compileWorkflowIr function", () => {
      expect(typeof CompilerExports.compileWorkflowIr).toBe("function");
    });

    it("exports generatePreview function", () => {
      expect(typeof CompilerExports.generatePreview).toBe("function");
    });

    it("exports buildProvenance function", () => {
      expect(typeof CompilerExports.buildProvenance).toBe("function");
    });

    it("does not export its internal domain guard token list", () => {
      expect("FORBIDDEN_COMPILER_BUSINESS_TOKENS" in CompilerExports).toBe(false);
    });

    it("does not export its internal executor guard token list", () => {
      expect("FORBIDDEN_EXECUTOR_EXPORTS" in CompilerExports).toBe(false);
    });

    it("scanForExecutorLeakage detects forbidden executor exports", () => {
      const issues: CompilerExports.CompileIssue[] = [];
      CompilerExports.scanForExecutorLeakage("test.module", { executePlan: () => undefined }, issues);

      expect(issues.map((issue) => issue.code)).toContain("COMPILER_EXECUTOR_EXPORT");
    });
  });

  // ─── Control flow validation ────────────────────────────────────
  describe("control flow constants", () => {
    it("MAX_ALLOWED_ITERATIONS is a reasonable bound", () => {
      expect(CompilerExports.MAX_ALLOWED_ITERATIONS).toBe(10_000);
    });

    it("MAX_STEP_TIMEOUT_MS is 10 minutes", () => {
      expect(CompilerExports.MAX_STEP_TIMEOUT_MS).toBe(600_000);
    });
  });

  // ─── Provenance ────────────────────────────────────────────────
  describe("provenance", () => {
    it("buildProvenance sets compilerVersion", () => {
      const p = CompilerExports.buildProvenance({
        packKey: "test.pack",
        packVersion: "1.0.0",
        packDigest: "sha256:abc",
        workflowRef: "test.workflow",
        workflowVersion: 1,
        irHash: "sha256:def",
        derivedGraphDigest: "sha256:ghi",
      });
      expect(p.compilerVersion).toBe("0.1.0");
      expect(p.packKey).toBe("test.pack");
      expect(p.compiledAt).toBeDefined();
    });
  });
});

function makeHashablePlan(): Omit<BridgeFlowPlan, "hash"> {
  return {
    schemaVersion: 1,
    planId: "bfp-test-1",
    provenance: {
      compiledAt: "2026-08-05T12:00:00.000Z",
      compilerVersion: "0.1.0",
      packKey: "test.pack",
      packVersion: "1.0.0",
      packDigest: "sha256:pack",
      workflowRef: "test.workflow",
      workflowVersion: 1,
      irHash: "sha256:ir",
      derivedGraphDigest: "sha256:derived",
    },
    packVersion: { major: 1, minor: 0, patch: 0 },
    packDigest: "sha256:pack",
    workflowRef: "test.workflow",
    workflowVersion: 1,
    appCompatibilityRefs: ["test.app"],
    adapterCompatibilityRefs: [],
    steps: [],
    entryStepId: "entry",
    waitPlans: [],
    capabilityManifest: {
      required: [],
      optional: [],
      gaps: [],
    },
    evidenceManifest: {
      continueGateRequirements: [],
      finalOracleRequirements: [],
      derivedGraphDigest: "sha256:derived",
      factDeliveryLanes: [],
    },
    resourceRequirements: [],
    domainDependencies: [],
    sourceMap: [],
  };
}
