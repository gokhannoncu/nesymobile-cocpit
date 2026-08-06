import { describe, expect, it } from 'vitest'
import {
  MANIFEST_VERSION,
  PAGE_MIGRATION_MANIFEST,
  getManifestEntry,
  type PageDataSourceContract,
} from './page-migration-manifest'

describe('PageMigrationManifest', () => {
  it('has a defined manifest version', () => {
    expect(MANIFEST_VERSION).toBeDefined()
    expect(typeof MANIFEST_VERSION).toBe('string')
    expect(MANIFEST_VERSION.length).toBeGreaterThan(0)
  })

  it('has non-empty entries', () => {
    expect(PAGE_MIGRATION_MANIFEST.length).toBeGreaterThan(0)
  })

  it('every entry has a non-empty routePattern', () => {
    for (const entry of PAGE_MIGRATION_MANIFEST) {
      expect(entry.routePattern).toBeDefined()
      expect(entry.routePattern.length).toBeGreaterThan(0)
    }
  })

  it('every entry has required fields', () => {
    for (const entry of PAGE_MIGRATION_MANIFEST) {
      expect(entry.routeLabel).toBeDefined()
      expect(entry.workspace).toBeDefined()
      expect(entry.owner).toBeDefined()
      expect(entry.currentSource).toBeDefined()
      expect(entry.targetSource).toBeDefined()
      expect(entry.cutoverCheckpoint).toBeDefined()
      expect(entry.availability).toBeDefined()
      expect(entry.fallbackPolicy).toBeDefined()
    }
  })

  it('CHECKPOINT_6 entries have targetSource = VERDICT_RUNTIME', () => {
    const cp6Entries = PAGE_MIGRATION_MANIFEST.filter(
      (e) => e.cutoverCheckpoint === 'CHECKPOINT_6',
    )
    expect(cp6Entries.length).toBeGreaterThan(0)
    for (const entry of cp6Entries) {
      expect(entry.targetSource).toBe('VERDICT_RUNTIME')
    }
  })

  it('NON_REGRESSION entries keep their current source as target', () => {
    const nrEntries = PAGE_MIGRATION_MANIFEST.filter(
      (e) => e.cutoverCheckpoint === 'NON_REGRESSION',
    )
    expect(nrEntries.length).toBeGreaterThan(0)
    for (const entry of nrEntries) {
      expect(entry.currentSource).toBe(entry.targetSource)
    }
  })

  it('covers all seven workspaces', () => {
    const workspaces = new Set(PAGE_MIGRATION_MANIFEST.map((e) => e.workspace))
    expect(workspaces.has('home')).toBe(true)
    expect(workspaces.has('product')).toBe(true)
    expect(workspaces.has('pm')).toBe(true)
    expect(workspaces.has('engineering')).toBe(true)
    expect(workspaces.has('debug-view')).toBe(true)
    expect(workspaces.has('data-center')).toBe(true)
    expect(workspaces.has('automation')).toBe(true)
  })

  it('no duplicate routePatterns', () => {
    const patterns = PAGE_MIGRATION_MANIFEST.map((e) => e.routePattern)
    const unique = new Set(patterns)
    expect(unique.size).toBe(patterns.length)
  })

  it('getManifestEntry returns correct entry', () => {
    const entry = getManifestEntry('/')
    expect(entry).toBeDefined()
    expect(entry?.routeLabel).toBe('Command Center Overview')
  })

  it('getManifestEntry returns undefined for unknown route', () => {
    const entry = getManifestEntry('/nonexistent-route')
    expect(entry).toBeUndefined()
  })

  // Coverage: known Automation CHECKPOINT_6 routes
  const EXPECTED_AUTOMATION_CP6_ROUTES = [
    '/automation/list',
    '/automation/history',
    '/automation/field-login',
    '/automation/01-load-tour-flow',
    '/automation/[id]',
    '/automation/[id]/runs/[runId]',
    '/automation/domain-packs',
    '/automation/domain-packs/[packId]',
    '/automation/domain-packs/[packId]/surfaces',
    '/automation/test-profiles',
    '/automation/test-profiles/[profileId]',
    '/automation/test-campaigns',
    '/automation/test-campaigns/[campaignId]',
  ]

  it('covers all expected Automation CHECKPOINT_6 routes', () => {
    for (const route of EXPECTED_AUTOMATION_CP6_ROUTES) {
      const entry = getManifestEntry(route)
      expect(entry, `Missing manifest entry for ${route}`).toBeDefined()
      expect(entry?.cutoverCheckpoint).toBe('CHECKPOINT_6')
    }
  })

  // Coverage: known Debug View routes
  const EXPECTED_DEBUG_VIEW_ROUTES = [
    '/debug-view/overview',
    '/debug-view/operational-health',
    '/debug-view/screen-state',
    '/debug-view/interactions',
    '/debug-view/network-inspector',
    '/debug-view/schedule',
    '/debug-view/database',
    '/debug-view/adb-scenarios',
    '/debug-view/log-explorer',
  ]

  it('covers all expected Debug View routes', () => {
    for (const route of EXPECTED_DEBUG_VIEW_ROUTES) {
      const entry = getManifestEntry(route)
      expect(entry, `Missing manifest entry for ${route}`).toBeDefined()
    }
  })

  // Fallback policy checks
  it('no entry uses fallbackPolicy other than NONE or READ_ONLY_LEGACY_SUMMARY', () => {
    for (const entry of PAGE_MIGRATION_MANIFEST) {
      expect(['NONE', 'READ_ONLY_LEGACY_SUMMARY']).toContain(entry.fallbackPolicy)
    }
  })
})
