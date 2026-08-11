/**
 * ===========================================================================
 *  LIVE SCREEN READINESS — the producer `WAIT_EVENT` on a UI fact needs
 *
 *  ## Why this exists
 *
 *  `UI.*_READY` facts had exactly one producer: a single publish before the run
 *  started, built from one `GET_STATE` snapshot, with a hardcoded
 *  `wait-login-ready` occurrence id and a 5s freshness window. A wait that runs
 *  for 30s could therefore only pass if the snapshot happened to catch the right
 *  screen AND the first evaluation landed inside those 5 seconds. On a cold start
 *  it never does, so `wait-login-ready` timed out every time — against a device
 *  that was sitting on the login screen and saying so.
 *
 *  The device already reports it: `SCREEN_READY` / `SCREEN_EXITED` with the
 *  fragment tag, streamed over the WS transport for the whole run. Those events
 *  cannot become evidence facts on their own — the resolver requires a BridgeFlow
 *  correlation tuple (`occurrenceId`, `iterationKey`) and the device cannot know
 *  it, because it belongs to a plan step the device never sees. So the host has to
 *  hold the state and correlate it at query time. That is all this file does.
 *
 *  ## Why a state and not an event log
 *
 *  "Is the login screen ready" is a question about NOW, not about whether an event
 *  once arrived. The device alternates `SCREEN_READY` / `SCREEN_EXITED` during
 *  layout, and then goes quiet once the UI settles — so the newest event is the
 *  truth and the absence of newer events means the truth still holds. Keeping the
 *  last transition per run answers the question; keeping a list would only make
 *  the caller re-derive it.
 * ===========================================================================
 */

/** The device's last screen transition for one run. */
export interface ScreenReadinessState {
  /** Fragment tag / route key / component the device reported. */
  screen: string
  /** False after a `SCREEN_EXITED` that superseded the last `SCREEN_READY`. */
  ready: boolean
  /** When the transition was observed on the host clock. */
  observedAtMs: number
}

const SCREEN_READY_EVENT = 'SCREEN_READY'
const SCREEN_EXITED_EVENT = 'SCREEN_EXITED'

export class ScreenReadinessObserver {
  private readonly byRun = new Map<string, ScreenReadinessState>()

  /**
   * Records a screen transition. Anything that is not a screen transition, or
   * carries no run/screen identity, is ignored rather than guessed at.
   */
  observe(
    event: { runId?: string | null; screen?: string | null; event?: string | null },
    observedAtMs: number,
  ): void {
    const runId = event.runId?.trim()
    const screen = event.screen?.trim()
    const name = event.event?.trim().toUpperCase()
    if (!runId || !screen) return
    if (name !== SCREEN_READY_EVENT && name !== SCREEN_EXITED_EVENT) return

    const ready = name === SCREEN_READY_EVENT
    const previous = this.byRun.get(runId)
    // A `SCREEN_EXITED` for a screen we are no longer on says nothing about the
    // one we ARE on: during a transition the old screen's exit can land after the
    // new screen's ready, and letting it win would blank a screen that is up.
    if (!ready && previous !== undefined && previous.screen !== screen) return

    this.byRun.set(runId, { screen, ready, observedAtMs })
  }

  /** The run's current screen, or undefined when the device has not reported one. */
  current(runId: string): ScreenReadinessState | undefined {
    const state = this.byRun.get(runId)
    return state === undefined ? undefined : { ...state }
  }

  /**
   * Drops a finished run's state.
   *
   * Without this the map is a leak in a long-lived API process, and a later run
   * that reuses nothing could still read a retired run's screen.
   */
  forget(runId: string): void {
    this.byRun.delete(runId)
  }

  /** Diagnostics only. */
  size(): number {
    return this.byRun.size
  }

  /**
   * Every run's last transition, for diagnostics.
   *
   * A `WAIT_EVENT`/continue gate on a `UI.*_READY` fact fails identically whether
   * the device never reported the screen or reported one the pack does not map, and
   * neither case leaves a trace: the fact is simply absent. This is the only way to
   * tell those two apart from outside the process.
   */
  snapshot(): Readonly<Record<string, ScreenReadinessState>> {
    return Object.fromEntries(
      Array.from(this.byRun, ([runId, state]) => [runId, { ...state }]),
    )
  }
}

let singleton: ScreenReadinessObserver | null = null

/**
 * Process-wide, because the producer (the WS/logcat event path) and the consumer
 * (the execution queue's evidence port) never meet: one is per device sniffer,
 * the other per run.
 */
export function getScreenReadinessObserver(): ScreenReadinessObserver {
  singleton ??= new ScreenReadinessObserver()
  return singleton
}
