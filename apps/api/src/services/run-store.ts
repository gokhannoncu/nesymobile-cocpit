/**
 * In-memory store for active run processes.
 * Tracks Maestro and Logcat child processes for cancel/cleanup.
 */

import type { ChildProcess } from "node:child_process";
import type { MaestroExecutor } from "./maestro-executor.js";

interface RunProcesses {
  maestro: ChildProcess | null;
  executor: MaestroExecutor | null;
  logcat: ChildProcess | null;
  startedAt: number;
}

const store = new Map<string, RunProcesses>();

export const RunStore = {
  register(
    runId: string,
    options: {
      maestro?: ChildProcess | null;
      executor?: MaestroExecutor | null;
      logcat?: ChildProcess | null;
    },
  ): void {
    const existing = store.get(runId);
    store.set(runId, {
      maestro: options.maestro ?? existing?.maestro ?? null,
      executor: options.executor ?? existing?.executor ?? null,
      logcat: options.logcat ?? existing?.logcat ?? null,
      startedAt: existing?.startedAt ?? Date.now(),
    });
  },

  get(runId: string): RunProcesses | undefined {
    return store.get(runId);
  },

  kill(runId: string): boolean {
    const processes = store.get(runId);
    if (!processes) return false;

    let killed = false;

    if (processes.executor) {
      processes.executor.kill();
      killed = true;
    } else if (processes.maestro && !processes.maestro.killed) {
      processes.maestro.kill("SIGTERM");
      killed = true;
    }

    if (processes.logcat && !processes.logcat.killed) {
      processes.logcat.kill("SIGTERM");
    }

    store.delete(runId);
    return killed;
  },

  cleanup(runId: string): void {
    store.delete(runId);
  },

  getActiveRunIds(): string[] {
    return Array.from(store.keys());
  },

  getActiveCount(): number {
    return store.size;
  },
};
