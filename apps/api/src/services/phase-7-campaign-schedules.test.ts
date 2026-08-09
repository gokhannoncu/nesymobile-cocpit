/**
 * Phase 7.22 — campaign schedule fake fixtures + matrix cell evidence gate.
 */

import { describe, expect, it } from 'vitest'
import { TestCampaignService } from './test-campaign.service.js'

const SCHEDULES = [
  { scheduleClass: 'PR', campaignKey: 'nesy.campaign.pr', fixtureId: 'fixture.campaign.schedule.pr' },
  {
    scheduleClass: 'NIGHTLY',
    campaignKey: 'nesy.campaign.nightly',
    fixtureId: 'fixture.campaign.schedule.nightly',
  },
  {
    scheduleClass: 'WEEKLY',
    campaignKey: 'nesy.campaign.weekly',
    fixtureId: 'fixture.campaign.schedule.weekly',
  },
  {
    scheduleClass: 'RELEASE',
    campaignKey: 'nesy.campaign.release',
    fixtureId: 'fixture.campaign.schedule.release',
  },
] as const

describe('Phase 7.22 campaign schedules', () => {
  it.each(SCHEDULES)(
    '$scheduleClass fake fixture starts a campaign without inventing cell PASS',
    async ({ campaignKey, fixtureId }) => {
      const service = new TestCampaignService()
      const started = await service.start({
        campaignKey,
        campaignVersion: 1,
        cells: [
          {
            cellKey: `${fixtureId}.cell-a`,
            profileKey: 'nesy.smoke.core',
            profileVersion: 1,
            deviceCell: 'fake-dut',
            datasetRef: fixtureId,
          },
        ],
      })
      expect(started.status).toBe('RUNNING')
      expect(started.releaseGateResult).toBe('NOT_EVALUATED')

      const view = await service.get(started.campaignId)
      expect(view?.cells[0]?.result).toBe('PENDING')
      expect(view?.cells[0]?.blockedReason).toMatch(/waiting for run\/evidence summary/i)
      expect(view?.cells[0]?.runDetailPath).toBeUndefined()
    },
  )

  it('withholds PASS/FAIL until an evidence summary is attached (CHECKPOINT 84)', async () => {
    const service = new TestCampaignService()
    const started = await service.start({
      campaignKey: 'nesy.campaign.release',
      campaignVersion: 1,
      cells: [
        {
          cellKey: 'cell-1',
          profileKey: 'nesy.smoke.core',
          profileVersion: 1,
        },
      ],
    })

    const withoutEvidence = await service.attachCellEvidence({
      campaignId: started.campaignId,
      cellKey: 'cell-1',
      runId: 'run-1',
    })
    // Public view masks incomplete cells as PENDING (never invents PASS/FAIL).
    expect(withoutEvidence?.cells[0]?.result).toBe('PENDING')
    expect(['PASS', 'FAIL']).not.toContain(withoutEvidence?.cells[0]?.result)
    expect(withoutEvidence?.cells[0]?.blockedReason).toMatch(/evidence summary missing/i)
    expect(withoutEvidence?.cells[0]?.runDetailPath).toBe('/automation/runs/run-1')

    const withEvidence = await service.attachCellEvidence({
      campaignId: started.campaignId,
      cellKey: 'cell-1',
      runId: 'run-1',
      evidenceSummaryRef: 'evidence://summary/run-1',
      result: 'PASS',
    })
    expect(withEvidence?.cells[0]?.result).toBe('PASS')
    expect(withEvidence?.cells[0]?.evidenceSummaryRef).toBe('evidence://summary/run-1')
  })

  it('marks real DUT campaign cells BLOCKED_EXTERNAL when DUT is deferred', async () => {
    const service = new TestCampaignService()
    const started = await service.start({
      campaignKey: 'nesy.campaign.release',
      campaignVersion: 1,
      cells: [
        {
          cellKey: 'real-dut-cell',
          profileKey: 'nesy.smoke.core',
          profileVersion: 1,
          deviceCell: 'R6CW400BC8N',
        },
      ],
    })
    const view = await service.attachCellEvidence({
      campaignId: started.campaignId,
      cellKey: 'real-dut-cell',
      runId: 'run-dut-deferred',
      evidenceSummaryRef: 'evidence://blocker/CP3-DUT',
      result: 'BLOCKED',
    })
    expect(view?.cells[0]?.result).toBe('BLOCKED')
    expect(view?.failedCells).toContain('real-dut-cell')
  })
})
