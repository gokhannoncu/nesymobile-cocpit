/**
 * Field Login cutover (Phase 7.4): REAL UI login vs SETUP precondition.
 * Setup must never claim a product login PASS.
 */

export type FieldLoginIntent = 'REAL_UI_LOGIN' | 'SETUP_PRECONDITION'

/** Cockpit route / history slug (URL continuity). */
export const FIELD_LOGIN_WORKFLOW_REF = 'field-courier-login'

/** Published pack independent workflow that judges real login. */
export const FIELD_LOGIN_PACK_WORKFLOW_KEY = 'nesy.workflow.login'

export const FIELD_LOGIN_LAUNCH = {
  REAL_UI_LOGIN: {
    profileKey: 'nesy.launch.cold-real-login',
    sessionPreparation: 'REAL_UI_LOGIN' as const,
    producesProductVerdict: true,
    label: 'Real UI login',
    summary: 'Cold start through product login screens — may write a product verdict.',
  },
  SETUP_PRECONDITION: {
    profileKey: 'nesy.launch.prepared-session',
    sessionPreparation: 'PREPARED_SESSION' as const,
    producesProductVerdict: false,
    label: 'Setup / precondition',
    summary: 'Prepared session only — cannot produce a product login PASS.',
  },
} as const

export function fieldLoginLaunchFor(intent: FieldLoginIntent) {
  return FIELD_LOGIN_LAUNCH[intent]
}

/** Minimal LaunchProfile shapes for validateLaunchProfile (pack contract). */
export function fieldLoginValidatePayload(intent: FieldLoginIntent) {
  const launch = fieldLoginLaunchFor(intent)
  return {
    profileKey: launch.profileKey,
    applicationRef: 'nesy.courier.mobile',
    displayName: launch.label,
    startMode: intent === 'REAL_UI_LOGIN' ? 'COLD_START' : 'WARM_START',
    sessionPreparation: launch.sessionPreparation,
    preconditionFactKeys: [] as string[],
    entry: {
      kind: 'WORKFLOW_ENTRY',
      entryRef: 'nesy.entry.field-login',
      expectedScreenRef: 'nesy.auth.login',
      expectedSurfaceRefs: [] as string[],
    },
    preparationOperationRefs: [] as string[],
    cleanup: { cleanupRefs: [] as string[], runOnFailure: true, deadlineMs: 30_000 },
    producesProductVerdict: launch.producesProductVerdict,
    releaseIsolation: {
      automationOnly: intent === 'SETUP_PRECONDITION',
      releaseGuard: 'automationRelease=false',
      assertionFactKey: 'APP.SESSION_ISOLATION_ASSERTED',
      allowedEnvironments: ['qa', 'staging', 'automation'],
    },
    requiredCapabilityRefs: [] as string[],
  }
}
