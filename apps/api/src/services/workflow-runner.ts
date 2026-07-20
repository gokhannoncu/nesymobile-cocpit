/**
 * Workflow Runner - Orchestrator
 *
 * Coordinates: workspace generation -> temp files -> ONE Maestro run -> stdout
 * parse -> DB step update -> cleanup.
 *
 * Every workflow — conditionals included — executes as a single Maestro
 * process: IF_LOGIN / CHECK_ROUTE branches are resolved BEFORE the run via the
 * GET_STATE preflight pull, and fall back to Maestro's own UI-visibility
 * conditionals when the device state cannot be pulled.
 *
 * Workspace files are ephemeral (os.tmpdir()); the combined YAML is persisted
 * in WorkflowRun.yamlContent.
 */

import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { spawn, execSync } from "node:child_process";
import { prisma } from "@nesy/db";
import {
  generatePartialWorkflowYaml,
  generateWorkflowWorkspace,
  resolveWorkflowAppId,
  type PreflightState,
} from "./yaml-generator.js";
import {
  MaestroExecutor,
  type StepEvent,
} from "./maestro-executor.js";
import { LogcatSniffer } from "./logcat-sniffer.js";
import { RunStore } from "./run-store.js";
import { RunSpanRecorder } from "./run-spans.js";
import { OracleEngine } from "./oracle-engine.js";
import {
  setRunIdProperty,
  broadcastSetRun,
  getDeviceBridgeState,
} from "./test-event-bridge.js";

const SCREENSHOT_BASE_DIR = path.resolve(process.cwd(), "maestro", "run");

export interface WorkflowRunnerOptions {
  /**
   * Persistent, device-scoped sniffer owned by a DeviceWorker. When provided,
   * the runner reuses it (re-targets the runId filter) instead of spawning a
   * fresh `adb logcat` process, and leaves it running at run end.
   */
  sniffer?: LogcatSniffer;
  /**
   * True when the host WS event server is running (device worker path):
   * SET_RUN then also tells the app to connect its WebSocket sink.
   */
  wsEventsEnabled?: boolean;
}

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

const LOG_CONDITION_NODE_TYPES = new Set(["IF_LOGIN", "CHECK_ROUTE"]);

const ANDROID_SDK = path.join(os.homedir(), "Library", "Android", "sdk", "platform-tools");
const MAESTRO_BIN = path.join(os.homedir(), ".maestro", "bin");

function getEnhancedPath(): string {
  const current = process.env.PATH ?? "";
  const extras = [ANDROID_SDK, MAESTRO_BIN].filter((p) => fs.existsSync(p));
  if (extras.length === 0) return current;
  return [...extras, current].join(path.delimiter);
}

process.env.PATH = getEnhancedPath();

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

/**
 * Maestro `--debug-output` drops failure screenshots (screenshot-❌-*.png)
 * into the debug dir. Returns the newest one, or null.
 */
function findLatestFailureScreenshot(debugDir: string): string | null {
  if (!fs.existsSync(debugDir)) return null;

  let latest: { file: string; mtime: number } | null = null;
  for (const name of fs.readdirSync(debugDir)) {
    if (!name.toLowerCase().endsWith(".png")) continue;
    const full = path.join(debugDir, name);
    const mtime = fs.statSync(full).mtimeMs;
    if (!latest || mtime > latest.mtime) {
      latest = { file: full, mtime };
    }
  }
  return latest?.file ?? null;
}

/**
 * When LAUNCH_APP clears app state, whatever GET_STATE reported beforehand is
 * void — the run starts logged-out with no route.
 */
function launchClearsState(nodes: WorkflowRunnerNode[]): boolean {
  const launchNode = nodes.find((node) => node.type === "LAUNCH_APP");
  return launchNode?.data.config?.clearState === true;
}

export const WorkflowRunner = {
  async execute(runId: string, options: WorkflowRunnerOptions = {}): Promise<void> {
    const run = await prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        version: true,
        workflow: true,
      },
    });

    if (!run) throw new Error(`Run ${runId} not found`);

    const nodes = run.version.nodes as WorkflowRunnerNode[];

    const edges = run.version.edges as WorkflowRunnerEdge[];

    const spanRecorder = new RunSpanRecorder();

    const yamlOptions = {
      workflowId: run.workflowId,
      runId: run.id,
      nodes,
      edges,
      environment: run.environment ?? undefined,
      country: run.country ?? undefined,
      config: (run.version.config as Record<string, unknown>) ?? undefined,
    };

    const bridgeAppId = resolveWorkflowAppId(nodes);
    const bridgeDeviceId = run.deviceId;

    // 1. Preflight — resolve IF_LOGIN / CHECK_ROUTE branches BEFORE the run so
    // conditionals compile into the single Maestro workspace. When LAUNCH_APP
    // clears state, the pulled state is void: the run starts logged-out.
    let preflight: PreflightState | null = null;
    const isFullRun = run.mode === "full" || (!run.targetStepId && run.mode !== "single_step" && run.mode !== "up_to_step");

    if (isFullRun && hasLogConditionNodes(nodes) && bridgeDeviceId) {
      if (launchClearsState(nodes)) {
        preflight = {
          isLoggedIn: false,
          routeSelected: false,
          evidence: "LAUNCH_APP clearState=true — state is wiped at launch",
        };
      } else {
        const pulled = await spanRecorder.measureAsync(
          "get_state_pull",
          () => getDeviceBridgeState(bridgeDeviceId, bridgeAppId),
          { phase: "preflight" },
        );
        if (pulled) {
          preflight = {
            isLoggedIn: pulled.isLoggedIn,
            routeSelected: pulled.routeSelected,
            evidence: `GET_STATE: is_logged_in=${pulled.isLoggedIn}, route_selected=${pulled.routeSelected}, screen=${pulled.currentScreen}`,
          };
        }
      }
    }

    // 2. Generate the Maestro workspace (full runs) or a single partial YAML.
    const workspace = spanRecorder.measure("yaml_generation", () => {
      if (run.mode === "single_step" && run.targetStepId) {
        return null;
      }
      if (run.mode === "up_to_step" && run.targetStepId) {
        return null;
      }
      return generateWorkflowWorkspace(yamlOptions, preflight);
    });

    const partialYaml: string | null = workspace
      ? null
      : spanRecorder.measure("yaml_generation", () => {
          if (run.mode === "single_step" && run.targetStepId) {
            return generatePartialWorkflowYaml(yamlOptions, "single_step", run.targetStepId);
          }
          return generatePartialWorkflowYaml(yamlOptions, "up_to_step", run.targetStepId ?? "");
        });

    // 3. Write temp files: a workspace dir for full runs, a single file otherwise.
    const workspaceDir = path.join(os.tmpdir(), `nesy-run-${runId}`);
    let tmpYamlPath: string;

    if (workspace) {
      fs.mkdirSync(path.join(workspaceDir, "flows"), { recursive: true });
      for (const file of workspace.files) {
        const filePath = path.join(workspaceDir, file.relativePath);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, file.content, "utf-8");
      }
      tmpYamlPath = path.join(workspaceDir, workspace.mainFile);
    } else {
      fs.mkdirSync(workspaceDir, { recursive: true });
      tmpYamlPath = path.join(workspaceDir, "main.yaml");
      fs.writeFileSync(tmpYamlPath, partialYaml ?? "# empty\n", "utf-8");
    }

    const yamlContent = workspace ? workspace.combinedYaml : (partialYaml ?? "");

    // 3b. Central artifact directory: maestro/run/<runId>/
    // Collects: executed workspace YAML, Maestro debug output (commands-*.json,
    // failure screenshots), the structured event stream (events.jsonl), the
    // span timeline (spans.json) and the screen recording (video.mp4).
    const artifactDir = path.join(SCREENSHOT_BASE_DIR, runId);
    const debugOutputDir = path.join(artifactDir, "debug");
    let eventLogStream: fs.WriteStream | null = null;
    try {
      fs.mkdirSync(debugOutputDir, { recursive: true });
      fs.writeFileSync(path.join(artifactDir, "workflow.yaml"), yamlContent, "utf-8");
      eventLogStream = fs.createWriteStream(path.join(artifactDir, "events.jsonl"), { flags: "a" });
    } catch (err) {
      console.warn("[WorkflowRunner] artifact dir setup failed:", err instanceof Error ? err.message : err);
    }

    function logArtifactEvent(channel: string, payload: unknown): void {
      if (!eventLogStream) return;
      try {
        eventLogStream.write(JSON.stringify({ at: Date.now(), channel, payload }) + "\n");
      } catch {
        // artifact logging is best-effort
      }
    }

    // 4. Store YAML content in DB + mark as running
    await prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: "running",
        startedAt: new Date(),
        yamlContent,
      },
    });

    // 4b. Apply compile-time branch decisions to step results.
    if (workspace) {
      if (workspace.skippedNodeIds.length > 0) {
        const skippedAt = new Date();
        await prisma.workflowStepResult.updateMany({
          where: { runId, nodeId: { in: workspace.skippedNodeIds }, status: "pending" },
          data: {
            status: "skipped",
            startedAt: skippedAt,
            completedAt: skippedAt,
            duration: 0,
            output: "Skipped by preflight branch resolution",
          },
        });
      }

      for (const decision of workspace.conditionDecisions) {
        if (decision.decision === "runtime_fallback") continue; // resolved by stdout markers
        await prisma.workflowStepResult.updateMany({
          where: { runId, nodeId: decision.nodeId },
          data: {
            status: "success",
            startedAt: new Date(),
            completedAt: new Date(),
            duration: 0,
            output: JSON.stringify({
              action: decision.nodeType,
              decision: decision.decision,
              evidence: decision.evidence,
            }),
          },
        });
      }
    }

    // 5. Test Event Bridge — assign the runId to the device BEFORE launch.
    // The `debug.nesy.run_id` sysprop is restored by the app on every cold start, so the
    // runId survives mid-run restarts (clearState nodes, crash recovery); the SET_RUN
    // broadcast additionally tags an already-running process. Both are best-effort:
    // structured events then carry this runId and the sniffer filters on it.
    if (bridgeDeviceId) {
      await spanRecorder.measureAsync("device_prep", async () => {
        await setRunIdProperty(bridgeDeviceId, runId);
        await broadcastSetRun(bridgeDeviceId, bridgeAppId, runId, {
          wsEnabled: options.wsEventsEnabled === true,
        });
      });
    }

    // Shared sniffer (persistent device worker) vs. run-owned sniffer (legacy path).
    const sharedSniffer = options.sniffer ?? null;
    let sniffer: LogcatSniffer | null = null;
    let snifferReleased = false;

    // Listeners registered by THIS run on the (possibly shared) sniffer.
    const runSnifferListeners: Array<[string, (...args: never[]) => void]> = [];

    function releaseSniffer(): void {
      if (!sniffer || snifferReleased) return;
      snifferReleased = true;
      if (sharedSniffer) {
        // Persistent sniffer: detach this run's listeners, clear the runId
        // filter, keep the adb logcat process alive for the next run.
        for (const [event, fn] of runSnifferListeners) {
          sniffer.off(event, fn as (...args: unknown[]) => void);
        }
        sniffer.setRunId(undefined);
      } else {
        sniffer.stop();
      }
    }

    try {
      // 4. Start Maestro executor (debug output lands in the artifact dir)
      const executor = new MaestroExecutor({
        yamlPath: tmpYamlPath,
        deviceId: run.deviceId ?? undefined,
        debugOutputDir,
      });

      executor.on("error", (err: unknown) => {
        console.warn("[WorkflowRunner] Maestro executor error (non-fatal):", err instanceof Error ? err.message : err);
      });

      // 5. Logcat sniffer (legacy pipe channel + structured NESY_TEST_EVENT channel).
      // Reuse the device worker's persistent sniffer when available.
      if (sharedSniffer) {
        sniffer = sharedSniffer;
        sniffer.setRunId(runId);
      } else {
        sniffer = new LogcatSniffer({
          deviceId: run.deviceId ?? undefined,
          runId,
        });
      }

      const activeSniffer = sniffer;
      function onSniffer(event: string, fn: (...args: never[]) => void): void {
        activeSniffer.on(event, fn as (...args: unknown[]) => void);
        runSnifferListeners.push([event, fn]);
      }

      // 6. Register executor in RunStore (process will be added on spawn)
      RunStore.register(runId, { executor });

      executor.on("spawned", (childProcess: import("node:child_process").ChildProcess) => {
        RunStore.register(runId, { maestro: childProcess });
      });
      const stepStartTimes = new Map<string, number>();
      let stepQueue = Promise.resolve();

      // Oracle Engine: fuses UI (Maestro), mobile business events and backend
      // confirmations into per-node verdicts based on each node's completionPolicy.
      const oracle = new OracleEngine(runId, nodes);

      // Spans: measure spawn → first stdout line as process startup cost.
      function attachStartupSpan(targetExecutor: MaestroExecutor, spanName: string, attrs?: Record<string, string>): void {
        let spawnedAt: number | null = null;
        let recorded = false;
        targetExecutor.on("spawned", () => {
          spawnedAt = Date.now();
        });
        const onFirstLine = () => {
          if (recorded || spawnedAt === null) return;
          recorded = true;
          spanRecorder.record(spanName, spawnedAt, Date.now() - spawnedAt, attrs);
        };
        targetExecutor.once("output", onFirstLine);
        targetExecutor.once("step", onFirstLine);
      }

      attachStartupSpan(executor, "maestro_startup");

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

                if (startTime && duration !== null) {
                  spanRecorder.record("ui_action", startTime, duration, {
                    nodeId: event.nodeId,
                    nodeType: event.nodeType,
                    status: "done",
                  });
                }

                // Ask the oracle whether UI completion alone satisfies this
                // node's completionPolicy. If not, the step stays "running"
                // until the required business/backend event resolves it.
                const uiIsEnough = await oracle.onUiStepDone(event.nodeId, event.warnings ?? 0);

                if (uiIsEnough) {
                  await prisma.workflowStepResult.updateMany({
                    where: { runId, nodeId: event.nodeId, status: "running" },
                    data: {
                      status: (event.warnings ?? 0) > 0 ? "warning" : "success",
                      completedAt: new Date(event.timestamp),
                      duration,
                    },
                  });
                } else {
                  await prisma.workflowStepResult.updateMany({
                    where: { runId, nodeId: event.nodeId, status: "running" },
                    data: {
                      duration,
                      output: "UI completed — waiting for business confirmation (completionPolicy)",
                    },
                  });
                }
              } else if (event.type === "fail") {
                const startTime = stepStartTimes.get(event.nodeId);
                const duration = startTime ? event.timestamp - startTime : null;

                if (startTime && duration !== null) {
                  spanRecorder.record("ui_action", startTime, duration, {
                    nodeId: event.nodeId,
                    nodeType: event.nodeType,
                    status: "fail",
                  });
                }

                oracle.onUiStepFailed(event.nodeId, event.message ?? "Step failed");

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

      // 8. Oracle Engine — all logcat/business-event handling and the
      // completionPolicy verdicts live in oracle-engine.ts.
      oracle.attach(onSniffer);

      // 8b. Persist the raw event streams as run artifacts (events.jsonl).
      onSniffer("test_event", (event: unknown) => logArtifactEvent("structured", event));
      onSniffer("event", (event: unknown) => logArtifactEvent("legacy", event));

      // 9. Start the logcat sniffer
      onSniffer("error", (err: unknown) => {
        console.warn("[WorkflowRunner] Logcat sniffer error (non-fatal):", err instanceof Error ? err.message : err);
      });
      sniffer.start(); // no-op when the shared sniffer is already running
      if (!sharedSniffer) {
        // Shared sniffers outlive the run — cancelling the run must not kill them.
        RunStore.register(runId, { logcat: sniffer.getProcess() });
      }

      // 10. Execute and wait for completion — ONE Maestro process for the whole workflow
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

      const maestroTotalStart = Date.now();
      const result = await executor.execute();
      spanRecorder.record("maestro_total", maestroTotalStart, result.duration);
      console.log(`[WorkflowRunner] Maestro exited: code=${result.exitCode}, signal=${result.signal}, duration=${result.duration}ms`);
      if (result.exitCode !== 0) {
        console.log(`[WorkflowRunner] Maestro output:\n${result.output.slice(0, 2000)}`);
      }

      // 11. Release the logcat sniffer (stops it, or detaches from the shared one)
      releaseSniffer();

      // Stop screenrecord and pull the video
      let videoPath: string | null = null;
      if (screenrecordProcess && deviceId) {
        const videoPullStart = Date.now();
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
        spanRecorder.record("video_pull", videoPullStart, Date.now() - videoPullStart);
      }

      // 12. Check if run was cancelled while Maestro was executing
      const currentRun = await prisma.workflowRun.findUnique({
        where: { id: runId },
        select: { status: true },
      });

      if (currentRun?.status === "cancelled") {
        console.log(`[WorkflowRunner] Run ${runId} was cancelled, skipping final update`);
        return;
      }

      // 13. Wait for in-flight step updates, then let the oracle produce the
      // fusion verdict: steps whose UI passed but whose required business or
      // backend confirmation never arrived are FAILED — a green screen alone
      // does not pass the test.
      await stepQueue;
      const { oracleFailures } = await oracle.finalizeRun(result.exitCode === 0);

      // 14. Determine final status (Maestro exit code + oracle verdict)
      const finalStatus = result.exitCode === 0 && oracleFailures === 0 ? "success" : "failed";

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

      // 15b. Attach Maestro failure screenshots to failed steps.
      if (finalStatus === "failed") {
        try {
          const failureScreenshot = findLatestFailureScreenshot(debugOutputDir);
          if (failureScreenshot) {
            const relativeScreenshot = path.relative(process.cwd(), failureScreenshot);
            await prisma.workflowStepResult.updateMany({
              where: { runId, status: "failed", screenshotPath: null },
              data: { screenshotPath: relativeScreenshot },
            });
          }
        } catch (err) {
          console.warn("[WorkflowRunner] failure screenshot attach failed:", err instanceof Error ? err.message : err);
        }
      }

      // 16. Update run final state (+ persist span timeline artifact)
      const spans = spanRecorder.finalize();
      try {
        fs.writeFileSync(path.join(artifactDir, "spans.json"), JSON.stringify(spans, null, 2), "utf-8");
      } catch {
        // artifact write is best-effort
      }

      await prisma.workflowRun.update({
        where: { id: runId },
        data: {
          status: finalStatus,
          completedAt: new Date(),
          duration: result.duration,
          maestroOutput: result.output.substring(0, 50000),
          screenshotDir: videoPath,
          spans: JSON.parse(JSON.stringify(spans)),
        },
      });

      console.log(
        `[WorkflowRunner] Run ${runId} completed: ${finalStatus} (${result.duration}ms)`
      );
    } finally {
      releaseSniffer();
      if (eventLogStream) {
        eventLogStream.end();
      }
      cleanupPath(workspaceDir);
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
