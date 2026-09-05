import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { getNodeConfigSchema } from "./workflow-node-config";
import { WorkflowNodeType } from "./workflow-types";

const panelSource = readFileSync(resolve(__dirname, "./NodeSettingsPanel.tsx"), "utf8");

function customBlock(nodeType: string, nextNodeType: string): string {
  const start = panelSource.indexOf(`if (node.type === "${nodeType}")`);
  const end = panelSource.indexOf(`if (node.type === "${nextNodeType}")`);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return panelSource.slice(start, end);
}

describe("NodeSettingsPanel — Delivery Operation", () => {
  it("offers every required schema field, so Run Test cannot demand a value the panel hides", () => {
    // The regression: `workflow-node-config` marked barcode + proofLookupId
    // required, Run Test blocked, and the custom form only showed Person
    // Delivered / Wait Before Delivery.
    const block = customBlock("DELIVERY_OPERATION", "WAIT");
    const required = getNodeConfigSchema(WorkflowNodeType.DELIVERY_OPERATION).filter(
      (field) => field.required,
    );

    expect(required.map((field) => field.key).sort()).toEqual(["barcode", "proofLookupId"]);
    for (const field of required) {
      expect(block).toContain(`label="${field.label}"`);
      expect(block).toContain(`onChange({ ${field.key}:`);
    }
  });
});
