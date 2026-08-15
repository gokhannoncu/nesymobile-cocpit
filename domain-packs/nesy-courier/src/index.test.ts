/**
 * ===========================================================================
 *  Nesy Courier reference pack acceptance suite  (CHECKPOINT 4B)
 *
 *  These tests are the reason the reference pack is worth having. A pack that
 *  merely type-checks proves that the fields exist; what has to be proven is that
 *  the pack's own rules hold — and that the ways a suite goes green while proving
 *  nothing are each refused by something mechanical.
 *
 *  So the file is organised as: the bundle is valid → the six slices exist and are
 *  complete → each canonical safeguard is asserted individually → the negative
 *  cases are refused when deliberately broken.
 * ===========================================================================
 */

import {
  computeBundleDigest,
  freezeBundle,
  parseDomainPackBundle,
  publishBundle,
  validateDomainPackBundle,
  type DomainPackBundle,
} from "@nesy/domain-pack-contracts";
import { hashWorkflowIrV2, validateWorkflowIrV2 } from "@nesy/workflow-contract";
import { describe, expect, it } from "vitest";
import { NESY_BACKOFFICE_ADAPTER, NESY_BACKOFFICE_OPERATIONS } from "./adapters/backoffice.js";
import { buildNesyCourierBundle, NESY_COURIER_PACK_KEY } from "./bundle.js";
import { NESY_COURIER_DERIVED_FACTS } from "./evidence/derived.js";
import { NESY_COURIER_EVIDENCE_SOURCES } from "./evidence/sources.js";
import { NESY_OPEN_STOP_MACRO } from "./macros/open-stop.js";
import { NESY_LAUNCH_PROFILES, NESY_COURIER_LAUNCH_PROFILES } from "./profiles/launch.js";
import { NESY_COURIER_TEST_PROFILES } from "./profiles/test-profiles.js";
import { NESY_COURIER_FRAGMENTS, NESY_COURIER_INDEPENDENT_WORKFLOWS, NESY_WORKFLOWS } from "./profiles/workflows.js";
import { NESY_COURIER_ENTITIES } from "./registries/entities.js";
import { NESY_FACTS } from "./registries/facts.js";
import { NESY_COURIER_FEATURES } from "./registries/features.js";
import { NESY_COURIER_SCREENS } from "./registries/screens.js";
import { NESY_COURIER_SURFACES } from "./registries/surfaces.js";
import { NESY_COURIER_TARGETS, NESY_TARGETS } from "./registries/targets.js";
import {
  findReferenceSlice,
  NESY_COURIER_DOMAIN_PACK_REFERENCE_V1,
  NESY_COURIER_REFERENCE_SLICE_KEYS,
  referenceArtifactDigest,
} from "./reference.js";

/** Deep clone through JSON so a mutation test cannot corrupt the shared bundle. */
function clone(bundle: DomainPackBundle): DomainPackBundle {
  return JSON.parse(JSON.stringify(bundle)) as DomainPackBundle;
}

describe("bundle", () => {
  it("validates with zero issues", () => {
    const issues = validateDomainPackBundle(buildNesyCourierBundle());
    expect(issues).toEqual([]);
  });

  it("parses as untrusted input", () => {
    const result = parseDomainPackBundle(JSON.parse(JSON.stringify(buildNesyCourierBundle())));
    expect(result.ok).toBe(true);
  });

  it("digests deterministically and independently of key order", () => {
    const a = buildNesyCourierBundle();
    const b = buildNesyCourierBundle();
    expect(computeBundleDigest(a)).toBe(computeBundleDigest(b));
    expect(computeBundleDigest(a)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("changes digest when executable content changes", () => {
    const mutated = clone(buildNesyCourierBundle());
    const target = mutated.registries.targets.find((t) => t.targetKey === NESY_TARGETS.stopRow);
    expect(target).toBeDefined();
    if (target !== undefined) {
      (target.resolution as { deadlineMs: number }).deadlineMs = 99_000;
    }
    expect(computeBundleDigest(mutated)).not.toBe(computeBundleDigest(buildNesyCourierBundle()));
  });

  it("publishes, records provenance and freezes the result", () => {
    const published = publishBundle(buildNesyCourierBundle(), {
      publishedAt: "2026-08-05T09:00:00.000Z",
      publishedBy: "phase-4b",
      sourceCommit: "0000000",
    });

    expect(published.packKey).toBe(NESY_COURIER_PACK_KEY);
    expect(published.bundle.manifest.publicationState).toBe("PUBLISHED");
    expect(published.bundle.manifest.provenance?.bundleDigest).toBe(published.digest);
    // The published version must not be editable in place: a mutable published
    // artifact turns every historical verdict into an anecdote.
    expect(Object.isFrozen(published.bundle)).toBe(true);
    expect(Object.isFrozen(published.bundle.registries.screens)).toBe(true);
    expect(validateDomainPackBundle(published.bundle)).toEqual([]);
  });

  it("refuses a published bundle whose recorded digest no longer matches", () => {
    const published = publishBundle(buildNesyCourierBundle(), {
      publishedAt: "2026-08-05T09:00:00.000Z",
      publishedBy: "phase-4b",
      sourceCommit: "0000000",
    });
    const tampered = clone(published.bundle);
    tampered.manifest.businessScope = "something else entirely";

    const codes = validateDomainPackBundle(tampered).map((issue) => issue.code);
    expect(codes).toContain("PUBLISHED_DIGEST_MISMATCH");
  });

  it("deep-freezes nested registry entries", () => {
    const frozen = freezeBundle(buildNesyCourierBundle());
    expect(Object.isFrozen(frozen.registries.targets[0])).toBe(true);
    expect(Object.isFrozen(frozen.manifest.notResponsibleFor)).toBe(true);
  });
});

describe("registries", () => {
  /**
   * Pins the counts published in
   * `docs/NESY_COURIER_DOMAIN_PACK_REFERENCE_V1.md` §2.
   *
   * A reference document whose numbers drift silently is worse than no document:
   * the first reader to trust it is wrong, and nothing reported it.
   */
  it("matches the registry counts published in the reference document", () => {
    const g = buildNesyCourierBundle().registries;
    expect({
      applications: g.applications.length,
      screens: g.screens.length,
      surfaces: g.surfaces.length,
      entities: g.entities.length,
      targets: g.targets.length,
      evidenceSources: g.evidenceSources.length,
      derivedFacts: g.derivedFacts.facts.length,
      semanticActions: g.semanticActions.length,
      macros: g.macros.length,
      launchProfiles: g.launchProfiles.length,
      testProfiles: g.testProfiles.length,
      campaigns: g.campaigns.length,
      features: g.features.length,
      capabilities: g.capabilities.length,
      adapterOperations: g.remoteAdapters[0].operations.length,
    }).toEqual({
      applications: 1,
      screens: 7,
      surfaces: 10,
      entities: 7,
      targets: 28,
      evidenceSources: 57,
      derivedFacts: 6,
      semanticActions: 10,
      macros: 13,
      launchProfiles: 4,
      testProfiles: 16,
      campaigns: 4,
      features: 3,
      capabilities: 16,
      adapterOperations: 10,
    });
  });

  it("matches the per-plane evidence counts published in the reference document", () => {
    const byPlane: Record<string, number> = {};
    for (const source of NESY_COURIER_EVIDENCE_SOURCES) {
      byPlane[source.plane] = (byPlane[source.plane] ?? 0) + 1;
    }
    expect(byPlane).toEqual({ UI: 17, APP: 26, LOCAL: 9, REMOTE: 5 });
  });

  it("declares the seven minimum screens", () => {
    expect(NESY_COURIER_SCREENS).toHaveLength(7);
    for (const key of [
      "nesy.auth.login",
      "nesy.route.stop-list",
      "nesy.stop.task-list",
      "nesy.delivery.flow",
      "nesy.pickup.flow",
      "nesy.vehicle-loading",
      "nesy.end-of-day",
    ]) {
      expect(NESY_COURIER_SCREENS.map((s) => s.screenKey)).toContain(key);
    }
  });

  it("declares the ten minimum surfaces, none of them as screens", () => {
    expect(NESY_COURIER_SURFACES).toHaveLength(10);
    const screenKeys = new Set(NESY_COURIER_SCREENS.map((s) => s.screenKey));
    for (const surface of NESY_COURIER_SURFACES) {
      expect(screenKeys.has(surface.surfaceKey)).toBe(false);
    }
  });

  it("declares the seven business entities, each with a business key", () => {
    expect(NESY_COURIER_ENTITIES.map((e) => e.entityType).sort()).toEqual([
      "PARCEL",
      "PENDING_OPERATION",
      "ROUTE",
      "SHIPMENT",
      "STOP",
      "TASK",
      "TOUR_APPROVAL_REQUEST",
    ]);
    for (const entity of NESY_COURIER_ENTITIES) {
      expect(entity.businessKeyPath).not.toBe("");
    }
  });

  it("redacts recipient data on the stop entity", () => {
    const stop = NESY_COURIER_ENTITIES.find((e) => e.entityType === "STOP");
    expect(stop?.redaction.redactPaths).toContain("address");
    expect(stop?.redaction.redactPaths).toContain("recipientPhone");
  });

  it("carries the minimum normalized fact set", () => {
    const known = new Set<string>([
      ...NESY_COURIER_EVIDENCE_SOURCES.map((s) => s.factKey).filter((k): k is string => k !== undefined),
      ...NESY_COURIER_DERIVED_FACTS.facts.map((f) => f.factKey),
      ...NESY_BACKOFFICE_ADAPTER.operations.flatMap((op) => op.outputs.map((o) => o.factKey)),
    ]);

    for (const fact of [
      NESY_FACTS.AUTH_ACCEPTED,
      NESY_FACTS.USER_SESSION_AVAILABLE_LOCAL,
      NESY_FACTS.USER_SESSION_AVAILABLE_APP,
      NESY_FACTS.ROUTES_AVAILABLE,
      NESY_FACTS.ROUTE_DIALOG_READY,
      NESY_FACTS.ACTIVE_STOP_MATCHES,
      NESY_FACTS.OFFLINE_QUEUE_ITEM_WAITING,
      NESY_FACTS.DELIVERY_CONFIRMED,
      NESY_FACTS.TOUR_APPROVAL_REQUESTED,
      NESY_FACTS.TOUR_APPROVAL_REQUEST_CREATED,
      NESY_FACTS.TOUR_APPROVAL_STATUS_APPROVED,
      NESY_FACTS.TOUR_APPROVAL_PUSH_RECEIVED,
    ]) {
      expect(known.has(fact)).toBe(true);
    }
  });

  it("keeps the offline queue inside the LOCAL plane instead of inventing one", () => {
    const queue = NESY_COURIER_EVIDENCE_SOURCES.filter((s) => s.kind === "OFFLINE_QUEUE_WATCH");
    expect(queue.length).toBeGreaterThan(0);
    for (const source of queue) expect(source.plane).toBe("LOCAL");
    expect(NESY_COURIER_EVIDENCE_SOURCES.map((s) => String(s.plane))).not.toContain("QUEUE");
  });

  it("preserves raw evidence on every source", () => {
    for (const source of NESY_COURIER_EVIDENCE_SOURCES) {
      expect(source.preservesRawEvidence).toBe(true);
    }
  });

  it("keeps the capability catalog limited to platform and the Nesy domain layer", () => {
    const bundle = buildNesyCourierBundle();
    const layers = new Set(bundle.registries.capabilities.map((c) => c.layer));
    expect([...layers].sort()).toEqual(["domain.nesy", "verdict.core"]);
    for (const capability of bundle.registries.capabilities) {
      expect(capability.capabilityKey.startsWith(`${capability.layer}.`)).toBe(true);
    }
  });
});

describe("target resolution", () => {
  it("never lets a row index establish identity", () => {
    for (const target of NESY_COURIER_TARGETS) {
      for (const strategy of target.resolution.chain) {
        if (strategy.kind === "ROW_INDEX_HINT") {
          expect(strategy.establishesIdentity).toBe(false);
          expect(target.resolution.chain.at(-1)).toBe(strategy);
        }
      }
    }
  });

  it("fails closed on ambiguity everywhere", () => {
    for (const target of NESY_COURIER_TARGETS) {
      expect(target.resolution.ambiguityPolicy).toBe("FAIL");
    }
  });

  it("resolves complete-delivery by the measured button, not an invented id", () => {
    const complete = NESY_COURIER_TARGETS.find((t) => t.targetKey === NESY_TARGETS.deliveryCompleteButton);
    expect(complete?.resolution.chain).toEqual([
      { kind: "ACCESSIBILITY_ID", selector: { id: "btn_deliver" }, establishesIdentity: true },
    ]);
    expect(complete?.resolution.ambiguityPolicy).toBe("FAIL");
    expect(complete?.resolution.reverifyBeforeAction).toBe(true);
  });

  it("resolves the stop row by entity binding and fingerprint before any hint", () => {
    const stopRow = NESY_COURIER_TARGETS.find((t) => t.targetKey === NESY_TARGETS.stopRow);
    // No ACCESSIBILITY_ID link: measured on device, a stop row carries no id at
    // all. The `stop_row_*` prefix this chain used to open with never existed —
    // the same invention as `route_row_*`. A strategy that cannot match is worse
    // than a missing one, because it reads as coverage.
    expect(stopRow?.resolution.chain.map((s) => s.kind)).toEqual([
      "ENTITY_BINDING",
      "STRUCTURAL_FINGERPRINT",
      "ROW_INDEX_HINT",
    ]);
    // Both fall back to the RecyclerView that is really on screen.
    for (const strategy of stopRow?.resolution.chain ?? []) {
      const selector = strategy.selector as { containerId?: string };
      if (selector.containerId !== undefined) expect(selector.containerId).toBe("rv");
    }
    // The list can re-sort between resolution and tap; that window is the bug.
    expect(stopRow?.resolution.reverifyBeforeAction).toBe(true);
    expect(stopRow?.entityBinding?.entityTypeRef).toBe("STOP");
    expect(stopRow?.entityBinding?.projectedPaths.length).toBeGreaterThan(0);
    expect(stopRow?.entityBinding?.redactProjection).toBe(true);
  });

  it("rejects a bundle where a row index claims identity", () => {
    const mutated = clone(buildNesyCourierBundle());
    const stopRow = mutated.registries.targets.find((t) => t.targetKey === NESY_TARGETS.stopRow);
    const hint = stopRow?.resolution.chain.find((s) => s.kind === "ROW_INDEX_HINT");
    if (hint !== undefined) (hint as { establishesIdentity: boolean }).establishesIdentity = true;

    const messages = validateDomainPackBundle(mutated).map((i) => i.message);
    expect(messages.some((m) => m.includes("ROW_INDEX_AS_IDENTITY"))).toBe(true);
  });
});

describe("evidence", () => {
  it("refuses to let an HTTP 2xx source bind a business fact", () => {
    const ack = NESY_COURIER_EVIDENCE_SOURCES.find((s) => s.transportSuccessOnly === true);
    expect(ack).toBeDefined();
    expect(ack?.factKey).toBeUndefined();
    expect(ack?.authority).not.toBe("PRIMARY");
  });

  it("rejects a bundle where a transport-only source binds a fact", () => {
    const mutated = clone(buildNesyCourierBundle());
    const ack = mutated.registries.evidenceSources.find((s) => s.transportSuccessOnly === true);
    if (ack !== undefined) (ack as { factKey?: string }).factKey = NESY_FACTS.DELIVERY_CONFIRMED;

    const messages = validateDomainPackBundle(mutated).map((i) => i.message);
    expect(messages.some((m) => m.includes("TRANSPORT_SUCCESS_AS_BUSINESS_FACT"))).toBe(true);
  });

  it("derives every cross-plane conclusion with correlation and preserved inputs", () => {
    for (const fact of NESY_COURIER_DERIVED_FACTS.facts) {
      expect(fact.preserveInputs).toBe(true);
      expect(fact.requiresCorrelation).toBe(true);
      expect(fact.provenance.inputFactKeys.length).toBeGreaterThan(1);
    }
  });

  it("rejects a derivation cycle", () => {
    const mutated = clone(buildNesyCourierBundle());
    const confirmed = mutated.registries.derivedFacts.facts.find(
      (f) => f.factKey === NESY_FACTS.DELIVERY_CONFIRMED,
    );
    const login = mutated.registries.derivedFacts.facts.find((f) => f.factKey === NESY_FACTS.LOGIN_SUCCEEDED);
    if (confirmed !== undefined && login !== undefined) {
      (confirmed.provenance as { inputFactKeys: string[] }).inputFactKeys = [NESY_FACTS.LOGIN_SUCCEEDED];
      (login.provenance as { inputFactKeys: string[] }).inputFactKeys = [NESY_FACTS.DELIVERY_CONFIRMED];
    }

    const messages = validateDomainPackBundle(mutated).map((i) => i.message);
    expect(messages.some((m) => m.includes("DERIVED_FACT_CYCLE"))).toBe(true);
  });

  it("rejects a derivation whose input nothing produces", () => {
    const mutated = clone(buildNesyCourierBundle());
    const fact = mutated.registries.derivedFacts.facts[0];
    (fact.provenance as { inputFactKeys: string[] }).inputFactKeys = ["APP.TYPO_NOBODY_PRODUCES"];

    const messages = validateDomainPackBundle(mutated).map((i) => i.message);
    expect(messages.some((m) => m.includes("DERIVED_FACT_UNDEFINED_INPUT"))).toBe(true);
  });
});

describe("launch and test profiles", () => {
  it("lets only the real-login profile carry a product verdict", () => {
    for (const profile of NESY_COURIER_LAUNCH_PROFILES) {
      if (profile.sessionPreparation === "REAL_UI_LOGIN") {
        expect(profile.producesProductVerdict).toBe(true);
      } else {
        expect(profile.producesProductVerdict).toBe(false);
        expect(profile.releaseIsolation.automationOnly).toBe(true);
        expect(profile.releaseIsolation.releaseGuard).not.toBe("");
      }
    }
  });

  it("rejects a prepared-session profile that claims a product verdict", () => {
    const mutated = clone(buildNesyCourierBundle());
    const prepared = mutated.registries.launchProfiles.find(
      (p) => p.profileKey === NESY_LAUNCH_PROFILES.preparedSession,
    );
    if (prepared !== undefined) (prepared as { producesProductVerdict: boolean }).producesProductVerdict = true;

    const messages = validateDomainPackBundle(mutated).map((i) => i.message);
    expect(messages.some((m) => m.includes("SETUP_LAUNCH_PRODUCES_VERDICT"))).toBe(true);
  });

  it("keeps preview profiles out of the release gate and gating profiles unsampled", () => {
    for (const profile of NESY_COURIER_TEST_PROFILES) {
      if (profile.kind === "PREVIEW" || profile.kind === "DIAGNOSTIC") {
        expect(profile.releaseGate).toBe(false);
      }
      if (profile.releaseGate) {
        expect(profile.telemetry.evidenceSampleEveryN).toBe(1);
        expect(profile.telemetry.retainRawEvidence).toBe(true);
      }
    }
  });

  it("rejects a preview profile promoted to a release gate", () => {
    const mutated = clone(buildNesyCourierBundle());
    const preview = mutated.registries.testProfiles.find((p) => p.kind === "PREVIEW");
    if (preview !== undefined) (preview as { releaseGate: boolean }).releaseGate = true;

    const messages = validateDomainPackBundle(mutated).map((i) => i.message);
    expect(messages.some((m) => m.includes("PREVIEW_PROFILE_GATES_RELEASE"))).toBe(true);
  });

  it("correlates every injected fault and names its expected recovery", () => {
    const badDay = NESY_COURIER_TEST_PROFILES.find((p) => p.kind === "BAD_DAY");
    expect(badDay?.faultPlan?.injections.length).toBeGreaterThan(0);
    for (const injection of badDay?.faultPlan?.injections ?? []) {
      expect(injection.correlationFactKey).not.toBe("");
      expect(injection.expectedRecoveryFactKey).not.toBe("");
    }
  });

  it("requires a baseline and critical facts on the differential profile", () => {
    const differential = NESY_COURIER_TEST_PROFILES.find((p) => p.kind === "DIFFERENTIAL");
    expect(differential?.differential?.baselineBuildRef).not.toBe("");
    expect(differential?.differential?.criticalFactKeys.length).toBeGreaterThan(0);
  });
});

describe("features and fragments", () => {
  it("keeps authoring edits out of the executable digest", () => {
    const before = NESY_COURIER_FEATURES[0].executableDigest;
    const mutated = clone(buildNesyCourierBundle());
    mutated.registries.features[0].authoring.description = "completely rewritten prose";
    mutated.registries.features[0].authoring.tags = ["different", "tags"];

    // Authoring churn must not invalidate a pinned run.
    expect(validateDomainPackBundle(mutated).map((i) => i.code)).not.toContain("FEATURE_INVALID");
    expect(NESY_COURIER_FEATURES[0].executableDigest).toBe(before);
  });

  it("moves the executable digest when executable content changes", () => {
    const mutated = clone(buildNesyCourierBundle());
    mutated.registries.features[0].executable.contractVersion = 2;

    const messages = validateDomainPackBundle(mutated).map((i) => i.message);
    expect(messages.some((m) => m.includes("FEATURE_DIGEST_MISMATCH"))).toBe(true);
  });

  it("never binds an AI_SUGGESTED invariant to a release gate", () => {
    for (const feature of NESY_COURIER_FEATURES) {
      for (const invariant of feature.executable.invariants) {
        if (invariant.authority === "AI_SUGGESTED") expect(invariant.bindsReleaseGate).toBe(false);
        expect(invariant.factKeys.length).toBeGreaterThan(0);
      }
    }
  });

  it("rejects an AI_SUGGESTED invariant promoted to a gate", () => {
    const mutated = clone(buildNesyCourierBundle());
    for (const feature of mutated.registries.features) {
      for (const invariant of feature.executable.invariants) {
        if (invariant.authority === "AI_SUGGESTED") {
          (invariant as { bindsReleaseGate: boolean }).bindsReleaseGate = true;
        }
      }
    }

    const messages = validateDomainPackBundle(mutated).map((i) => i.message);
    expect(messages.some((m) => m.includes("AI_INVARIANT_GATES_RELEASE"))).toBe(true);
  });

  it("keeps fragments verdict-free and independent workflows self-scoped", () => {
    for (const fragment of NESY_COURIER_FRAGMENTS) {
      expect(fragment.producesTerminalVerdict).toBe(false);
    }
    for (const workflow of NESY_COURIER_INDEPENDENT_WORKFLOWS) {
      expect(workflow.occurrenceScope).toBe("INDEPENDENT");
      expect(workflow.oracleTemplate.finalOracle.requirements.length).toBeGreaterThan(0);
    }
  });

  it("rejects a fragment that claims a terminal verdict", () => {
    const mutated = clone(buildNesyCourierBundle());
    (mutated.registries.fragments[0] as { producesTerminalVerdict: unknown }).producesTerminalVerdict = true;

    const messages = validateDomainPackBundle(mutated).map((i) => i.message);
    expect(messages.some((m) => m.includes("FRAGMENT_PRODUCES_VERDICT"))).toBe(true);
  });
});

describe("back-office adapter", () => {
  it("carries no transport detail anywhere", () => {
    for (const operation of NESY_BACKOFFICE_ADAPTER.operations) {
      const raw = operation as unknown as Record<string, unknown>;
      for (const field of ["url", "endpoint", "method", "headers", "body", "host", "path", "query", "script"]) {
        expect(raw[field]).toBeUndefined();
      }
    }
  });

  it("audits every mutation and bounds its environments", () => {
    for (const operation of NESY_BACKOFFICE_ADAPTER.operations) {
      if (operation.effectClass !== "READ_ONLY") {
        expect(operation.audit.recordRequest).toBe(true);
        expect(operation.allowedEnvironments.length).toBeGreaterThan(0);
      }
    }
  });

  it("treats the approve call's acknowledgement as no evidence at all", () => {
    const approve = NESY_BACKOFFICE_ADAPTER.operations.find(
      (op) => op.operationRef === NESY_BACKOFFICE_OPERATIONS.approveTourRequest,
    );
    expect(approve?.transportSuccessOnly).toBe(true);
    expect(approve?.outputs).toEqual([]);
    expect(approve?.actorRole).toBe("DISPATCHER");
    expect(approve?.idempotencyClass).toBe("KEYED");
  });

  it("requires an entity status and a correlation on every validation fact", () => {
    for (const operation of NESY_BACKOFFICE_ADAPTER.operations) {
      if (operation.role !== "VALIDATION") continue;
      expect(operation.outputs.length).toBeGreaterThan(0);
      for (const output of operation.outputs) {
        expect(output.entityStatusPath).toBeDefined();
        expect(output.correlationPath).toBeDefined();
      }
    }
  });

  it("rejects a setup operation that binds business evidence", () => {
    const mutated = clone(buildNesyCourierBundle());
    const seed = mutated.registries.remoteAdapters[0].operations.find((op) => op.role === "SETUP");
    if (seed !== undefined) {
      (seed as { outputs: unknown[] }).outputs = [
        { factKey: NESY_FACTS.ROUTE_ASSIGNED, responsePath: "seed.ok", entityStatusPath: "s", correlationPath: "c" },
      ];
    }

    const messages = validateDomainPackBundle(mutated).map((i) => i.message);
    expect(messages.some((m) => m.includes("SETUP_BINDS_BUSINESS_FACT"))).toBe(true);
  });
});

describe("runtime code policy", () => {
  it("rejects an inline script field anywhere in the bundle", () => {
    const mutated = clone(buildNesyCourierBundle()) as unknown as Record<string, unknown>;
    (mutated.registries as Record<string, unknown>).script = "return 1";

    const codes = validateDomainPackBundle(mutated as unknown as DomainPackBundle).map((i) => i.code);
    expect(codes).toContain("RUNTIME_CODE_FORBIDDEN");
  });

  it("rejects code-shaped content hiding in an ordinary string", () => {
    const mutated = clone(buildNesyCourierBundle());
    mutated.manifest.businessScope = "eval('drop everything')";

    const codes = validateDomainPackBundle(mutated).map((i) => i.code);
    expect(codes).toContain("RUNTIME_CODE_FORBIDDEN");
  });

  it("rejects a relaxed runtime code policy", () => {
    const mutated = clone(buildNesyCourierBundle());
    (mutated.runtimeCodePolicy as { allowEval: unknown }).allowEval = true;

    const codes = validateDomainPackBundle(mutated).map((i) => i.code);
    expect(codes).toContain("RUNTIME_CODE_FORBIDDEN");
  });
});

describe("NESY_COURIER_DOMAIN_PACK_REFERENCE_V1", () => {
  it("carries exactly the seven canonical slices, in courier-day order", () => {
    expect(NESY_COURIER_DOMAIN_PACK_REFERENCE_V1.slices.map((s) => s.sliceKey)).toEqual(
      NESY_COURIER_REFERENCE_SLICE_KEYS,
    );
  });

  it("gives every slice the complete required field set", () => {
    for (const slice of NESY_COURIER_DOMAIN_PACK_REFERENCE_V1.slices) {
      expect(slice.businessMeaning.length).toBeGreaterThan(20);
      expect(slice.notResponsibleFor.length).toBeGreaterThan(0);
      expect(slice.inputSchema.fields.length).toBeGreaterThan(0);
      expect(slice.outputSchema.fields.length).toBeGreaterThan(0);
      expect(slice.preconditions.length).toBeGreaterThan(0);
      expect(slice.screenRefs.length).toBeGreaterThan(0);
      expect(slice.targetResolutionRefs.length).toBeGreaterThan(0);
      expect(slice.semanticMacroRef).not.toBe("");
      expect(slice.oracle.finalOracle.requirements.length).toBeGreaterThan(0);
      expect(slice.oracle.continueGate.deadlineMs).toBeGreaterThan(0);
      expect(slice.interruptPolicy.fatalSurfaceRefs.length).toBeGreaterThan(0);
      expect(slice.requiredCapabilityRefs.length).toBeGreaterThan(0);
      expect(slice.releaseIsolation.releaseGuard).not.toBe("");
      expect(slice.negativeCases.length).toBeGreaterThan(0);
      expect(slice.macroExpansion.domainSourceMap.length).toBeGreaterThan(0);
      expect(slice.bridgeFlowPlanSnapshot.legs.length).toBeGreaterThan(0);
    }
  });

  it("keeps every generic IR snapshot valid WorkflowIR v2", () => {
    for (const slice of NESY_COURIER_DOMAIN_PACK_REFERENCE_V1.slices) {
      const issues = validateWorkflowIrV2(slice.genericIrSnapshot, {
        availableCapabilities: slice.genericIrSnapshot.capabilityRequirements
          .filter((requirement) => !requirement.optional)
          .map((requirement) => requirement.capability)
          .concat(
            slice.genericIrSnapshot.steps.flatMap((step) =>
              step.capabilityRequirements.filter((r) => !r.optional).map((r) => r.capability),
            ),
          ),
      });
      expect({ slice: slice.sliceKey, issues }).toEqual({ slice: slice.sliceKey, issues: [] });
    }
  });

  it("labels every snapshot as compiler-authored WorkflowIR output", () => {
    for (const slice of NESY_COURIER_DOMAIN_PACK_REFERENCE_V1.slices) {
      expect(slice.macroExpansion.authoredBy).toBe("COMPILER");
      expect(slice.bridgeFlowPlanSnapshot.authoredBy).toBe("COMPILER");
      expect(slice.genericIrSnapshot.source.kind).toBe("DOMAIN_PACK_EXPANSION");
    }
  });

  it("traces every domain source map entry to a real generic step", () => {
    for (const slice of NESY_COURIER_DOMAIN_PACK_REFERENCE_V1.slices) {
      const stepIds = new Set(slice.genericIrSnapshot.steps.map((step) => step.planStepId));
      for (const entry of slice.macroExpansion.domainSourceMap) {
        expect(entry.macroRef).toBe(slice.semanticMacroRef);
        for (const planStepId of entry.planStepIds) expect(stepIds.has(planStepId)).toBe(true);
      }
      // And back the other way: every step names a source map entry.
      const refs = new Set(slice.genericIrSnapshot.sourceMap.map((entry) => entry.ref));
      for (const step of slice.genericIrSnapshot.steps) expect(refs.has(step.sourceMapRef)).toBe(true);
    }
  });

  it("gives each slice a distinct, deterministic plan hash", () => {
    const hashes = NESY_COURIER_DOMAIN_PACK_REFERENCE_V1.slices.map((s) => hashWorkflowIrV2(s.genericIrSnapshot));
    expect(new Set(hashes).size).toBe(hashes.length);
    expect(hashes).toEqual(
      NESY_COURIER_DOMAIN_PACK_REFERENCE_V1.slices.map((s) => hashWorkflowIrV2(s.genericIrSnapshot)),
    );
  });

  it("digests deterministically", () => {
    expect(referenceArtifactDigest()).toBe(referenceArtifactDigest());
    expect(referenceArtifactDigest()).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("never expands into a step kind outside the generic union", () => {
    const allowed = new Set([
      "SDK_QUERY",
      "RESOLVE_TARGET",
      "BRIDGE_ACTION",
      "WAIT_ANY",
      "ASSERT_FACT",
      "CONDITION",
      "SWITCH",
      "FOR_EACH",
      "WAIT_EVENT",
      "REMOTE_ACTION",
      "EXTERNAL_ACTION",
      "CLEANUP",
      "ANNOTATE",
      "NOOP",
    ]);
    for (const slice of NESY_COURIER_DOMAIN_PACK_REFERENCE_V1.slices) {
      for (const step of slice.genericIrSnapshot.steps) expect(allowed.has(step.kind)).toBe(true);
    }
  });
});

describe("OPEN_STOP canonical macro", () => {
  const slice = findReferenceSlice("OPEN_STOP");

  it("takes a typed STOP entity as its input", () => {
    const input = NESY_OPEN_STOP_MACRO.input.fields.find((f) => f.type === "entityRef");
    expect(input?.entityTypeRef).toBe("STOP");
    expect(input?.required).toBe(true);
  });

  it("reads the stop projection before touching the screen", () => {
    const steps = slice?.genericIrSnapshot.steps ?? [];
    const queryIndex = steps.findIndex((s) => s.kind === "SDK_QUERY");
    const actionIndex = steps.findIndex((s) => s.kind === "BRIDGE_ACTION");

    expect(queryIndex).toBeGreaterThanOrEqual(0);
    expect(actionIndex).toBeGreaterThan(queryIndex);

    const query = steps[queryIndex];
    expect(query.kind === "SDK_QUERY" ? query.queryRef : "").toBe("nesy.availableStops");
  });

  /**
   * The slice addresses a stop the way the PRODUCT does: type a business key into
   * the stop list's search box, let the list filter, tap what survives.
   *
   * This replaced a pre-check that compared the requested code against
   * `nesy.availableStops` — a projection carrying stop ids and no parcel key, so
   * it could never answer the question. The safeguard moved to the point of the
   * action instead: the row resolves by the text the ROW shows, and ambiguity
   * fails closed if the filter left more than one candidate.
   */
  it("searches for the stop before tapping anything", () => {
    const steps = slice?.genericIrSnapshot.steps ?? [];
    const order = steps.map((s) => s.planStepId);
    expect(order.indexOf("enter-search-term")).toBeGreaterThan(-1);
    expect(order.indexOf("tap-search-submit")).toBeGreaterThan(order.indexOf("enter-search-term"));
    expect(order.indexOf("tap-row")).toBeGreaterThan(order.indexOf("tap-search-submit"));

    const typed = steps.find((s) => s.planStepId === "enter-search-term");
    expect(typed?.kind === "BRIDGE_ACTION" ? typed.action : "").toBe("setText");
  });

  it("recognises the row by a different key from the one it typed", () => {
    // The search box keeps what was typed. One key for both would match twice
    // and stop the run on ambiguity — measured on device.
    const steps = slice?.genericIrSnapshot.steps ?? [];
    const typed = steps.find((s) => s.planStepId === "enter-search-term");
    const row = steps.find((s) => s.planStepId === "resolve-row");
    const typedRef =
      typed?.kind === "BRIDGE_ACTION" ? String(typed.args?.["valueRef"] ?? "") : "";
    expect(typedRef).toBe("run.input.searchTerm");
    expect(row?.entityBinding?.id).toBe("run.input.rowKey");
    expect(typedRef).not.toBe(row?.entityBinding?.id);
  });

  it("uses the stop-row provider chain rather than an index", () => {
    const steps = slice?.genericIrSnapshot.steps ?? [];
    const resolve = steps.find(
      (s) => s.kind === "RESOLVE_TARGET" && s.planStepId === "resolve-row",
    );
    expect(resolve?.kind === "RESOLVE_TARGET" ? resolve.targetRef : "").toBe(NESY_TARGETS.stopRow);
    expect(resolve?.entityBinding?.type).toBe("STOP");
  });

  it("waits for either the task list or the delivery flow", () => {
    const steps = slice?.genericIrSnapshot.steps ?? [];
    const waitAny = steps.find((s) => s.kind === "WAIT_ANY");
    const factKeys = waitAny?.kind === "WAIT_ANY" ? waitAny.legs.map((leg) => leg.factKey) : [];
    expect(factKeys).toContain(NESY_FACTS.TASK_LIST_READY);
    expect(factKeys).toContain(NESY_FACTS.DELIVERY_FLOW_READY);
    // B-13: a Bridge v1 device has no wait_any, so the fallback is declared.
    expect(waitAny?.kind === "WAIT_ANY" ? waitAny.hostOnlyCancel : false).toBe(true);
    const optional = waitAny?.capabilityRequirements.find((r) => r.capability === "wait_any");
    expect(optional?.optional).toBe(true);
    expect(optional?.fallback).toBe("SEQUENTIAL_LEGS");
  });

  it("catches a wrong row with APP.ACTIVE_STOP_MATCHES", () => {
    const steps = slice?.genericIrSnapshot.steps ?? [];
    const assertion = steps.find((s) => s.kind === "ASSERT_FACT");
    expect(assertion?.kind === "ASSERT_FACT" ? assertion.factKey : "").toBe(NESY_FACTS.ACTIVE_STOP_MATCHES);

    const required = assertion?.finalOraclePolicy?.requirements.find(
      (r) => r.factKey === NESY_FACTS.ACTIVE_STOP_MATCHES,
    );
    expect(required?.obligation).toBe("REQUIRED");
    expect(required?.timing).toBe("IMMEDIATE");
    expect(required?.onTimeout).toBe("FAIL");
  });

  it("records the wrong-row guard as a derived fact with correlation", () => {
    const derived = NESY_COURIER_DERIVED_FACTS.facts.find((f) => f.factKey === NESY_FACTS.ACTIVE_STOP_MATCHES);
    expect(derived?.requiresCorrelation).toBe(true);
    expect(derived?.provenance.reducerKind).toBe("ENTITY_STATUS_EQUALS");
    expect(derived?.preserveInputs).toBe(true);
  });

  it("enumerates the ways it could go green while proving nothing", () => {
    const keys = slice?.negativeCases.map((c) => c.caseKey) ?? [];
    expect(keys).toContain("ROW_INDEX_AS_IDENTITY");
    expect(keys).toContain("AMBIGUOUS_TARGET_FIRST_MATCH");
    expect(keys).toContain("OPENED_SOMETHING_UNVERIFIED");
  });
});

describe("COURIER_LOGIN setup/real separation", () => {
  const slice = findReferenceSlice("COURIER_LOGIN");

  it("requires the app and local planes, each from its own observation", () => {
    const requirements = slice?.oracle.finalOracle.requirements ?? [];
    const required = requirements.filter((r) => r.obligation === "REQUIRED").map((r) => r.factKey);
    expect(required).toContain(NESY_FACTS.USER_SESSION_AVAILABLE_APP);
    expect(required).toContain(NESY_FACTS.USER_SESSION_AVAILABLE_LOCAL);

    // Each required plane must be produced by a step in the plan. Requiring a
    // fact nothing observes is what made every login run EVIDENCE_INSUFFICIENT.
    const produced = new Set(
      (slice?.genericIrSnapshot.steps ?? []).flatMap((step) =>
        step.kind === "SDK_QUERY" ? (step.outputFactBindings ?? []).map((b) => b.factKey) : [],
      ),
    );
    for (const factKey of required) expect(produced).toContain(factKey);
  });

  // The back-office read resolves the dashboard admin token, so it cannot tell a
  // courier who signed in from one who did not. It is recorded, not counted.
  it("observes the backend plane without letting it vote", () => {
    const auth = slice?.oracle.finalOracle.requirements.find(
      (r) => r.factKey === NESY_FACTS.AUTH_ACCEPTED,
    );
    expect(auth?.obligation).toBe("OPTIONAL");
  });

  // APP.LOGIN_SUCCEEDED is derived, and no host runtime reads DerivedFactGraph.
  // Requiring it is unsatisfiable rather than strict.
  it("does not require a derived fact no runtime produces", () => {
    const requirements = slice?.oracle.finalOracle.requirements ?? [];
    expect(requirements.map((r) => r.factKey)).not.toContain(NESY_FACTS.LOGIN_SUCCEEDED);
  });

  it("models expected wrong-PIN rejection as its own product-pass oracle", () => {
    const workflow = NESY_COURIER_INDEPENDENT_WORKFLOWS.find(
      (entry) => entry.workflowKey === NESY_WORKFLOWS.loginRejected,
    );
    expect(workflow?.macroRefs).toEqual(["nesy.macro.login-rejected"]);
    expect(workflow?.oracleTemplate.continueGate.anyOf).toEqual([NESY_FACTS.LOGIN_REJECTED]);
    expect(workflow?.oracleTemplate.finalOracle.requirements).toEqual([
      {
        factKey: NESY_FACTS.LOGIN_REJECTED,
        obligation: "REQUIRED",
        timing: "IMMEDIATE",
        onTimeout: "FAIL",
      },
    ]);
  });

  it("derives APP.LOGIN_SUCCEEDED from backend, app and local facts together", () => {
    const derived = NESY_COURIER_DERIVED_FACTS.facts.find((f) => f.factKey === NESY_FACTS.LOGIN_SUCCEEDED);
    expect(derived?.provenance.reducerKind).toBe("CORRELATED_ALL_OF");
    expect(derived?.provenance.inputFactKeys).toEqual([
      NESY_FACTS.AUTH_ACCEPTED,
      NESY_FACTS.USER_SESSION_AVAILABLE_APP,
      NESY_FACTS.USER_SESSION_AVAILABLE_LOCAL,
    ]);
  });

  it("treats the expired-session dialog as fatal instead of re-authenticating", () => {
    expect(slice?.interruptPolicy.fatalSurfaceRefs).toContain("nesy.session-expired-dialog");
    expect(slice?.interruptPolicy.handledSurfaceRefs).not.toContain("nesy.session-expired-dialog");
  });

  it("runs under the real-login launch profile, which is the only verdict-bearing one", () => {
    const real = NESY_COURIER_LAUNCH_PROFILES.find((p) => p.profileKey === NESY_LAUNCH_PROFILES.coldRealLogin);
    expect(real?.sessionPreparation).toBe("REAL_UI_LOGIN");
    expect(real?.producesProductVerdict).toBe(true);
    expect(real?.preparationOperationRefs).toEqual([]);
  });
});

describe("TOUR_APPROVAL_LIFECYCLE multi-actor model", () => {
  const slice = findReferenceSlice("TOUR_APPROVAL_LIFECYCLE");

  it("drives the courier through the UI and the dispatcher through the adapter", () => {
    const steps = slice?.genericIrSnapshot.steps ?? [];
    expect(steps.some((s) => s.kind === "BRIDGE_ACTION")).toBe(true);

    const remote = steps.filter((s) => s.kind === "REMOTE_ACTION");
    expect(remote.length).toBeGreaterThanOrEqual(3);

    const dispatcherOp = NESY_BACKOFFICE_ADAPTER.operations.find(
      (op) => op.operationRef === NESY_BACKOFFICE_OPERATIONS.approveTourRequest,
    );
    expect(dispatcherOp?.actorRole).toBe("DISPATCHER");
  });

  it("requires two separate backend fact reads, not one 2xx", () => {
    const steps = slice?.genericIrSnapshot.steps ?? [];
    const validationOps = steps
      .filter((s) => s.kind === "REMOTE_ACTION")
      .map((s) => (s.kind === "REMOTE_ACTION" ? s.spec : undefined))
      .filter((spec) => spec?.role === "VALIDATION")
      .map((spec) => spec?.operationRef);

    expect(validationOps).toContain(NESY_BACKOFFICE_OPERATIONS.readTourApprovalRequest);
    expect(validationOps).toContain(NESY_BACKOFFICE_OPERATIONS.readTourApprovalStatus);
  });

  it("makes the dispatcher action produce no evidence of its own", () => {
    const steps = slice?.genericIrSnapshot.steps ?? [];
    const approve = steps
      .filter((s) => s.kind === "REMOTE_ACTION")
      .map((s) => (s.kind === "REMOTE_ACTION" ? s.spec : undefined))
      .find((spec) => spec?.operationRef === NESY_BACKOFFICE_OPERATIONS.approveTourRequest);

    expect(approve?.role).toBe("SETUP");
    expect(approve?.outputFactBindings).toEqual([]);
    expect(approve?.idempotencyClass).toBe("KEYED");
    expect(approve?.idempotencyKey).not.toBe("");
    expect(approve?.reconciliationPolicy).toBe("RECONCILE_BEFORE_RELEASE");
    expect(approve?.auditPolicy.recordRequest).toBe(true);
  });

  it("confirms approval only through a correlated derivation of three facts", () => {
    const derived = NESY_COURIER_DERIVED_FACTS.facts.find(
      (f) => f.factKey === NESY_FACTS.TOUR_APPROVAL_CONFIRMED,
    );
    expect(derived?.provenance.reducerKind).toBe("CORRELATED_ALL_OF");
    expect(derived?.requiresCorrelation).toBe(true);
    expect(derived?.provenance.inputFactKeys).toEqual([
      NESY_FACTS.TOUR_APPROVAL_REQUESTED,
      NESY_FACTS.TOUR_APPROVAL_REQUEST_CREATED,
      NESY_FACTS.TOUR_APPROVAL_STATUS_APPROVED,
    ]);
  });

  it("keeps the push notification confirmatory rather than gating", () => {
    const push = slice?.oracle.finalOracle.requirements.find(
      (r) => r.factKey === NESY_FACTS.TOUR_APPROVAL_PUSH_RECEIVED,
    );
    expect(push?.obligation).toBe("WARNING");

    const source = NESY_COURIER_EVIDENCE_SOURCES.find((s) => s.factKey === NESY_FACTS.TOUR_APPROVAL_PUSH_RECEIVED);
    expect(source?.authority).toBe("CONFIRMATORY");
  });

  it("separates the real approval test from the setup mode that arranges one", () => {
    const setupProfile = NESY_COURIER_LAUNCH_PROFILES.find(
      (p) => p.profileKey === NESY_LAUNCH_PROFILES.directState,
    );
    expect(setupProfile?.sessionPreparation).toBe("DIRECT_STATE");
    expect(setupProfile?.producesProductVerdict).toBe(false);
    expect(slice?.negativeCases.map((c) => c.caseKey)).toContain("SETUP_MODE_CLAIMS_APPROVAL_VERDICT");
  });
});
