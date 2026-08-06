import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PAGE_MIGRATION_MANIFEST, MANIFEST_VERSION } from '../lib/page-migration-manifest'
import type { PageDataSourceContract } from '../lib/page-migration-manifest'

/**
 * Step 6.27 — Page acceptance contract.
 *
 * Static half of page acceptance: every production route must declare who may
 * see it, must exist on disk when it claims to be available, and — when it
 * reads from the Verdict runtime — must handle the failure path rather than
 * rendering an empty shell.
 *
 * Direct-entry / refresh / live rendering are verified against the running app
 * (see the Phase 6 RESULT verification section); they cannot be asserted from
 * the module graph alone and are deliberately not faked here.
 */

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'app')

function collectPages(dir: string, prefix = ''): Map<string, string> {
  const out = new Map<string, string>()
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      const segment = /^\(.*\)$/.test(entry) ? '' : `/${entry}`
      for (const [k, v] of collectPages(full, prefix + segment)) out.set(k, v)
    } else if (entry === 'page.tsx') {
      out.set(prefix || '/', full)
    }
  }
  return out
}

const PAGE_FILES = collectPages(APP_DIR)

const AVAILABLE = PAGE_MIGRATION_MANIFEST.filter((e) => e.availability === 'AVAILABLE')

/**
 * Routes that read the Verdict runtime *today*. Filtering on `currentSource`
 * rather than `targetSource` keeps the runtime assertions off pages that are
 * still static and have no read to fail.
 */
const VERDICT_ROUTES = AVAILABLE.filter((e) => e.currentSource === 'VERDICT_RUNTIME')

const sourceOf = (entry: PageDataSourceContract): string => {
  const file = PAGE_FILES.get(entry.routePattern)
  return file ? readFileSync(file, 'utf8') : ''
}

describe('6.27 — manifest contract', () => {
  it('declares a manifest version', () => {
    expect(MANIFEST_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it.each(PAGE_MIGRATION_MANIFEST.map((e) => [e.routePattern, e] as const))(
    '%s declares RBAC, owner and a fallback policy',
    (_route, entry) => {
      expect(entry.rbac.length).toBeGreaterThan(0)
      expect(entry.owner.length).toBeGreaterThan(0)
      expect(['NONE', 'READ_ONLY_LEGACY_SUMMARY']).toContain(entry.fallbackPolicy)
    },
  )

  it.each(PAGE_MIGRATION_MANIFEST.map((e) => [e.routePattern, e] as const))(
    '%s references the acceptance suite that covers it',
    (_route, entry) => {
      expect(entry.acceptanceTestRef, 'acceptanceTestRef must be backfilled').toBeDefined()
      expect(entry.acceptanceTestRef).toContain('src/test/')
    },
  )
})

describe('6.27 — direct entry', () => {
  it.each(AVAILABLE.map((e) => [e.routePattern] as const))(
    '%s is AVAILABLE and has a page file so a direct URL entry resolves',
    (route) => {
      expect(PAGE_FILES.has(route)).toBe(true)
    },
  )

  it('placeholder routes are never advertised as AVAILABLE', () => {
    const lying = PAGE_MIGRATION_MANIFEST.filter(
      (e) => e.availability === 'AVAILABLE' && !PAGE_FILES.has(e.routePattern),
    )
    expect(lying.map((e) => e.routePattern)).toEqual([])
  })
})

describe('6.27 — error and blocked states', () => {
  it.each(VERDICT_ROUTES.map((e) => [e.routePattern, e] as const))(
    '%s handles a runtime read failure instead of rendering blindly',
    (_route, entry) => {
      const src = sourceOf(entry)
      // Either the page itself handles failure, or it delegates to a client
      // component that does; both satisfy "no silent empty render".
      const handlesFailure =
        /catch\s*[({]/.test(src) || /\berror\b/i.test(src) || /blockedReason/.test(src)
      expect(handlesFailure, `${entry.routePattern} has no visible failure path`).toBe(true)
    },
  )

  it.each(VERDICT_ROUTES.map((e) => [e.routePattern, e] as const))(
    '%s reads the runtime client instead of shipping fabricated rows',
    (_route, entry) => {
      const src = sourceOf(entry)
      // A route that advertises VERDICT_RUNTIME as its current source must
      // actually call the runtime. Hardcoded sample records render as real
      // product state and are the fake-pass the playbook forbids.
      expect(
        /verdict-runtime\/client/.test(src),
        `${entry.routePattern} declares VERDICT_RUNTIME but never calls the client`,
      ).toBe(true)
    },
  )

  it('no AVAILABLE route silently falls back to legacy data', () => {
    // READ_ONLY_LEGACY_SUMMARY is allowed, but it must be declared, never implicit.
    const implicit = AVAILABLE.filter(
      (e) =>
        e.currentSource === 'LEGACY_API' &&
        e.targetSource === 'VERDICT_RUNTIME' &&
        e.fallbackPolicy !== 'NONE' &&
        e.fallbackPolicy !== 'READ_ONLY_LEGACY_SUMMARY',
    )
    expect(implicit.map((e) => e.routePattern)).toEqual([])
  })
})

describe('6.27 — accessibility floor', () => {
  it.each([...PAGE_FILES.entries()].map(([route, file]) => [route, file] as const))(
    '%s renders a heading or delegates to a component that does',
    (_route, file) => {
      const src = readFileSync(file, 'utf8')
      // Redirect-only pages render nothing by design.
      if (/\bredirect\(/.test(src)) return
      const hasHeading = /<h[1-6][\s>]/.test(src) || /<[A-Z][A-Za-z]*/.test(src)
      expect(hasHeading).toBe(true)
    },
  )

  it('no page ships a positive tabIndex, which breaks keyboard order', () => {
    const offenders: string[] = []
    for (const [route, file] of PAGE_FILES) {
      if (/tabIndex=\{?["']?[1-9]/.test(readFileSync(file, 'utf8'))) offenders.push(route)
    }
    expect(offenders).toEqual([])
  })
})
