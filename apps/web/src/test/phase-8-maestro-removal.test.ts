import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8')
}

describe('Phase 8 web Maestro removal', () => {
  it('removes runnable source preview files', () => {
    for (const relativePath of [
      'app/(automation-editor)/automation/[id]/WorkflowYamlPreviewModal.tsx',
      'app/(automation-editor)/automation/[id]/yaml-generator.ts',
      'app/(automation-editor)/automation/[id]/yaml-registry.ts',
    ]) {
      expect(existsSync(join(ROOT, relativePath)), `${relativePath} should be removed`).toBe(false)
    }
  })

  it('runs editor tests through Verdict runtime start', () => {
    const editor = read('app/(automation-editor)/automation/[id]/workflow-editor.tsx')
    expect(editor).toMatch(/startPinnedVerdictRun/)
    expect(editor).not.toMatch(/startWorkflowRun\b|Preview YAML|WorkflowYamlPreviewModal/)
  })

  it('removes legacy run detail fallback and YAML preview client', () => {
    expect(read('app/(cockpit)/automation/[id]/runs/[runId]/page.tsx')).not.toMatch(/MAESTRO_LEGACY|legacy-summary|Legacy YAML/)
    expect(read('services/automation-api.ts')).not.toMatch(/previewWorkflowYaml|maestroOutput/)
    expect(read('lib/verdict-runtime/client.ts')).not.toMatch(/legacy-summary/)
  })
})
