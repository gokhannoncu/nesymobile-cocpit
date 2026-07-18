import { describe, expect, it } from 'vitest'
import { isVisibleHistoryRun, runMatchesStatusFilter } from './run-history-filters'

const run = (status: string, slug?: string) =>
  ({
    id: 'run-1',
    status,
    workflow: slug
      ? { id: 'wf-1', slug, name: slug }
      : undefined,
  }) as Parameters<typeof runMatchesStatusFilter>[0]

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

describe('isVisibleHistoryRun', () => {
  it('hides runs for field-courier-login', () => {
    expect(isVisibleHistoryRun(run('success', 'field-courier-login'))).toBe(false)
  })

  it('keeps runs for other workflows', () => {
    expect(isVisibleHistoryRun(run('success', 'login-flow'))).toBe(true)
  })

  it('keeps runs with missing workflow slug', () => {
    expect(isVisibleHistoryRun(run('success'))).toBe(true)
  })
})
