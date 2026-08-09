/**
 * Phase 7.24 — negative safety suite (fail-closed invariants).
 */

import { validateDomainPackBundle } from "@nesy/domain-pack-contracts";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildNesyCourierBundle } from "./bundle.js";
import { NESY_FULL_COURIER_GOLDEN_IR } from "./macros/full-courier-golden.js";
import { NESY_COURIER_TEST_PROFILES, NESY_TEST_PROFILES } from "./profiles/test-profiles.js";
import { NESY_COURIER_EVIDENCE_SOURCES } from "./evidence/sources.js";
import { NESY_FACTS } from "./registries/facts.js";

const PACK_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(PACK_ROOT, "../..");

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkTsFiles(full, out);
    else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("Phase 7.24 negative safety", () => {
  it("Core/Bridge contract packages do not carry Nesy STOP/PARCEL/ROUTE/DELIVERY business types", () => {
    const banned = [/\bSTOP\b/, /\bPARCEL\b/, /\bROUTE\b/, /\bDELIVERY\b/, /OPEN_STOP/, /APPROVE_TOUR/];
    const cores = [
      join(REPO_ROOT, "packages/bridge-contract/src"),
      join(REPO_ROOT, "packages/bridgeflow-executor/src"),
      join(REPO_ROOT, "packages/execution-contract/src"),
    ];
    for (const root of cores) {
      for (const file of walkTsFiles(root)) {
        if (file.endsWith(".test.ts")) continue;
        const text = readFileSync(file, "utf8");
        // Allow documentation that forbids the tokens (DOMAIN YOK comments).
        const withoutForbidDocs = text
          .replace(/DOMAIN YOK[\s\S]{0,400}/g, "")
          .replace(/domain bilmez[\s\S]{0,400}/gi, "")
          .replace(/`STOP`[\s\S]{0,80}/g, "")
          .replace(/`PARCEL`[\s\S]{0,80}/g, "")
          .replace(/`TOUR`[\s\S]{0,80}/g, "")
          .replace(/`OPEN_STOP`[\s\S]{0,80}/g, "")
          .replace(/`APPROVE_TOUR`[\s\S]{0,80}/g, "")
          .replace(/STOP_UNKNOWN_EFFECT/g, "");
        for (const pattern of banned) {
          expect(withoutForbidDocs, `${file} leaked ${pattern}`).not.toMatch(pattern);
        }
      }
    }
  });

  it("does not statically unroll 20 barcode nodes in the golden workflow", () => {
    const forEach = NESY_FULL_COURIER_GOLDEN_IR.steps.filter((s) => s.kind === "FOR_EACH");
    expect(forEach.length).toBeGreaterThanOrEqual(2);
    const barcodeLoop = forEach.find((s) => s.kind === "FOR_EACH" && s.maxIterations === 20);
    expect(barcodeLoop).toBeDefined();
    expect(NESY_FULL_COURIER_GOLDEN_IR.steps.length).toBeLessThan(40);
  });

  it("refuses HTTP 2xx transport-ack as business success binding", () => {
    const transportOnly = NESY_COURIER_EVIDENCE_SOURCES.filter((s) => s.transportSuccessOnly === true);
    expect(transportOnly.length).toBeGreaterThan(0);
    for (const source of transportOnly) {
      expect(source.factKey, source.sourceKey).toBeUndefined();
      expect(source.authority).not.toBe("PRIMARY");
    }

    const mutated = JSON.parse(JSON.stringify(buildNesyCourierBundle())) as ReturnType<
      typeof buildNesyCourierBundle
    >;
    const ack = mutated.registries.evidenceSources.find((s) => s.transportSuccessOnly === true);
    if (ack) {
      (ack as { factKey?: string }).factKey = NESY_FACTS.DELIVERY_CONFIRMED;
      (ack as { authority?: string }).authority = "PRIMARY";
    }
    const messages = validateDomainPackBundle(mutated).map((i) => i.message);
    expect(messages.some((m) => /transport|HTTP|2xx|factKey|PRIMARY|business/i.test(m))).toBe(true);
  });

  it("preview profiles cannot launder a release GO decision", () => {
    for (const profile of NESY_COURIER_TEST_PROFILES.filter((p) => p.kind === "PREVIEW")) {
      expect(profile.releaseGate).toBe(false);
    }
    const releaseCampaign = buildNesyCourierBundle().registries.campaigns.find(
      (c) => c.campaignKey === "nesy.campaign.release",
    );
    expect(releaseCampaign?.releaseGate).toBe(true);
    expect(
      releaseCampaign?.profileRefs.some((ref) => {
        const profile = NESY_COURIER_TEST_PROFILES.find((p) => p.profileKey === ref);
        return profile?.releaseGate === true;
      }),
    ).toBe(true);

    const mutated = JSON.parse(JSON.stringify(buildNesyCourierBundle())) as ReturnType<
      typeof buildNesyCourierBundle
    >;
    const previewOnly = mutated.registries.campaigns.find((c) => c.campaignKey === "nesy.campaign.release");
    if (previewOnly) {
      previewOnly.profileRefs = [NESY_TEST_PROFILES.previewAccessibilityBasic];
      previewOnly.releaseGate = true;
    }
    const messages = validateDomainPackBundle(mutated).map((i) => i.message);
    expect(messages.some((m) => m.includes("release-gating campaign contains no release-gating profile"))).toBe(
      true,
    );
  });

  it("Bad Day / recovery without correlation fail closed at pack validation", () => {
    const mutated = JSON.parse(JSON.stringify(buildNesyCourierBundle())) as ReturnType<
      typeof buildNesyCourierBundle
    >;
    const badDay = mutated.registries.testProfiles.find(
      (p) => p.profileKey === NESY_TEST_PROFILES.badDayStateAwareShort,
    );
    if (badDay?.faultPlan?.injections[0]) {
      (badDay.faultPlan.injections[0] as { correlationFactKey: string }).correlationFactKey = "";
    }
    const messages = validateDomainPackBundle(mutated).map((i) => i.message);
    expect(messages.some((m) => m.includes("FAULT_WITHOUT_CORRELATION"))).toBe(true);
  });
});
