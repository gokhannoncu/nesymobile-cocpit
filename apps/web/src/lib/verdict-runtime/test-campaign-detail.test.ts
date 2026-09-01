import { describe, expect, it } from 'vitest'
import {
  buildProfileSequence,
  countCampaignCellResults,
  findTestCampaignDefinition,
  parseCampaignCell,
  parseTestCampaignDefinition,
  profileCatalogByKey,
} from './test-campaign-detail'

describe('test-campaign-detail', () => {
  it('parses campaign definition from pack contract', () => {
    const parsed = parseTestCampaignDefinition({
      campaignKey: 'NIGHTLY',
      version: 1,
      displayName: 'Nightly campaign — critical regression + bad day',
      profileRefs: ['nesy.regression.critical', 'nesy.bad-day.state-aware-short'],
      releaseGate: false,
      onProfileFailure: 'CONTINUE',
    })

    expect(parsed?.displayName).toContain('Nightly')
    expect(parsed?.profileRefs).toHaveLength(2)
    expect(parsed?.releaseGate).toBe(false)
  })

  it('finds definition and counts cell results', () => {
    const campaigns = [
      {
        campaignKey: 'RELEASE',
        version: 1,
        displayName: 'Release gate campaign',
        profileRefs: ['nesy.preview.smoke'],
        releaseGate: true,
        onProfileFailure: 'STOP',
      },
    ]

    const definition = findTestCampaignDefinition(campaigns, 'RELEASE')
    expect(definition?.onProfileFailure).toBe('STOP')

    const cells = [
      parseCampaignCell({ cellKey: 'c1', profileKey: 'p1', result: 'PASS' }),
      parseCampaignCell({ cellKey: 'c2', profileKey: 'p2', result: 'FAIL' }),
      parseCampaignCell({ cellKey: 'c3', profileKey: 'p3', result: 'PENDING' }),
    ]

    const stats = countCampaignCellResults(cells)
    expect(stats.pass).toBe(1)
    expect(stats.fail).toBe(1)
    expect(stats.pending).toBe(1)
  })

  it('builds ordered profile sequence from contract refs', () => {
    const definition = parseTestCampaignDefinition({
      campaignKey: 'NIGHTLY',
      version: 1,
      displayName: 'Nightly',
      profileRefs: ['profile-a', 'profile-b'],
      releaseGate: false,
      onProfileFailure: 'CONTINUE',
    })!

    const cells = [
      parseCampaignCell({ cellKey: 'c1', profileKey: 'profile-b', deviceCell: 'pixel', result: 'PASS' }),
      parseCampaignCell({ cellKey: 'c2', profileKey: 'profile-a', deviceCell: 'pixel', result: 'PENDING' }),
    ]

    const catalog = profileCatalogByKey([
      {
        profileKey: 'profile-a',
        version: 2,
        kind: 'CORE',
        packKey: 'nesy.courier',
        packVersion: '1.0.0',
        owner: 'qa',
        lastResult: 'NOT_RUN',
        releaseGate: true,
        blockedReason: null,
      },
    ])

    const sequence = buildProfileSequence(definition, cells, catalog)
    expect(sequence).toHaveLength(2)
    expect(sequence[0]?.profileKey).toBe('profile-a')
    expect(sequence[0]?.catalogKind).toBe('CORE')
    expect(sequence[1]?.passCount).toBe(1)
  })
})
