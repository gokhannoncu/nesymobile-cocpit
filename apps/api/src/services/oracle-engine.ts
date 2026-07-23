/**
 * Oracle Engine — decides node success from MULTIPLE independent signals
 * instead of a single source of truth.
 *
 * Three oracle kinds:
 * - "ui"          Maestro executed the node's commands (NESY_STEP::DONE marker)
 * - "mobileEvent" the app reported the business action via the test bridge
 *                 (logcat NESY_AUTO_BRIDGE / structured NESY_TEST_EVENT)
 * - "backend"     the app confirmed the backend accepted the operation
 *                 (e.g. DELIVER_PARCEL step=BACKEND_CONFIRMED)
 *
 * Each node type has a default completion policy (which oracles are REQUIRED
 * before the step counts as passed); workflow editors can override it per
 * node via `data.config.completionPolicy.required`.
 *
 * At run end `finalizeRun` produces the fusion verdict: a step whose UI
 * commands succeeded but whose required business event never arrived is
 * FAILED with an explicit "UI passed but ..." message, and every step gets an
 * evidence table in its output.
 */

import { prisma } from "@nesy/db";
import type { LogcatEvent } from "./logcat-sniffer.js";
import type { TestBridgeEvent } from "./test-event-bridge.js";

export type OracleKind = "ui" | "mobileEvent" | "backend";

export interface NodeCompletionPolicy {
  /** Oracles that must ALL pass for the step to be marked success. */
  required: OracleKind[];
}

export interface OracleEvidence {
  oracle: OracleKind;
  status: "passed" | "failed" | "pending";
  detail: string;
  at: number;
}

/**
 * Default policies — mirrors the pre-refactor behavior of the per-node-type
 * logcat handlers that used to live inline in workflow-runner.ts.
 */
export const DEFAULT_COMPLETION_POLICIES: Record<string, NodeCompletionPolicy> = {
  DELIVERY_OPERATION: { required: ["ui", "mobileEvent", "backend"] },
  // Multi-barcode loads: per-parcel GENERIC_ERROR is non-fatal; UI completion
  // of the Maestro loop is the gate. mobileEvent still recorded when a parcel
  // pipeline succeeds, but is no longer required for the node to pass.
  LOAD_TO_VEHICLE: { required: ["ui"] },
  SCAN_BARCODE: { required: ["ui", "mobileEvent"] },
  // UI soft-assert + post-Maestro server step (device JWT + GET_KEY →
  // GetMyScheduleByZoneCode). Run stays open until backend oracle resolves.
  VALIDATE_STOPLIST: { required: ["ui", "backend"] },
  // Tour-start notification / logcat can race; UI tap of btn_out is enough —
  // TOUR_APPROVE server step confirms the leaving-request was created.
  REQUEST_TOUR_START: { required: ["ui"] },
  OPEN_SHIPMENT: { required: ["ui", "mobileEvent"] },
  OPEN_PARCEL: { required: ["ui", "mobileEvent"] },
  VERIFY_BACKEND_STATE: { required: ["backend"] },
  // Server-side approval / schedule steps (server-steps.ts) resolve "backend".
  TOUR_APPROVE: { required: ["backend"] },
  PICKUP_ASSIGN: { required: ["backend"] },
  EOD_APPROVE: { required: ["backend"] },
};

const DEFAULT_POLICY: NodeCompletionPolicy = { required: ["ui"] };

const ORACLE_KINDS: OracleKind[] = ["ui", "mobileEvent", "backend"];

function isOracleKind(value: unknown): value is OracleKind {
  return typeof value === "string" && (ORACLE_KINDS as string[]).includes(value);
}

/** Dialog strategy — mirrors frontend DIALOG_STRATEGY from yaml-registry. */
const DIALOG_STRATEGY: Record<string, { flowContinues: boolean }> = {
  HUB_WARNING:         { flowContinues: true },
  DELY_DELR_STOR_LOST: { flowContinues: false },
  NETWORK_ERROR:       { flowContinues: false },
  // Multi-barcode LOAD continues past per-parcel business dialogs (already
  // loaded / zone mismatch / etc.). Pipeline SUCCESS still gates the node.
  GENERIC_ERROR:       { flowContinues: true },
};

const LOAD_TO_VEHICLE_REQUIRED_STEPS = ["FETCH_SHIPMENT", "CREATE_TASK", "FETCH_SCHEDULE"] as const;

interface LoadToVehicleEvent {
  status: string;
  raw: string;
  dialog?: string;
  message?: string;
  userChoice?: string;
}

interface LoadToVehicleTaskState {
  steps: Map<string, LoadToVehicleEvent>;
  dialogLog: LoadToVehicleEvent[];
  terminalFailure: boolean;
  terminalErrorMessage?: string;
}

interface OracleNode {
  id: string;
  type: string;
  config?: Record<string, unknown>;
}

type SnifferRegistrar = (event: string, fn: (...args: never[]) => void) => void;

export class OracleEngine {
  private readonly runId: string;
  private readonly nodesByType = new Map<string, OracleNode[]>();
  private readonly policyByNodeId = new Map<string, NodeCompletionPolicy>();
  /** nodeId → oracle → evidence (latest wins per oracle). */
  private readonly evidence = new Map<string, Map<OracleKind, OracleEvidence>>();
  private readonly loadToVehicleTracker = new Map<string, LoadToVehicleTaskState>();

  constructor(runId: string, nodes: Array<{ id: string; type: string; data?: { config?: Record<string, unknown> } }>) {
    this.runId = runId;
    for (const node of nodes) {
      const entry: OracleNode = { id: node.id, type: node.type, config: node.data?.config };
      const list = this.nodesByType.get(node.type) ?? [];
      list.push(entry);
      this.nodesByType.set(node.type, list);
      this.policyByNodeId.set(node.id, resolvePolicy(node.type, node.data?.config));
    }
  }

  policyFor(nodeId: string): NodeCompletionPolicy {
    return this.policyByNodeId.get(nodeId) ?? DEFAULT_POLICY;
  }

  /** Latest backend oracle evidence for a node (used by the Backend Validations lane). */
  getBackendOracle(nodeId: string): { status: OracleEvidence["status"]; detail: string } | null {
    const evidence = this.evidence.get(nodeId)?.get("backend");
    if (!evidence) return null;
    return { status: evidence.status, detail: evidence.detail };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Evidence recording + step finalization
  // ───────────────────────────────────────────────────────────────────────────

  private record(nodeId: string, oracle: OracleKind, status: OracleEvidence["status"], detail: string): void {
    let byOracle = this.evidence.get(nodeId);
    if (!byOracle) {
      byOracle = new Map();
      this.evidence.set(nodeId, byOracle);
    }
    byOracle.set(oracle, { oracle, status, detail, at: Date.now() });
  }

  private evidenceTable(nodeId: string): OracleEvidence[] {
    const byOracle = this.evidence.get(nodeId);
    if (!byOracle) return [];
    return [...byOracle.values()].sort((a, b) => a.at - b.at);
  }

  private verdict(nodeId: string): { complete: boolean; failed: boolean; missing: OracleKind[]; failedOracles: OracleKind[] } {
    const policy = this.policyFor(nodeId);
    const byOracle = this.evidence.get(nodeId) ?? new Map<OracleKind, OracleEvidence>();

    const failedOracles = policy.required.filter((k) => byOracle.get(k)?.status === "failed");
    const missing = policy.required.filter((k) => {
      const status = byOracle.get(k)?.status;
      return status !== "passed" && status !== "failed";
    });

    return {
      complete: missing.length === 0,
      failed: failedOracles.length > 0,
      missing,
      failedOracles,
    };
  }

  private buildOutput(nodeId: string, summary: string): string {
    return JSON.stringify({
      summary,
      oracles: this.evidenceTable(nodeId).map((e) => ({
        oracle: e.oracle,
        status: e.status,
        detail: e.detail,
      })),
      completionPolicy: this.policyFor(nodeId).required,
    });
  }

  /** Applies the current verdict to the DB step when all required oracles resolved. */
  private async finalizeStepIfComplete(nodeId: string): Promise<void> {
    const { complete, failed, failedOracles } = this.verdict(nodeId);
    if (!complete && !failed) return;

    if (failed) {
      const detail = failedOracles
        .map((k) => this.evidence.get(nodeId)?.get(k)?.detail)
        .filter(Boolean)
        .join(" | ");
      await prisma.workflowStepResult.updateMany({
        where: { runId: this.runId, nodeId, status: { in: ["running", "pending"] } },
        data: {
          status: "failed",
          completedAt: new Date(),
          errorMessage: detail || `Oracle(s) failed: ${failedOracles.join(", ")}`,
          output: this.buildOutput(nodeId, "failed"),
        },
      });
      return;
    }

    await prisma.workflowStepResult.updateMany({
      where: { runId: this.runId, nodeId, status: { in: ["running", "pending"] } },
      data: {
        status: "success",
        completedAt: new Date(),
        errorMessage: null,
        output: this.buildOutput(nodeId, "all required oracles passed"),
      },
    });
  }

  private nodeIdsOfTypes(types: string[]): string[] {
    return types.flatMap((t) => (this.nodesByType.get(t) ?? []).map((n) => n.id));
  }

  /**
   * Records evidence for every node of the given types and finalizes the ones
   * whose policy is now satisfied. Most bridge events don't carry a nodeId, so
   * type-level attribution (single active run per device, sequential queue)
   * is the correct granularity — same as the pre-refactor handlers.
   */
  private async recordForTypes(
    types: string[],
    oracle: OracleKind,
    status: OracleEvidence["status"],
    detail: string,
  ): Promise<void> {
    for (const nodeId of this.nodeIdsOfTypes(types)) {
      this.record(nodeId, oracle, status, detail);
      await this.finalizeStepIfComplete(nodeId);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // UI oracle — fed by Maestro NESY_STEP markers (via workflow-runner)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Returns true when the step may be marked success right away (policy needs
   * only the UI oracle); false when business confirmation is still pending —
   * the step then stays "running" until the event oracle resolves it.
   */
  async onUiStepDone(nodeId: string, warnings: number): Promise<boolean> {
    this.record(nodeId, "ui", "passed", warnings > 0 ? `Maestro step done (${warnings} warnings)` : "Maestro step done");
    const policy = this.policyFor(nodeId);
    const uiOnly = policy.required.every((k) => k === "ui");
    if (!uiOnly) {
      await this.finalizeStepIfComplete(nodeId);
    }
    return uiOnly;
  }

  onUiStepFailed(nodeId: string, message: string): void {
    this.record(nodeId, "ui", "failed", message);
  }

  /**
   * Records the server-side backend verification result (NESY_BACKEND_CHECK
   * poller or a server approval step) for a specific node and finalizes the
   * step if its policy is now satisfied.
   */
  async recordBackendVerification(nodeId: string, passed: boolean, detail: string): Promise<void> {
    this.record(nodeId, "backend", passed ? "passed" : "failed", detail);
    await this.finalizeStepIfComplete(nodeId);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Event oracles — logcat bridge handlers (moved from workflow-runner)
  // ───────────────────────────────────────────────────────────────────────────

  attach(onSniffer: SnifferRegistrar): void {
    onSniffer("verify", async (event: LogcatEvent) => {
      try {
        if (event.status === "SUCCESS") {
          await this.recordForTypes(["VERIFY_BACKEND_STATE"], "backend", "passed", `Verified via logcat: TASK_ID=${event.value}`);
        }
      } catch (err) {
        console.error("[OracleEngine] verify error:", err);
      }
    });

    onSniffer("validate_stoplist", async (event: LogcatEvent) => {
      try {
        if (event.status === "SUCCESS") {
          await this.recordForTypes(["VALIDATE_STOPLIST"], "mobileEvent", "passed", `Logcat result: ${event.raw}`);
        } else if (event.status === "FAIL" || event.status === "FAILED") {
          await this.recordForTypes(["VALIDATE_STOPLIST"], "mobileEvent", "failed", `Validation failed. Logcat: ${event.raw}`);
        }
      } catch (err) {
        console.error("[OracleEngine] validate_stoplist error:", err);
      }
    });

    onSniffer("request_tour_start", async (event: LogcatEvent) => {
      try {
        if (event.status === "SUCCESS") {
          await this.recordForTypes(["REQUEST_TOUR_START"], "mobileEvent", "passed", `Logcat result: ${event.raw}`);
        } else if (event.status === "FAIL" || event.status === "FAILED" || event.status === "ERROR") {
          await this.recordForTypes(["REQUEST_TOUR_START"], "mobileEvent", "failed", `Request Tour Start failed. Logcat: ${event.raw}`);
        }
      } catch (err) {
        console.error("[OracleEngine] request_tour_start error:", err);
      }
    });

    onSniffer("deliver_parcel", async (event: LogcatEvent) => {
      try {
        const step = typeof event.data?.step === "string" ? event.data.step : "";

        // COMPLETED = written to local queue — the UI/mobile part of delivery succeeded.
        if (step === "COMPLETED") {
          await this.recordForTypes(["DELIVERY_OPERATION"], "mobileEvent", "passed", `Delivery written to queue. ${event.raw}`);
          console.log(`[OracleEngine] DELIVER_PARCEL COMPLETED — waiting for backend confirmation...`);
          return;
        }

        if (step === "BACKEND_CONFIRMED") {
          await this.recordForTypes(["DELIVERY_OPERATION"], "backend", "passed", `Backend confirmed. Logcat: ${event.raw}`);
          return;
        }

        if (step === "BACKEND_RETRY") {
          console.warn(`[OracleEngine] DELIVER_PARCEL BACKEND_RETRY: ${event.raw}`);
          return;
        }

        if (step === "BACKEND_FAILED") {
          await this.recordForTypes(["DELIVERY_OPERATION"], "backend", "failed", `Backend failed. Logcat: ${event.raw}`);
          return;
        }

        // Legacy format fallback (no step field, only SUCCESS/ERROR)
        if (event.status === "SUCCESS") {
          await this.recordForTypes(["DELIVERY_OPERATION"], "mobileEvent", "passed", `Logcat result: ${event.raw}`);
          await this.recordForTypes(["DELIVERY_OPERATION"], "backend", "passed", `Legacy SUCCESS event (no step detail). ${event.raw}`);
        } else if (event.status === "FAIL" || event.status === "FAILED" || event.status === "ERROR") {
          await this.recordForTypes(["DELIVERY_OPERATION"], "mobileEvent", "failed", `Deliver parcel failed. Logcat: ${event.raw}`);
        }
      } catch (err) {
        console.error("[OracleEngine] deliver_parcel error:", err);
      }
    });

    onSniffer("scan_parcel", async (event: LogcatEvent) => {
      try {
        if (event.status === "SUCCESS") {
          await this.recordForTypes(["SCAN_BARCODE"], "mobileEvent", "passed", `Logcat result: ${event.raw}`);
        } else if (event.status === "FAIL" || event.status === "FAILED" || event.status === "ERROR") {
          await this.recordForTypes(["SCAN_BARCODE"], "mobileEvent", "failed", `Scan barcode failed. Logcat: ${event.raw}`);
        }
      } catch (err) {
        console.error("[OracleEngine] scan_parcel error:", err);
      }
    });

    // LOAD_TO_VEHICLE sub-step + dialog tracking.
    // The ScanProcessor pipeline emits 3 sequential logcat events per barcode scan:
    //   FETCH_SHIPMENT -> CREATE_TASK -> FETCH_SCHEDULE
    // Each step can trigger ArasDialog; DIALOG_DISMISSED with flowContinues=false
    // is a terminal failure, ERROR alone is not (a dialog might resolve it).
    onSniffer("load_to_vehicle", async (event: LogcatEvent) => {
      try {
        await this.handleLoadToVehicle(event);
      } catch (err) {
        console.error("[OracleEngine] load_to_vehicle error:", err);
      }
    });

    onSniffer("search_stop", async (event: LogcatEvent) => {
      try {
        if (event.status === "ERROR") {
          await this.recordForTypes(
            ["OPEN_SHIPMENT", "OPEN_PARCEL"],
            "mobileEvent",
            "failed",
            `Search returned no results. Query: ${event.taskId ?? "—"}. ${event.raw}`,
          );
        } else if (event.status === "SUCCESS") {
          const resultCount = typeof event.data?.result_count === "string" ? event.data.result_count : "?";
          console.log(`[OracleEngine] SEARCH_STOP success: query=${event.taskId}, results=${resultCount}`);
        }
      } catch (err) {
        console.error("[OracleEngine] search_stop error:", err);
      }
    });

    onSniffer("open_stop", async (event: LogcatEvent) => {
      try {
        if (event.status === "SUCCESS") {
          await this.recordForTypes(
            ["OPEN_SHIPMENT", "OPEN_PARCEL"],
            "mobileEvent",
            "passed",
            `Stop opened successfully. Stop ID: ${event.taskId ?? "—"}. ${event.raw}`,
          );
        }
      } catch (err) {
        console.error("[OracleEngine] open_stop error:", err);
      }
    });

    onSniffer("device_error", async (event: LogcatEvent) => {
      try {
        await prisma.workflowStepResult.updateMany({
          where: { runId: this.runId, status: "running" },
          data: {
            status: "failed",
            completedAt: new Date(),
            errorMessage: `Device error: ${event.value}`,
          },
        });
      } catch (err) {
        console.error("[OracleEngine] device_error handling failed:", err);
      }
    });

    // BRIDGE_INIT mid-run = the app process restarted (clearState node or crash recovery).
    onSniffer("bridge_init", (event: TestBridgeEvent) => {
      console.log(
        `[OracleEngine] BRIDGE_INIT: app (re)started — session=${event.sessionId}, ` +
        `version=${event.data?.app_version ?? "?"}, flavor=${event.data?.flavor ?? "?"}`,
      );
    });

    // APP_CRASHED is written synchronously on the crashing thread — the most
    // reliable "the app died" signal we have.
    onSniffer("app_crashed", async (event: TestBridgeEvent) => {
      try {
        const summary = `App crashed: ${event.data?.exception ?? "unknown"} — ${event.data?.message ?? ""} ` +
          `(thread=${event.data?.thread ?? "?"}, screen=${event.screen})`;
        console.error(`[OracleEngine] ${summary}`);

        await prisma.workflowStepResult.updateMany({
          where: { runId: this.runId, status: "running" },
          data: {
            status: "failed",
            completedAt: new Date(),
            errorMessage: summary,
            output: event.raw,
          },
        });
      } catch (err) {
        console.error("[OracleEngine] APP_CRASHED handling failed:", err);
      }
    });
  }

  private async handleLoadToVehicle(event: LogcatEvent): Promise<void> {
    const taskId = event.taskId ?? "unknown";
    const subStep = typeof event.data?.step === "string" ? event.data.step : null;
    const dialogType = typeof event.data?.dialog === "string" ? event.data.dialog : null;
    const dialogMessage = typeof event.data?.message === "string" ? event.data.message : undefined;
    const userChoice = typeof event.data?.user_choice === "string" ? event.data.user_choice : undefined;

    let state = this.loadToVehicleTracker.get(taskId);
    if (!state) {
      state = { steps: new Map(), dialogLog: [], terminalFailure: false };
      this.loadToVehicleTracker.set(taskId, state);
    }
    if (state.terminalFailure) return;

    const eventEntry: LoadToVehicleEvent = {
      status: event.status,
      raw: event.raw,
      dialog: dialogType ?? undefined,
      message: dialogMessage,
      userChoice,
    };

    console.log(
      `[OracleEngine] LOAD_TO_VEHICLE [${taskId}] status=${event.status} step=${subStep ?? "—"} dialog=${dialogType ?? "—"}`,
    );

    if (event.status === "DIALOG_SHOWN") {
      state.dialogLog.push(eventEntry);
      return;
    }

    if (event.status === "DIALOG_DISMISSED") {
      state.dialogLog.push(eventEntry);
      const strategy = dialogType ? DIALOG_STRATEGY[dialogType] : null;
      const flowContinues = strategy?.flowContinues ?? false;

      if (!flowContinues) {
        state.terminalFailure = true;
        state.terminalErrorMessage =
          `LOAD_TO_VEHICLE stopped: ${dialogType ?? "UNKNOWN"} dialog dismissed. ` +
          `Step: ${subStep ?? "—"}, TASK_ID: ${taskId}` +
          (dialogMessage ? `. Message: ${dialogMessage}` : "");

        await this.recordForTypes(["LOAD_TO_VEHICLE"], "mobileEvent", "failed", state.terminalErrorMessage);
        this.loadToVehicleTracker.delete(taskId);
      }
      return;
    }

    // ERROR alone does NOT fail the node — a dialog might resolve it.
    if (event.status === "ERROR" || event.status === "FAIL" || event.status === "FAILED") {
      if (subStep) state.steps.set(subStep, eventEntry);
      return;
    }

    if (event.status === "SUCCESS" && subStep) {
      state.steps.set(subStep, eventEntry);

      const allReceived = LOAD_TO_VEHICLE_REQUIRED_STEPS.every((s) => state.steps.has(s));
      if (!allReceived) return;

      const allSuccess = LOAD_TO_VEHICLE_REQUIRED_STEPS.every((s) => state.steps.get(s)?.status === "SUCCESS");

      if (allSuccess) {
        await this.recordForTypes(
          ["LOAD_TO_VEHICLE"],
          "mobileEvent",
          "passed",
          `LOAD_TO_VEHICLE completed. TASK_ID: ${taskId}. Pipeline: ${LOAD_TO_VEHICLE_REQUIRED_STEPS.join(" → ")}` +
            (state.dialogLog.length > 0 ? ` (dialogs: ${state.dialogLog.map((d) => d.dialog).join(", ")})` : ""),
        );
      } else {
        const failedSteps = LOAD_TO_VEHICLE_REQUIRED_STEPS
          .filter((s) => state.steps.get(s)?.status !== "SUCCESS")
          .join(", ");
        await this.recordForTypes(
          ["LOAD_TO_VEHICLE"],
          "mobileEvent",
          "failed",
          `LOAD_TO_VEHICLE failed. TASK_ID: ${taskId}. Failed sub-steps: ${failedSteps}`,
        );
      }

      this.loadToVehicleTracker.delete(taskId);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Run finalization — the fusion verdict
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Resolves steps that are still "running" after Maestro exited: their UI
   * commands ran, but a required business/backend oracle never arrived.
   * Returns true when any step ended up failed (the run must not be green).
   */
  async finalizeRun(maestroSucceeded: boolean): Promise<{ oracleFailures: number }> {
    const openSteps = await prisma.workflowStepResult.findMany({
      where: { runId: this.runId, status: "running" },
      select: { id: true, nodeId: true, nodeType: true },
    });

    let oracleFailures = 0;

    for (const step of openSteps) {
      const { complete, failed, missing } = this.verdict(step.nodeId);

      if (failed) {
        oracleFailures += 1;
        // finalizeStepIfComplete would normally have caught this; make sure.
        await this.finalizeStepIfComplete(step.nodeId);
        continue;
      }

      if (complete) {
        await this.finalizeStepIfComplete(step.nodeId);
        continue;
      }

      if (!maestroSucceeded) {
        // Maestro itself failed — the generic runner handling marks these.
        continue;
      }

      // Fusion verdict: UI passed, required confirmation missing.
      oracleFailures += 1;
      const summary =
        `UI completed but required oracle(s) never confirmed: ${missing.join(", ")}. ` +
        `The on-screen flow looked successful while the business state was not verified.`;
      await prisma.workflowStepResult.updateMany({
        where: { id: step.id },
        data: {
          status: "failed",
          completedAt: new Date(),
          errorMessage: summary,
          output: this.buildOutput(step.nodeId, summary),
        },
      });
    }

    // Also surface failures recorded earlier (steps already marked failed by oracles).
    const failedSteps = await prisma.workflowStepResult.count({
      where: { runId: this.runId, status: "failed" },
    });

    return { oracleFailures: Math.max(oracleFailures, failedSteps > 0 ? 1 : 0) };
  }
}

function resolvePolicy(nodeType: string, config?: Record<string, unknown>): NodeCompletionPolicy {
  let policy = DEFAULT_COMPLETION_POLICIES[nodeType] ?? DEFAULT_POLICY;

  const override = config?.completionPolicy;
  if (override && typeof override === "object" && !Array.isArray(override)) {
    const required = (override as Record<string, unknown>).required;
    if (Array.isArray(required)) {
      const kinds = required.filter(isOracleKind);
      if (kinds.length > 0) policy = { required: kinds };
    }
  }

  // `verifyBackend: true` on a node makes the server-side backend event check a
  // hard requirement even for node types whose default policy omits it.
  if (config?.verifyBackend === true && !policy.required.includes("backend")) {
    policy = { required: [...policy.required, "backend"] };
  }

  return policy;
}
