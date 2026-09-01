import { describe, expect, it } from 'vitest'
import {
  campaignGateResultTone,
  campaignStatusRank,
  campaignStatusTone,
  campaignTypeTone,
  countCampaignsByType,
  sumCampaignCells,
} from './test-campaign-registry'
import type { TestCampaignCatalogItemApi } from './types'

function campaign(
  overrides: Partial<TestCampaignCatalogItemApi> = {},
): TestCampaignCatalogItemApi {
  return {
    campaignId: 'nightly-2026-03-01',
    campaignKey: 'NIGHTLY',
    campaignVersion: '1',
    status: 'RUNNING',
    cellCount: 12,
    releaseGateResult: 'NOT_EVALUATED',
    ...overrides,
  }
}

describe('test-campaign-registry helpers', () => {
  it('maps campaign type, status, and gate tones', () => {
    expect(campaignTypeTone('NIGHTLY')).toBe('purple')
    expect(campaignTypeTone('RELEASE')).toBe('nesy')
    expect(campaignStatusTone('RUNNING')).toBe('blue')
    expect(campaignStatusTone('BLOCKED')).toBe('orange')
    expect(campaignGateResultTone('FAIL')).toBe('orange')
    expect(campaignGateResultTone('PASS')).toBe('teal')
  })

  it('ranks blocked campaigns first', () => {
    expect(campaignStatusRank('BLOCKED')).toBeLessThan(campaignStatusRank('RUNNING'))
    expect(campaignStatusRank('COMPLETED')).toBeGreaterThan(campaignStatusRank('PENDING'))
  })

  it('aggregates campaign counts', () => {
    const items = [
      campaign(),
      campaign({ campaignId: 'pr-42', campaignKey: 'PR', cellCount: 4 }),
      campaign({ campaignId: 'nightly-2', cellCount: 8 }),
    ]
    expect(countCampaignsByType(items)).toEqual({ NIGHTLY: 2, PR: 1 })
    expect(sumCampaignCells(items)).toBe(24)
  })
})
