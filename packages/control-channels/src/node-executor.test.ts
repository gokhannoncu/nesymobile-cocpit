import { describe, expect, it } from "vitest";
import { newRequestId } from "@nesy/control-contract";
import type { AdbRunner } from "./index.js";
import {
  createControlExecutor,
  type ControlExecutorEvent,
} from "./node-executor.js";

describe("createControlExecutor Verdict-only detection", () => {
  it("ping başarısızlığını legacy'ye düşmeden coded error olarak döndürür", async () => {
    const events: ControlExecutorEvent[] = [];
    const adb: AdbRunner = () => Promise.reject(new Error("device offline"));
    const executor = createControlExecutor({
      applicationId: "com.arasdigital.nesymobile.rstest",
      adb,
      onEvent: (event) => events.push(event),
    });

    const result = await executor.run("TESTSERIAL01", {
      op: "get_state",
      requestId: newRequestId("detect-fail"),
      scope: "test",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("CHANNEL_UNAVAILABLE");
      expect(result.detail).toContain("Verdict channel detection failed");
    }
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      channel: "verdict",
      ok: false,
      code: "CHANNEL_UNAVAILABLE",
    });
  });
});
