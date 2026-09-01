import { describe, expect, it } from 'vitest'
import {
  countWorkflowLibraryStatuses,
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

  it('treats published workflows as active', () => {
    expect(workflowMatchesStatusFilter(workflow('published'), 'active')).toBe(true)
    expect(workflowMatchesStatusFilter(workflow('published'), 'draft')).toBe(false)
  })
})

describe('countWorkflowLibraryStatuses', () => {
  it('groups published workflows under active', () => {
    expect(
      countWorkflowLibraryStatuses([
        workflow('published'),
        workflow('active'),
        workflow('draft'),
      ]),
    ).toEqual({ active: 2, draft: 1, archived: 0 })
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
