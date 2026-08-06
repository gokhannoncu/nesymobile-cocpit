import { readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PAGE_MIGRATION_MANIFEST } from '../lib/page-migration-manifest'
import { WORKSPACES } from '@nesy/metronic/config/layout-21.config'

/**
 * Step 6.26 — Route non-regression suite.
 *
 * Phase 6 rewrote large parts of the cockpit. These tests assert that the
 * pre-Phase-6 workspaces still resolve, that the App Router tree stays
 * internally consistent, and that the manifest keeps describing reality.
 *
 * The duplicate-route test exists because Phase 6 shipped a second
 * `/automation/[id]/runs/[runId]` page in a different route group, which
 * `tsc` and every unit suite accepted while `next build` failed outright.
 */

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'app')

/** Route paths as Next.js resolves them: route groups `(name)` contribute no segment. */
function collectRoutes(dir: string, prefix = ''): { route: string; file: string }[] {
  const out: { route: string; file: string }[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      const segment = /^\(.*\)$/.test(entry) ? '' : `/${entry}`
      out.push(...collectRoutes(full, prefix + segment))
    } else if (entry === 'page.tsx') {
      out.push({ route: prefix || '/', file: full })
    }
  }
  return out
}

const PAGES = collectRoutes(APP_DIR)
const ROUTES = PAGES.map((p) => p.route)

/** Catch-all fallbacks are not production routes and are exempt from manifest coverage. */
const isCatchAll = (route: string) => route.includes('[...')

/**
 * Routes that existed before Phase 6 and must survive the cockpit rewrite.
 * Frozen on purpose: adding to this list is fine, removing an entry means a
 * user-visible route disappeared and needs an explicit migration decision.
 */
const PRE_PHASE_6_ROUTES = [
  '/',
  '/product',
  '/product/country-matrix',
  '/product/country-profiles',
  '/product/domain-glossary',
  '/product/domain-model',
  '/product/feature-library',
  '/product/screen-map',
  '/pm/calendar',
  '/pm/releases',
  '/pm/roadmap',
  '/pm/root-cause',
  '/pm/tickets',
  '/pm/versions',
  '/engineering/modernization-plan',
  '/engineering/mobile-service-atlas',
  '/engineering/incident-playbook',
  '/engineering/tools/data-locator',
  '/engineering/tools/graylog-query-generator',
  '/engineering/tools/mongodb-query-generator',
  '/debug-view/overview',
  '/debug-view/screen-state',
  '/automation/list',
  '/automation/history',
  '/automation/overview',
  '/automation/field-login',
  '/automation/01-load-tour-flow',
  '/automation/[id]',
  '/automation/[id]/runs/[runId]',
]

describe('6.26 — App Router integrity', () => {
  it('no two page files resolve to the same route path', () => {
    const seen = new Map<string, string[]>()
    for (const { route, file } of PAGES) {
      seen.set(route, [...(seen.get(route) ?? []), file])
    }
    const collisions = [...seen.entries()].filter(([, files]) => files.length > 1)
    expect(
      collisions.map(([route, files]) => `${route} <- ${files.join(' , ')}`),
      'two pages resolving to one path fail `next build`',
    ).toEqual([])
  })

  it('finds a non-trivial number of pages', () => {
    // Guards against the collector silently returning nothing and every other
    // assertion in this file passing vacuously.
    expect(ROUTES.length).toBeGreaterThan(40)
  })
})

describe('6.26 — pre-Phase-6 route preservation', () => {
  it.each(PRE_PHASE_6_ROUTES)('%s still resolves to a page', (route) => {
    expect(ROUTES).toContain(route)
  })

  it.each(['product', 'pm', 'engineering', 'data-center', 'debug-view'])(
    'the %s workspace still owns at least one route',
    (workspace) => {
      const owned = PAGE_MIGRATION_MANIFEST.filter((e) => e.workspace === workspace)
      expect(owned.length).toBeGreaterThan(0)
    },
  )
})

describe('6.26 — manifest describes reality', () => {
  it('every page on disk is declared in the manifest', () => {
    const declared = new Set(PAGE_MIGRATION_MANIFEST.map((e) => e.routePattern))
    const undeclared = ROUTES.filter((r) => !isCatchAll(r) && !declared.has(r))
    expect(undeclared).toEqual([])
  })

  it('every manifest route without a page file is declared PLACEHOLDER', () => {
    const onDisk = new Set(ROUTES)
    const missing = PAGE_MIGRATION_MANIFEST.filter(
      (e) => !onDisk.has(e.routePattern) && e.availability !== 'PLACEHOLDER',
    )
    expect(missing.map((e) => `${e.routePattern} (${e.availability})`)).toEqual([])
  })

  it('no manifest route is declared twice', () => {
    const patterns = PAGE_MIGRATION_MANIFEST.map((e) => e.routePattern)
    expect(patterns.length).toBe(new Set(patterns).size)
  })
})

describe('6.26 — navigation points at real routes', () => {
  const menuPaths = WORKSPACES.flatMap((ws) => flattenMenuPaths(ws.menu as unknown[]))

  it('every navigation entry targets a route that exists or is a declared placeholder', () => {
    const known = new Set([...ROUTES, ...PAGE_MIGRATION_MANIFEST.map((e) => e.routePattern)])
    const dangling = menuPaths.filter((p) => p.startsWith('/') && !known.has(p))
    expect(dangling).toEqual([])
  })

  it('every workspace landing path is reachable', () => {
    const known = new Set(ROUTES)
    const unreachable = WORKSPACES.filter((ws) => !known.has(ws.path)).map((ws) => ws.path)
    expect(unreachable).toEqual([])
  })
})

function flattenMenuPaths(menu: unknown[]): string[] {
  const paths: string[] = []
  const walk = (items: unknown[]) => {
    for (const item of items) {
      const node = item as { path?: unknown; children?: unknown }
      if (typeof node.path === 'string') paths.push(node.path)
      if (Array.isArray(node.children)) walk(node.children)
    }
  }
  walk(menu)
  return paths
}
