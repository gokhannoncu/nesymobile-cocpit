import { describe, expect, it } from 'vitest'
import {
  EVIDENCE_JOURNEY_STAGES,
  latestItemPerStage,
  normalizeJourneyState,
  reducerTraceSteps,
} from '../lib/verdict-runtime/evidence-journey'
import { deriveLayerApplicability } from '../lib/verdict-runtime/layer-applicability'
import { buildReproExport } from '../lib/verdict-runtime/repro-export'
import { mapDeviceBoundsToViewport, xywhToLtrb } from '../lib/debug-view/map-device-bounds'
import type { RunDetailResult } from '../lib/verdict-runtime/types'

function baseRun(over: Partial<RunDetailResult> = {}): RunDetailResult {
  return {
    apiVersion: 'verdict-runtime.v1',
    partial: false,
    correlation: { runId: 'run-1', engineType: 'BRIDGEFLOW' },
    run: { id: 'run-1', deviceId: 'd1', workflowId: 'w1' },
    runtime: {
      compiledPlanHash: 'sha256:abc',
      domainPackKey: 'nesy-courier',
      domainPackVersion: '2.0.0',
      domainPackDigest: 'sha256:pack',
      bridgeProtocolVersion: '1',
      sdkProtocolVersion: '1',
      runEpochMs: 1,
      token: 'super-secret-token',
    },
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

describe('67/69 — evidence journey mapping', () => {
  it('uses UPPERCASE stages and OBSERVED/NOT_OBSERVED states', () => {
    expect(EVIDENCE_JOURNEY_STAGES).toHaveLength(9)
    expect(normalizeJourneyState('OBSERVED')).toBe('OBSERVED')
    expect(normalizeJourneyState('COMPLETED')).toBe('OBSERVED')
    expect(normalizeJourneyState('NOT_CAPTURED')).toBe('NOT_OBSERVED')
  })

  it('picks latest revision per stage and exposes reducer steps', () => {
    const byStage = latestItemPerStage([
      {
        journeyStage: 'NORMALIZATION',
        journeyState: 'OBSERVED',
        revision: 1,
        factKey: 'old',
        reducerTrace: ['a'],
      },
      {
        journeyStage: 'normalization',
        journeyState: 'OBSERVED',
        revision: 3,
        factKey: 'login.ok',
        rawEventRef: 'evt-9',
        value: true,
        reducerTrace: { steps: ['raw', 'normalize'] },
      },
    ])
    const item = byStage.get('NORMALIZATION')
    expect(item?.factKey).toBe('login.ok')
    expect(item?.revision).toBe(3)
    expect(reducerTraceSteps(item?.reducerTrace)).toEqual(['raw', 'normalize'])
  })
})

describe('61/63 — layer applicability from persisted evaluations', () => {
  it('does not invent PASS when evaluations are empty', () => {
    const layers = deriveLayerApplicability(baseRun())
    expect(layers.every((l) => l.state === 'NOT_MEASURED')).toBe(true)
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
    const ui = layers.find((l) => l.layer === 'UI')
    const remote = layers.find((l) => l.layer === 'Remote')
    expect(ui?.state).toBe('FAIL')
    expect(ui?.revision).toBe(2)
    expect(remote?.state).toBe('NOT_APPLICABLE')
  })
})

describe('75 — repro export builder', () => {
  it('reads compiledPlanHash from runtime and redacts secrets', () => {
    const manifest = buildReproExport(baseRun())
    expect(manifest.compiledPlanHash).toBe('sha256:abc')
    expect(manifest.opensActMode).toBe(false)
    expect(manifest.slots.workflow.status).toBe('CAPTURED')
    expect(manifest.slots.app.status).toBe('CAPTURED')
    // Secret keys from runtime must never leak into the export payload.
    expect(JSON.stringify(manifest)).not.toContain('super-secret-token')
    const withSecretSlot = buildReproExport(
      baseRun({
        runtime: {
          compiledPlanHash: 'sha256:abc',
          profileSnapshot: { password: 'hunter2', ok: true },
        },
      }),
    )
    expect(JSON.stringify(withSecretSlot)).toContain('[REDACTED]')
    expect(JSON.stringify(withSecretSlot)).not.toContain('hunter2')
  })
})

describe('50 — overlay coordinate mapper', () => {
  it('scales portrait bounds into viewport', () => {
    const rect = mapDeviceBoundsToViewport({
      bounds: xywhToLtrb(10, 20, 100, 40),
      orientation: 'PORTRAIT',
      applyInsets: false,
      insets: { left: 0, top: 0, right: 0, bottom: 0 },
      screenshotWidth: 360,
      screenshotHeight: 640,
      viewportWidth: 180,
      viewportHeight: 320,
    })
    expect(rect.x).toBeCloseTo(5)
    expect(rect.y).toBeCloseTo(10)
    expect(rect.width).toBeCloseTo(50)
    expect(rect.height).toBeCloseTo(20)
  })

  it('applies top inset when enabled', () => {
    const without = mapDeviceBoundsToViewport({
      bounds: { left: 0, top: 40, right: 100, bottom: 80 },
      orientation: 'PORTRAIT',
      applyInsets: false,
      insets: { left: 0, top: 24, right: 0, bottom: 0 },
      screenshotWidth: 100,
      screenshotHeight: 200,
      viewportWidth: 100,
      viewportHeight: 200,
    })
    const withInsets = mapDeviceBoundsToViewport({
      bounds: { left: 0, top: 40, right: 100, bottom: 80 },
      orientation: 'PORTRAIT',
      applyInsets: true,
      insets: { left: 0, top: 24, right: 0, bottom: 0 },
      screenshotWidth: 100,
      screenshotHeight: 200,
      viewportWidth: 100,
      viewportHeight: 200,
    })
    expect(withInsets.y).toBeLessThan(without.y)
  })
})

describe('71–73 — human baseline exclusion rule', () => {
  it('documents that only MANUAL counts toward human baseline', () => {
    const origins = ['BRIDGE_INJECTED', 'MANUAL', 'UNKNOWN', 'BRIDGE_INJECTED', 'MANUAL'] as const
    const humanBaseline = origins.filter((o) => o === 'MANUAL').length
    const bridge = origins.filter((o) => o === 'BRIDGE_INJECTED').length
    expect(humanBaseline).toBe(2)
    expect(bridge).toBe(2)
    expect(humanBaseline).not.toBe(origins.length)
  })
})
