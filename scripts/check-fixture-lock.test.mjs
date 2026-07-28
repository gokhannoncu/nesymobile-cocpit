/**
 * `Pairs-With` trust-boundary tests (Bölüm G).
 *
 *   node --test scripts/check-fixture-lock.test.mjs
 *
 * ## Why the validator is tested and not the workflow
 *
 * The cross-repo path needs `vars.COCKPIT_REPO`, `vars.MOBILE_REPO` and
 * `secrets.PEER_LOCK_TOKEN`, none of which exist yet, so nothing can exercise the
 * `gh api` call or the peer checkout outside CI. What CAN be tested is the part the
 * secrets do not protect: the decision about WHICH commit to trust, made from a PR
 * description that any author of any PR can write. That decision is
 * `parsePairsWith` + `resolvePeerRef`, both pure, both here.
 *
 * ## What each security property is pinned by
 *
 * Every one of the four checks in Bölüm G's trust model has a test whose failure
 * mode is the attack, and the mutation that removes the check is named in the test
 * so the pairing survives a refactor:
 *
 * | Check | Test | Mutation it catches |
 * |---|---|---|
 * | exact `owner/repo#PR` form | `malformed values are refused, one by one` | M-P1 |
 * | hard-coded allow-list | `a third-party repo is refused` | M-P2 |
 * | reciprocity | `a one-sided reference is refused` | M-P3 |
 * | fork PRs get no peer head | `a fork PR ...` (two of them) | M-P4/M-P5 |
 *
 * A malformed value is a FAILURE and not an ignore, and that is itself a security
 * property: ignoring it silently reverts to the peer's default branch while the
 * author believes coordination is on.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parsePairsWith, resolvePeerRef, ALLOWED_PEER_REPOS } from './check-fixture-lock.mjs'

const MOBILE = 'aras-digital/NESY.Courier.Mobile'
const COCKPIT = 'gokhannoncu/nesymobile-cocpit'
const SHA = 'a'.repeat(40)

/** A well-formed, mutual, non-fork pair. Every negative test spoils exactly one thing. */
const good = (over = {}) => ({
  selfRepo: MOBILE,
  selfPr: 42,
  selfBody: `Bumps the corpus.\n\nPairs-With: ${COCKPIT}#7\n`,
  selfIsFork: false,
  peerRepo: COCKPIT,
  peerDefaultBranch: 'main',
  peerPr: {
    number: 7,
    state: 'open',
    merged: false,
    baseRepo: COCKPIT,
    headRepo: COCKPIT,
    headSha: SHA,
    body: `Consumes the new corpus.\n\nPairs-With: ${MOBILE}#42\n`,
  },
  ...over,
})

describe('parsePairsWith — format', () => {
  it('accepts the exact form and nothing around it', () => {
    const r = parsePairsWith(`intro\nPairs-With: ${COCKPIT}#7\noutro`)
    assert.equal(r.ok, true)
    assert.deepEqual(r.target, {
      owner: 'gokhannoncu',
      repo: 'nesymobile-cocpit',
      full: COCKPIT,
      pr: 7,
    })
  })

  it('accepts a repo name containing dots (NESY.Courier.Mobile)', () => {
    const r = parsePairsWith(`Pairs-With: ${MOBILE}#1`)
    assert.equal(r.target.full, MOBILE)
    assert.equal(r.target.pr, 1)
  })

  it('is case-insensitive on the KEY and tolerates indentation and CRLF', () => {
    for (const body of [
      `pairs-with: ${COCKPIT}#7`,
      `PAIRS-WITH:${COCKPIT}#7`,
      `   Pairs-With:   ${COCKPIT}#7   `,
      `line\r\nPairs-With: ${COCKPIT}#7\r\nline`,
    ]) {
      const r = parsePairsWith(body)
      assert.equal(r.ok, true, body)
      assert.equal(r.target?.pr, 7, body)
    }
  })

  it('treats an absent line, an empty body and null as "no pairing"', () => {
    for (const body of [null, undefined, '', 'no pairing here', 'see also owner/repo#5']) {
      const r = parsePairsWith(body)
      assert.equal(r.ok, true, String(body))
      assert.equal(r.target, null, String(body))
    }
  })

  /**
   * M-P1. Every one of these must be REFUSED, not silently ignored.
   *
   * The URL and the trailing-junk cases are the ones that matter most: they are how
   * a value that "looks right to a human" gets a checkout to fetch something else.
   */
  it('malformed values are refused, one by one', () => {
    const bad = [
      ['a URL', `Pairs-With: https://github.com/${COCKPIT}/pull/7`],
      ['trailing junk', `Pairs-With: ${COCKPIT}#7 and also evil/repo#1`],
      ['leading junk', `Pairs-With: see ${COCKPIT}#7`],
      ['path traversal', 'Pairs-With: gokhannoncu/../../etc/passwd#7'],
      ['no pr number', `Pairs-With: ${COCKPIT}`],
      ['empty pr number', `Pairs-With: ${COCKPIT}#`],
      ['zero pr number', `Pairs-With: ${COCKPIT}#0`],
      ['leading-zero pr number', `Pairs-With: ${COCKPIT}#007`],
      ['negative pr number', `Pairs-With: ${COCKPIT}#-7`],
      ['non-numeric pr', `Pairs-With: ${COCKPIT}#abc`],
      ['a branch instead', 'Pairs-With: gokhannoncu/nesymobile-cocpit@main'],
      ['three path segments', 'Pairs-With: a/b/c#7'],
      ['owner starting with a hyphen', 'Pairs-With: -evil/nesymobile-cocpit#7'],
      ['a newline smuggled via a second field', `Pairs-With: ${COCKPIT}#7\tref=evil`],
      ['unicode homoglyph owner', 'Pairs-With: gökhannoncu/nesymobile-cocpit#7'],
      ['whitespace inside', `Pairs-With: ${COCKPIT} #7`],
      ['empty value', 'Pairs-With:'],
      ['a glob', 'Pairs-With: */*#7'],
    ]
    for (const [label, body] of bad) {
      const r = parsePairsWith(body)
      assert.equal(r.ok, false, `${label} was ACCEPTED: ${body}`)
      assert.match(r.reason, /owner\/repo#PR/, label)
    }
  })

  it('two Pairs-With lines are refused rather than resolved to the first', () => {
    const r = parsePairsWith(`Pairs-With: ${COCKPIT}#7\nPairs-With: ${COCKPIT}#8`)
    assert.equal(r.ok, false)
    assert.match(r.reason, /2 Pairs-With lines/)
  })

  it('a non-string body is an error, not a crash', () => {
    assert.equal(parsePairsWith({ evil: true }).ok, false)
    assert.equal(parsePairsWith(7).ok, false)
  })
})

describe('resolvePeerRef — the happy paths', () => {
  it('a mutual non-fork pair resolves to the peer PR head', () => {
    const r = resolvePeerRef(good())
    assert.equal(r.ok, true)
    assert.equal(r.mode, 'peer-head')
    assert.equal(r.ref, SHA)
  })

  it('the same pair resolves from the Cockpit side too (the file is shared)', () => {
    const r = resolvePeerRef({
      selfRepo: COCKPIT,
      selfPr: 7,
      selfBody: `Pairs-With: ${MOBILE}#42`,
      peerRepo: MOBILE,
      peerDefaultBranch: 'rel/env-dev',
      peerPr: {
        number: 42,
        state: 'open',
        merged: false,
        baseRepo: MOBILE,
        headRepo: MOBILE,
        headSha: 'b'.repeat(40),
        body: `Pairs-With: ${COCKPIT}#7`,
      },
    })
    assert.equal(r.ok, true)
    assert.equal(r.mode, 'peer-head')
    assert.equal(r.ref, 'b'.repeat(40))
  })

  it('no Pairs-With means the peer default branch — Bölüm G, the common case', () => {
    const r = resolvePeerRef(good({ selfBody: 'a normal PR that touches no fixtures' }))
    assert.equal(r.ok, true)
    assert.equal(r.mode, 'default-branch')
    assert.equal(r.ref, 'main')
  })

  it('a push or dispatch run (no PR) uses the peer default branch', () => {
    const r = resolvePeerRef(good({ selfPr: null, selfBody: null }))
    assert.equal(r.ok, true)
    assert.equal(r.ref, 'main')
  })

  it('case differences in repo names do not break a legitimate pair', () => {
    // GitHub owner/repo are case-insensitive, so refusing these would reject a
    // correct value and push people towards ignoring the gate.
    const r = resolvePeerRef(
      good({
        selfBody: 'Pairs-With: GokhanNoncu/NesyMobile-Cocpit#7',
        peerPr: { ...good().peerPr, body: 'Pairs-With: ARAS-DIGITAL/nesy.courier.mobile#42' },
      }),
    )
    assert.equal(r.ok, true)
    assert.equal(r.mode, 'peer-head')
  })
})

describe('resolvePeerRef — trust boundary', () => {
  /** M-P2 — the hard-coded allow-list. */
  it('a third-party repo is refused', () => {
    for (const evil of [
      'attacker/nesymobile-cocpit',
      'gokhannoncu/verdict-contract-fixtures', // the neutral repo is NOT a pairing target
      'gokhannoncu/nesymobile-cocpit-evil',
      'nesymobile-cocpit/gokhannoncu',
    ]) {
      const r = resolvePeerRef(good({ selfBody: `Pairs-With: ${evil}#7` }))
      assert.equal(r.ok, false, `${evil} was ACCEPTED`)
      assert.match(r.reason, /not one of the two consumer repos|does not compare against/, evil)
    }
  })

  it('the allow-list is exactly the two consumer repos', () => {
    // Pins the list itself. Adding a third repo is a decision, not a typo, and it
    // must break a test rather than widen the boundary quietly.
    assert.deepEqual([...ALLOWED_PEER_REPOS].sort(), [
      'aras-digital/nesy.courier.mobile',
      'gokhannoncu/nesymobile-cocpit',
    ])
  })

  it('a Pairs-With naming this repo instead of the peer is refused', () => {
    const r = resolvePeerRef(good({ selfBody: `Pairs-With: ${MOBILE}#41` }))
    assert.equal(r.ok, false)
    assert.match(r.reason, /names this repo/)
  })

  it('an allowed repo that is not THIS job\'s peer is refused', () => {
    // Reachable if `vars.*` is ever misconfigured. The comparison must be against
    // the repo the job actually fetches, not merely "an allowed repo".
    const r = resolvePeerRef(good({ peerRepo: COCKPIT, selfRepo: COCKPIT, selfBody: `Pairs-With: ${MOBILE}#42` }))
    assert.equal(r.ok, false)
    assert.match(r.reason, /but this job compares against/)
  })

  it('a misconfigured peerRepo is refused before anything is fetched', () => {
    const r = resolvePeerRef(good({ peerRepo: 'attacker/whatever' }))
    assert.equal(r.ok, false)
    assert.match(r.reason, /not one of the two consumer repos/)
  })

  /** M-P3 — reciprocity. The core of the trust model. */
  it('a one-sided reference is refused', () => {
    const r = resolvePeerRef(good({ peerPr: { ...good().peerPr, body: 'no pairing line at all' } }))
    assert.equal(r.ok, false)
    assert.match(r.reason, /ONE-SIDED/)
  })

  it('a peer that names a DIFFERENT PR in this repo is refused', () => {
    const r = resolvePeerRef(good({ peerPr: { ...good().peerPr, body: `Pairs-With: ${MOBILE}#41` } }))
    assert.equal(r.ok, false)
    assert.match(r.reason, /NOT MUTUAL/)
  })

  it('a peer that names a THIRD repo is refused', () => {
    const r = resolvePeerRef(good({ peerPr: { ...good().peerPr, body: 'Pairs-With: attacker/evil#1' } }))
    assert.equal(r.ok, false)
    assert.match(r.reason, /not an allowed repo/)
  })

  it('a malformed Pairs-With in the PEER description is refused too', () => {
    const r = resolvePeerRef(good({ peerPr: { ...good().peerPr, body: 'Pairs-With: https://x/y#1' } }))
    assert.equal(r.ok, false)
    assert.match(r.reason, /peer PR description/)
  })

  /** M-P4 — this PR is from a fork. */
  it('a fork PR may not resolve a peer head', () => {
    const r = resolvePeerRef(good({ selfIsFork: true }))
    assert.equal(r.ok, false)
    assert.match(r.reason, /from a fork/)
  })

  it('a fork PR with no Pairs-With is still fine — it just uses the default branch', () => {
    const r = resolvePeerRef(good({ selfIsFork: true, selfBody: 'a docs typo' }))
    assert.equal(r.ok, true)
    assert.equal(r.mode, 'default-branch')
  })

  /** M-P5 — the PEER PR is from a fork. Default branch only, and say so. */
  it('a peer PR from a fork does not get its head checked out', () => {
    const r = resolvePeerRef(
      good({ peerPr: { ...good().peerPr, headRepo: 'attacker/nesymobile-cocpit' } }),
    )
    assert.equal(r.ok, true)
    assert.equal(r.mode, 'default-branch')
    assert.equal(r.ref, 'main')
    assert.match(r.notes.join('\n'), /from a fork/)
    assert.match(r.notes.join('\n'), /CANNOT go green/)
  })

  it('the fetched PR must be the one that was named, in the repo that was named', () => {
    const wrongNumber = resolvePeerRef(good({ peerPr: { ...good().peerPr, number: 8 } }))
    assert.equal(wrongNumber.ok, false)
    assert.match(wrongNumber.reason, /Pairs-With names #7/)

    const wrongBase = resolvePeerRef(good({ peerPr: { ...good().peerPr, baseRepo: MOBILE } }))
    assert.equal(wrongBase.ok, false)
    assert.match(wrongBase.reason, /not the peer repo/)
  })

  it('a Pairs-With whose peer PR was never fetched fails rather than falling back', () => {
    const r = resolvePeerRef(good({ peerPr: null }))
    assert.equal(r.ok, false)
    assert.match(r.reason, /was not fetched/)
  })

  it('a head sha that is not a 40-hex commit is refused', () => {
    for (const sha of ['main', '', 'zzz', 'a'.repeat(39), 'A'.repeat(40), '../../x']) {
      const r = resolvePeerRef(good({ peerPr: { ...good().peerPr, headSha: sha } }))
      assert.equal(r.ok, false, `head sha "${sha}" was ACCEPTED`)
      assert.match(r.reason, /40-hex/)
    }
  })
})

describe('resolvePeerRef — peer PR lifecycle', () => {
  it('a merged peer PR falls back to the default branch instead of failing', () => {
    // Bölüm G merges the pair the same day. The second PR to re-run its CI sees
    // this state, and failing here would make the winner break the loser — the
    // "ignore the gate" habit, arrived at from the other direction.
    const r = resolvePeerRef(good({ peerPr: { ...good().peerPr, state: 'closed', merged: true } }))
    assert.equal(r.ok, true)
    assert.equal(r.mode, 'default-branch')
    assert.match(r.notes.join('\n'), /already merged/)
  })

  it('a closed-unmerged peer PR is refused', () => {
    const r = resolvePeerRef(good({ peerPr: { ...good().peerPr, state: 'closed', merged: false } }))
    assert.equal(r.ok, false)
    assert.match(r.reason, /closed and not merged/)
  })

  it('reciprocity is still required for a merged peer? No — and that is deliberate', () => {
    // Once merged, the peer's sha is in its default branch and the comparison needs
    // no trust in the PR description at all: nothing attacker-controlled is read.
    const r = resolvePeerRef(
      good({
        peerPr: { ...good().peerPr, state: 'closed', merged: true, body: 'no pairing' },
      }),
    )
    assert.equal(r.ok, true)
    assert.equal(r.mode, 'default-branch')
  })
})
