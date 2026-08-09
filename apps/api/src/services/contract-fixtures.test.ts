/**
 * ===========================================================================
 *  GOLDEN CONTRACT FIXTURE CONSUMER SUITE  (plan Faz 0.4 / 2.5)
 *
 *  Cockpit is the CONSUMER side of the shared corpus. The mobile/SDK side
 *  PRODUCES the same bytes from production code
 *  (`ContractFixtureGeneratorTest.kt`), and `expected-parse/` is written by an
 *  INDEPENDENT reference parser in the fixture repo — deliberately not by the
 *  regex under test here, because a parser compared against its own output can
 *  never fail.
 *
 *  ### Locating the corpus
 *
 *  `VERDICT_FIXTURES_DIR`, else the submodule path `verdict-contract-fixtures/`
 *  at the repo root. When `contract-fixtures.lock` exists but the corpus does
 *  not, this suite FAILS rather than skipping: a pinned SHA with no checkout
 *  means someone forgot `git submodule update --init`, and a green tick there
 *  would be exactly the false assurance this mechanism exists to remove.
 * ===========================================================================
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseLogcatLine } from "./logcat-sniffer.js";
import { parseTestEventLine } from "./test-event-bridge.js";

/**
 * Walks up from this file to the workspace root (the directory holding `apps/`).
 *
 * `fileURLToPath`, not `new URL(...).pathname`: the repo lives under a path with a
 * space ("Pype Develop"), which `pathname` percent-encodes into a path that does
 * not exist on disk.
 */
function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("workspace root not found");
}

const ROOT = repoRoot();
const LOCK = join(ROOT, "contract-fixtures.lock");
const FIXTURES =
  process.env.VERDICT_FIXTURES_DIR?.trim() ||
  join(ROOT, "verdict-contract-fixtures");

const corpusPresent = existsSync(join(FIXTURES, "legacy-lines"));

describe("golden contract fixtures", () => {
  /**
   * The corpus is REQUIRED once the submodule is declared, not merely once a SHA is
   * pinned.
   *
   * `contract-fixtures.lock` can legitimately exist before the fixture repo has a
   * remote: it records which commit the two sides agreed on. Failing on the lock
   * alone would turn `pnpm test` red for everyone until someone creates that remote —
   * punishing the wrong step. Once `.gitmodules` declares the path, a missing corpus
   * really does mean a forgotten `git submodule update --init`, and then it must fail:
   * a pinned contract that was never read must never report as verified.
   */
  it("corpus is reachable once the submodule is declared", () => {
    const gitmodules = join(ROOT, ".gitmodules");
    const declared =
      existsSync(gitmodules) &&
      readFileSync(gitmodules, "utf8").includes("verdict-contract-fixtures");

    if (!declared) {
      expect(
        existsSync(LOCK),
        "contract-fixtures.lock should record the agreed SHA even before the submodule exists",
      ).toBe(true);
      return;
    }
    expect(
      corpusPresent,
      `.gitmodules declares verdict-contract-fixtures but no corpus at ${FIXTURES}. ` +
        `Run: git submodule update --init, or set VERDICT_FIXTURES_DIR.`,
    ).toBe(true);
  });

  if (!corpusPresent) {
    it.skip("legacy + structured fixtures (corpus not present)", () => undefined);
    return;
  }

  // -------------------------------------------------------------------------
  //  Legacy channel
  // -------------------------------------------------------------------------

  const legacyDir = join(FIXTURES, "legacy-lines");
  const expectedDir = join(FIXTURES, "expected-parse");
  const legacyFiles = readdirSync(legacyDir)
    .filter((f) => f.endsWith(".txt"))
    .sort();

  /**
   * The corpus stores the MESSAGE that `AutomationLogFormatter` produces. logcat
   * prepends timestamp, level, tag and pid, and `LOGCAT_PATTERN` anchors on the tag —
   * so each consumer wraps the message in its own transport shape. Keeping the raw
   * message in the corpus is what lets the Kotlin side generate it from production
   * code without having to fake a logcat frame.
   */
  const readLine = (f: string) => {
    const message = readFileSync(join(legacyDir, f), "utf8").replace(/\r?\n$/, "");
    return `01-01 00:00:00.000 D/NESY_AUTO_BRIDGE( 1234): ${message}`;
  };
  const readExpected = (f: string) =>
    JSON.parse(
      readFileSync(
        join(expectedDir, `legacy__${f.replace(/\.txt$/, "")}.json`),
        "utf8",
      ),
    ) as { action: string; status: string; taskId: string; data: Record<string, unknown> };

  it("corpus covers the full 12 action × 6 status matrix", () => {
    const matrix = legacyFiles.filter((f) => f.startsWith("matrix__"));
    expect(matrix).toHaveLength(72);
  });

  it("every legacy line parses — none is silently rejected", () => {
    const rejected = legacyFiles.filter((f) => parseLogcatLine(readLine(f)) === null);
    expect(rejected, `parseLogcatLine returned null for: ${rejected}`).toEqual([]);
  });

  it("action, status and DATA match the reference parser", () => {
    const mismatches: string[] = [];
    for (const f of legacyFiles) {
      const got = parseLogcatLine(readLine(f));
      const want = readExpected(f);
      if (!got) continue; // covered by the test above
      if (got.action !== want.action) mismatches.push(`${f}: action ${got.action} != ${want.action}`);
      if (got.status !== want.status) mismatches.push(`${f}: status ${got.status} != ${want.status}`);
      if (JSON.stringify(got.data ?? {}) !== JSON.stringify(want.data)) {
        mismatches.push(
          `${f}: data ${JSON.stringify(got.data)} != ${JSON.stringify(want.data)}`,
        );
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("a null DATA value stays null and is not coerced to the string \"null\"", () => {
    const parsed = parseLogcatLine(readLine("data__null-value.txt"));
    expect(parsed?.data).toEqual({ note: null, step: "DONE" });
  });

  it("a brace inside a DATA value does not truncate the payload", () => {
    // The DATA regex is greedy (`\{.*\}`); this pins that a `}` in a value is safe.
    const parsed = parseLogcatLine(readLine("data__brace-in-value.txt"));
    expect(parsed?.data).toEqual({ json_like: '{"nested":"no"}' });
  });

  it("non-ASCII survives unescaped (TR/RS markets)", () => {
    const parsed = parseLogcatLine(readLine("data__non-ascii.txt"));
    expect(parsed?.data).toEqual({ city: "İstanbul", hub: "Београд" });
  });

  it("an empty TASK_ID still yields the extended parse, not a format-1 fallback", () => {
    // The regex uses `[^|]*?` precisely for this; `.+` would drop DATA entirely.
    const parsed = parseLogcatLine(readLine("taskid__empty.txt"));
    expect(parsed?.taskId).toBe("");
    expect(parsed?.data).toEqual({});
  });

  it("TASK_ID whitespace is trimmed by the consumer (documented divergence)", () => {
    // The reference parser preserves the field verbatim; Cockpit trims. Trimming is
    // the useful behaviour — a padded id would never match a task record — so the
    // divergence is pinned here rather than "fixed" in one of the two parsers.
    const parsed = parseLogcatLine(readLine("taskid__spaces.txt"));
    const reference = readExpected("taskid__spaces.txt");
    expect(reference.taskId).toBe("  padded  ");
    expect(parsed?.taskId).toBe("padded");
  });

  // -------------------------------------------------------------------------
  //  Structured channel
  // -------------------------------------------------------------------------

  const structuredDir = join(FIXTURES, "structured");
  const structuredFiles = readdirSync(structuredDir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  const readEvent = (f: string) =>
    readFileSync(join(structuredDir, f), "utf8").replace(/\r?\n$/, "");

  it("corpus carries all 49 frozen wire names", () => {
    const names = structuredFiles
      .filter((f) => f.startsWith("event__"))
      .map((f) => f.slice("event__".length, -".json".length));
    expect(names).toHaveLength(49);
  });

  it("every structured payload parses off a real logcat line", () => {
    const rejected: string[] = [];
    for (const f of structuredFiles) {
      // Wrap in the real line shape the sniffer sees.
      const line = `01-01 00:00:00.000 I/NESY_TEST_EVENT( 1234): NESY_TEST_EVENT|${readEvent(f)}`;
      if (parseTestEventLine(line) === null) rejected.push(f);
    }
    expect(rejected, `parseTestEventLine returned null for: ${rejected}`).toEqual([]);
  });

  it("unknown (SDK-era) wire names pass through instead of being rejected", () => {
    // A.5 passthrough guarantee: the current parser must survive names it has never
    // seen, otherwise every SDK phase would need a lockstep Cockpit release.
    const line = `NESY_TEST_EVENT|${readEvent("event__anr_likely.json")}`;
    const parsed = parseTestEventLine(line);
    expect(parsed?.event).toBe("ANR_LIKELY");
  });

  it("success:false survives as false, not as absent", () => {
    const parsed = parseTestEventLine(
      `NESY_TEST_EVENT|${readEvent("fields__success-false.json")}`,
    );
    expect(parsed?.success).toBe(false);
  });

  it("absent optionals stay undefined (Gson omits nulls)", () => {
    const parsed = parseTestEventLine(
      `NESY_TEST_EVENT|${readEvent("fields__all-optionals-absent.json")}`,
    );
    expect(parsed?.action).toBeUndefined();
    expect(parsed?.status).toBeUndefined();
    expect(parsed?.success).toBeUndefined();
  });

  it("a null value inside `data` is DROPPED on the structured channel", () => {
    // Asymmetry surfaced by the corpus: the legacy formatter writes `"note":null`
    // (key present), Gson omits it entirely. `TestBridgeEvent.data` is typed
    // `Record<string, string | null>`, which implies the key would be there — it is
    // not. Consumers must treat absent and null as the same thing on this channel.
    const raw = JSON.parse(readEvent("fields__data-edge-cases.json")) as {
      data: Record<string, unknown>;
    };
    expect("null" in raw.data).toBe(false);
    expect(raw.data.empty).toBe("");
  });

  it("seq beyond 2^53 loses precision through JSON.parse — pinned, not accepted", () => {
    // 9007199254740993 is 2^53+1. JSON.parse rounds it to 2^53. seq is a Kotlin Long,
    // so this is reachable in principle; the day it matters this fixture is the record
    // that it was known, not a mystery duplicate-detection bug.
    const parsed = parseTestEventLine(
      `NESY_TEST_EVENT|${readEvent("fields__large-seq.json")}`,
    );
    expect(parsed?.seq).toBe(9007199254740992);
    expect(readEvent("fields__large-seq.json")).toContain("9007199254740993");
  });

  it("no fixture contains a raw line break", () => {
    const offenders = [
      ...legacyFiles.map((f) => [f, readLine(f)] as const),
      ...structuredFiles.map((f) => [f, readEvent(f)] as const),
    ].filter(([, body]) => body.includes("\n") || body.includes("\r"));
    expect(offenders.map(([f]) => f)).toEqual([]);
  });

  // -------------------------------------------------------------------------
  //  Control plane
  // -------------------------------------------------------------------------

  it("control-plane fixtures cover every Verdict control op", () => {
    const dir = join(FIXTURES, "control-plane");
    // The corpus carries two shapes. Legacy control ops travel the `am` channel
    // as `{ op: { op } }`; Bridge B2 protocol requests are `{ request: { command } }`.
    // Reading only the first shape made every B2 fixture crash this test with
    // `Cannot read properties of undefined (reading 'op')`.
    const ops = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map(
        (f) =>
          JSON.parse(readFileSync(join(dir, f), "utf8")) as {
            op?: { op?: string };
            request?: { command?: string };
          },
      )
      .map((fixture) => fixture.op?.op ?? fixture.request?.command)
      .filter((op): op is string => typeof op === "string");
    for (const required of [
      "get_state",
      "get_device_id",
      "get_request_key",
      "set_run",
      "reset_state",
      "navigate",
      "seed",
      "get_screen_state",
      "end_run",
    ]) {
      expect(ops, `control-plane fixture missing for ${required}`).toContain(required);
    }
  });

  it("control-plane fixtures cover the Bridge B2 protocol commands", () => {
    // Guards the cross-repo seam: these fixtures come from the
    // `verdict-contract-fixtures` submodule owned by the mobile side. Asserting
    // them here means a B2 command disappearing upstream fails the cockpit
    // build instead of silently narrowing the corpus.
    const dir = join(FIXTURES, "control-plane");
    const commands = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as { request?: { command?: string } })
      .map((fixture) => fixture.request?.command)
      .filter((command): command is string => typeof command === "string");
    for (const required of ["wait_any", "cancel_request", "capabilities", "register_watch"]) {
      expect(commands, `B2 control-plane fixture missing for ${required}`).toContain(required);
    }
  });
});

/** Exported so the mismatch-gate script can reuse the resolved paths. */
export const fixturePaths = { root: ROOT, lock: LOCK, corpus: resolve(FIXTURES) };
