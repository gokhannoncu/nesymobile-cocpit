import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workflowEditorSource = readFileSync(
  new URL('../app/(automation-editor)/automation/[id]/workflow-editor.tsx', import.meta.url),
  'utf8',
)

const runResultsPageSource = readFileSync(
  new URL('../app/(automation-editor)/automation/[id]/runs/[runId]/page.tsx', import.meta.url),
  'utf8',
)

describe('workflow editor render contract', () => {
  it('mounts the workflow canvas in the editor page', () => {
    expect(workflowEditorSource).toMatch(/<WorkflowCanvas\s/)
  })

  it('uses the cockpit NESY icon in the editor header', () => {
    expect(workflowEditorSource).toContain('src="/media/app/nesy-icon.png"')
  })

  it('uses the cockpit NESY icon in the test results header', () => {
    expect(runResultsPageSource).toContain('src="/media/app/nesy-icon.png"')
    expect(runResultsPageSource).not.toContain('nesy-courier-app-icon.png')
  })
})
