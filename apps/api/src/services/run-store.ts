/**
 * In-memory store for active run processes.
 * Tracks auxiliary child processes for cancel/cleanup.
 */

import type { ChildProcess } from "node:child_process";

interface RunProcesses {
  runner: { kill(): void } | null;
  logcat: ChildProcess | null;
  startedAt: number;
}

const store = new Map<string, RunProcesses>();

export const RunStore = {
  register(
    runId: string,
    options: {
      runner?: { kill(): void } | null;
      logcat?: ChildProcess | null;
    },
  ): void {
    const existing = store.get(runId);
    store.set(runId, {
      runner: options.runner ?? existing?.runner ?? null,
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

    if (processes.runner) {
      processes.runner.kill();
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
