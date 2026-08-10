import { describe, expect, it } from 'vitest'

import { ScreenReadinessObserver } from './screen-readiness-observer.js'

const READY = 'SCREEN_READY'
const EXITED = 'SCREEN_EXITED'

describe('ScreenReadinessObserver', () => {
  it('reports the screen the device last said was ready', () => {
    const observer = new ScreenReadinessObserver()
    observer.observe({ runId: 'run-1', screen: 'LoginFragment', event: READY }, 1_000)

    expect(observer.current('run-1')).toEqual({
      screen: 'LoginFragment',
      ready: true,
      observedAtMs: 1_000,
    })
  })

  it('keeps the newest transition, because the question is about now', () => {
    // The device alternates ready/exited while the UI settles; only the last one
    // describes the current screen.
    const observer = new ScreenReadinessObserver()
    observer.observe({ runId: 'run-1', screen: 'LoginFragment', event: READY }, 1_000)
    observer.observe({ runId: 'run-1', screen: 'LoginFragment', event: EXITED }, 2_000)
    expect(observer.current('run-1')?.ready).toBe(false)

    observer.observe({ runId: 'run-1', screen: 'LoginFragment', event: READY }, 3_000)
    expect(observer.current('run-1')).toEqual({
      screen: 'LoginFragment',
      ready: true,
      observedAtMs: 3_000,
    })
  })

  it('ignores a late exit for a screen the device already left', () => {
    // A transition can deliver the old screen's exit after the new screen's ready.
    // Letting it win would blank a screen that is up, and the wait for it would
    // then time out against a device sitting on that very screen.
    const observer = new ScreenReadinessObserver()
    observer.observe({ runId: 'run-1', screen: 'LoginFragment', event: READY }, 1_000)
    observer.observe({ runId: 'run-1', screen: 'StopListFragment', event: READY }, 2_000)
    observer.observe({ runId: 'run-1', screen: 'LoginFragment', event: EXITED }, 2_001)

    expect(observer.current('run-1')).toEqual({
      screen: 'StopListFragment',
      ready: true,
      observedAtMs: 2_000,
    })
  })

  it('keeps runs apart so one run cannot answer another run"s question', () => {
    const observer = new ScreenReadinessObserver()
    observer.observe({ runId: 'run-1', screen: 'LoginFragment', event: READY }, 1_000)
    observer.observe({ runId: 'run-2', screen: 'StopListFragment', event: READY }, 1_100)

    expect(observer.current('run-1')?.screen).toBe('LoginFragment')
    expect(observer.current('run-2')?.screen).toBe('StopListFragment')
  })

  it('ignores anything that is not an identified screen transition', () => {
    // Heartbeats and business events carry no screen or arrive without a run id;
    // treating them as transitions would overwrite the real state with blanks.
    const observer = new ScreenReadinessObserver()
    observer.observe({ runId: 'run-1', screen: 'LoginFragment', event: READY }, 1_000)

    observer.observe({ runId: 'run-1', screen: '', event: READY }, 2_000)
    observer.observe({ runId: 'run-1', screen: 'LoginFragment', event: 'BRIDGE_HEARTBEAT' }, 2_000)
    observer.observe({ runId: '', screen: 'StopListFragment', event: READY }, 2_000)
    observer.observe({ runId: 'run-1', screen: 'LoginFragment', event: null }, 2_000)

    expect(observer.current('run-1')).toEqual({
      screen: 'LoginFragment',
      ready: true,
      observedAtMs: 1_000,
    })
  })

  it('forgets a finished run, since the observer outlives every run', () => {
    const observer = new ScreenReadinessObserver()
    observer.observe({ runId: 'run-1', screen: 'LoginFragment', event: READY }, 1_000)
    expect(observer.size()).toBe(1)

    observer.forget('run-1')

    expect(observer.current('run-1')).toBeUndefined()
    expect(observer.size()).toBe(0)
  })
})
