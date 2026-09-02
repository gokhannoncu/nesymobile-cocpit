/**
 * The `entityBinding.id` contract: run input path, variable path, or literal.
 *
 * The `var.` form exists because some identities cannot be run inputs. A tour
 * approval is keyed by the schedule, and in an end-to-end journey the run
 * CREATES the schedule — its id is unknowable at start. Measured on
 * run_419a050c: `run.input.scheduleId` resolved to nothing, the back-office
 * adapter refused the unbound tour call, and the run died at
 * `permit-verify-request-record` citing an input no operator could supply.
 */
import { describe, expect, it, vi } from "vitest";

import { resolveDeclaredEntityId } from "./bridgeflow-remote-steps.js";

function variables(values: Record<string, unknown>) {
  return {
    get: vi.fn((name: string) => values[name]),
    set: vi.fn(),
  } as unknown as Parameters<typeof resolveDeclaredEntityId>[2];
}

describe("resolveDeclaredEntityId", () => {
  it("reads a run input path", () => {
    expect(
      resolveDeclaredEntityId("run.input.scheduleId", { scheduleId: "11-36-1" }),
    ).toBe("11-36-1");
  });

  it("reads a column out of a single-row variable", () => {
    // What `read-current-schedule` leaves behind: one row, `maxRows: 1`.
    const vars = variables({
      approvalScheduleRows: [{ schedule_id: "11-36-20260902-1", schedule_status: "2" }],
    });

    expect(
      resolveDeclaredEntityId("var.approvalScheduleRows.schedule_id", {}, vars),
    ).toBe("11-36-20260902-1");
  });

  it("refuses to guess when a variable holds several rows", () => {
    // Taking [0] would be a guess about WHICH record the run meant — the
    // wrong-row bug this codebase refuses elsewhere.
    const vars = variables({
      rows: [{ schedule_id: "a" }, { schedule_id: "b" }],
    });

    expect(resolveDeclaredEntityId("var.rows.schedule_id", {}, vars)).toBeUndefined();
  });

  it("reads a whole variable when no column is named", () => {
    const vars = variables({ pinned: "11-36-1" });

    expect(resolveDeclaredEntityId("var.pinned", {}, vars)).toBe("11-36-1");
  });

  it("returns undefined for a var reference with no variable port", () => {
    expect(resolveDeclaredEntityId("var.pinned", {})).toBeUndefined();
  });

  it("treats anything else as a literal id", () => {
    // A pack is allowed to pin a fixed target; guessing a path out of it would
    // turn that into a missing one.
    expect(resolveDeclaredEntityId("11-36-20260902-1", {})).toBe("11-36-20260902-1");
  });

  it("returns undefined when nothing is declared", () => {
    expect(resolveDeclaredEntityId(undefined, {})).toBeUndefined();
  });

  it("returns undefined when the declared run input is absent", () => {
    // The failure mode that started this: absent, not blank — so the adapter
    // refuses rather than searching the back office for an empty string.
    expect(resolveDeclaredEntityId("run.input.scheduleId", { pin: "3680" })).toBeUndefined();
  });
});
