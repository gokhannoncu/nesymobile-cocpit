#!/usr/bin/env node
/**
 * MISMATCH GATE + `Pairs-With` RESOLVER — CI's `contract` job (plan Faz 0.4, Bölüm G).
 *
 * Fails when the two consumer repos pin different `verdict-contract-fixtures`
 * commits, or when the checked-out corpus is not the pinned one. Without this a
 * fixture change landing on only one side goes green on both: each repo's own
 * suite keeps passing against whichever corpus it happens to have.
 *
 * ## Why this file also resolves `Pairs-With`
 *
 * Because the gate had a defect that made it unusable the first time it mattered.
 * Each side compared its own new sha against the peer's DEFAULT BRANCH, so a
 * coordinated pin bump could not go green on either side: A's PR compared the new
 * sha with B's still-old main, and B's PR did the mirror image. Two PRs that have
 * to land together were therefore unmergeable — and the only way forward would
 * have been to ignore the gate, which is the habit that ends a gate's usefulness.
 *
 * Bölüm G's answer is a `Pairs-With: <owner/repo#PR>` line in the PR description,
 * verified for RECIPROCITY: each PR must name the other, and then each side reads
 * the peer's PR HEAD instead of the peer's default branch.
 *
 * ## The trust boundary — this is the security-relevant part of this file
 *
 * The `Pairs-With` value comes from a PR description, which any author of any PR
 * can write. It is UNTRUSTED INPUT and is treated as such:
 *
 *   1. Only the exact `owner/repo#PR` form is accepted. ASCII only, anchored, no
 *      URLs, no surrounding text, no whitespace inside. A value that does not
 *      match is a hard FAILURE, not something to ignore — ignoring it silently
 *      downgrades to the broken default-branch comparison while the author
 *      believes coordination is active.
 *   2. Only the two consumer repos are accepted, from a HARD-CODED list. Not
 *      configurable, because a configurable allow-list is one repository variable
 *      away from pointing the peer checkout at anything.
 *   3. RECIPROCITY is required. The peer PR's own description must name this repo
 *      and this PR number. A one-sided reference fails. Without this, anyone who
 *      can open a PR anywhere in either repo could make the other repo's gate
 *      read a commit of their choosing.
 *   4. FORK PRs never get a peer-head checkout (Bölüm G). Neither this PR being
 *      from a fork, nor the peer PR being from a fork.
 *
 * Even with all four, the only thing ever read from the peer is
 * `contract-fixtures.lock`, with a token scoped to `contents: read` +
 * `pull_requests: read`, and no peer code is executed. The checks are what stop
 * the gate from being TOLD which commit to consider authoritative; the narrow
 * checkout is what limits the damage if they are ever wrong.
 *
 * Usage:
 *   # 1) the gate
 *   node scripts/check-fixture-lock.mjs --self . --peer <dir> [--corpus <path>]
 *
 *   # 2) which peer PR does this PR name? (prints nothing when there is none)
 *   node scripts/check-fixture-lock.mjs --pairs-target --body-file <f>
 *
 *   # 3) which peer ref should be checked out?
 *   node scripts/check-fixture-lock.mjs --resolve-peer \
 *     --self-repo <owner/repo> --self-pr <n> --body-file <f> [--self-fork] \
 *     --peer-repo <owner/repo> --peer-default-branch <b> [--peer-pr-file <f>]
 *
 * Exit 0 = the answer is on stdout. Anything else exits 1 with the specific
 * disagreement, never a generic failure.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// ---------------------------------------------------------------------------
//  Pairs-With — pure, exported, and tested directly (check-fixture-lock.test.mjs)
// ---------------------------------------------------------------------------

/**
 * The only repos a `Pairs-With` may name. HARD-CODED, per Bölüm G.
 *
 * Not read from `vars.*`: a repository variable is editable by anyone with repo
 * admin and by any workflow that can write variables, and the whole point of the
 * allow-list is to be the one thing an attacker with PR-description access cannot
 * move. The neutral fixture repo is deliberately NOT here — it is never a
 * `Pairs-With` target; it is the thing both sides pin.
 *
 * Lower-case because GitHub owner/repo names are case-insensitive, and the
 * comparison normalises. Format validation runs FIRST and is ASCII-only, so no
 * Unicode ever reaches `toLowerCase()` (Turkish dotted-İ folding would otherwise
 * be a way to make two different strings compare equal).
 */
export const ALLOWED_PEER_REPOS = Object.freeze([
  'aras-digital/nesy.courier.mobile',
  'gokhannoncu/nesymobile-cocpit',
])

/**
 * `Pairs-With:` at the start of a line, key case-insensitive.
 *
 * The key is matched loosely (people type `pairs-with:`) and the VALUE is matched
 * strictly. A quoted or indented-in-a-code-block occurrence with a `>` or other
 * prefix does not match, which is the safe direction: it is not honoured.
 */
const PAIRS_WITH_KEY = /^[ \t]*pairs-with[ \t]*:(.*)$/i

/**
 * `owner/repo#N`, anchored, ASCII only.
 *
 * * owner: GitHub's own rule — alphanumeric or single hyphens, cannot start or end
 *   with a hyphen, ≤39 chars.
 * * repo: alphanumeric plus `.`, `-`, `_`; must start alphanumeric. `.` is allowed
 *   because one of the two repos is literally `NESY.Courier.Mobile`.
 * * number: no leading zero, ≤10 digits. `#0` and `#007` are refused — a PR number
 *   is not zero, and two spellings of one number are two cache keys.
 *
 * No `\s` anywhere, so `owner/repo#1 ../../etc` cannot match: the anchors plus the
 * character classes are what make this safe to interpolate into a URL path.
 */
const PAIRS_WITH_VALUE =
  /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)\/([A-Za-z0-9][A-Za-z0-9._-]{0,99})#([1-9][0-9]{0,9})$/

const sameRepo = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase()

const isAllowed = (repoFull) => ALLOWED_PEER_REPOS.includes(String(repoFull).toLowerCase())

/**
 * Finds and validates the `Pairs-With` line in a PR description.
 *
 * @param body the raw PR description. `null`/`undefined` are normal — GitHub sends
 *   `null` for an empty body — and mean "no pairing", not an error.
 * @returns `{ok:true, target:null}` | `{ok:true, target:{owner,repo,full,pr}}` |
 *   `{ok:false, reason}`
 */
export function parsePairsWith(body) {
  if (body === null || body === undefined) return { ok: true, target: null }
  if (typeof body !== 'string') return { ok: false, reason: `PR body is not a string (${typeof body})` }

  const raw = []
  for (const line of body.split(/\r?\n/)) {
    const m = PAIRS_WITH_KEY.exec(line)
    if (m) raw.push(m[1].trim())
  }
  if (raw.length === 0) return { ok: true, target: null }
  if (raw.length > 1) {
    // Not "take the first". Two lines is either a mistake or an attempt to have
    // one reader honour one and another reader honour the other.
    return { ok: false, reason: `PR body has ${raw.length} Pairs-With lines; exactly one is allowed` }
  }

  const value = raw[0]
  const m = PAIRS_WITH_VALUE.exec(value)
  if (!m) {
    return {
      ok: false,
      reason:
        `Pairs-With value is not of the form owner/repo#PR: "${value}"\n` +
        `  Exactly that form, nothing else — no URL, no branch, no extra text.`,
    }
  }
  const [, owner, repo, pr] = m
  return { ok: true, target: { owner, repo, full: `${owner}/${repo}`, pr: Number(pr) } }
}

/**
 * Decides which peer ref the mismatch gate compares against.
 *
 * Pure. Every fact it needs is passed in, so the whole decision — including all
 * four trust checks — is testable without a network, a token or a repository.
 *
 * @param input.selfRepo         `github.repository`, trusted.
 * @param input.selfPr           this PR's number, or null on a push/dispatch run.
 * @param input.selfBody         this PR's description. UNTRUSTED.
 * @param input.selfIsFork       `github.event.pull_request.head.repo.fork`.
 * @param input.peerRepo         the repo this job compares against, from `vars.*`.
 * @param input.peerDefaultBranch the fallback ref.
 * @param input.peerPr           the peer PR as the API reported it, or null when
 *   none was fetched: `{number, state, merged, baseRepo, headRepo, headSha, body}`.
 *   `body` is UNTRUSTED.
 * @returns `{ok:true, mode:'default-branch'|'peer-head', ref, notes:[]}` |
 *   `{ok:false, reason}`
 */
export function resolvePeerRef(input) {
  const {
    selfRepo,
    selfPr = null,
    selfBody = null,
    selfIsFork = false,
    peerRepo,
    peerDefaultBranch,
    peerPr = null,
  } = input ?? {}

  const notes = []
  const fallback = (note) => {
    if (note) notes.push(note)
    return { ok: true, mode: 'default-branch', ref: peerDefaultBranch, notes }
  }

  if (!peerRepo || !peerDefaultBranch) {
    return { ok: false, reason: 'peerRepo and peerDefaultBranch are required' }
  }
  if (!isAllowed(peerRepo)) {
    // The workflow's own configuration is wrong. Refuse rather than compare
    // against whatever `vars.COCKPIT_REPO` happens to say today.
    return {
      ok: false,
      reason:
        `peer repo "${peerRepo}" is not one of the two consumer repos.\n` +
        `  Allowed: ${ALLOWED_PEER_REPOS.join(', ')}`,
    }
  }
  // Not a pull_request run: there is no description to read and no PR to pair with.
  if (selfPr === null || selfPr === undefined) return fallback(null)

  const parsed = parsePairsWith(selfBody)
  if (!parsed.ok) return { ok: false, reason: parsed.reason }
  // Bölüm G: "Fixture değişmeyen PR: karşı tarafın main'i kullanılır."
  if (parsed.target === null) return fallback(null)

  const target = parsed.target

  // ---- trust check 2: the hard-coded allow-list -------------------------
  if (!isAllowed(target.full)) {
    return {
      ok: false,
      reason:
        `Pairs-With names "${target.full}", which is not one of the two consumer repos.\n` +
        `  Allowed: ${ALLOWED_PEER_REPOS.join(', ')}`,
    }
  }
  if (sameRepo(target.full, selfRepo)) {
    return { ok: false, reason: `Pairs-With names this repo (${target.full}); it must name the peer` }
  }
  if (!sameRepo(target.full, peerRepo)) {
    return {
      ok: false,
      reason: `Pairs-With names "${target.full}" but this job compares against "${peerRepo}"`,
    }
  }

  // ---- trust check 4a: this PR is from a fork ---------------------------
  if (selfIsFork) {
    return {
      ok: false,
      reason:
        `this PR is from a fork, so Bölüm G forbids resolving a peer head for it.\n` +
        `  A coordinated fixture bump must be opened from a branch in ${selfRepo}.`,
    }
  }

  if (!peerPr) {
    return { ok: false, reason: `Pairs-With names ${target.full}#${target.pr} but that PR was not fetched` }
  }
  if (Number(peerPr.number) !== target.pr) {
    return {
      ok: false,
      reason: `fetched PR is #${peerPr.number} but Pairs-With names #${target.pr}`,
    }
  }
  if (!sameRepo(peerPr.baseRepo, peerRepo)) {
    return {
      ok: false,
      reason: `fetched PR targets "${peerPr.baseRepo}", not the peer repo "${peerRepo}"`,
    }
  }

  // Merged already: the paired change is IN the default branch, so the default
  // branch is now the right answer. Bölüm G merges the pair the same day, so the
  // second of the two PRs re-runs its CI in exactly this state — failing here
  // would make the winner of the race break the loser.
  if (peerPr.merged === true) {
    return fallback(`peer PR ${target.full}#${target.pr} is already merged; using ${peerDefaultBranch}`)
  }
  if (peerPr.state !== 'open') {
    return {
      ok: false,
      reason:
        `peer PR ${target.full}#${target.pr} is ${peerPr.state} and not merged.\n` +
        `  Its head is not a commit anything should be compared against.`,
    }
  }

  // ---- trust check 4b: the PEER PR is from a fork -----------------------
  // Its head is a commit an outside author controls. Bölüm G: no peer checkout,
  // default branch only. Not a hard failure, because the peer PR being a fork PR
  // is not this PR's fault — but the gate will now go red at the lock comparison,
  // so the note has to say why.
  if (!sameRepo(peerPr.headRepo, peerPr.baseRepo)) {
    return fallback(
      `peer PR ${target.full}#${target.pr} is from a fork (${peerPr.headRepo}); ` +
        `Bölüm G forbids checking out its head, so ${peerDefaultBranch} is used. ` +
        `A paired pin bump CANNOT go green this way — reopen it from a branch in ${peerRepo}.`,
    )
  }

  // ---- trust check 3: reciprocity ---------------------------------------
  const back = parsePairsWith(peerPr.body)
  if (!back.ok) return { ok: false, reason: `peer PR description: ${back.reason}` }
  if (back.target === null) {
    return {
      ok: false,
      reason:
        `ONE-SIDED Pairs-With. ${selfRepo}#${selfPr} names ${target.full}#${target.pr}, ` +
        `but that PR names nothing.\n` +
        `  Add "Pairs-With: ${selfRepo}#${selfPr}" to it. Reciprocity is what stops any PR ` +
        `author from choosing which commit the other repo's gate trusts.`,
    }
  }
  if (!isAllowed(back.target.full)) {
    return { ok: false, reason: `peer PR names "${back.target.full}", which is not an allowed repo` }
  }
  if (!sameRepo(back.target.full, selfRepo) || back.target.pr !== Number(selfPr)) {
    return {
      ok: false,
      reason:
        `NOT MUTUAL. ${selfRepo}#${selfPr} names ${target.full}#${target.pr}, ` +
        `but that PR names ${back.target.full}#${back.target.pr}.`,
    }
  }

  if (!/^[0-9a-f]{40}$/.test(String(peerPr.headSha))) {
    return { ok: false, reason: `peer PR head sha is not a 40-hex commit: "${peerPr.headSha}"` }
  }

  return {
    ok: true,
    mode: 'peer-head',
    ref: String(peerPr.headSha),
    notes: [`paired with ${target.full}#${target.pr} (mutual), reading its head ${peerPr.headSha}`],
  }
}

// ---------------------------------------------------------------------------
//  CLI
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2)
const arg = (name) => {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}
const flag = (name) => argv.includes(name)

const readBody = () => {
  // Via a FILE, never via a command-line argument or a `${{ }}` interpolation.
  // A PR description is attacker-controlled text that may contain quotes,
  // backticks, newlines and `$(...)`; interpolating it into a `run:` block is a
  // shell injection with the workflow's own permissions.
  const f = arg('--body-file')
  if (!f) return null
  return existsSync(f) ? readFileSync(f, 'utf8') : null
}

const fail = (message) => {
  console.error('\n' + message + '\n')
  process.exit(1)
}

function cmdPairsTarget() {
  const parsed = parsePairsWith(readBody())
  if (!parsed.ok) fail(`PAIRS-WITH REJECTED\n  ${parsed.reason}`)
  // Nothing on stdout means "no pairing" — the caller skips the API fetch.
  if (parsed.target) process.stdout.write(`${parsed.target.full}#${parsed.target.pr}\n`)
}

function cmdResolvePeer() {
  const prFile = arg('--peer-pr-file')
  let peerPr = null
  if (prFile) {
    if (!existsSync(prFile)) fail(`--peer-pr-file ${prFile} does not exist`)
    let json
    try {
      json = JSON.parse(readFileSync(prFile, 'utf8'))
    } catch (err) {
      fail(`--peer-pr-file is not JSON: ${err instanceof Error ? err.message : err}`)
    }
    peerPr = {
      number: json.number,
      state: json.state,
      merged: json.merged === true,
      baseRepo: json.base?.repo?.full_name,
      headRepo: json.head?.repo?.full_name,
      headSha: json.head?.sha,
      body: json.body ?? null,
    }
  }

  const selfPrRaw = arg('--self-pr')
  const res = resolvePeerRef({
    selfRepo: arg('--self-repo'),
    selfPr: selfPrRaw === undefined || selfPrRaw === '' ? null : Number(selfPrRaw),
    selfBody: readBody(),
    selfIsFork: flag('--self-fork'),
    peerRepo: arg('--peer-repo'),
    peerDefaultBranch: arg('--peer-default-branch'),
    peerPr,
  })
  if (!res.ok) fail(`PAIRS-WITH REJECTED\n  ${res.reason}`)
  for (const note of res.notes) console.warn(`[fixture-lock] ${note}`)
  // Two lines, `key=value`, appendable straight to $GITHUB_OUTPUT.
  process.stdout.write(`peer_ref=${res.ref}\npeer_mode=${res.mode}\n`)
}

function cmdGate() {
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
          `  Both repos must pin the same fixture commit, in the same PR round.\n` +
          `  If the peer's change is in an OPEN PR rather than its default branch, the two PRs\n` +
          `  must reference each other: add "Pairs-With: <owner/repo#PR>" to BOTH descriptions.`,
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

  if (problems.length) fail(problems.join('\n\n'))
  console.log(`[fixture-lock] OK — pinned ${self.sha}`)
}

// Only when RUN, not when imported by the test file.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (flag('--pairs-target')) cmdPairsTarget()
  else if (flag('--resolve-peer')) cmdResolvePeer()
  else cmdGate()
}
