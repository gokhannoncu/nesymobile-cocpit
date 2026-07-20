/**
 * Workflow Runner - Orchestrator
 *
 * Coordinates: YAML generation -> temp file -> Maestro spawn -> stdout parse -> DB step update -> cleanup
 *
 * YAML files are ephemeral: written to os.tmpdir() before execution, deleted after.
 * YAML content is persisted in WorkflowRun.yamlContent (DB).
 * On failure, Maestro debug screenshots are moved to maestro/run/DDMMYYYY-{slug}-NN.
 * On success, all temp artifacts are deleted — nothing stays on disk.
 */

import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { spawn, execSync } from "node:child_process";
import { prisma } from "@nesy/db";
import { generateWorkflowYaml, generatePartialWorkflowYaml, generateSingleNodeWorkflowYaml, resolveWorkflowAppId } from "./yaml-generator.js";
import {
  formatMaestroFailure,
  MaestroExecutor,
  type StepEvent,
} from "./maestro-executor.js";
import { LogcatSniffer, type LogcatEvent } from "./logcat-sniffer.js";
import { RunStore } from "./run-store.js";
import {
  setRunIdProperty,
  broadcastSetRun,
  getDeviceBridgeState,
  type TestBridgeEvent,
} from "./test-event-bridge.js";

const SCREENSHOT_BASE_DIR = path.resolve(process.cwd(), "maestro", "run");

type WorkflowRunnerNode = {
  id: string;
  type: string;
  kind: string;
  position: { x: number; y: number };
  data: { title: string; subtitle?: string; config?: Record<string, unknown> };
};

type WorkflowRunnerEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string | null;
  sourceHandle: "default" | "true" | "false";
  targetHandle: string | null;
  isPlaceholder?: boolean;
};

type BridgeEventPredicate = (event: LogcatEvent) => boolean;

const LOG_CONDITION_NODE_TYPES = new Set(["IF_LOGIN", "CHECK_ROUTE"]);

const BRIDGE_TIMEOUTS = {
  CHECK_LOGIN: 10_000,
  LOGIN_STATUS: 30_000,
  CHECK_ROUTE: 15_000,
  ROUTE_STATUS: 30_000,
} as const;

const ANDROID_SDK = path.join(os.homedir(), "Library", "Android", "sdk", "platform-tools");
const MAESTRO_BIN = path.join(os.homedir(), ".maestro", "bin");

function getEnhancedPath(): string {
  const current = process.env.PATH ?? "";
  const extras = [ANDROID_SDK, MAESTRO_BIN].filter((p) => fs.existsSync(p));
  if (extras.length === 0) return current;
  return [...extras, current].join(path.delimiter);
}

process.env.PATH = getEnhancedPath();

function formatDateDDMMYYYY(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}${mm}${yyyy}`;
}

function getNextRunNumber(baseDir: string, dateStr: string, slug: string): string {
  const prefix = `${dateStr}-${slug}-`;

  if (!fs.existsSync(baseDir)) return "01";

  const existing = fs
    .readdirSync(baseDir)
    .filter((name) => name.startsWith(prefix))
    .map((name) => {
      const suffix = name.slice(prefix.length);
      const num = parseInt(suffix, 10);
      return isNaN(num) ? 0 : num;
    });

  const max = existing.length > 0 ? Math.max(...existing) : 0;
  return String(max + 1).padStart(2, "0");
}

function cleanupPath(filePath: string): void {
  try {
    if (!fs.existsSync(filePath)) return;
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      fs.rmSync(filePath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(filePath);
    }
  } catch {
    // best-effort cleanup
  }
}

function hasLogConditionNodes(nodes: WorkflowRunnerNode[]): boolean {
  return nodes.some((node) => LOG_CONDITION_NODE_TYPES.has(node.type));
}

function getBooleanData(event: LogcatEvent, key: string): boolean | null {
  const value = event.data?.[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return null;
}

function getTargetNodeId(
  edges: WorkflowRunnerEdge[],
  sourceNodeId: string,
  sourceHandle: WorkflowRunnerEdge["sourceHandle"],
): string | null {
  return (
    edges.find(
      (edge) =>
        edge.sourceNodeId === sourceNodeId &&
        edge.sourceHandle === sourceHandle &&
        Boolean(edge.targetNodeId) &&
        !edge.isPlaceholder,
    )?.targetNodeId ?? null
  );
}

function collectReachableNodeIds(
  edges: WorkflowRunnerEdge[],
  startNodeId: string | null,
  stopAtNodeId?: string | null,
): string[] {
  if (!startNodeId) return [];

  const result: string[] = [];
  const visited = new Set<string>();

  function walk(nodeId: string): void {
    if (stopAtNodeId && nodeId === stopAtNodeId) return;
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    result.push(nodeId);

    const outgoing = edges.filter((edge) => edge.sourceNodeId === nodeId && edge.targetNodeId && !edge.isPlaceholder);
    for (const edge of outgoing) {
      if (edge.targetNodeId) walk(edge.targetNodeId);
    }
  }

  walk(startNodeId);
  return result;
}

export const WorkflowRunner = {
  async execute(runId: string): Promise<void> {
    const run = await prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        version: true,
        workflow: true,
      },
    });

    if (!run) throw new Error(`Run ${runId} not found`);

    const runDeviceId = run.deviceId ?? undefined;
    const nodes = run.version.nodes as WorkflowRunnerNode[];

    const edges = run.version.edges as WorkflowRunnerEdge[];

    // 1. Generate YAML content
    const yamlOptions = {
      workflowId: run.workflowId,
      runId: run.id,
      nodes,
      edges,
      environment: run.environment ?? undefined,
      country: run.country ?? undefined,
      config: (run.version.config as Record<string, unknown>) ?? undefined,
    };

    let yamlContent: string;

    if (run.mode === "single_step" && run.targetStepId) {
      yamlContent = generatePartialWorkflowYaml(yamlOptions, "single_step", run.targetStepId);
    } else if (run.mode === "up_to_step" && run.targetStepId) {
      yamlContent = generatePartialWorkflowYaml(yamlOptions, "up_to_step", run.targetStepId);
    } else {
      yamlContent = generateWorkflowYaml(yamlOptions);
    }

    // 2. Write temp YAML file
    const tmpYamlPath = path.join(os.tmpdir(), `nesy-run-${runId}.yaml`);
    fs.writeFileSync(tmpYamlPath, yamlContent, "utf-8");

    // 3. Store YAML content in DB + mark as running
    await prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: "running",
        startedAt: new Date(),
        yamlContent,
      },
    });

    // 3b. Test Event Bridge — assign the runId to the device BEFORE launch.
    // The `debug.nesy.run_id` sysprop is restored by the app on every cold start, so the
    // runId survives mid-run restarts (clearState nodes, crash recovery); the SET_RUN
    // broadcast additionally tags an already-running process. Both are best-effort:
    // structured events then carry this runId and the sniffer filters on it.
    const bridgeAppId = resolveWorkflowAppId(nodes);
    const bridgeDeviceId = run.deviceId;
    if (bridgeDeviceId) {
      await setRunIdProperty(bridgeDeviceId, runId);
      await broadcastSetRun(bridgeDeviceId, bridgeAppId, runId);
    }

    let sniffer: LogcatSniffer | null = null;

    try {
      // 4. Start Maestro executor
      const executor = new MaestroExecutor({
        yamlPath: tmpYamlPath,
        deviceId: run.deviceId ?? undefined,
      });

      executor.on("error", (err: unknown) => {
        console.warn("[WorkflowRunner] Maestro executor error (non-fatal):", err instanceof Error ? err.message : err);
      });

      // 5. Start Logcat sniffer (legacy pipe channel + structured NESY_TEST_EVENT channel)
      sniffer = new LogcatSniffer({
        deviceId: run.deviceId ?? undefined,
        runId,
      });

      // 6. Register executor in RunStore (process will be added on spawn)
      RunStore.register(runId, { executor });

      executor.on("spawned", (childProcess: import("node:child_process").ChildProcess) => {
        RunStore.register(runId, { maestro: childProcess });
      });
      const stepStartTimes = new Map<string, number>();
      let stepQueue = Promise.resolve();

      // 7. Handle step events from Maestro stdout
      function attachStepTracking(targetExecutor: MaestroExecutor): void {
        targetExecutor.on("step", (event: StepEvent) => {
          stepQueue = stepQueue.then(async () => {
            try {
              if (event.type === "start") {
                stepStartTimes.set(event.nodeId, event.timestamp);

                await prisma.workflowStepResult.updateMany({
                  where: { runId, nodeId: event.nodeId },
                  data: { status: "running", startedAt: new Date(event.timestamp) },
                });
              } else if (event.type === "done") {
                const startTime = stepStartTimes.get(event.nodeId);
                const duration = startTime ? event.timestamp - startTime : null;

                await prisma.workflowStepResult.updateMany({
                  where: { runId, nodeId: event.nodeId, status: "running" },
                  data: {
                    status: (event.warnings ?? 0) > 0 ? "warning" : "success",
                    completedAt: new Date(event.timestamp),
                    duration,
                  },
                });
              } else if (event.type === "fail") {
                const startTime = stepStartTimes.get(event.nodeId);
                const duration = startTime ? event.timestamp - startTime : null;

                await prisma.workflowStepResult.updateMany({
                  where: { runId, nodeId: event.nodeId, status: "running" },
                  data: {
                    status: "failed",
                    completedAt: new Date(event.timestamp),
                    duration,
                    errorMessage: event.message ?? "Step failed",
                  },
                });
              }
            } catch (err) {
              console.error(`[WorkflowRunner] Step event error:`, err);
            }
          });
        });
      }

      attachStepTracking(executor);

      // 8. Handle logcat verify events
      sniffer.on("verify", async (event: LogcatEvent) => {
        try {
          if (event.status === "SUCCESS") {
            const taskId = event.value;
            const verifySteps = await prisma.workflowStepResult.findMany({
              where: { runId, nodeType: "VERIFY_BACKEND_STATE", status: "running" },
            });

            for (const step of verifySteps) {
              await prisma.workflowStepResult.update({
                where: { id: step.id },
                data: {
                  status: "success",
                  completedAt: new Date(),
                  output: `Verified via logcat: TASK_ID=${taskId}`,
                },
              });
            }
          }
        } catch (err) {
          console.error("[WorkflowRunner] Logcat verify error:", err);
        }
      });

      sniffer.on("validate_stoplist", async (event: LogcatEvent) => {
        try {
          if (event.status === "SUCCESS") {
            const validateSteps = await prisma.workflowStepResult.findMany({
              where: { runId, nodeType: "VALIDATE_STOPLIST", status: "running" },
            });

            for (const step of validateSteps) {
              await prisma.workflowStepResult.update({
                where: { id: step.id },
                data: {
                  status: "success",
                  completedAt: new Date(),
                  output: `Logcat result: ${event.raw}`,
                },
              });
            }
          } else if (event.status === "FAIL" || event.status === "FAILED") {
            const validateSteps = await prisma.workflowStepResult.findMany({
              where: { runId, nodeType: "VALIDATE_STOPLIST", status: "running" },
            });

            for (const step of validateSteps) {
              await prisma.workflowStepResult.update({
                where: { id: step.id },
                data: {
                  status: "failed",
                  completedAt: new Date(),
                  errorMessage: `Validation failed. Logcat: ${event.raw}`,
                },
              });
            }
          }
        } catch (err) {
          console.error("[WorkflowRunner] Logcat validate_stoplist error:", err);
        }
      });

      sniffer.on("request_tour_start", async (event: LogcatEvent) => {
        try {
          if (event.status === "SUCCESS") {
            const steps = await prisma.workflowStepResult.findMany({
              where: { runId, nodeType: "REQUEST_TOUR_START", status: "running" },
            });

            for (const step of steps) {
              await prisma.workflowStepResult.update({
                where: { id: step.id },
                data: {
                  status: "success",
                  completedAt: new Date(),
                  output: `Logcat result: ${event.raw}`,
                },
              });
            }
          } else if (event.status === "FAIL" || event.status === "FAILED" || event.status === "ERROR") {
            const steps = await prisma.workflowStepResult.findMany({
              where: { runId, nodeType: "REQUEST_TOUR_START", status: "running" },
            });

            for (const step of steps) {
              await prisma.workflowStepResult.update({
                where: { id: step.id },
                data: {
                  status: "failed",
                  completedAt: new Date(),
                  errorMessage: `Request Tour Start failed. Logcat: ${event.raw}`,
                },
              });
            }
          }
        } catch (err) {
          console.error("[WorkflowRunner] Logcat request_tour_start error:", err);
        }
      });

      sniffer.on("deliver_parcel", async (event: LogcatEvent) => {
        try {
          const step = event.data?.step ?? "";

          // COMPLETED = written to queue (instantly in DeliveryFragment) — not sent to backend yet, waiting
          if (step === "COMPLETED") {
            console.log(`[WorkflowRunner] DELIVER_PARCEL COMPLETED (written to queue), waiting for backend confirmation...`);
            return;
          }

          // BACKEND_CONFIRMED = successfully sent to backend after 2 minutes -> SUCCESS
          if (step === "BACKEND_CONFIRMED" || (event.status === "SUCCESS" && step === "BACKEND_CONFIRMED")) {
            const steps = await prisma.workflowStepResult.findMany({
              where: { runId, nodeType: "DELIVERY_OPERATION", status: "running" },
            });

            for (const s of steps) {
              await prisma.workflowStepResult.update({
                where: { id: s.id },
                data: {
                   status: "success",
                   completedAt: new Date(),
                   output: `Backend confirmed. Logcat: ${event.raw}`,
                },
              });
            }
            return;
          }

          // BACKEND_RETRY = trying to send to backend but received error
          if (step === "BACKEND_RETRY") {
            console.warn(`[WorkflowRunner] DELIVER_PARCEL BACKEND_RETRY: ${event.raw}`);
            return;
          }

          // BACKEND_FAILED = max retries reached -> FAIL
          if (step === "BACKEND_FAILED" || (event.status === "ERROR" && step === "BACKEND_FAILED")) {
            const steps = await prisma.workflowStepResult.findMany({
              where: { runId, nodeType: "DELIVERY_OPERATION", status: "running" },
            });

            for (const s of steps) {
              await prisma.workflowStepResult.update({
                where: { id: s.id },
                data: {
                  status: "failed",
                  completedAt: new Date(),
                  errorMessage: `Backend failed. Logcat: ${event.raw}`,
                },
              });
            }
            return;
          }

          // Fallback: eski format (step yok, sadece SUCCESS/ERROR)
          if (event.status === "SUCCESS") {
            const steps = await prisma.workflowStepResult.findMany({
              where: { runId, nodeType: "DELIVERY_OPERATION", status: "running" },
            });
            for (const s of steps) {
              await prisma.workflowStepResult.update({
                where: { id: s.id },
                data: {
                  status: "success",
                  completedAt: new Date(),
                  output: `Logcat result: ${event.raw}`,
                },
              });
            }
          } else if (event.status === "FAIL" || event.status === "FAILED" || event.status === "ERROR") {
            const steps = await prisma.workflowStepResult.findMany({
              where: { runId, nodeType: "DELIVERY_OPERATION", status: "running" },
            });
            for (const s of steps) {
              await prisma.workflowStepResult.update({
                where: { id: s.id },
                data: {
                  status: "failed",
                  completedAt: new Date(),
                  errorMessage: `Deliver parcel failed. Logcat: ${event.raw}`,
                },
              });
            }
          }
        } catch (err) {
          console.error("[WorkflowRunner] Logcat deliver_parcel error:", err);
        }
      });

      sniffer.on("scan_parcel", async (event: LogcatEvent) => {
        try {
          if (event.status === "SUCCESS") {
            const steps = await prisma.workflowStepResult.findMany({
              where: { runId, nodeType: "SCAN_BARCODE", status: "running" },
            });

            for (const step of steps) {
              await prisma.workflowStepResult.update({
                where: { id: step.id },
                data: {
                  status: "success",
                  completedAt: new Date(),
                  output: `Logcat result: ${event.raw}`,
                },
              });
            }
          } else if (event.status === "FAIL" || event.status === "FAILED" || event.status === "ERROR") {
            const steps = await prisma.workflowStepResult.findMany({
              where: { runId, nodeType: "SCAN_BARCODE", status: "running" },
            });

            for (const step of steps) {
              await prisma.workflowStepResult.update({
                where: { id: step.id },
                data: {
                  status: "failed",
                  completedAt: new Date(),
                  errorMessage: `Scan barcode failed. Logcat: ${event.raw}`,
                },
              });
            }
          }
        } catch (err) {
          console.error("[WorkflowRunner] Logcat scan_parcel error:", err);
        }
      });

      // 8b. Handle LOAD_TO_VEHICLE sub-step + dialog tracking
      // The ScanProcessor pipeline emits 3 sequential logcat events per barcode scan:
      //   FETCH_SHIPMENT -> CREATE_TASK -> FETCH_SCHEDULE
      // Each step can trigger ArasDialog (HUB_WARNING, GENERIC_ERROR, etc.)
      // Dialog lifecycle: DIALOG_SHOWN -> user action -> DIALOG_DISMISSED
      //
      // Decision logic:
      //   - ERROR alone does NOT fail the node (a dialog might resolve it)
      //   - DIALOG_DISMISSED with flowContinues=false -> fail immediately
      //   - DIALOG_DISMISSED with flowContinues=true -> wait for remaining steps
      //   - All 3 pipeline steps SUCCESS -> success
      const LOAD_TO_VEHICLE_REQUIRED_STEPS = ["FETCH_SHIPMENT", "CREATE_TASK", "FETCH_SCHEDULE"] as const;

      /** Dialog strategy — mirrors frontend DIALOG_STRATEGY from yaml-registry */
      const DIALOG_STRATEGY: Record<string, { flowContinues: boolean }> = {
        HUB_WARNING:         { flowContinues: true },
        DELY_DELR_STOR_LOST: { flowContinues: false },
        NETWORK_ERROR:       { flowContinues: false },
        GENERIC_ERROR:       { flowContinues: false },
      };

      interface LoadToVehicleEvent {
        status: string;
        raw: string;
        dialog?: string;
        message?: string;
        userChoice?: string;
      }

      interface LoadToVehicleTaskState {
        /** Pipeline sub-step results (FETCH_SHIPMENT, CREATE_TASK, FETCH_SCHEDULE) */
        steps: Map<string, LoadToVehicleEvent>;
        /** Dialog events log for reporting */
        dialogLog: LoadToVehicleEvent[];
        /** Set to true when a non-continuing dialog is dismissed */
        terminalFailure: boolean;
        /** Error message for terminal failures */
        terminalErrorMessage?: string;
      }

      const loadToVehicleTracker = new Map<string, LoadToVehicleTaskState>();

      function getOrCreateTaskState(taskId: string): LoadToVehicleTaskState {
        if (!loadToVehicleTracker.has(taskId)) {
          loadToVehicleTracker.set(taskId, {
            steps: new Map(),
            dialogLog: [],
            terminalFailure: false,
          });
        }
        return loadToVehicleTracker.get(taskId)!;
      }

      sniffer.on("load_to_vehicle", async (event: LogcatEvent) => {
        try {
          const taskId = event.taskId ?? "unknown";
          const subStep = typeof event.data?.step === "string" ? event.data.step : null;
          const dialogType = typeof event.data?.dialog === "string" ? event.data.dialog : null;
          const dialogMessage = typeof event.data?.message === "string" ? event.data.message : undefined;
          const userChoice = typeof event.data?.user_choice === "string" ? event.data.user_choice : undefined;
          const state = getOrCreateTaskState(taskId);

          // Skip events for already-resolved tasks
          if (state.terminalFailure) return;

          const eventEntry: LoadToVehicleEvent = {
            status: event.status,
            raw: event.raw,
            dialog: dialogType ?? undefined,
            message: dialogMessage,
            userChoice,
          };

          console.log(
            `[WorkflowRunner] LOAD_TO_VEHICLE [${taskId}] status=${event.status} step=${subStep ?? "—"} dialog=${dialogType ?? "—"}`
          );

          // ── DIALOG_SHOWN ──
          // A dialog appeared on screen. Log it but don't take action yet.
          // Maestro will dismiss it via the YAML template's runFlow block.
          if (event.status === "DIALOG_SHOWN") {
            state.dialogLog.push(eventEntry);
            return;
          }

          // ── DIALOG_DISMISSED ──
          // Dialog was dismissed. Check strategy to decide if flow continues.
          if (event.status === "DIALOG_DISMISSED") {
            state.dialogLog.push(eventEntry);

            const strategy = dialogType ? DIALOG_STRATEGY[dialogType] : null;
            const flowContinues = strategy?.flowContinues ?? false;

            if (!flowContinues) {
              // Terminal dialog — mark node as failed
              state.terminalFailure = true;
              state.terminalErrorMessage =
                `LOAD_TO_VEHICLE stopped: ${dialogType ?? "UNKNOWN"} dialog dismissed. ` +
                `Step: ${subStep ?? "—"}, TASK_ID: ${taskId}` +
                (dialogMessage ? `. Message: ${dialogMessage}` : "");

              const loadSteps = await prisma.workflowStepResult.findMany({
                where: { runId, nodeType: "LOAD_TO_VEHICLE", status: "running" },
              });

              for (const step of loadSteps) {
                await prisma.workflowStepResult.update({
                  where: { id: step.id },
                  data: {
                    status: "failed",
                    completedAt: new Date(),
                    errorMessage: state.terminalErrorMessage,
                    output: JSON.stringify({
                      steps: Object.fromEntries(state.steps),
                      dialogLog: state.dialogLog,
                    }),
                  },
                });
              }

              loadToVehicleTracker.delete(taskId);
              return;
            }

            // flowContinues=true (e.g. HUB_WARNING OK) — keep waiting for pipeline steps
            return;
          }

          // ── ERROR ──
          // A pipeline step failed. DON'T fail immediately — a DIALOG_SHOWN
          // might follow (e.g. HUB_WARNING which can be resolved with OK).
          // Record the error and wait for the dialog lifecycle to complete.
          if (event.status === "ERROR" || event.status === "FAIL" || event.status === "FAILED") {
            if (subStep) {
              state.steps.set(subStep, eventEntry);
            }
            // Don't resolve yet — wait for potential DIALOG_SHOWN or next pipeline steps
            return;
          }

          // ── SUCCESS ──
          // A pipeline step completed successfully.
          if (event.status === "SUCCESS" && subStep) {
            state.steps.set(subStep, eventEntry);

            // Check if all 3 required steps have arrived as SUCCESS
            const allReceived = LOAD_TO_VEHICLE_REQUIRED_STEPS.every((s) => state.steps.has(s));
            if (!allReceived) return;

            const allSuccess = LOAD_TO_VEHICLE_REQUIRED_STEPS.every(
              (s) => state.steps.get(s)?.status === "SUCCESS"
            );

            const loadSteps = await prisma.workflowStepResult.findMany({
              where: { runId, nodeType: "LOAD_TO_VEHICLE", status: "running" },
            });

            for (const step of loadSteps) {
              if (allSuccess) {
                await prisma.workflowStepResult.update({
                  where: { id: step.id },
                  data: {
                    status: "success",
                    completedAt: new Date(),
                    output: JSON.stringify({
                      message: `LOAD_TO_VEHICLE completed. TASK_ID: ${taskId}. Pipeline: ${LOAD_TO_VEHICLE_REQUIRED_STEPS.join(" → ")}`,
                      steps: Object.fromEntries(state.steps),
                      dialogLog: state.dialogLog.length > 0 ? state.dialogLog : undefined,
                    }),
                  },
                });
              } else {
                const failedSteps = LOAD_TO_VEHICLE_REQUIRED_STEPS
                  .filter((s) => state.steps.get(s)?.status !== "SUCCESS")
                  .join(", ");

                await prisma.workflowStepResult.update({
                  where: { id: step.id },
                  data: {
                    status: "failed",
                    completedAt: new Date(),
                    errorMessage: `LOAD_TO_VEHICLE failed. TASK_ID: ${taskId}. Failed sub-steps: ${failedSteps}`,
                    output: JSON.stringify({
                      steps: Object.fromEntries(state.steps),
                      dialogLog: state.dialogLog,
                    }),
                  },
                });
              }
            }

            loadToVehicleTracker.delete(taskId);
            return;
          }
        } catch (err) {
          console.error("[WorkflowRunner] LOAD_TO_VEHICLE logcat error:", err);
        }
      });

      // 8c. Handle SEARCH_STOP bridge events (for OPEN_SHIPMENT / OPEN_PARCEL)
      sniffer.on("search_stop", async (event: LogcatEvent) => {
        try {
          const resultCount = typeof event.data?.result_count === "string" ? event.data.result_count : "?";

          if (event.status === "ERROR") {
            // Search returned no results — fail running OPEN_SHIPMENT / OPEN_PARCEL nodes
            const searchSteps = await prisma.workflowStepResult.findMany({
              where: {
                runId,
                nodeType: { in: ["OPEN_SHIPMENT", "OPEN_PARCEL"] },
                status: "running",
              },
            });

            for (const step of searchSteps) {
              await prisma.workflowStepResult.update({
                where: { id: step.id },
                data: {
                  status: "failed",
                  completedAt: new Date(),
                  errorMessage: `Search returned no results. Query: ${event.taskId ?? "—"}`,
                  output: event.raw,
                },
              });
            }
          } else if (event.status === "SUCCESS") {
            console.log(
              `[WorkflowRunner] SEARCH_STOP success: query=${event.taskId}, results=${resultCount}`
            );
          }
        } catch (err) {
          console.error("[WorkflowRunner] SEARCH_STOP logcat error:", err);
        }
      });

      // 8d. Handle OPEN_STOP bridge events (confirms navigation to task detail)
      sniffer.on("open_stop", async (event: LogcatEvent) => {
        try {
          if (event.status === "SUCCESS") {
            const openSteps = await prisma.workflowStepResult.findMany({
              where: {
                runId,
                nodeType: { in: ["OPEN_SHIPMENT", "OPEN_PARCEL"] },
                status: "running",
              },
            });

            for (const step of openSteps) {
              await prisma.workflowStepResult.update({
                where: { id: step.id },
                data: {
                  status: "success",
                  completedAt: new Date(),
                  output: `Stop opened successfully. Stop ID: ${event.taskId ?? "—"}. ${event.raw}`,
                },
              });
            }
          }
        } catch (err) {
          console.error("[WorkflowRunner] OPEN_STOP logcat error:", err);
        }
      });

      sniffer.on("device_error", async (event: LogcatEvent) => {
        try {
          const runningSteps = await prisma.workflowStepResult.findMany({
            where: { runId, status: "running" },
          });

          for (const step of runningSteps) {
            await prisma.workflowStepResult.update({
              where: { id: step.id },
              data: {
                status: "failed",
                completedAt: new Date(),
                errorMessage: `Device error: ${event.value}`,
              },
            });
          }
        } catch (err) {
          console.error("[WorkflowRunner] Logcat error handling failed:", err);
        }
      });

      // 8e. Structured Test Event Bridge channel (NESY_TEST_EVENT, runId-filtered + deduped).
      // BRIDGE_INIT mid-run = the app process restarted (clearState node or crash recovery).
      sniffer.on("bridge_init", (event: TestBridgeEvent) => {
        console.log(
          `[WorkflowRunner] BRIDGE_INIT: app (re)started — session=${event.sessionId}, ` +
          `version=${event.data?.app_version ?? "?"}, flavor=${event.data?.flavor ?? "?"}`
        );
      });

      // APP_CRASHED is written synchronously on the crashing thread (bypasses the app's
      // dispatch queue), so it is the most reliable "the app died" signal we have.
      sniffer.on("app_crashed", async (event: TestBridgeEvent) => {
        try {
          const summary = `App crashed: ${event.data?.exception ?? "unknown"} — ${event.data?.message ?? ""} ` +
            `(thread=${event.data?.thread ?? "?"}, screen=${event.screen})`;
          console.error(`[WorkflowRunner] ${summary}`);

          const runningSteps = await prisma.workflowStepResult.findMany({
            where: { runId, status: "running" },
          });

          for (const step of runningSteps) {
            await prisma.workflowStepResult.update({
              where: { id: step.id },
              data: {
                status: "failed",
                completedAt: new Date(),
                errorMessage: summary,
                output: event.raw,
              },
            });
          }
        } catch (err) {
          console.error("[WorkflowRunner] APP_CRASHED handling failed:", err);
        }
      });

      const bridgeEvents: LogcatEvent[] = [];
      const consumedBridgeEvents = new Set<LogcatEvent>();

      sniffer.on("event", (event: LogcatEvent) => {
        bridgeEvents.push(event);
      });

      function waitForBridgeEvent(
        action: string,
        predicate: BridgeEventPredicate,
        timeoutMs: number,
      ): Promise<LogcatEvent> {
        const buffered = bridgeEvents.find(
          (event) => event.action === action && !consumedBridgeEvents.has(event) && predicate(event),
        );
        if (buffered) {
          consumedBridgeEvents.add(buffered);
          return Promise.resolve(buffered);
        }

        return new Promise<LogcatEvent>((resolve, reject) => {
          const timeout = setTimeout(() => {
            sniffer?.off("event", onEvent);
            reject(new Error(`Timed out waiting for ${action} bridge log after ${timeoutMs}ms`));
          }, timeoutMs);

          const onEvent = (event: LogcatEvent) => {
            if (event.action !== action || consumedBridgeEvents.has(event) || !predicate(event)) return;
            clearTimeout(timeout);
            consumedBridgeEvents.add(event);
            sniffer?.off("event", onEvent);
            resolve(event);
          };

          sniffer?.on("event", onEvent);
        });
      }

      async function markNodeRunning(node: WorkflowRunnerNode): Promise<number> {
        const startedAt = Date.now();
        await prisma.workflowStepResult.updateMany({
          where: { runId, nodeId: node.id },
          data: { status: "running", startedAt: new Date(startedAt), errorMessage: null },
        });
        return startedAt;
      }

      async function markNodeSuccess(node: WorkflowRunnerNode, startedAt: number, output: unknown): Promise<void> {
        await prisma.workflowStepResult.updateMany({
          where: { runId, nodeId: node.id },
          data: {
            status: "success",
            completedAt: new Date(),
            duration: Date.now() - startedAt,
            output: typeof output === "string" ? output : JSON.stringify(output),
            errorMessage: null,
          },
        });
      }

      async function markNodeFailed(node: WorkflowRunnerNode, startedAt: number, error: unknown): Promise<void> {
        await prisma.workflowStepResult.updateMany({
          where: { runId, nodeId: node.id },
          data: {
            status: "failed",
            completedAt: new Date(),
            duration: Date.now() - startedAt,
            errorMessage: error instanceof Error ? error.message : String(error),
          },
        });
      }

      async function markSkipped(nodeIds: string[], reason: string): Promise<void> {
        if (nodeIds.length === 0) return;
        const skippedAt = new Date();
        await prisma.workflowStepResult.updateMany({
          where: { runId, nodeId: { in: nodeIds }, status: { in: ["pending", "running"] } },
          data: {
            status: "skipped",
            startedAt: skippedAt,
            completedAt: skippedAt,
            duration: 0,
            output: reason,
          },
        });
      }

      async function executeSingleNode(node: WorkflowRunnerNode, executedYaml: string[]): Promise<string> {
        await markNodeRunning(node);
        const nodeYamlContent = generateSingleNodeWorkflowYaml(yamlOptions, node.id);
        executedYaml.push(nodeYamlContent);
        const nodeYamlPath = path.join(os.tmpdir(), `nesy-run-${runId}-${node.id}.yaml`);
        fs.writeFileSync(nodeYamlPath, nodeYamlContent, "utf-8");

        const nodeExecutor = new MaestroExecutor({
          yamlPath: nodeYamlPath,
          deviceId: runDeviceId,
        });
        attachStepTracking(nodeExecutor);
        nodeExecutor.on("error", (err: unknown) => {
          console.warn("[WorkflowRunner] Maestro node executor error (non-fatal):", err instanceof Error ? err.message : err);
        });
        nodeExecutor.on("spawned", (childProcess: import("node:child_process").ChildProcess) => {
          RunStore.register(runId, { maestro: childProcess });
        });
        RunStore.register(runId, { executor: nodeExecutor });

        try {
          // Use executeUntilStepDone to resolve as soon as the step completes,
          // without waiting for the Maestro process to fully shut down (~3-5s savings).
          const result = await nodeExecutor.executeUntilStepDone(node.id);
          await stepQueue;

          if (result.exitCode !== 0) {
            throw new Error(formatMaestroFailure(result));
          }

          const step = await prisma.workflowStepResult.findFirst({
            where: { runId, nodeId: node.id },
            select: { status: true, errorMessage: true },
          });
          if (step?.status === "failed") {
            throw new Error(step.errorMessage ?? `${node.type} failed`);
          }

          return result.output;
        } finally {
          cleanupPath(nodeYamlPath);
        }
      }

      async function assertRunNotCancelled(): Promise<void> {
        const currentRun = await prisma.workflowRun.findUnique({
          where: { id: runId },
          select: { status: true },
        });
        if (currentRun?.status === "cancelled") {
          throw new Error("RUN_CANCELLED");
        }
      }

      // 9. Start both processes
      sniffer.on("error", (err: unknown) => {
        console.warn("[WorkflowRunner] Logcat sniffer error (non-fatal):", err instanceof Error ? err.message : err);
      });
      sniffer.start();
      RunStore.register(runId, { logcat: sniffer.getProcess() });

      if (hasLogConditionNodes(nodes) && run.mode === "full") {
        const dynamicStartedAt = Date.now();
        const nodeMap = new Map(nodes.map((node) => [node.id, node]));
        const executedYaml: string[] = [];
        const maestroOutputs: string[] = [];
        let dynamicFailed = false;
        let dynamicCancelled = false;
        let dynamicErrorMessage: string | null = null;

        let screenrecordProcess: ReturnType<typeof spawn> | null = null;
        const deviceId = run.deviceId;
        if (deviceId) {
          screenrecordProcess = spawn("adb", [
            "-s", deviceId,
            "shell",
            "screenrecord",
            "--size", "720x1280",
            "--bit-rate", "4000000",
            `/sdcard/nesy-run-${runId}.mp4`
          ]);
          console.log(`[WorkflowRunner] Started screenrecord on device ${deviceId}`);
        }

        async function runFrom(startNodeId: string | null, stopAtNodeId?: string | null): Promise<void> {
          let currentNodeId = startNodeId;

          while (currentNodeId && currentNodeId !== stopAtNodeId) {
            await assertRunNotCancelled();

            const node = nodeMap.get(currentNodeId);
            if (!node) return;

            if (node.type === "IF_LOGIN") {
              const startedAt = await markNodeRunning(node);
              const trueTarget = getTargetNodeId(edges, node.id, "true");
              const falseTarget = getTargetNodeId(edges, node.id, "false");
              const convergenceNodeId = trueTarget;

              try {
                // Pull-first: the GET_STATE broadcast answers synchronously instead of
                // waiting up to 10s for the CHECK_LOGIN logcat event. Falls back to the
                // legacy event wait when the query fails (older app build, device hiccup).
                let isLoggedIn: boolean;
                let loginEvidence: string;

                const pulledLoginState = bridgeDeviceId
                  ? await getDeviceBridgeState(bridgeDeviceId, bridgeAppId)
                  : null;

                if (pulledLoginState && pulledLoginState.isLoggedIn !== null) {
                  isLoggedIn = pulledLoginState.isLoggedIn;
                  loginEvidence = `GET_STATE: is_logged_in=${pulledLoginState.isLoggedIn}, screen=${pulledLoginState.currentScreen}`;
                } else {
                  const checkLoginEvent = await waitForBridgeEvent(
                    "CHECK_LOGIN",
                    (event) => event.status === "SUCCESS" && getBooleanData(event, "is_logged_in") !== null,
                    BRIDGE_TIMEOUTS.CHECK_LOGIN,
                  );
                  isLoggedIn = getBooleanData(checkLoginEvent, "is_logged_in") === true;
                  loginEvidence = checkLoginEvent.raw;
                }

                await markNodeSuccess(node, startedAt, {
                  action: "CHECK_LOGIN",
                  isLoggedIn,
                  raw: loginEvidence,
                });

                if (isLoggedIn) {
                  await markSkipped(
                    collectReachableNodeIds(edges, falseTarget, convergenceNodeId),
                    "Skipped because CHECK_LOGIN reported is_logged_in=true",
                  );
                  currentNodeId = trueTarget ?? getTargetNodeId(edges, node.id, "default");
                  continue;
                }

                await runFrom(falseTarget, convergenceNodeId);

                const loginStatusEvent = await waitForBridgeEvent(
                  "LOGIN_STATUS",
                  (event) => event.status === "SUCCESS" && getBooleanData(event, "login_success") === true,
                  BRIDGE_TIMEOUTS.LOGIN_STATUS,
                );

                if (falseTarget) {
                  await prisma.workflowStepResult.updateMany({
                    where: { runId, nodeId: falseTarget },
                    data: { output: `LOGIN_STATUS confirmed. ${loginStatusEvent.raw}` },
                  });
                }

                currentNodeId = convergenceNodeId ?? getTargetNodeId(edges, node.id, "default");
                continue;
              } catch (error) {
                await markNodeFailed(node, startedAt, error);
                throw error;
              }
            }

            if (node.type === "CHECK_ROUTE") {
              const startedAt = await markNodeRunning(node);
              const trueTarget = getTargetNodeId(edges, node.id, "true");
              const falseTarget = getTargetNodeId(edges, node.id, "false");
              const convergenceNodeId = trueTarget;

              try {
                // Pull fast-path: GET_STATE route_selected=true is unambiguous (a route is
                // already picked → no selection needed). route_selected=false is NOT enough
                // to conclude the opposite — some flavors don't require a route at all —
                // so that case still defers to the app's own route_required computation
                // via the legacy CHECK_ROUTE event.
                let routeRequired: boolean;
                let routeEvidence: string;

                const pulledRouteState = bridgeDeviceId
                  ? await getDeviceBridgeState(bridgeDeviceId, bridgeAppId)
                  : null;

                if (pulledRouteState?.routeSelected === true) {
                  routeRequired = false;
                  routeEvidence = `GET_STATE: route_selected=true, route_name=${pulledRouteState.routeName}`;
                } else {
                  const checkRouteEvent = await waitForBridgeEvent(
                    "CHECK_ROUTE",
                    (event) => event.status === "SUCCESS" && getBooleanData(event, "route_required") !== null,
                    BRIDGE_TIMEOUTS.CHECK_ROUTE,
                  );
                  routeRequired = getBooleanData(checkRouteEvent, "route_required") === true;
                  routeEvidence = checkRouteEvent.raw;
                }

                await markNodeSuccess(node, startedAt, {
                  action: "CHECK_ROUTE",
                  routeRequired,
                  raw: routeEvidence,
                });

                if (!routeRequired) {
                  await markSkipped(
                    collectReachableNodeIds(edges, falseTarget, convergenceNodeId),
                    "Skipped because CHECK_ROUTE reported route_required=false",
                  );
                  currentNodeId = trueTarget ?? getTargetNodeId(edges, node.id, "default");
                  continue;
                }

                await runFrom(falseTarget, convergenceNodeId);

                const routeStatusEvent = await waitForBridgeEvent(
                  "ROUTE_STATUS",
                  (event) => event.status === "SUCCESS" && getBooleanData(event, "route_selected") === true,
                  BRIDGE_TIMEOUTS.ROUTE_STATUS,
                );

                if (falseTarget) {
                  const routeName = typeof routeStatusEvent.data?.route_name === "string" ? routeStatusEvent.data.route_name : null;
                  await prisma.workflowStepResult.updateMany({
                    where: { runId, nodeId: falseTarget },
                    data: {
                      output: routeName
                        ? `ROUTE_STATUS confirmed. Selected route: ${routeName}. ${routeStatusEvent.raw}`
                        : `ROUTE_STATUS confirmed. ${routeStatusEvent.raw}`,
                    },
                  });
                }

                currentNodeId = convergenceNodeId ?? getTargetNodeId(edges, node.id, "default");
                continue;
              } catch (error) {
                await markNodeFailed(node, startedAt, error);
                throw error;
              }
            }

            const output = await executeSingleNode(node, executedYaml);
            if (output) maestroOutputs.push(output);

            currentNodeId = getTargetNodeId(edges, node.id, "default");

            // Eagerly mark the next node as "running" so the UI shows progress
            // immediately instead of waiting for the next loop iteration's markNodeRunning call.
            if (currentNodeId) {
              const nextNode = nodeMap.get(currentNodeId);
              if (nextNode) {
                await markNodeRunning(nextNode);
              }
            }
          }
        }

        try {
          const startNode = nodes.find((node) => node.type === "LAUNCH_APP") ?? nodes[0];
          await runFrom(startNode?.id ?? null);
        } catch (error) {
          if (error instanceof Error && error.message === "RUN_CANCELLED") {
            console.log(`[WorkflowRunner] Run ${runId} was cancelled, skipping final update`);
            dynamicCancelled = true;
          } else {
            dynamicFailed = true;
            dynamicErrorMessage =
              error instanceof Error ? error.message : String(error);
            console.error("[WorkflowRunner] Dynamic workflow execution failed:", error);
          }
        }

        sniffer.stop();

        let videoPath: string | null = null;
        if (screenrecordProcess && deviceId) {
          screenrecordProcess.kill("SIGINT");
          await new Promise(resolve => setTimeout(resolve, 3000));

          const runDir = path.join(SCREENSHOT_BASE_DIR, runId);
          try {
            fs.mkdirSync(runDir, { recursive: true });
            const localVideoPath = path.join(runDir, "video.mp4");
            execSync(`adb -s ${deviceId} pull /sdcard/nesy-run-${runId}.mp4 "${localVideoPath}"`, { stdio: "ignore" });
            execSync(`adb -s ${deviceId} shell rm /sdcard/nesy-run-${runId}.mp4`, { stdio: "ignore" });
            videoPath = path.relative(process.cwd(), localVideoPath);
            console.log(`[WorkflowRunner] Video saved to: ${localVideoPath}`);
          } catch (err) {
            console.error("[WorkflowRunner] Failed to pull video:", err);
          }
        }

        if (dynamicCancelled) {
          return;
        }

        const runningSteps = await prisma.workflowStepResult.findMany({
          where: { runId, status: "running" },
        });

        for (const step of runningSteps) {
          await prisma.workflowStepResult.update({
            where: { id: step.id },
            data: {
              status: dynamicFailed ? "failed" : "success",
              completedAt: new Date(),
              errorMessage: dynamicFailed
                ? dynamicErrorMessage ?? "Workflow stopped before this step completed"
                : null,
            },
          });
        }

        if (dynamicErrorMessage) {
          maestroOutputs.push(`[runner] ${dynamicErrorMessage}`);
        }

        const finalStatus = dynamicFailed ? "failed" : "success";
        await prisma.workflowRun.update({
          where: { id: runId },
          data: {
            status: finalStatus,
            completedAt: new Date(),
            duration: Date.now() - dynamicStartedAt,
            yamlContent: executedYaml.join("\n"),
            maestroOutput: maestroOutputs.join("\n").substring(0, 50000),
            screenshotDir: videoPath,
          },
        });

        console.log(
          `[WorkflowRunner] Run ${runId} completed with log-branch orchestration: ${finalStatus} (${Date.now() - dynamicStartedAt}ms)`
        );
        return;
      }

      // 10. Execute and wait for completion
      console.log(`[WorkflowRunner] Executing maestro: ${tmpYamlPath}`);
      
      let screenrecordProcess: ReturnType<typeof spawn> | null = null;
      const deviceId = run.deviceId;
      if (deviceId) {
        screenrecordProcess = spawn("adb", [
          "-s", deviceId,
          "shell",
          "screenrecord",
          "--size", "720x1280",
          "--bit-rate", "4000000",
          `/sdcard/nesy-run-${runId}.mp4`
        ]);
        console.log(`[WorkflowRunner] Started screenrecord on device ${deviceId}`);
      }

      const result = await executor.execute();
      console.log(`[WorkflowRunner] Maestro exited: code=${result.exitCode}, signal=${result.signal}, duration=${result.duration}ms`);
      if (result.exitCode !== 0) {
        console.log(`[WorkflowRunner] Maestro output:\n${result.output.slice(0, 2000)}`);
      }

      // 11. Stop logcat sniffer
      sniffer.stop();

      // Stop screenrecord and pull the video
      let videoPath: string | null = null;
      if (screenrecordProcess && deviceId) {
        screenrecordProcess.kill("SIGINT");
        
        // Wait for screenrecord to finalize the video
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const runDir = path.join(SCREENSHOT_BASE_DIR, runId);
        try {
          fs.mkdirSync(runDir, { recursive: true });
          const localVideoPath = path.join(runDir, "video.mp4");
          execSync(`adb -s ${deviceId} pull /sdcard/nesy-run-${runId}.mp4 "${localVideoPath}"`, { stdio: "ignore" });
          execSync(`adb -s ${deviceId} shell rm /sdcard/nesy-run-${runId}.mp4`, { stdio: "ignore" });
          videoPath = path.relative(process.cwd(), localVideoPath);
          console.log(`[WorkflowRunner] Video saved to: ${localVideoPath}`);
        } catch (err) {
          console.error("[WorkflowRunner] Failed to pull video:", err);
        }
      }

      // 12. Determine final status
      const finalStatus = result.exitCode === 0 ? "success" : "failed";

      // 14. Check if run was cancelled while Maestro was executing
      const currentRun = await prisma.workflowRun.findUnique({
        where: { id: runId },
        select: { status: true },
      });

      if (currentRun?.status === "cancelled") {
        console.log(`[WorkflowRunner] Run ${runId} was cancelled, skipping final update`);
        return;
      }

      // 15. Mark last running steps as failed if Maestro failed
      if (result.exitCode !== 0) {
        const runningSteps = await prisma.workflowStepResult.findMany({
          where: { runId, status: "running" },
        });

        for (const step of runningSteps) {
          await prisma.workflowStepResult.update({
            where: { id: step.id },
            data: {
              status: "failed",
              completedAt: new Date(),
              errorMessage: `Maestro exited with code ${result.exitCode}`,
            },
          });
        }
      }

      // 16. Update run final state
      await prisma.workflowRun.update({
        where: { id: runId },
        data: {
          status: finalStatus,
          completedAt: new Date(),
          duration: result.duration,
          maestroOutput: result.output.substring(0, 50000),
          screenshotDir: videoPath,
        },
      });

      console.log(
        `[WorkflowRunner] Run ${runId} completed: ${finalStatus} (${result.duration}ms)`
      );
    } finally {
      if (sniffer) sniffer.stop();
      cleanupPath(tmpYamlPath);
      RunStore.cleanup(runId);

      // Test Event Bridge contract: clear the runId at run end. The sysprop survives
      // until reboot — left behind, tomorrow's manual session would be tagged with
      // this run's id. Both calls are best-effort (device may already be gone).
      if (bridgeDeviceId) {
        await setRunIdProperty(bridgeDeviceId, "");
        await broadcastSetRun(bridgeDeviceId, bridgeAppId, "");
      }
    }
  },
};
