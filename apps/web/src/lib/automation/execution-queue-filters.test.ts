import { describe, expect, it } from 'vitest'

import {
  queueDeviceChipLabel,
  queueRowDurationMs,
  workflowRunApiToQueueRow,
} from './execution-queue-filters'
import type { WorkflowRunApi } from '@/lib/verdict-runtime/types'

describe('workflowRunApiToQueueRow', () => {
  it('maps the persisted device serial onto the pipeline table', () => {
    const item: WorkflowRunApi = {
      apiVersion: 'verdict-runtime.v1',
      partial: false,
      correlation: { runId: 'run_dc83e18c', engineType: 'BRIDGEFLOW' },
      run: {
        id: 'run_dc83e18c',
        workflowId: 'w1',
        workflowSlug: 'nesy.workflow.open-stop',
        workflowName: 'Opening a stop opens the requested stop',
        status: 'completed',
        deviceId: 'R6CW400BC8N',
        deviceModelName: 'SM-A346E',
        deviceLabel: 'Samsung SM-A346E',
        startedAt: '2026-09-01T20:25:05.114Z',
        completedAt: '2026-09-01T20:25:41.132Z',
        createdAt: '2026-09-01T20:25:01.964Z',
        duration: null,
      },
      runtime: { engineType: 'BRIDGEFLOW' },
    }

    const row = workflowRunApiToQueueRow(item)
    expect(row.deviceId).toBe('R6CW400BC8N')
    expect(row.deviceLabel).toBe('Samsung SM-A346E')
    expect(queueDeviceChipLabel(row)).toBe('Samsung SM-A346E')
    expect(row.completedAt).toBe('2026-09-01T20:25:41.132Z')
    expect(row.duration).toBe(36_018)
    expect(queueRowDurationMs(row)).toBe(36_018)
  })

  it('derives duration from timestamps when the stored field is empty', () => {
    const row = workflowRunApiToQueueRow({
      apiVersion: 'verdict-runtime.v1',
      partial: false,
      correlation: { runId: 'run_blocked', engineType: 'BRIDGEFLOW' },
      run: {
        id: 'run_blocked',
        status: 'blocked',
        createdAt: '2026-09-01T20:26:48.167Z',
        completedAt: '2026-09-01T20:26:49.949Z',
        duration: null,
      },
      runtime: null,
    })
    expect(queueRowDurationMs(row)).toBe(1_782)
  })
})
