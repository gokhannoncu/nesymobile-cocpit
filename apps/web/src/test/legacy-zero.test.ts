import { describe, expect, it } from 'vitest'
import { PAGE_MIGRATION_MANIFEST } from '../lib/page-migration-manifest'

/**
 * Legacy-Zero Tests
 *
 * These tests enforce that YAML/Maestro is NOT the primary authoring UI
 * in Phase 6. They serve as guardrails against accidentally re-introducing
 * Maestro-specific patterns as the primary user experience.
 */
describe('Legacy-Zero Guard — Maestro/YAML Primary UI Removal', () => {
  it('no manifest entry advertises YAML as primary target source', () => {
    for (const entry of PAGE_MIGRATION_MANIFEST) {
      expect(entry.targetSource).not.toBe('YAML')
      expect(entry.targetSource).not.toBe('MAESTRO')
    }
  })

  it('no manifest entry uses YAML-specific DTO version', () => {
    for (const entry of PAGE_MIGRATION_MANIFEST) {
      expect(entry.targetDtoVersion.toLowerCase()).not.toContain('yaml')
      expect(entry.targetDtoVersion.toLowerCase()).not.toContain('maestro')
    }
  })

  it('CHECKPOINT_6 automation routes target VERDICT_RUNTIME not LEGACY_API', () => {
    const automationCp6 = PAGE_MIGRATION_MANIFEST.filter(
      (e) => e.workspace === 'automation' && e.cutoverCheckpoint === 'CHECKPOINT_6',
    )
    expect(automationCp6.length).toBeGreaterThan(0)
    for (const entry of automationCp6) {
      expect(entry.targetSource).toBe('VERDICT_RUNTIME')
    }
  })

  it('no fallback policy allows silent legacy fallback', () => {
    for (const entry of PAGE_MIGRATION_MANIFEST) {
      // NONE = no fallback, READ_ONLY_LEGACY_SUMMARY = explicit read-only legacy
      // Silent/hidden fallback is never allowed
      expect(['NONE', 'READ_ONLY_LEGACY_SUMMARY']).toContain(entry.fallbackPolicy)
    }
  })

  it('legacy adapters have owner and expiry when present', () => {
    const adapterEntries = PAGE_MIGRATION_MANIFEST.filter(
      (e) => e.compatibilityAdapter !== undefined,
    )
    for (const entry of adapterEntries) {
      expect(
        entry.owner,
        `Adapter for ${entry.routePattern} missing owner`,
      ).toBeDefined()
      expect(
        entry.compatibilityExpiry,
        `Adapter for ${entry.routePattern} missing expiry`,
      ).toBeDefined()
    }
  })
})
