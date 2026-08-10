import { describe, expect, it } from "vitest";
import { deriveCapabilityManifest } from "@nesy/bridge-contract";
import { compileDomainWorkflow } from "@nesy/bridgeflow-compiler";
import { validateDomainPackBundle } from "@nesy/domain-pack-contracts";
import { validateWorkflowIrV2 } from "@nesy/workflow-contract";

import {
  buildMatchReactionBundle,
  MATCH_REACTION_MACRO_KEY,
  MATCH_REACTION_WORKFLOW_KEY,
} from "./index.js";

describe("match reaction domain pack", () => {
  it("is a valid second-domain bundle", () => {
    const bundle = buildMatchReactionBundle();
    expect(validateDomainPackBundle(bundle)).toEqual([]);
    expect(bundle.manifest.packKey).toBe("match.reaction");
    expect(bundle.registries.macros[0]?.expansionSnapshot?.authoredBy).toBe("COMPILER");
  });

  it("compiles through the generic BridgeFlow compiler without adding domain step kinds", () => {
    const bundle = buildMatchReactionBundle();
    const macro = bundle.registries.macros.find((entry) => entry.macroKey === MATCH_REACTION_MACRO_KEY);
    const ir = macro?.expansionSnapshot?.genericIr;
    expect(ir).toBeDefined();
    expect(validateWorkflowIrV2(ir!)).toEqual([]);

    const result = compileDomainWorkflow({
      bundle,
      workflowIr: ir!,
      macros: [macro!],
      expansionSnapshots: [macro!.expansionSnapshot!],
      deviceCapabilities: deriveCapabilityManifest(1),
    });

    expect(result.ok).toBe(true);
    expect(result.plan?.workflowRef).toBe(MATCH_REACTION_WORKFLOW_KEY);
    expect(result.plan?.steps.map((step) => step.kind)).toEqual(["ASSERT_FACT"]);
    expect(JSON.stringify(result.plan?.steps)).not.toMatch(/OPEN_STOP|PARCEL|COURIER|MATCH_DETAIL|REACTION_STEP/);
  });
});
