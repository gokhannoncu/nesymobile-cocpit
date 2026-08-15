import { describe, expect, it } from "vitest";

import { NESY_PROCESS_PARCEL_MACRO } from "./macros/process-parcel.js";
import { NESY_ADAPTER_QUERY_REFS } from "./registries/application.js";
import { NESY_FACTS } from "./registries/facts.js";

describe("process-parcel LOCAL queue measurement (G90.10 BD.6)", () => {
  const ir = NESY_PROCESS_PARCEL_MACRO.expansionSnapshot.genericIr;

  it("reads pendingOperation after the confirm tap and binds the queue fact", () => {
    const confirm = ir.steps.find((step) => step.planStepId === "tap-input-confirm");
    const read = ir.steps.find((step) => step.planStepId === "read-pending-queue");
    expect(confirm?.next).toBe("read-pending-queue");
    expect(read?.kind).toBe("SDK_QUERY");
    if (read?.kind !== "SDK_QUERY") throw new Error("expected SDK_QUERY");
    expect(read.queryRef).toBe(NESY_ADAPTER_QUERY_REFS.pendingOperation);
    expect(read.outputFactBindings).toEqual([
      {
        factKey: NESY_FACTS.OFFLINE_QUEUE_ITEM_WAITING,
        from: { kind: "COLUMN_NOT_IN", column: "pending_count", values: ["0"] },
      },
    ]);
    expect(read.next).toBe("assert-delivery-started");
  });

  it("keeps the queue fact OPTIONAL so uninjected online stays PASS_ONLINE", () => {
    const assert = ir.steps.find((step) => step.planStepId === "assert-delivery-started");
    if (assert?.kind !== "ASSERT_FACT") throw new Error("expected ASSERT_FACT");
    const queue = assert.finalOraclePolicy?.requirements.find(
      (requirement) => requirement.factKey === NESY_FACTS.OFFLINE_QUEUE_ITEM_WAITING,
    );
    expect(queue?.obligation).toBe("OPTIONAL");
    const template = NESY_PROCESS_PARCEL_MACRO.oracleTemplate.finalOracle.requirements.find(
      (requirement) => requirement.factKey === NESY_FACTS.OFFLINE_QUEUE_ITEM_WAITING,
    );
    expect(template?.obligation).toBe("OPTIONAL");
  });

  it("does not treat parcel persist as the queue fact", () => {
    const assert = ir.steps.find((step) => step.planStepId === "assert-delivery-started");
    if (assert?.kind !== "ASSERT_FACT") throw new Error("expected ASSERT_FACT");
    const keys = (assert.finalOraclePolicy?.requirements ?? []).map((requirement) => requirement.factKey);
    expect(keys).toContain(NESY_FACTS.OFFLINE_QUEUE_ITEM_WAITING);
    expect(keys).not.toContain(NESY_FACTS.PARCEL_RECORD_PERSISTED);
  });
});
