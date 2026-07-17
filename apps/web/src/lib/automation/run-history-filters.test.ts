import { describe, expect, it } from 'vitest'
import { runMatchesStatusFilter } from '@/lib/automation/run-history-filters'
import type { WorkflowRun } from '@/services/automation-api'

const run = (status: string) =>
  ({
    id: 'run-1',
    status,
  }) as WorkflowRun

describe('runMatchesStatusFilter', () => {
  it('matches in-progress runs for the active filter', () => {
    expect(runMatchesStatusFilter(run('running'), 'active')).toBe(true)
    expect(runMatchesStatusFilter(run('pending'), 'active')).toBe(true)
    expect(runMatchesStatusFilter(run('success'), 'active')).toBe(false)
  })

  it('matches exact status filters', () => {
    expect(runMatchesStatusFilter(run('failed'), 'failed')).toBe(true)
    expect(runMatchesStatusFilter(run('success'), 'failed')).toBe(false)
  })
})
