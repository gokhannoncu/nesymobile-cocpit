import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PAGE_MIGRATION_MANIFEST } from '../lib/page-migration-manifest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PAGE = join(ROOT, 'app/(cockpit)/automation/01-load-tour-flow/page.tsx')
const WORKSPACE = join(ROOT, 'components/automation/load-tour-flow-workspace.tsx')

describe('Phase 7.5 Load Tour cutover', () => {
  it('manifest marks load-tour as VERDICT_RUNTIME', () => {
    const entry = PAGE_MIGRATION_MANIFEST.find(
      (e) => e.routePattern === '/automation/01-load-tour-flow',
    )
    expect(entry?.currentSource).toBe('VERDICT_RUNTIME')
  })

  it('page pins Domain Pack catalog', () => {
    const src = readFileSync(PAGE, 'utf8')
    expect(src).toMatch(/fetchVerdictDomainPacks/)
    expect(src).toMatch(/Verdict runtime pin/)
  })

  it('workspace starts via startPinnedVerdictRun without legacy execution UI', () => {
    const src = readFileSync(WORKSPACE, 'utf8')
    expect(src).toMatch(/startPinnedVerdictRun/)
    expect(src).not.toMatch(/startWorkflowRun\b/)
    expect(src).not.toMatch(/maestro-executor/)
    expect(src).not.toMatch(/from ['"]@\/services\/maestro/)
    expect(src).toMatch(/Verdict WorkflowRunApi/)
    expect(src).not.toMatch(/legacy YAML/i)
    expect(src).not.toMatch(/preview .*YAML/i)
  })
})
