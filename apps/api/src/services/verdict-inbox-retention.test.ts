import { describe, expect, it } from "vitest";

import {
  DEFAULT_BODY_RETENTION_MS,
  DEFAULT_EVENT_RETENTION_MS,
  planInboxRetention,
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
