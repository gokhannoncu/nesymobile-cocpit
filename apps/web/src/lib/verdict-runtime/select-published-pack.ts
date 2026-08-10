import type { DomainPackSummary } from './types'

/** Real published digests are sha256 + 64 hex; stubs use short tokens like `sha256:persist01`. */
export function isCanonicalPackDigest(digest: string): boolean {
  return /^sha256:[a-f0-9]{64}$/i.test(digest.trim())
}

export function packIdentity(pack: Pick<DomainPackSummary, 'packKey' | 'version'>): string {
  return `${pack.packKey}@${pack.version}`
}

export function parsePackIdentity(identity: string): { packKey: string; version: string } | null {
  const at = identity.lastIndexOf('@')
  if (at <= 0 || at === identity.length - 1) return null
  return { packKey: identity.slice(0, at), version: identity.slice(at + 1) }
}

/** Compare dotted numeric versions (`1.0.2` > `1.0.1`). Non-numeric segments sort last. */
export function comparePackVersions(a: string, b: string): number {
  const as = a.split('.').map((part) => Number.parseInt(part, 10))
  const bs = b.split('.').map((part) => Number.parseInt(part, 10))
  const len = Math.max(as.length, bs.length)
  for (let i = 0; i < len; i += 1) {
    const left = Number.isFinite(as[i]) ? as[i]! : -1
    const right = Number.isFinite(bs[i]) ? bs[i]! : -1
    if (left !== right) return left - right
  }
  return 0
}

export type SelectPublishedPackOptions = {
  /** Prefer this pack family when several published packs exist. */
  preferredPackKey?: string
}

/**
 * Pick the Domain Pack a Verdict run/palette should pin to.
 *
 * Never returns the first catalog row blindly — persist/review stubs often
 * appear first and have empty `semanticActions`, which blocks the editor.
 */
export function selectPinnedPublishedPack(
  items: readonly DomainPackSummary[],
  options: SelectPublishedPackOptions = {},
): DomainPackSummary | undefined {
  const preferredPackKey = options.preferredPackKey ?? 'nesy.courier'
  const published = items.filter(
    (item) => item.publicationState === 'PUBLISHED' && isCanonicalPackDigest(item.bundleDigest),
  )
  if (published.length === 0) return undefined

  const compileReady = published.filter((item) => item.compileReady === true)
  const base = compileReady.length > 0 ? compileReady : published

  const preferred = base.filter((item) => item.packKey === preferredPackKey)
  const pool = preferred.length > 0 ? preferred : base

  return [...pool].sort((left, right) => comparePackVersions(right.version, left.version))[0]
}
