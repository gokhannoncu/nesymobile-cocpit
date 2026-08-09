import { describe, expect, it } from 'vitest'
import { buildReproExport } from '../lib/verdict-runtime/repro-export'
import type { RunDetailResult } from '../lib/verdict-runtime/types'

function sparseRun(): RunDetailResult {
  return {
    apiVersion: 'verdict-runtime.v1',
    partial: false,
    correlation: { runId: 'run-sparse', engineType: 'BRIDGEFLOW' },
    run: { id: 'run-sparse' },
    runtime: {},
    steps: [],
    waits: [],
    actionTransitions: [],
    oracleEvaluations: [],
    testExecutions: [],
    resourceLeases: [],
    remoteActions: [],
  }
}

describe('Phase 7.18 repro NOT_CAPTURED', () => {
  it('marks missing slots NOT_CAPTURED without inventing retrospective dumps', () => {
    const manifest = buildReproExport(sparseRun())
    expect(manifest.opensActMode).toBe(false)
    expect(manifest.slots.app.status).toBe('NOT_CAPTURED')
    expect(manifest.slots.sdk.status).toBe('NOT_CAPTURED')
    expect(manifest.slots.bridge.status).toBe('NOT_CAPTURED')
    expect(manifest.slots.device.status).toBe('NOT_CAPTURED')
    expect(manifest.slots.action.status).toBe('NOT_CAPTURED')
    expect(manifest.slots.artifact.status).toBe('NOT_CAPTURED')
    for (const [name, slot] of Object.entries(manifest.slots)) {
      if (slot.status === 'NOT_CAPTURED') {
        expect(slot.value, name).toBeUndefined()
      }
    }
  })
})
