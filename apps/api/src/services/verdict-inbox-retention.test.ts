import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_BODY_RETENTION_MS,
  DEFAULT_EVENT_RETENTION_MS,
  planInboxRetention,
  startInboxRetentionSchedule,
} from "./verdict-inbox-retention.js";

const DAY = 24 * 60 * 60_000;
const NOW = new Date("2026-09-02T00:00:00.000Z").getTime();

function row(
  seq: number,
  event: string | null,
  ageDays: number,
  hasBody = true,
) {
  return {
    seq,
    event,
    receivedAt: new Date(NOW - ageDays * DAY),
    hasBody,
  };
}

describe("verdict inbox retention", () => {
  it("keeps a fresh body untouched", () => {
    const plan = planInboxRetention([row(1, "HTTP_BODY_CAPTURED", 3)], {
      nowMs: NOW,
    });

    expect(plan.purgeBodyText).toEqual([]);
    expect(plan.deleteRows).toEqual([]);
  });

  it("purges body text past the body window while keeping the row", () => {
    const plan = planInboxRetention([row(1, "HTTP_BODY_CAPTURED", 20)], {
      nowMs: NOW,
    });

    expect(plan.purgeBodyText).toEqual(["1"]);
    expect(plan.deleteRows).toEqual([]);
  });

  it("leaves metadata events alone until the event window", () => {
    const plan = planInboxRetention(
      [row(1, "HTTP_CALL", 20), row(2, "SCREEN_READY", 89)],
      { nowMs: NOW },
    );

    expect(plan.purgeBodyText).toEqual([]);
    expect(plan.deleteRows).toEqual([]);
  });

  it("deletes any row past the event window, bodies included", () => {
    const plan = planInboxRetention(
      [row(1, "HTTP_CALL", 91), row(2, "HTTP_BODY_CAPTURED", 120)],
      { nowMs: NOW },
    );

    // The body row is deleted, not redacted: redacting it would leave a
    // tombstone outliving every row it referred to.
    expect(plan.deleteRows).toEqual(["1", "2"]);
    expect(plan.purgeBodyText).toEqual([]);
  });

  it("does not re-purge a body whose text is already gone", () => {
    const plan = planInboxRetention(
      [row(1, "HTTP_BODY_CAPTURED", 20, false)],
      { nowMs: NOW },
    );

    expect(plan.purgeBodyText).toEqual([]);
  });

  it("refuses a body window longer than the event window", () => {
    // Otherwise the two rules fight nightly: one redacts a row the other is
    // about to delete.
    expect(() =>
      planInboxRetention([], { bodyRetentionMs: 100 * DAY, eventRetentionMs: 90 * DAY }),
    ).toThrow(/must not exceed/);
  });

  it("ignores a row with an unreadable timestamp rather than deleting it", () => {
    const plan = planInboxRetention(
      [{ seq: 1, event: "HTTP_CALL", receivedAt: "not-a-date", hasBody: false }],
      { nowMs: NOW },
    );

    expect(plan.deleteRows).toEqual([]);
  });

  it("defaults match the approved decision: bodies 14 days, events 90", () => {
    expect(DEFAULT_BODY_RETENTION_MS).toBe(14 * DAY);
    expect(DEFAULT_EVENT_RETENTION_MS).toBe(90 * DAY);
  });
});

describe("retention schedule", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function harness(overrides: Record<string, unknown> = {}) {
    const logs: string[] = [];
    const run = vi.fn(async () => ({ bodiesPurged: 2, rowsDeleted: 5 }));
    const stop = startInboxRetentionSchedule({
      run,
      log: (message) => logs.push(message),
      ...overrides,
    });
    return { logs, run, stop };
  }

  it("sweeps shortly after boot rather than a day later", async () => {
    // A plain 24h interval never fires in a process that restarts hourly, so
    // the window would look configured and never once have run.
    const { run, stop } = harness();

    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(run).toHaveBeenCalledTimes(1);

    stop();
  });

  it("keeps sweeping daily", async () => {
    const { run, stop } = harness();

    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(24 * 60 * 60_000);
    expect(run.mock.calls.length).toBeGreaterThanOrEqual(2);

    stop();
  });

  it("reports a sweep that changed nothing", async () => {
    // A job that only speaks when it deletes something is indistinguishable
    // from a job that is not running.
    const { logs, stop } = harness({
      run: async () => ({ bodiesPurged: 0, rowsDeleted: 0 }),
    });

    await vi.advanceTimersByTimeAsync(60_000);

    expect(logs.some((line) => line.includes("0 body text purged"))).toBe(true);
    stop();
  });

  it("survives a failing sweep instead of taking the process down", async () => {
    const { logs, stop } = harness({
      run: async () => {
        throw new Error("connection lost");
      },
    });

    await vi.advanceTimersByTimeAsync(60_000);

    expect(logs.some((line) => line.includes("sweep failed: connection lost"))).toBe(true);
    stop();
  });

  it("does nothing when disabled, and says so", async () => {
    const { logs, run, stop } = harness({ enabled: false });

    await vi.advanceTimersByTimeAsync(24 * 60 * 60_000);

    expect(run).not.toHaveBeenCalled();
    expect(logs).toEqual(["[verdict-retention] disabled by configuration"]);
    stop();
  });

  it("stops cleanly so the timer cannot outlive the server", async () => {
    const { run, stop } = harness();

    stop();
    await vi.advanceTimersByTimeAsync(48 * 60 * 60_000);

    expect(run).not.toHaveBeenCalled();
  });

  it("refuses an impossible window pair at startup", () => {
    expect(() =>
      startInboxRetentionSchedule({
        bodyRetentionDays: 120,
        eventRetentionDays: 90,
        run: async () => ({ bodiesPurged: 0, rowsDeleted: 0 }),
        log: () => {},
      }),
    ).toThrow(/must not exceed/);
  });
});
