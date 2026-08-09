/**
 * Phase 7.20–7.21 — Test Profile catalog + Preview profiles.
 */

import { validateDomainPackBundle } from "@nesy/domain-pack-contracts";
import { describe, expect, it } from "vitest";
import { buildNesyCourierBundle } from "./bundle.js";
import {
  NESY_CAMPAIGN_SCHEDULE_FIXTURES,
  findCampaignSchedule,
} from "./profiles/campaign-schedules.js";
import {
  NESY_CAMPAIGNS,
  NESY_COURIER_CAMPAIGNS,
  NESY_COURIER_TEST_PROFILES,
  NESY_TEST_PROFILES,
} from "./profiles/test-profiles.js";
import { NESY_FACTS } from "./registries/facts.js";

const REQUIRED_CATALOG = [
  NESY_TEST_PROFILES.smokeCore,
  NESY_TEST_PROFILES.regressionCritical,
  NESY_TEST_PROFILES.regressionDifferential,
  NESY_TEST_PROFILES.recoveryPaymentProcessKill,
  NESY_TEST_PROFILES.recoveryFiscalProcessKill,
  NESY_TEST_PROFILES.recoveryQueueFlush,
  NESY_TEST_PROFILES.badDayStateAwareShort,
  NESY_TEST_PROFILES.contractConsistency,
  NESY_TEST_PROFILES.loadNormal60Stop,
  NESY_TEST_PROFILES.loadBusy120Stop,
  NESY_TEST_PROFILES.compatibilityFieldDevices,
  NESY_TEST_PROFILES.securityReleaseIsolation,
  NESY_TEST_PROFILES.soakShort,
] as const;

describe("Phase 7.20 Nesy Test Profile catalog", () => {
  it("publishes every CHECKPOINT 7 catalog profile key", () => {
    const keys = new Set(NESY_COURIER_TEST_PROFILES.map((p) => p.profileKey));
    for (const key of REQUIRED_CATALOG) {
      expect(keys.has(key), key).toBe(true);
    }
  });

  it("keeps the expanded catalog valid in the domain pack bundle", () => {
    const issues = validateDomainPackBundle(buildNesyCourierBundle());
    expect(issues.filter((i) => i.code === "PROFILE_INVALID" || i.code === "UNKNOWN_REGISTRY_REF")).toEqual(
      [],
    );
  });

  it("Bad Day / recovery faults use business fact correlation + expected recovery", () => {
    const badDays = NESY_COURIER_TEST_PROFILES.filter((p) => p.kind === "BAD_DAY");
    expect(badDays.length).toBeGreaterThanOrEqual(4);
    for (const profile of badDays) {
      expect(profile.faultPlan?.injections.length).toBeGreaterThan(0);
      for (const injection of profile.faultPlan?.injections ?? []) {
        expect(injection.correlationFactKey).toMatch(/^(APP|LOCAL|REMOTE|UI)\./);
        expect(injection.expectedRecoveryFactKey).toMatch(/^(APP|LOCAL|REMOTE|UI)\./);
        expect(injection.correlationFactKey).not.toBe(injection.expectedRecoveryFactKey);
      }
    }
  });

  it("contract consistency profile stays non-gating DIAGNOSTIC", () => {
    const profile = NESY_COURIER_TEST_PROFILES.find(
      (p) => p.profileKey === NESY_TEST_PROFILES.contractConsistency,
    );
    expect(profile?.kind).toBe("DIAGNOSTIC");
    expect(profile?.releaseGate).toBe(false);
  });

  it("load 60/120 and compatibility/soak/security profiles exist with expected kinds", () => {
    expect(
      NESY_COURIER_TEST_PROFILES.find((p) => p.profileKey === NESY_TEST_PROFILES.loadNormal60Stop)?.kind,
    ).toBe("DIAGNOSTIC");
    expect(
      NESY_COURIER_TEST_PROFILES.find((p) => p.profileKey === NESY_TEST_PROFILES.loadBusy120Stop)?.kind,
    ).toBe("DIAGNOSTIC");
    expect(
      NESY_COURIER_TEST_PROFILES.find((p) => p.profileKey === NESY_TEST_PROFILES.compatibilityFieldDevices)
        ?.kind,
    ).toBe("DIAGNOSTIC");
    expect(
      NESY_COURIER_TEST_PROFILES.find((p) => p.profileKey === NESY_TEST_PROFILES.soakShort)?.kind,
    ).toBe("DIAGNOSTIC");
    const security = NESY_COURIER_TEST_PROFILES.find(
      (p) => p.profileKey === NESY_TEST_PROFILES.securityReleaseIsolation,
    );
    expect(security?.kind).toBe("RELEASE");
    expect(security?.releaseGate).toBe(true);
    expect(security?.requiredCapabilityRefs).toContain("domain.nesy.adapter.release-isolation");
  });

  it("differential profile names critical facts for build-to-build loss", () => {
    const differential = NESY_COURIER_TEST_PROFILES.find(
      (p) => p.profileKey === NESY_TEST_PROFILES.regressionDifferential,
    );
    expect(differential?.differential?.criticalFactKeys).toEqual(
      expect.arrayContaining([
        NESY_FACTS.ACTIVE_STOP_MATCHES,
        NESY_FACTS.DELIVERY_CONFIRMED,
        NESY_FACTS.PARCEL_STATE_PROCESSED,
      ]),
    );
  });
});

describe("Phase 7.21 Preview profiles", () => {
  it("accessibility + smart-explorer previews never gate release", () => {
    for (const key of [
      NESY_TEST_PROFILES.previewAccessibilityBasic,
      NESY_TEST_PROFILES.previewSmartExplorer,
      NESY_TEST_PROFILES.previewSmoke,
    ] as const) {
      const profile = NESY_COURIER_TEST_PROFILES.find((p) => p.profileKey === key);
      expect(profile?.kind, key).toBe("PREVIEW");
      expect(profile?.releaseGate, key).toBe(false);
    }
  });

  it("rejects promoting a preview profile into a release gate", () => {
    const mutated = JSON.parse(JSON.stringify(buildNesyCourierBundle())) as ReturnType<
      typeof buildNesyCourierBundle
    >;
    const preview = mutated.registries.testProfiles.find(
      (p) => p.profileKey === NESY_TEST_PROFILES.previewAccessibilityBasic,
    );
    if (preview) preview.releaseGate = true;
    const messages = validateDomainPackBundle(mutated).map((i) => i.message);
    expect(messages.some((m) => m.includes("PREVIEW_PROFILE_GATES_RELEASE"))).toBe(true);
  });
});

describe("Phase 7.22 campaign schedule fixtures (pack intent)", () => {
  it("declares PR/nightly/weekly/release schedule fixtures bound to campaign keys", () => {
    expect(NESY_CAMPAIGN_SCHEDULE_FIXTURES.map((f) => f.scheduleClass).sort()).toEqual(
      ["NIGHTLY", "PR", "RELEASE", "WEEKLY"].sort(),
    );
    expect(findCampaignSchedule("PR")?.campaignKey).toBe(NESY_CAMPAIGNS.pr);
    expect(findCampaignSchedule("NIGHTLY")?.campaignKey).toBe(NESY_CAMPAIGNS.nightly);
    expect(findCampaignSchedule("WEEKLY")?.campaignKey).toBe(NESY_CAMPAIGNS.weekly);
    expect(findCampaignSchedule("RELEASE")?.campaignKey).toBe(NESY_CAMPAIGNS.release);
    expect(findCampaignSchedule("RELEASE")?.releaseGate).toBe(true);

    const campaignKeys = new Set(NESY_COURIER_CAMPAIGNS.map((c) => c.campaignKey));
    for (const fixture of NESY_CAMPAIGN_SCHEDULE_FIXTURES) {
      expect(campaignKeys.has(fixture.campaignKey), fixture.fixtureId).toBe(true);
    }
  });
});
