#!/usr/bin/env node
/**
 * ===========================================================================
 *  DOMAIN PACK PUBLISHER
 *
 *  Publishes the code-resident domain pack build to the runtime catalog, so a
 *  run can actually be pinned to it.
 *
 *  ## Why this script exists
 *
 *  Changing a macro is not enough. A run pins `packKey + version + digest`, and
 *  `resolveDomainPack` refuses a digest the process cannot reproduce — correctly,
 *  since a plan attributed to the wrong pack version is worse than a compile
 *  error. So a pack edit that does not reach the catalog is invisible: the run
 *  keeps compiling the PREVIOUS plan and the new steps simply never appear.
 *
 *  Measured on 2026-09-02: a login idempotency precheck was added, the pack
 *  rebuilt, and three runs still died on `auth-resolve-pin-field` because
 *  version and digest were unchanged and the pinned plan was the old one.
 *
 *  ## The digest trap this script exists to avoid
 *
 *  The catalog digest is computed by `publishBundle` over the PUBLISHED form,
 *  with provenance stamped after digesting so it is reproducible across
 *  processes. Computing it with `computeBundleDigest(buildNesyCourierBundle())`
 *  instead yields a DIFFERENT value, and the compile endpoint then rejects the
 *  pin with `DOMAIN_PACK_DIGEST_MISMATCH`. The provenance constants below are
 *  the same ones `domain-pack-registry.ts` uses; they are part of the digest
 *  contract, not decoration.
 *
 *  ## Order of operations
 *
 *      pnpm --filter @nesy/nesy-courier-domain-pack build   (dist must be fresh)
 *      node scripts/publish-domain-pack.mjs
 *
 *  A published version is immutable, so re-running for the same version reports
 *  that and changes nothing. Bump `version` in the pack's `bundle.ts` first.
 * ===========================================================================
 */

const API = process.env.VERDICT_API_BASE ?? 'http://localhost:4001/api/verdict/runtime'
const PUBLISHED_BY = process.env.VERDICT_PUBLISHED_BY ?? 'publish-domain-pack.mjs'

/** Byte-identical to `domain-pack-registry.ts`; these feed the digest. */
const FIRST_PARTY_PROVENANCE = {
  publishedAt: '1970-01-01T00:00:00.000Z',
  publishedBy: 'first-party-code-resident',
  sourceCommit: 'workspace',
}

async function main() {
  const { publishBundle } = await import('@nesy/domain-pack-contracts')
  const { buildNesyCourierBundle } = await import('@nesy/nesy-courier-domain-pack')

  const entry = publishBundle(buildNesyCourierBundle(), FIRST_PARTY_PROVENANCE)
  console.log(`pack    : ${entry.packKey}@${entry.version}`)
  console.log(`digest  : ${entry.digest}`)

  const catalog = await getJson(`${API}/domain-packs`)
  const already = (catalog.items ?? []).find(
    (item) => item.packKey === entry.packKey && item.version === entry.version,
  )
  if (already?.publicationState === 'PUBLISHED') {
    console.log(
      `\nAlready published (revision ${already.revision}). Published versions are ` +
        `immutable — bump the version in the pack's bundle.ts to publish a change.`,
    )
    return
  }

  const draft = await putJson(`${API}/domain-packs/draft`, {
    packKey: entry.packKey,
    version: entry.version,
    bundleDigest: entry.digest,
    bundle: entry.bundle,
  })
  const revision = draft?.pack?.revision
  if (typeof revision !== 'number') {
    throw new Error(`draft did not return a revision: ${JSON.stringify(draft).slice(0, 300)}`)
  }
  console.log(`draft   : saved, revision ${revision}`)

  const published = await postJson(`${API}/domain-packs/publish`, {
    packKey: entry.packKey,
    version: entry.version,
    publishedBy: PUBLISHED_BY,
    // Optimistic concurrency: the draft we just wrote, not a guess.
    expectedRevision: revision,
  })
  console.log(
    `publish : ${published?.pack?.publicationState} revision ${published?.pack?.revision}`,
  )
  console.log(
    `\nRuns can now pin ${entry.packKey}@${entry.version}. Recompile the workflow ` +
      `so its plan hash reflects the new pack.`,
  )
}

async function getJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`GET ${url} → ${response.status}`)
  return response.json()
}

async function putJson(url, body) {
  return sendJson('PUT', url, body)
}

async function postJson(url, body) {
  return sendJson('POST', url, body)
}

async function sendJson(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`${method} ${url} → ${response.status}: ${text.slice(0, 300)}`)
  }
  return JSON.parse(text)
}

main().catch((error) => {
  console.error(`\npublish failed: ${error instanceof Error ? error.message : error}`)
  process.exitCode = 1
})
