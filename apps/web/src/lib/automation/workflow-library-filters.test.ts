import { describe, expect, it } from 'vitest'
import {
  isVisibleLibraryWorkflow,
  workflowMatchesStatusFilter,
} from './workflow-library-filters'

const workflow = (status: string, slug = 'login-flow') =>
  ({
    id: 'wf-1',
    status,
    slug,
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

describe('isVisibleLibraryWorkflow', () => {
  it('hides field-courier-login', () => {
    expect(isVisibleLibraryWorkflow(workflow('active', 'field-courier-login'))).toBe(false)
  })

  it('keeps other workflows', () => {
    expect(isVisibleLibraryWorkflow(workflow('active', 'login-flow'))).toBe(true)
  })
})
