import { describe, expect, it } from 'vitest'
import type { TargetFingerprint, TargetResolutionEvidence } from '@nesy/bridge-contract'

import {
  InteractionReadinessTracker,
  isActionableResolution,
  observeInteractionReadiness,
} from './cold-start-readiness.js'

const fingerprint: TargetFingerprint = {
  version: 1,
  selector: { by: 'id', value: 'pinView' },
  expectedId: 'pinView',
}

function resolution(
  overrides: Partial<TargetResolutionEvidence> = {},
): TargetResolutionEvidence {
  return {
    outcome: 'RESOLVED_UNIQUE',
    fingerprint,
    strength: 'STRONG',
    treeGen: 18,
    node: {
      depth: 2,
      id: 'pinView',
      text: null,
      contentDescription: null,
      className: 'android.widget.EditText',
      packageName: 'com.example',
      rowIndex: null,
      columnIndex: null,
      collectionInfo: null,
      clickable: true,
      enabled: true,
      visible: true,
      obscuredBy: [],
      bounds: { left: 10, top: 20, right: 100, bottom: 60 },
    },
    ...overrides,
  }
}

describe('InteractionReadinessTracker', () => {
  it('reaches INTERACTION_READY without AUTH or bootstrap facts', () => {
    const tracker = new InteractionReadinessTracker(100, 20_000)
    tracker.mark('PROCESS_TERMINATED', 110, { previousPidAbsent: true })
    tracker.observe(
      {
        processCreated: true,
        processId: 42,
        osScheduled: true,
        appLifecycleReady: true,
        uiVisible: true,
        currentScreen: 'LoginFragment',
        targetResolution: resolution(),
        sdkReady: true,
        sessionId: 'session-1',
      },
      250,
    )

    const trace = tracker.trace(260)
    expect(trace.status).toBe('INTERACTION_READY')
    expect(trace.failureClass).toBeNull()
    expect(trace.completed.map((marker) => marker.state)).toEqual([
      'PROCESS_TERMINATED',
      'PROCESS_CREATED',
      'OS_SCHEDULED',
      'APP_LIFECYCLE_READY',
      'UI_VISIBLE',
      'A11Y_SYNCHRONIZED',
      'UI_ACTIONABLE',
      'SDK_READY',
    ])
  })

  it('classifies the first unmet boundary instead of returning TIMEOUT', () => {
    const tracker = new InteractionReadinessTracker(0, 1_000)
    tracker.mark('PROCESS_TERMINATED', 1)
    tracker.observe(
      {
        processCreated: true,
        processId: 42,
        osScheduled: true,
        appLifecycleReady: true,
        uiVisible: true,
        currentScreen: 'LoginFragment',
        targetResolution: resolution({
          node: { ...resolution().node!, enabled: false },
        }),
        sdkReady: true,
      },
      20,
    )

    const trace = tracker.trace(1_001)
    expect(trace.status).toBe('INTERACTION_NOT_READY')
    expect(trace.firstUnmet).toBe('UI_ACTIONABLE')
    expect(trace.failureClass).toBe('UI_NOT_ACTIONABLE')
    expect(trace.pending).not.toContain('SDK_READY')
  })

  it('keeps force-stop failure out of the evaluable cold dataset', () => {
    const tracker = new InteractionReadinessTracker(0, 1_000)
    const trace = tracker.trace(20, false)
    expect(trace.status).toBe('NOT_EVALUATED')
    expect(trace.failureClass).toBe('FORCE_STOP_NOT_CONFIRMED')
  })

  it('distinguishes a synchronized but obscured target from a stale a11y tree', () => {
    const tracker = new InteractionReadinessTracker(0, 1_000)
    tracker.mark('PROCESS_TERMINATED', 1)
    tracker.observe(
      {
        processCreated: true,
        osScheduled: true,
        appLifecycleReady: true,
        uiVisible: true,
        targetResolution: resolution({
          node: { ...resolution().node!, obscuredBy: ['PermissionDialog'] },
        }),
        sdkReady: true,
      },
      2,
    )
    const trace = tracker.trace(1_001)
    expect(trace.completed.map((marker) => marker.state)).toContain('A11Y_SYNCHRONIZED')
    expect(trace.failureClass).toBe('UI_NOT_ACTIONABLE')
  })

  it.each([
    {
      expected: 'PROCESS_NOT_STARTED',
      arrange: (tracker: InteractionReadinessTracker) => tracker.mark('PROCESS_TERMINATED', 1),
    },
    {
      expected: 'COLD_START_OS_SUSPEND',
      arrange: (tracker: InteractionReadinessTracker) => {
        tracker.mark('PROCESS_TERMINATED', 1)
        tracker.observe({ processCreated: true, processState: 'S', cpuTicks: 0 }, 2)
      },
    },
    {
      expected: 'APP_NOT_READY',
      arrange: (tracker: InteractionReadinessTracker) => {
        tracker.mark('PROCESS_TERMINATED', 1)
        tracker.observe({ processCreated: true, osScheduled: true }, 2)
      },
    },
    {
      expected: 'A11Y_SYNC_PENDING',
      arrange: (tracker: InteractionReadinessTracker) => {
        tracker.mark('PROCESS_TERMINATED', 1)
        tracker.observe({
          processCreated: true,
          osScheduled: true,
          appLifecycleReady: true,
          uiVisible: true,
        }, 2)
      },
    },
    {
      expected: 'SDK_NOT_READY',
      arrange: (tracker: InteractionReadinessTracker) => {
        tracker.mark('PROCESS_TERMINATED', 1)
        tracker.observe({
          processCreated: true,
          osScheduled: true,
          appLifecycleReady: true,
          uiVisible: true,
          targetResolution: resolution(),
        }, 2)
      },
    },
  ])('can produce $expected without a generic timeout class', ({ arrange, expected }) => {
    const tracker = new InteractionReadinessTracker(0, 100)
    arrange(tracker)
    expect(tracker.trace(101).failureClass).toBe(expected)
  })
})

describe('observeInteractionReadiness', () => {
  it('is bounded and records independently arriving states', async () => {
    let now = 0
    let sample = 0
    const tracker = new InteractionReadinessTracker(now, 100)
    tracker.mark('PROCESS_TERMINATED', now)

    const trace = await observeInteractionReadiness({
      tracker,
      intervalMs: 10,
      monoClock: () => now,
      wait: async (ms) => {
        now += ms
      },
      sample: async () => {
        sample += 1
        now += 1
        return {
          processCreated: true,
          osScheduled: true,
          appLifecycleReady: true,
          uiVisible: true,
          targetResolution: sample >= 2 ? resolution() : null,
          sdkReady: sample >= 3,
        }
      },
    })

    expect(trace.status).toBe('INTERACTION_READY')
    expect(trace.endedMonoTs).toBeLessThanOrEqual(100)
  })
})

describe('isActionableResolution', () => {
  it('requires measured, non-empty bounds', () => {
    expect(isActionableResolution(resolution())).toBe(true)
    expect(
      isActionableResolution(
        resolution({ node: { ...resolution().node!, bounds: 'not_measured' } }),
      ),
    ).toBe(false)
  })
})
