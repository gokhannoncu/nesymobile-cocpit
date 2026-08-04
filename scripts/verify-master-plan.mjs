import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const planPath = path.join(
  repoRoot,
  "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md",
);

const raw = await readFile(planPath, "utf8");
const lf = raw.replace(/\r\n?/g, "\n");

if (!lf.endsWith("\n")) {
  console.error("Master plan digest verification failed: file must end with LF.");
  process.exit(1);
}

const lines = lf.split("\n");
const digestLineIndexes = [];
const normalizedLines = [];

for (const [index, line] of lines.entries()) {
  if (line.startsWith("**MasterDigest:**")) {
    digestLineIndexes.push(index);
    continue;
  }
  normalizedLines.push(line);
}

if (digestLineIndexes.length !== 1) {
  console.error(
    `Master plan digest verification failed: expected exactly one MasterDigest line, found ${digestLineIndexes.length}.`,
  );
  process.exit(1);
}

const digestLine = lines[digestLineIndexes[0]];
const match = digestLine.match(/`sha256:([a-f0-9]{64})`/);

if (!match) {
  console.error("Master plan digest verification failed: MasterDigest must be `sha256:<64 hex>`.");
  process.exit(1);
}

const normalized = normalizedLines.join("\n");
const computed = createHash("sha256").update(normalized, "utf8").digest("hex");
const expected = match[1];

if (computed !== expected) {
  console.error("Master plan digest verification failed.");
  console.error(`Expected: sha256:${expected}`);
  console.error(`Computed: sha256:${computed}`);
  process.exit(1);
}

console.log(`Master plan digest OK: sha256:${computed}`);
