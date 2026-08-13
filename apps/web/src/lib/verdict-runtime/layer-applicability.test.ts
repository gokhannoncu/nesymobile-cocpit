import { describe, expect, it } from 'vitest'
import {
  deriveLayerApplicability,
  deriveStepLayerApplicability,
  planeFromFactKey,
} from './layer-applicability'
import type { RunDetailResult } from './types'

function baseRun(over: Partial<RunDetailResult> = {}): RunDetailResult {
  return {
    apiVersion: 'verdict-runtime.v1',
    partial: false,
    correlation: { runId: 'run-1', engineType: 'BRIDGEFLOW' },
    run: { id: 'run-1', deviceId: 'd1', workflowId: 'w1' },
    runtime: null,
    steps: [],
    waits: [],
    actionTransitions: [],
    oracleEvaluations: [],
    testExecutions: [],
    resourceLeases: [],
    remoteActions: [],
    ...over,
  }
}

describe('layer applicability', () => {
  it('maps fact-key prefixes to planes', () => {
    expect(planeFromFactKey('UI.LOGIN_SCREEN_READY')).toBe('UI')
    expect(planeFromFactKey('APP.USER_SESSION_AVAILABLE')).toBe('App')
    expect(planeFromFactKey('LOCAL.SESSION_STATE')).toBe('Local')
    expect(planeFromFactKey('REMOTE.TOUR_APPROVED')).toBe('Remote')
    expect(planeFromFactKey('app.persisted')).toBe('App')
  })

  it('derives per-step oracle ticks from FINAL_ORACLE requirements', () => {
    const layers = deriveStepLayerApplicability('occ-1', [
      {
        occurrenceId: 'occ-1',
        evaluatorKind: 'FINAL_ORACLE',
        revision: 2,
        requirements: {
          'UI.LOGIN_SCREEN_READY': { state: 'SATISFIED' },
          'APP.USER_SESSION_AVAILABLE': { state: 'SATISFIED' },
          'LOCAL.SESSION_STATE': { state: 'PENDING' },
          'REMOTE.TOUR_APPROVED': { state: 'NOT_APPLICABLE', reason: 'not required' },
        },
      },
    ])

    expect(layers).not.toBeNull()
    expect(layers!.find((layer) => layer.layer === 'UI')?.state).toBe('PASS')
    expect(layers!.find((layer) => layer.layer === 'App')?.state).toBe('PASS')
    expect(layers!.find((layer) => layer.layer === 'Local')?.state).toBe('REQUIRED_PENDING')
    expect(layers!.find((layer) => layer.layer === 'Remote')?.state).toBe('NOT_APPLICABLE')
  })

  it('returns null for a step that persisted no oracle evaluation', () => {
    expect(deriveStepLayerApplicability('occ-bridge-only', [])).toBeNull()
    expect(
      deriveStepLayerApplicability('occ-bridge-only', [
        { occurrenceId: 'other-occ', evaluatorKind: 'FINAL_ORACLE', revision: 1, requirements: {} },
      ]),
    ).toBeNull()
  })

  it('marks planes the step policy never mentions as NOT_APPLICABLE, not NOT_MEASURED', () => {
    const layers = deriveStepLayerApplicability('occ-2', [
      {
        occurrenceId: 'occ-2',
        evaluatorKind: 'FINAL_ORACLE',
        revision: 1,
        requirements: { 'APP.USER_SESSION_AVAILABLE': { state: 'SATISFIED' } },
      },
    ])

    expect(layers!.find((layer) => layer.layer === 'App')?.state).toBe('PASS')
    for (const layer of ['UI', 'Local', 'Remote'] as const) {
      expect(layers!.find((entry) => entry.layer === layer)?.state).toBe('NOT_APPLICABLE')
    }
  })

  it('does not invent PASS when evaluations are empty', () => {
    const layers = deriveLayerApplicability(baseRun())
    expect(layers.every((layer) => layer.state === 'NOT_MEASURED')).toBe(true)
  })

  it('maps plane outcomes and keeps max revision', () => {
    const layers = deriveLayerApplicability(
      baseRun({
        oracleEvaluations: [
          {
            revision: 1,
            plane: 'UI',
            outcome: 'PASS',
          },
          {
            revision: 2,
            requirements: [{ plane: 'UI', state: 'FAIL', reason: 'stale' }],
          },
          {
            revision: 1,
            requirements: [{ layer: 'Remote', outcome: 'NOT_APPLICABLE', reason: 'no remote' }],
          },
        ],
      }),
    )
    const ui = layers.find((layer) => layer.layer === 'UI')
    const remote = layers.find((layer) => layer.layer === 'Remote')
    expect(ui?.state).toBe('FAIL')
    expect(ui?.revision).toBe(2)
    expect(remote?.state).toBe('NOT_APPLICABLE')
  })
})
