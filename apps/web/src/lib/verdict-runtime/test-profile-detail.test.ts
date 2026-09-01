import { describe, expect, it } from 'vitest'
import {
  findCampaignMembershipsForProfile,
  findTestProfileDefinition,
  parseTestProfileDefinition,
} from './test-profile-detail'

describe('test-profile-detail', () => {
  it('parses bad-day profile contract fields', () => {
    const parsed = parseTestProfileDefinition({
      profileKey: 'nesy.bad-day.state-aware-short',
      version: 1,
      kind: 'BAD_DAY',
      displayName: 'Bad day — network and process faults (state-aware short)',
      applicationRef: 'nesy.courier',
      launchProfileRef: 'nesy.launch.cold-real-login',
      includedWorkflowRefs: ['nesy.macro.complete-delivery', 'nesy.macro.tour-approval-lifecycle'],
      releaseGate: false,
      telemetry: {
        captureArtifacts: true,
        evidenceSampleEveryN: 1,
        retainRawEvidence: true,
      },
      faultPlan: {
        expectRecovery: true,
        injections: [
          {
            faultRef: 'nesy.fault.network-drop-at-submit',
            kind: 'NETWORK',
            triggerRef: 'nesy.macro.complete-delivery',
            correlationFactKey: 'nesy.fact.offline-queue-item-waiting',
            expectedRecoveryFactKey: 'nesy.fact.delivery-confirmed',
          },
        ],
      },
      performanceBudgetRefs: [],
      requiredCapabilityRefs: ['verdict.core.remote.allowlisted-operation'],
    })

    expect(parsed?.displayName).toContain('Bad day')
    expect(parsed?.includedWorkflowRefs).toHaveLength(2)
    expect(parsed?.faultPlan?.injections).toHaveLength(1)
    expect(parsed?.faultPlan?.injections[0]?.kind).toBe('NETWORK')
  })

  it('finds profile and campaign membership from pack registries', () => {
    const profiles = [
      {
        profileKey: 'nesy.bad-day.state-aware-short',
        version: 1,
        kind: 'BAD_DAY',
        displayName: 'Bad day profile',
        applicationRef: 'nesy.courier',
        launchProfileRef: 'nesy.launch.cold-real-login',
        includedWorkflowRefs: [],
        releaseGate: false,
        telemetry: { captureArtifacts: true, evidenceSampleEveryN: 1, retainRawEvidence: true },
        performanceBudgetRefs: [],
        requiredCapabilityRefs: [],
      },
    ]

    const campaigns = [
      {
        campaignKey: 'nesy.campaign.nightly',
        version: 1,
        displayName: 'Nightly campaign',
        profileRefs: ['nesy.regression.critical', 'nesy.bad-day.state-aware-short'],
        releaseGate: false,
        onProfileFailure: 'CONTINUE',
      },
    ]

    const definition = findTestProfileDefinition(profiles, 'nesy.bad-day.state-aware-short')
    const memberships = findCampaignMembershipsForProfile(
      campaigns,
      'nesy.bad-day.state-aware-short',
      new Map([['nesy.campaign.nightly', 'cmp-123']]),
    )

    expect(definition?.profileKey).toBe('nesy.bad-day.state-aware-short')
    expect(memberships).toHaveLength(1)
    expect(memberships[0]?.profileIndex).toBe(1)
    expect(memberships[0]?.campaignId).toBe('cmp-123')
  })
})
