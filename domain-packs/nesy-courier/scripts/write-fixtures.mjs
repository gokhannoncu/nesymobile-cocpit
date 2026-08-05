/**
 * ===========================================================================
 *  Fixture writer  (RUN_PLAY 4B.18)
 *
 *  Emits the reference and negative fixtures from the pack's own definitions, so
 *  the JSON on disk cannot drift from the TypeScript that describes it. The test
 *  suite reads the files back and compares; a stale fixture therefore fails CI
 *  rather than quietly documenting a pack that no longer exists.
 *
 *  Run with:  pnpm --filter @nesy/nesy-courier-domain-pack build && node scripts/write-fixtures.mjs
 * ===========================================================================
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "fixtures");
const { NESY_COURIER_DOMAIN_PACK_REFERENCE_V1 } = await import("../dist/reference.js");
const { buildNesyCourierBundle } = await import("../dist/bundle.js");

mkdirSync(outDir, { recursive: true });

const write = (name, value) => {
  writeFileSync(join(outDir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const fileNameBySlice = {
  COURIER_LOGIN: "courier-login.reference.json",
  SELECT_ROUTE: "select-route.reference.json",
  OPEN_STOP: "open-stop.reference.json",
  PROCESS_PARCEL: "process-parcel.reference.json",
  COMPLETE_DELIVERY: "complete-delivery.reference.json",
  TOUR_APPROVAL_LIFECYCLE: "tour-approval-lifecycle.reference.json",
};

for (const slice of NESY_COURIER_DOMAIN_PACK_REFERENCE_V1.slices) {
  write(fileNameBySlice[slice.sliceKey], slice);
}

const clone = () => JSON.parse(JSON.stringify(buildNesyCourierBundle()));

// 1. A setup launch profile claiming a product verdict.
const invalidSetup = clone();
for (const profile of invalidSetup.registries.launchProfiles) {
  if (profile.sessionPreparation !== "REAL_UI_LOGIN") profile.producesProductVerdict = true;
}
write("invalid-setup-produces-verdict.json", invalidSetup);

// 2. A row index promoted to a target identity.
const invalidRowIndex = clone();
for (const target of invalidRowIndex.registries.targets) {
  for (const strategy of target.resolution.chain) {
    if (strategy.kind === "ROW_INDEX_HINT") strategy.establishesIdentity = true;
  }
}
write("invalid-row-index-primary-target.json", invalidRowIndex);

// 3. A transport-success-only source binding a business fact.
const invalidHttp = clone();
for (const source of invalidHttp.registries.evidenceSources) {
  if (source.transportSuccessOnly === true) {
    source.factKey = "REMOTE.DELIVERY_CONFIRMED";
    source.authority = "PRIMARY";
  }
}
write("invalid-http-2xx-business-success.json", invalidHttp);

// 4. Execution-plane state smuggled into a pack.
const invalidExecution = clone();
invalidExecution.registries.applications[0].resourceLease = { leaseId: "l-1", holder: "worker-3" };
write("invalid-domain-execution-leakage.json", invalidExecution);

console.log(`wrote fixtures to ${outDir}`);
