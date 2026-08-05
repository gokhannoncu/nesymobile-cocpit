/**
 * ===========================================================================
 *  Domain leakage guard  (Plan D.6A.7 · CHECKPOINT 4A · RUN_PLAY 4A.13)
 *
 *  Phase 4A's whole purpose is that Verdict Core stays domain-neutral, and the
 *  only durable way to keep a rule like that is to make its violation a failing
 *  test. Review does not scale: a single `OPEN_STOP` added under deadline
 *  pressure is invisible in a large diff and permanent once shipped.
 *
 *  What is guarded, and what deliberately is not:
 *
 *    GUARDED — Core's own vocabulary. Type names, union members, step kinds,
 *    capability ids, bridge verbs, variable names, comments. If Core says the
 *    word, Core knows the word, and the second domain then needs a redesign.
 *
 *    NOT GUARDED — opaque Domain-Pack-owned refs carried *through* Core:
 *    `factKey`, `queryRef`, `targetRef`, `adapterRef`, `operationRef`,
 *    `entityRef.type`. These are supposed to contain business language; that is
 *    what makes them the seam. Banning words there would ban the design.
 *
 *  The distinction is the guard's real content. Scanning everything would force
 *  either meaningless fixtures or a disabled test.
 * ===========================================================================
 */

/**
 * Business words that must not appear in Core vocabulary.
 *
 * Two domains on purpose: courier words prove Nesy is not baked in, sports
 * words prove the second tenant is not either.
 */
export const FORBIDDEN_DOMAIN_TOKENS: readonly string[] = [
  "COURIER",
  "PARCEL",
  "SHIPMENT",
  "BARCODE",
  "TOUR",
  "STOPLIST",
  "OPEN_STOP",
  "APPROVE_TOUR",
  "COURIER_LOGIN",
  "BETTING",
  "ODDS",
];

/**
 * Words too generic to match as substrings.
 *
 * `MATCH` hides inside `MATCHES`, `matchesAllowlistedPattern` and `mismatch`;
 * `STOP` hides inside `STOPPED` and `NONSTOP`. A guard that flagged those would
 * cry wolf, and a test that cries wolf gets deleted — so precision here is part
 * of the contract.
 *
 * These are matched per identifier SEGMENT instead: `openStop` and `OPEN_STOP`
 * both split to a `STOP` segment and are flagged, while `STOPPED` and
 * `matchesAllowlistedPattern` do not. The rule is deliberately strict about
 * whole segments — an identifier that wants the word `stop` as its own segment
 * must find another word, which for Core vocabulary is always possible.
 */
export const FORBIDDEN_DOMAIN_WORDS: readonly string[] = ["STOP", "STOPS", "MATCH", "TOURS"];

/**
 * Splits an identifier into uppercase segments.
 *
 * Handles snake_case, kebab-case, dotted refs and camelCase humps, so the same
 * business word is caught regardless of the casing convention it arrives in.
 */
export function identifierSegments(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter((segment) => segment !== "")
    .map((segment) => segment.toUpperCase());
}

export interface DomainLeakageHit {
  token: string;
  /** Where the token was found — a field path or a symbol name. */
  location: string;
}

/**
 * Scans one text for forbidden business vocabulary.
 *
 * Case-insensitive: `Parcel`, `parcel` and `PARCEL` are the same violation.
 */
export function findDomainLeakage(text: string, location: string): DomainLeakageHit[] {
  const upper = text.toUpperCase();
  const hits: DomainLeakageHit[] = [];

  for (const token of FORBIDDEN_DOMAIN_TOKENS) {
    if (upper.includes(token)) hits.push({ token, location });
  }

  const segments = new Set(identifierSegments(text));
  for (const word of FORBIDDEN_DOMAIN_WORDS) {
    if (segments.has(word)) hits.push({ token: word, location });
  }

  return hits;
}

/**
 * Scans a module's exported surface as text.
 *
 * Stringifying the surface catches a leak whether it arrives as a type name, a
 * union member or an exported constant — all three are the same violation, and
 * a guard that only checked one shape would be trivially bypassed.
 */
export function scanExportSurface(moduleName: string, moduleExports: Record<string, unknown>): DomainLeakageHit[] {
  const hits: DomainLeakageHit[] = [];
  for (const [name, value] of Object.entries(moduleExports)) {
    hits.push(...findDomainLeakage(name, `${moduleName}.${name}`));
    if (typeof value === "function") continue;
    hits.push(...findDomainLeakage(JSON.stringify(value) ?? "", `${moduleName}.${name}`));
  }
  return hits;
}
