import { describe, expect, it } from 'vitest'
import {
  FIELD_COURIER_LOGIN_WORKFLOW_SLUG,
  isHiddenSystemWorkflow,
} from './system-workflows'

describe('isHiddenSystemWorkflow', () => {
  it('hides the field courier login slug', () => {
    expect(isHiddenSystemWorkflow(FIELD_COURIER_LOGIN_WORKFLOW_SLUG)).toBe(true)
    expect(isHiddenSystemWorkflow('field-courier-login')).toBe(true)
  })

  it('keeps normal workflow slugs visible', () => {
    expect(isHiddenSystemWorkflow('login-flow')).toBe(false)
    expect(isHiddenSystemWorkflow('delivery-happy-path')).toBe(false)
  })

  it('does not hide missing slugs', () => {
    expect(isHiddenSystemWorkflow(undefined)).toBe(false)
    expect(isHiddenSystemWorkflow(null)).toBe(false)
    expect(isHiddenSystemWorkflow('')).toBe(false)
  })
})
