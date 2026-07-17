import { describe, expect, it } from 'vitest'
import { workflowMatchesStatusFilter } from './workflow-library-filters'

const workflow = (status: string) =>
  ({
    id: 'wf-1',
    status,
  }) as Parameters<typeof workflowMatchesStatusFilter>[0]

describe('workflowMatchesStatusFilter', () => {
  it('returns all workflows when filter is all', () => {
    expect(workflowMatchesStatusFilter(workflow('draft'), 'all')).toBe(true)
  })

  it('matches a single workflow status', () => {
    expect(workflowMatchesStatusFilter(workflow('active'), 'active')).toBe(true)
    expect(workflowMatchesStatusFilter(workflow('draft'), 'active')).toBe(false)
  })
})
