#!/usr/bin/env node
/**
 * MISMATCH GATE — first step of CI's `contract` job (plan Faz 0.4, Bölüm G).
 *
 * Fails when the two consumer repos pin different `verdict-contract-fixtures`
 * commits, or when the checked-out corpus is not the pinned one. Without this a
 * fixture change landing on only one side goes green on both: each repo's own
 * suite keeps passing against whichever corpus it happens to have.
 *
 * Usage:
 *   node scripts/check-fixture-lock.mjs --peer <path-to-other-repo> [--corpus <path>]
 *
 * Exit 0 = locks agree and the corpus matches. Anything else exits 1 with the
 * specific disagreement, never a generic failure.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const argv = process.argv.slice(2)
const arg = (name) => {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}

const SELF = resolve(arg('--self') ?? process.cwd())
const PEER = arg('--peer')
// Default to the submodule location when it is actually checked out. Requiring the
// flag meant a local run silently skipped the corpus check — the same
// "green tick that verified nothing" this gate exists to remove.
const defaultCorpus = join(SELF, 'verdict-contract-fixtures')
const CORPUS =
  arg('--corpus') ??
  process.env.VERDICT_FIXTURES_DIR ??
  (existsSync(join(defaultCorpus, 'manifest.json')) ? defaultCorpus : undefined)

const readSha = (repo) => {
  const lock = join(repo, 'contract-fixtures.lock')
  if (!existsSync(lock)) return { repo, error: `no contract-fixtures.lock at ${lock}` }
  const line = readFileSync(lock, 'utf8')
    .split('\n')
    .find((l) => l.trim().startsWith('sha='))
  if (!line) return { repo, error: `no sha= line in ${lock}` }
  const sha = line.trim().slice('sha='.length).trim()
  if (!/^[0-9a-f]{40}$/.test(sha)) return { repo, error: `malformed sha in ${lock}: ${sha}` }
  return { repo, sha }
}

const problems = []
const self = readSha(SELF)
if (self.error) problems.push(self.error)

if (PEER) {
  const peer = readSha(resolve(PEER))
  if (peer.error) problems.push(peer.error)
  else if (self.sha && peer.sha !== self.sha) {
    problems.push(
      `LOCK MISMATCH\n  ${SELF}\n    ${self.sha}\n  ${resolve(PEER)}\n    ${peer.sha}\n` +
        `  Both repos must pin the same fixture commit, in the same PR round.`,
    )
  }
} else {
  // Say so out loud. A gate that quietly checks half of what it claims is worse
  // than no gate, because the green tick is read as "both sides agree".
  console.warn('[fixture-lock] --peer not given: cross-repo comparison SKIPPED')
}

if (CORPUS && self.sha) {
  if (!existsSync(join(CORPUS, 'manifest.json'))) {
    problems.push(`corpus at ${CORPUS} has no manifest.json — is it the fixture repo?`)
  } else {
    try {
      const head = execFileSync('git', ['-C', CORPUS, 'rev-parse', 'HEAD'], {
        encoding: 'utf8',
      }).trim()
      if (head !== self.sha) {
        problems.push(
          `CORPUS MISMATCH\n  pinned:    ${self.sha}\n  checked out: ${head}\n` +
            `  Run: git submodule update --init --checkout`,
        )
      }
    } catch (err) {
      problems.push(`could not read corpus HEAD: ${err instanceof Error ? err.message : err}`)
    }
  }
} else if (!CORPUS) {
  // A missing corpus is only tolerable while the submodule is not declared. Once
  // `.gitmodules` names it, absence means a forgotten `git submodule update --init`
  // and the check MUST fail.
  //
  // Measured: the earlier version printed
  //     [fixture-lock] no --corpus: corpus check SKIPPED
  //     [fixture-lock] OK — pinned <sha>
  // and exited 0 with no corpus on disk at all — the exact
  // green-tick-that-verified-nothing this gate exists to prevent, inside the gate
  // itself. It surfaced in a sandbox where the submodule clone had failed.
  const gitmodules = join(SELF, '.gitmodules')
  const declared =
    existsSync(gitmodules) &&
    readFileSync(gitmodules, 'utf8').includes('verdict-contract-fixtures')
  if (declared) {
    problems.push(
      `CORPUS MISSING\n  .gitmodules declares verdict-contract-fixtures but nothing is ` +
        `checked out at ${defaultCorpus}\n  Run: git submodule update --init --checkout`,
    )
  } else {
    console.warn(
      '[fixture-lock] no corpus and no submodule declared: corpus check SKIPPED ' +
        '(this stops being acceptable once .gitmodules names it)',
    )
  }
}

if (problems.length) {
  console.error('\n' + problems.join('\n\n') + '\n')
  process.exit(1)
}
console.log(`[fixture-lock] OK — pinned ${self.sha}`)
