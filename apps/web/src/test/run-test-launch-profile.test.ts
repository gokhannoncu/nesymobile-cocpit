import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const EDITOR = readFileSync(
  resolve(__dirname, '../app/(automation-editor)/automation/[id]/workflow-editor.tsx'),
  'utf8',
)

/**
 * Run Test used to name the two workflows allowed a cold start. Every other
 * workflow that signs in — `nesy.workflow.full-courier-day` among them — started
 * with no launch profile, so nothing force-stopped the app and the plan's first
 * wait for the login screen timed out against whatever was already on screen.
 */
describe('Run Test — launch profile', () => {
  it('pins the cold real login profile from the canvas, not from a list of slugs', () => {
    expect(EDITOR).toMatch(/profileKey: authLogin \? "nesy\.launch\.cold-real-login" : undefined/)
  })

  it('does not gate the launch profile on individual workflow slugs', () => {
    expect(EDITOR).not.toMatch(/workflowRef === "nesy\.workflow\.login"/)
    expect(EDITOR).not.toMatch(/workflowRef === "nesy\.workflow\.login-and-select-route"/)
  })
})
