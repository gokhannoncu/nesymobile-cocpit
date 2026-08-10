import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  BRIDGE_COMMANDS,
  BRIDGE_V1_DEVICE_GAPS,
  cancelScopeFor,
  capabilityManifestFromDeviceResponse,
  isBridgeCommand,
  planWaitExecution,
  type UiWaitPlan,
} from "./index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const matrixPath = path.join(
  repoRoot,
  "verdict-contract-fixtures/compatibility/m4c-pack-adapter-bridge-matrix.json",
);
const capabilitiesFixturePath = path.join(
  repoRoot,
  "verdict-contract-fixtures/control-plane/capabilities_response.json",
);

describe("M4C pack/adapter/bridge compatibility fixtures", () => {
  it("locks the matrix against Mobile M3+ bridge surface", () => {
    const matrix = JSON.parse(readFileSync(matrixPath, "utf8")) as {
      bridge: {
        supportsWaitAny: boolean;
        supportsCancelRequest: boolean;
        supportsUnsolicitedPush: boolean;
        commandsRequired: string[];
        commandsForbidden: string[];
      };
      adapter: {
        requiredCapabilityKinds: string[];
        namedQueryRefs: string[];
      };
    };

    expect(matrix.bridge.supportsWaitAny).toBe(true);
    expect(matrix.bridge.supportsCancelRequest).toBe(true);
    expect(matrix.bridge.supportsUnsolicitedPush).toBe(false);
    expect(BRIDGE_V1_DEVICE_GAPS.waitAny).toBe(true);
    expect(BRIDGE_V1_DEVICE_GAPS.cancelRequest).toBe(true);
    expect(BRIDGE_V1_DEVICE_GAPS.unsolicitedPush).toBe(false);

    for (const command of matrix.bridge.commandsRequired) {
      expect(isBridgeCommand(command)).toBe(true);
      expect(BRIDGE_COMMANDS).toContain(command);
    }
    for (const command of matrix.bridge.commandsForbidden) {
      expect(isBridgeCommand(command)).toBe(false);
    }

    expect(matrix.adapter.requiredCapabilityKinds).toContain("NAMED_QUERY");
    expect(matrix.adapter.namedQueryRefs).toContain("nesy.availableStops");
    expect(cancelScopeFor({ supportsCancelRequest: true })).toBe("HOST_AND_DEVICE");
  });

  it("parses the golden capabilities fixture into SINGLE_WAIT_ANY strategy", () => {
    const fixture = JSON.parse(readFileSync(capabilitiesFixturePath, "utf8")) as {
      response: Record<string, unknown>;
    };
    const manifest = capabilityManifestFromDeviceResponse(fixture.response);
    expect(manifest.supportsWaitAny).toBe(true);
    expect(manifest.supportsCancelRequest).toBe(true);
    expect(manifest.supportsUnsolicitedPush).toBe(false);

    const plan: UiWaitPlan = {
      timeoutMs: 5_000,
      expected: [
        {
          key: "ready",
          predicate: { selector: { by: "id", value: "ready" }, until: "APPEAR" },
        },
      ],
    };
    // The device half of the negotiation: with the host side implemented, an M4C
    // manifest is enough to collapse the plan to one command. The shipped default
    // still races wait_node, because only the host is behind.
    expect(planWaitExecution(plan, manifest, true).kind).toBe("SINGLE_WAIT_ANY");
    expect(planWaitExecution(plan, manifest).kind).toBe("RACED_WAIT_NODE");
  });
});
