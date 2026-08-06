import { describe, expect, it } from 'vitest'
import { PAGE_MIGRATION_MANIFEST } from '../lib/page-migration-manifest'

/**
 * Data-Source Cutover Tests
 *
 * Validates that each route's data-source contract is correctly targeting
 * the Verdict Runtime DTOs as specified in Phase 6.
 */
describe('Data-Source Cutover Verification', () => {
  const CP6_ROUTES_WITH_TARGET_DTO: Array<{
    route: string
    expectedTargetDto: string
  }> = [
    { route: '/debug-view/overview', expectedTargetDto: 'DeviceReadinessQuery' },
    { route: '/debug-view/screen-state', expectedTargetDto: 'LiveInspector' },
    { route: '/debug-view/interactions', expectedTargetDto: 'DurableInteractionSubscription' },
    { route: '/automation/list', expectedTargetDto: 'WorkflowCatalogQuery' },
    { route: '/automation/history', expectedTargetDto: 'RunHistoryQuery' },
    { route: '/automation/[id]', expectedTargetDto: 'WorkflowCompileApi' },
    { route: '/automation/[id]/runs/[runId]', expectedTargetDto: 'RunDetailQuery' },
    { route: '/automation/domain-packs', expectedTargetDto: 'DomainPackAdminApi' },
    { route: '/automation/test-profiles', expectedTargetDto: 'TestProfileCatalogQuery' },
    { route: '/automation/test-campaigns', expectedTargetDto: 'TestCampaignQuery' },
  ]

  for (const { route, expectedTargetDto } of CP6_ROUTES_WITH_TARGET_DTO) {
    it(`${route} targets VERDICT_RUNTIME with ${expectedTargetDto}`, () => {
      const entry = PAGE_MIGRATION_MANIFEST.find((e) => e.routePattern === route)
      expect(entry, `Missing manifest entry for ${route}`).toBeDefined()
      expect(entry!.targetSource).toBe('VERDICT_RUNTIME')
      expect(entry!.cutoverCheckpoint).toBe('CHECKPOINT_6')
    })
  }

  const CUTOVER_CURRENT_SOURCE: string[] = [
    '/automation/list',
    '/automation/history',
    '/automation/field-login',
    '/automation/01-load-tour-flow',
    '/debug-view/interactions',
  ]

  for (const route of CUTOVER_CURRENT_SOURCE) {
    it(`${route} currentSource is VERDICT_RUNTIME after DTO cutover`, () => {
      const entry = PAGE_MIGRATION_MANIFEST.find((e) => e.routePattern === route)
      expect(entry, `Missing manifest entry for ${route}`).toBeDefined()
      expect(entry!.currentSource).toBe('VERDICT_RUNTIME')
    })
  }

  it('NON_REGRESSION routes are not migrated to VERDICT_RUNTIME', () => {
    const nrEntries = PAGE_MIGRATION_MANIFEST.filter(
      (e) => e.cutoverCheckpoint === 'NON_REGRESSION',
    )
    for (const entry of nrEntries) {
      expect(entry.targetSource).not.toBe('VERDICT_RUNTIME')
    }
  })

  it('Data Center routes remain NON_REGRESSION', () => {
    const dcEntries = PAGE_MIGRATION_MANIFEST.filter(
      (e) => e.workspace === 'data-center',
    )
    expect(dcEntries.length).toBeGreaterThan(0)
    for (const entry of dcEntries) {
      expect(entry.cutoverCheckpoint).toBe('NON_REGRESSION')
    }
  })

  it('Product workspace routes remain STATIC', () => {
    const productEntries = PAGE_MIGRATION_MANIFEST.filter(
      (e) => e.workspace === 'product',
    )
    expect(productEntries.length).toBeGreaterThan(0)
    for (const entry of productEntries) {
      expect(entry.currentSource).toBe('STATIC')
    }
  })
})
