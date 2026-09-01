/**
 * Domain Pack registry — the compile path's pack resolver.
 *
 * A compile request pins a pack by key + version + digest. This registry turns
 * that pin back into the bundle the compiler reads. The digest is checked, not
 * trusted: a request that pins a digest the process cannot reproduce compiles
 * against *something else* than the caller believes, and a plan attributed to
 * the wrong pack version is worse than a compile error.
 *
 * First-party packs are code-resident and published at load (nesy.courier@1.26.0).
 * `publishBundle`
 * computes the digest over the published form, so the digest is deterministic
 * across processes — provenance timestamps are added after digesting.
 */

import {
  publishBundle,
  type DomainPackBundle,
  type PublishedVersion,
} from '@nesy/domain-pack-contracts'
import { buildNesyCourierBundle } from '@nesy/nesy-courier-domain-pack'

export interface ResolvedDomainPack {
  packKey: string
  packVersion: string
  packDigest: string
  bundle: DomainPackBundle
}

export type DomainPackResolution =
  | { ok: true; pack: ResolvedDomainPack }
  | { ok: false; code: 'UNKNOWN_DOMAIN_PACK' | 'DOMAIN_PACK_DIGEST_MISMATCH'; message: string }

function publishFirstPartyPacks(): PublishedVersion[] {
  return [
    publishBundle(buildNesyCourierBundle(), {
      publishedAt: '1970-01-01T00:00:00.000Z',
      publishedBy: 'first-party-code-resident',
      sourceCommit: 'workspace',
    }),
  ]
}

let published: PublishedVersion[] | undefined

function publishedPacks(): PublishedVersion[] {
  published ??= publishFirstPartyPacks()
  return published
}

function packSlotKey(packKey: string, version: string): string {
  return `${packKey}@${version}`
}

/** Every pack this process can compile against, with its reproducible digest. */
export function listDomainPacks(): readonly ResolvedDomainPack[] {
  return publishedPacks().map((entry) => ({
    packKey: entry.packKey,
    packVersion: entry.version,
    packDigest: entry.digest,
    bundle: entry.bundle,
  }))
}

/**
 * Hydrate a published admin-store pack into the compile registry.
 * Used when the catalog has a historical published version that is not the
 * current code-resident first-party build (e.g. `nesy.courier@1.0.1` while
 * source is at `1.0.2`).
 */
export function registerPublishedPack(input: {
  packKey: string
  version: string
  digest: string
  bundle: DomainPackBundle
}): void {
  const packs = publishedPacks()
  const idx = packs.findIndex(
    (entry) => entry.packKey === input.packKey && entry.version === input.version,
  )
  const next: PublishedVersion = {
    packKey: input.packKey,
    version: input.version,
    digest: input.digest,
    publishedAt: '1970-01-01T00:00:00.000Z',
    bundle: input.bundle,
  }
  if (idx >= 0) {
    packs[idx] = next
  } else {
    packs.push(next)
  }
}

export function resolveDomainPack(input: {
  packKey: string
  packVersion: string
  /** When present, must match the digest this process computes for the pack. */
  packDigest?: string
}): DomainPackResolution {
  const match = publishedPacks().find(
    (entry) => entry.packKey === input.packKey && entry.version === input.packVersion,
  )

  if (match === undefined) {
    const known = publishedPacks().map((entry) => packSlotKey(entry.packKey, entry.version)).join(', ')
    return {
      ok: false,
      code: 'UNKNOWN_DOMAIN_PACK',
      message:
        `domain pack "${input.packKey}@${input.packVersion}" is not available in this API process ` +
        `(available: ${known.length === 0 ? 'none' : known})`,
    }
  }

  if (input.packDigest !== undefined && input.packDigest !== '' && input.packDigest !== match.digest) {
    return {
      ok: false,
      code: 'DOMAIN_PACK_DIGEST_MISMATCH',
      message:
        `pinned digest ${input.packDigest} does not match the digest this process computes ` +
        `for ${match.packKey}@${match.version} (${match.digest})`,
    }
  }

  return {
    ok: true,
    pack: {
      packKey: match.packKey,
      packVersion: match.version,
      packDigest: match.digest,
      bundle: match.bundle,
    },
  }
}
