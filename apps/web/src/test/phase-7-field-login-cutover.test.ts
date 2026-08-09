import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PAGE_MIGRATION_MANIFEST } from '../lib/page-migration-manifest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FIELD_LOGIN_PAGE = join(ROOT, 'app/(cockpit)/automation/field-login/page.tsx')
const START_PINNED = join(ROOT, 'lib/verdict-runtime/start-pinned-run.ts')

describe('Phase 7.4 Field Login cutover', () => {
  it('manifest marks field-login as VERDICT_RUNTIME', () => {
    const entry = PAGE_MIGRATION_MANIFEST.find((e) => e.routePattern === '/automation/field-login')
    expect(entry?.currentSource).toBe('VERDICT_RUNTIME')
  })

  it('page starts via startPinnedVerdictRun and validates launch intent', () => {
    const src = readFileSync(FIELD_LOGIN_PAGE, 'utf8')
    expect(src).toMatch(/startPinnedVerdictRun/)
    expect(src).toMatch(/FieldLoginIntent/)
    expect(src).toMatch(/REAL_UI_LOGIN/)
    expect(src).toMatch(/SETUP_PRECONDITION/)
    expect(src).toMatch(/producesProductVerdict/)
    expect(src).not.toMatch(/startFieldCourierLogin/)
    expect(src).not.toMatch(/from ['"]@\/services\/maestro/)
    expect(src).not.toMatch(/maestro-executor/)
    expect(src).toMatch(/BridgeFlow-only/)
  })

  it('pinned start helper compiles then starts WorkflowRunApi', () => {
    const src = readFileSync(START_PINNED, 'utf8')
    expect(src).toMatch(/compileVerdictWorkflow/)
    expect(src).toMatch(/startVerdictWorkflowRun/)
    expect(src).toMatch(/profileKey/)
  })
})
