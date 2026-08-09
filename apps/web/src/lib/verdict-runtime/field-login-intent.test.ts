import { describe, expect, it } from 'vitest'
import {
  FIELD_LOGIN_LAUNCH,
  FIELD_LOGIN_PACK_WORKFLOW_KEY,
  FIELD_LOGIN_WORKFLOW_REF,
  fieldLoginLaunchFor,
  fieldLoginValidatePayload,
} from './field-login-intent'

describe('field-login-intent — Phase 7.4', () => {
  it('keeps cockpit slug and pack workflow keys distinct', () => {
    expect(FIELD_LOGIN_WORKFLOW_REF).toBe('field-courier-login')
    expect(FIELD_LOGIN_PACK_WORKFLOW_KEY).toBe('nesy.workflow.login')
  })

  it('real UI login may produce a product verdict', () => {
    const launch = fieldLoginLaunchFor('REAL_UI_LOGIN')
    expect(launch.profileKey).toBe('nesy.launch.cold-real-login')
    expect(launch.producesProductVerdict).toBe(true)
    expect(launch.sessionPreparation).toBe('REAL_UI_LOGIN')
  })

  it('setup precondition cannot produce a product login PASS', () => {
    const launch = fieldLoginLaunchFor('SETUP_PRECONDITION')
    expect(launch.profileKey).toBe('nesy.launch.prepared-session')
    expect(launch.producesProductVerdict).toBe(false)
    expect(launch.sessionPreparation).toBe('PREPARED_SESSION')
  })

  it('validate payloads mirror producesProductVerdict for each intent', () => {
    for (const intent of Object.keys(FIELD_LOGIN_LAUNCH) as Array<keyof typeof FIELD_LOGIN_LAUNCH>) {
      const payload = fieldLoginValidatePayload(intent)
      expect(payload.producesProductVerdict).toBe(FIELD_LOGIN_LAUNCH[intent].producesProductVerdict)
      expect(payload.profileKey).toBe(FIELD_LOGIN_LAUNCH[intent].profileKey)
    }
  })
})
