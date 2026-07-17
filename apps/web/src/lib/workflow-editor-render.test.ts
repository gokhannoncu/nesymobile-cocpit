import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workflowEditorSource = readFileSync(
  new URL('../app/(automation-editor)/automation/[id]/workflow-editor.tsx', import.meta.url),
  'utf8',
)

describe('workflow editor render contract', () => {
  it('mounts the workflow canvas in the editor page', () => {
    expect(workflowEditorSource).toMatch(/<WorkflowCanvas\s/)
  })

  it('uses the cockpit NESY icon in the editor header', () => {
    expect(workflowEditorSource).toContain('src="/media/app/nesy-icon.png"')
  })
})
