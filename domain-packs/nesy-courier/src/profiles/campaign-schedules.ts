/**
 * Phase 7.22 — campaign schedule intents (fixtures only).
 *
 * Kept OUT of DomainPackBundle registries so pack validation does not treat
 * schedule vocabulary as execution/scheduler state smuggled into the digest.
 */

import { NESY_CAMPAIGNS } from "./test-profiles.js";

export type CampaignScheduleClass = "PR" | "NIGHTLY" | "WEEKLY" | "RELEASE";

export interface CampaignScheduleFixture {
  scheduleClass: CampaignScheduleClass;
  campaignKey: string;
  /** Human-readable cadence; not a cron executor. */
  cadence: string;
  /** Fake fixture id used in acceptance tests. */
  fixtureId: string;
  releaseGate: boolean;
}

export const NESY_CAMPAIGN_SCHEDULE_FIXTURES: readonly CampaignScheduleFixture[] = [
  {
    scheduleClass: "PR",
    campaignKey: NESY_CAMPAIGNS.pr,
    cadence: "on every pull request",
    fixtureId: "fixture.campaign.schedule.pr",
    releaseGate: false,
  },
  {
    scheduleClass: "NIGHTLY",
    campaignKey: NESY_CAMPAIGNS.nightly,
    cadence: "daily 02:00 Europe/Istanbul",
    fixtureId: "fixture.campaign.schedule.nightly",
    releaseGate: false,
  },
  {
    scheduleClass: "WEEKLY",
    campaignKey: NESY_CAMPAIGNS.weekly,
    cadence: "Sunday 03:00 Europe/Istanbul",
    fixtureId: "fixture.campaign.schedule.weekly",
    releaseGate: false,
  },
  {
    scheduleClass: "RELEASE",
    campaignKey: NESY_CAMPAIGNS.release,
    cadence: "on release candidate cut",
    fixtureId: "fixture.campaign.schedule.release",
    releaseGate: true,
  },
] as const;

export function findCampaignSchedule(
  scheduleClass: CampaignScheduleClass,
): CampaignScheduleFixture | undefined {
  return NESY_CAMPAIGN_SCHEDULE_FIXTURES.find((f) => f.scheduleClass === scheduleClass);
}
