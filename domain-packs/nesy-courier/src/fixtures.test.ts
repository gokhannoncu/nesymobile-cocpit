/**
 * ===========================================================================
 *  Fixture binding suite  (RUN_PLAY 4B.18)
 *
 *  The reference artifact only means something if the JSON on disk is the same
 *  artifact the code describes. A fixture that drifted would keep documenting a
 *  pack that no longer exists, and the first reader to trust it would be wrong in
 *  a way nothing reported.
 *
 *  So the six reference fixtures are compared field-for-field against the
 *  in-code slices, and the four negative fixtures are run through the validator
 *  to prove each of them is actually refused — a negative fixture nobody checks
 *  is a file, not a test.
 * ===========================================================================
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateDomainPackBundle, type DomainPackBundle } from "@nesy/domain-pack-contracts";
import { describe, expect, it } from "vitest";
import { NESY_COURIER_DOMAIN_PACK_REFERENCE_V1 } from "./reference.js";

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

function readFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), "utf8")) as T;
}

const REFERENCE_FILES: Readonly<Record<string, string>> = {
  COURIER_LOGIN: "courier-login.reference.json",
  SELECT_ROUTE: "select-route.reference.json",
  OPEN_STOP: "open-stop.reference.json",
  PROCESS_PARCEL: "process-parcel.reference.json",
  COMPLETE_DELIVERY: "complete-delivery.reference.json",
  TOUR_APPROVAL_LIFECYCLE: "tour-approval-lifecycle.reference.json",
};

describe("reference slice fixtures", () => {
  it("exist for all six slices", () => {
    expect(Object.keys(REFERENCE_FILES)).toHaveLength(6);
  });

  for (const slice of NESY_COURIER_DOMAIN_PACK_REFERENCE_V1.slices) {
    it(`matches the in-code definition for ${slice.sliceKey}`, () => {
      const fixture = readFixture(REFERENCE_FILES[slice.sliceKey]);
      // JSON round-trip on both sides: the fixture cannot carry `undefined`, so
      // comparing the raw object would fail on absent optional fields alone.
      expect(fixture).toEqual(JSON.parse(JSON.stringify(slice)));
    });
  }
});

describe("negative fixtures", () => {
  it("refuses a setup launch profile that claims a product verdict", () => {
    const bundle = readFixture<DomainPackBundle>("invalid-setup-produces-verdict.json");
    const messages = validateDomainPackBundle(bundle).map((issue) => issue.message);
    expect(messages.some((m) => m.includes("SETUP_LAUNCH_PRODUCES_VERDICT"))).toBe(true);
  });

  it("refuses a row index promoted to a target identity", () => {
    const bundle = readFixture<DomainPackBundle>("invalid-row-index-primary-target.json");
    const messages = validateDomainPackBundle(bundle).map((issue) => issue.message);
    expect(messages.some((m) => m.includes("ROW_INDEX_AS_IDENTITY"))).toBe(true);
  });

  it("refuses an HTTP 2xx source used as business evidence", () => {
    const bundle = readFixture<DomainPackBundle>("invalid-http-2xx-business-success.json");
    const messages = validateDomainPackBundle(bundle).map((issue) => issue.message);
    expect(messages.some((m) => m.includes("TRANSPORT_SUCCESS_AS_BUSINESS_FACT"))).toBe(true);
    expect(messages.some((m) => m.includes("TRANSPORT_SUCCESS_PRIMARY"))).toBe(true);
  });

  it("refuses execution-plane state smuggled into a pack", () => {
    const bundle = readFixture<DomainPackBundle>("invalid-domain-execution-leakage.json");
    const codes = validateDomainPackBundle(bundle).map((issue) => issue.code);
    expect(codes).toContain("EXECUTION_PLANE_LEAKAGE");
  });
});
