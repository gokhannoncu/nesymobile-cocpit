/**
 * Phase 7.14 — Launch Profiles (FULL_JOURNEY / PREPARED_SESSION / DIRECT_STATE).
 */

import { describe, expect, it } from "vitest";
import {
  NESY_COURIER_LAUNCH_PROFILES,
  NESY_LAUNCH_PROFILE_ALIASES,
  NESY_LAUNCH_PROFILES,
} from "./profiles/launch.js";
import { NESY_FACTS } from "./registries/facts.js";

describe("Phase 7.14 launch profiles", () => {
  it("maps playbook FULL_JOURNEY / PREPARED_SESSION / DIRECT_STATE aliases", () => {
    expect(NESY_LAUNCH_PROFILE_ALIASES.FULL_JOURNEY).toBe(NESY_LAUNCH_PROFILES.coldRealLogin);
    expect(NESY_LAUNCH_PROFILE_ALIASES.PREPARED_SESSION).toBe(NESY_LAUNCH_PROFILES.preparedSession);
    expect(NESY_LAUNCH_PROFILE_ALIASES.DIRECT_STATE).toBe(NESY_LAUNCH_PROFILES.directState);
  });

  it("FULL_JOURNEY (cold-real-login) alone may produce product verdict", () => {
    const full = NESY_COURIER_LAUNCH_PROFILES.find((p) => p.profileKey === NESY_LAUNCH_PROFILES.coldRealLogin);
    expect(full?.sessionPreparation).toBe("REAL_UI_LOGIN");
    expect(full?.producesProductVerdict).toBe(true);
    expect(full?.preparationOperationRefs).toEqual([]);
    expect(full?.preconditionFactKeys).toContain(NESY_FACTS.SESSION_ISOLATION_ASSERTED);
  });

  it("PREPARED_SESSION is setup-only with automation isolation", () => {
    const prepared = NESY_COURIER_LAUNCH_PROFILES.find(
      (p) => p.profileKey === NESY_LAUNCH_PROFILES.preparedSession,
    );
    expect(prepared?.sessionPreparation).toBe("PREPARED_SESSION");
    expect(prepared?.producesProductVerdict).toBe(false);
    expect(prepared?.releaseIsolation.automationOnly).toBe(true);
    expect(prepared?.cleanup.runOnFailure).toBe(true);
    expect(prepared?.cleanup.deadlineMs).toBeGreaterThan(0);
  });

  it("DIRECT_STATE is setup-only, release-isolated, and capability-gated", () => {
    const direct = NESY_COURIER_LAUNCH_PROFILES.find((p) => p.profileKey === NESY_LAUNCH_PROFILES.directState);
    expect(direct?.sessionPreparation).toBe("DIRECT_STATE");
    expect(direct?.producesProductVerdict).toBe(false);
    expect(direct?.releaseIsolation.automationOnly).toBe(true);
    expect(direct?.requiredCapabilityRefs).toEqual(
      expect.arrayContaining(["domain.nesy.adapter.direct-state"]),
    );
    expect(direct?.cleanup.runOnFailure).toBe(true);
  });

  it("every profile declares isolation precondition and failure cleanup", () => {
    for (const profile of NESY_COURIER_LAUNCH_PROFILES) {
      expect(profile.preconditionFactKeys).toContain(NESY_FACTS.SESSION_ISOLATION_ASSERTED);
      expect(profile.cleanup.runOnFailure).toBe(true);
      expect(profile.cleanup.deadlineMs).toBeGreaterThan(0);
      expect(profile.releaseIsolation.releaseGuard.length).toBeGreaterThan(0);
    }
  });
});
