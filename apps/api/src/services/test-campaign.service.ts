import { randomUUID } from 'node:crypto'

export const TEST_CAMPAIGN_API_VERSION = 'verdict-runtime.v1' as const

export interface CampaignCellRecord {
  cellKey: string
  profileKey: string
  profileVersion: number
  deviceCell?: string
  datasetRef?: string
  runIds: readonly string[]
  result: 'PENDING' | 'PASS' | 'FAIL' | 'BLOCKED' | 'PARTIAL'
  blockedReason?: string
  evidenceSummaryRef?: string
}

export interface CampaignRecord {
  campaignId: string
  campaignKey: string
  campaignVersion: number
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'BLOCKED'
  cells: CampaignCellRecord[]
  releaseGateResult?: 'PASS' | 'FAIL' | 'NOT_EVALUATED'
  evidenceSummaryRef?: string
}

export class TestCampaignService {
  private readonly campaigns = new Map<string, CampaignRecord>()

  list() {
    return {
      apiVersion: TEST_CAMPAIGN_API_VERSION,
      items: [...this.campaigns.values()].map((campaign) => ({
        campaignId: campaign.campaignId,
        campaignKey: campaign.campaignKey,
        campaignVersion: campaign.campaignVersion,
        status: campaign.status,
        cellCount: campaign.cells.length,
        releaseGateResult: campaign.releaseGateResult ?? 'NOT_EVALUATED',
      })),
    }
  }

  get(campaignId: string) {
    const campaign = this.campaigns.get(campaignId)
    if (!campaign) return null
    return {
      apiVersion: TEST_CAMPAIGN_API_VERSION,
      campaignId: campaign.campaignId,
      campaignKey: campaign.campaignKey,
      campaignVersion: campaign.campaignVersion,
      status: campaign.status,
      releaseGateResult: campaign.releaseGateResult ?? 'NOT_EVALUATED',
      evidenceSummaryRef: campaign.evidenceSummaryRef,
      cells: campaign.cells.map((cell) => this.publicCell(cell)),
      failedCells: campaign.cells
        .filter((cell) => cell.result === 'FAIL' || cell.result === 'BLOCKED')
        .map((cell) => cell.cellKey),
      partial: campaign.cells.some((cell) => cell.result === 'PENDING' || cell.result === 'PARTIAL'),
    }
  }

  start(input: {
    campaignKey: string
    campaignVersion: number
    cells: readonly Omit<CampaignCellRecord, 'runIds' | 'result'>[]
  }): CampaignRecord {
    const campaignId = `campaign_${randomUUID()}`
    const campaign: CampaignRecord = {
      campaignId,
      campaignKey: input.campaignKey,
      campaignVersion: input.campaignVersion,
      status: 'RUNNING',
      cells: input.cells.map((cell) => ({
        ...cell,
        runIds: [],
        result: 'PENDING',
      })),
      releaseGateResult: 'NOT_EVALUATED',
    }
    this.campaigns.set(campaignId, campaign)
    return campaign
  }

  /**
   * Attach a real run/evidence summary. Without evidence, cells stay PENDING/PARTIAL
   * and never invent PASS/FAIL.
   */
  attachCellEvidence(input: {
    campaignId: string
    cellKey: string
    runId: string
    evidenceSummaryRef?: string
    result?: 'PASS' | 'FAIL' | 'BLOCKED'
  }) {
    const campaign = this.campaigns.get(input.campaignId)
    if (!campaign) throw new Error('campaign not found')
    const cell = campaign.cells.find((item) => item.cellKey === input.cellKey)
    if (!cell) throw new Error('campaign cell not found')
    if (!input.evidenceSummaryRef) {
      cell.result = 'PARTIAL'
      cell.runIds = [...cell.runIds, input.runId]
      cell.blockedReason = 'evidence summary missing; verdict withheld'
      return this.get(input.campaignId)
    }
    cell.runIds = [...cell.runIds, input.runId]
    cell.evidenceSummaryRef = input.evidenceSummaryRef
    cell.result = input.result ?? 'PASS'
    cell.blockedReason = undefined
    return this.get(input.campaignId)
  }

  private publicCell(cell: CampaignCellRecord) {
    const hasEvidence = Boolean(cell.evidenceSummaryRef) && cell.runIds.length > 0
    return {
      cellKey: cell.cellKey,
      profileKey: cell.profileKey,
      profileVersion: cell.profileVersion,
      deviceCell: cell.deviceCell,
      datasetRef: cell.datasetRef,
      runIds: cell.runIds,
      result: hasEvidence ? cell.result : cell.result === 'BLOCKED' ? 'BLOCKED' : 'PENDING',
      blockedReason: hasEvidence
        ? cell.blockedReason
        : cell.blockedReason ?? 'waiting for run/evidence summary',
      evidenceSummaryRef: cell.evidenceSummaryRef,
      runDetailPath:
        cell.runIds[0] === undefined
          ? undefined
          : `/automation/runs/${cell.runIds[0]}`,
    }
  }
}
