import { BRIDGE_NOT_MEASURED, type TargetResolutionEvidence } from '@nesy/bridge-contract'

/** Canonical pre-action boundaries from G90 READINESS.md. */
export const INTERACTION_READINESS_BOUNDARIES = [
  'PROCESS_TERMINATED',
  'PROCESS_CREATED',
  'OS_SCHEDULED',
  'APP_LIFECYCLE_READY',
  'UI_VISIBLE',
  'A11Y_SYNCHRONIZED',
  'UI_ACTIONABLE',
  'SDK_READY',
] as const

export type InteractionReadinessBoundary = (typeof INTERACTION_READINESS_BOUNDARIES)[number]

export type PreActionFailureClass =
  | 'FORCE_STOP_NOT_CONFIRMED'
  | 'PROCESS_NOT_STARTED'
  | 'COLD_START_OS_SUSPEND'
  | 'APP_NOT_READY'
  | 'A11Y_SYNC_PENDING'
  | 'UI_NOT_ACTIONABLE'
  | 'SDK_NOT_READY'
  | 'UNCLASSIFIED'

export interface ReadinessMarker {
  state: InteractionReadinessBoundary
  /** Host monotonic clock; wall time is deliberately not used for component latency. */
  monoTs: number
  evidence?: Record<string, unknown>
}

export interface InteractionReadinessTrace {
  version: 1
  status: 'INTERACTION_READY' | 'INTERACTION_NOT_READY' | 'NOT_EVALUATED'
  startedMonoTs: number
  endedMonoTs: number
  deadlineMs: number
  failureClass: PreActionFailureClass | null
  firstUnmet: InteractionReadinessBoundary | null
  completed: readonly ReadinessMarker[]
  pending: readonly InteractionReadinessBoundary[]
  supportingEvidence: Readonly<Record<string, unknown>>
}

export interface InteractionReadinessObservation {
  processCreated?: boolean
  processId?: number | null
  processState?: string | null
  cpuTicks?: number | null
  osScheduled?: boolean
  appLifecycleReady?: boolean
  uiVisible?: boolean
  currentScreen?: string | null
  targetResolution?: TargetResolutionEvidence | null
  sdkReady?: boolean
  sessionId?: string | null
  detail?: Record<string, unknown>
}

/**
 * Accumulates independently observed readiness facts and emits one canonical
 * boundary/class. Facts are monotonic within a cold-start attempt: a later
 * transient miss cannot erase proof already captured for this launch.
 */
export class InteractionReadinessTracker {
  private readonly markers = new Map<InteractionReadinessBoundary, ReadinessMarker>()
  private readonly evidence: Record<string, unknown> = {}
  private lastObservation: InteractionReadinessObservation = {}

  constructor(
    private readonly startedMonoTs: number,
    private readonly deadlineMs: number,
  ) {}

  mark(
    state: InteractionReadinessBoundary,
    monoTs: number,
    evidence?: Record<string, unknown>,
  ): void {
    if (this.markers.has(state)) return
    this.markers.set(state, {
      state,
      monoTs,
      ...(evidence === undefined ? {} : { evidence }),
    })
  }

  observe(observation: InteractionReadinessObservation, monoTs: number): void {
    this.lastObservation = observation
    Object.assign(this.evidence, observation.detail ?? {})

    if (observation.processCreated === true) {
      this.mark('PROCESS_CREATED', monoTs, compact({ pid: observation.processId }))
    }
    if (observation.osScheduled === true) {
      this.mark(
        'OS_SCHEDULED',
        monoTs,
        compact({
          pid: observation.processId,
          processState: observation.processState,
          cpuTicks: observation.cpuTicks,
        }),
      )
    }
    if (observation.appLifecycleReady === true) {
      this.mark('APP_LIFECYCLE_READY', monoTs, compact({ screen: observation.currentScreen }))
    }
    if (observation.uiVisible === true) {
      this.mark('UI_VISIBLE', monoTs, compact({ screen: observation.currentScreen }))
    }

    const resolution = observation.targetResolution
    if (resolution !== undefined && resolution !== null) {
      // A tree generation tied to the current, visible screen proves a11y has
      // synchronized even when the target is absent or not yet actionable.
      if (typeof resolution.treeGen === 'number' && observation.uiVisible === true) {
        this.mark('A11Y_SYNCHRONIZED', monoTs, {
          treeGen: resolution.treeGen,
          outcome: resolution.outcome,
        })
      }
      if (isActionableResolution(resolution) && observation.uiVisible === true) {
        this.mark('UI_ACTIONABLE', monoTs, {
          treeGen: resolution.treeGen,
          target: resolution.fingerprint.selector.value,
        })
      }
    }

    if (observation.sdkReady === true) {
      this.mark('SDK_READY', monoTs, compact({ sessionId: observation.sessionId }))
    }
  }

  ready(): boolean {
    return INTERACTION_READINESS_BOUNDARIES.every((state) => this.markers.has(state))
  }

  deadlineMonoTs(): number {
    return this.startedMonoTs + this.deadlineMs
  }

  trace(endedMonoTs: number, forceStopConfirmed = true): InteractionReadinessTrace {
    if (!forceStopConfirmed) {
      return this.build(
        endedMonoTs,
        'NOT_EVALUATED',
        'FORCE_STOP_NOT_CONFIRMED',
        'PROCESS_TERMINATED',
      )
    }
    if (this.ready()) return this.build(endedMonoTs, 'INTERACTION_READY', null, null)

    const firstUnmet = INTERACTION_READINESS_BOUNDARIES.find((state) => !this.markers.has(state)) ?? null
    return this.build(
      endedMonoTs,
      'INTERACTION_NOT_READY',
      classifyFirstUnmet(firstUnmet, this.lastObservation),
      firstUnmet,
    )
  }

  private build(
    endedMonoTs: number,
    status: InteractionReadinessTrace['status'],
    failureClass: InteractionReadinessTrace['failureClass'],
    firstUnmet: InteractionReadinessTrace['firstUnmet'],
  ): InteractionReadinessTrace {
    return {
      version: 1,
      status,
      startedMonoTs: this.startedMonoTs,
      endedMonoTs,
      deadlineMs: this.deadlineMs,
      failureClass,
      firstUnmet,
      completed: INTERACTION_READINESS_BOUNDARIES.flatMap((state) => {
        const marker = this.markers.get(state)
        return marker === undefined ? [] : [marker]
      }),
      pending: INTERACTION_READINESS_BOUNDARIES.filter((state) => !this.markers.has(state)),
      supportingEvidence: {
        ...this.evidence,
        ...compact({
          processId: this.lastObservation.processId,
          processState: this.lastObservation.processState,
          cpuTicks: this.lastObservation.cpuTicks,
          currentScreen: this.lastObservation.currentScreen,
          targetOutcome: this.lastObservation.targetResolution?.outcome,
          treeGen: this.lastObservation.targetResolution?.treeGen,
          targetActionability: summarizeTargetActionability(this.lastObservation.targetResolution),
          sessionId: this.lastObservation.sessionId,
        }),
      },
    }
  }
}

export interface ObserveInteractionReadinessInput {
  tracker: InteractionReadinessTracker
  sample: () => Promise<InteractionReadinessObservation>
  monoClock: () => number
  intervalMs?: number
  wait?: (ms: number) => Promise<void>
}

/** Event/probe-driven bounded wait. Timeout chooses no class; the first unmet invariant does. */
export async function observeInteractionReadiness(
  input: ObserveInteractionReadinessInput,
): Promise<InteractionReadinessTrace> {
  const intervalMs = input.intervalMs ?? 250
  const wait = input.wait ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)))
  const deadline = input.tracker.deadlineMonoTs()

  while (input.monoClock() <= deadline) {
    const cycleStarted = input.monoClock()
    input.tracker.observe(await input.sample(), input.monoClock())
    if (input.tracker.ready()) return input.tracker.trace(input.monoClock())

    const remaining = deadline - input.monoClock()
    if (remaining <= 0) break
    const spent = input.monoClock() - cycleStarted
    await wait(Math.min(remaining, Math.max(0, intervalMs - spent)))
  }
  return input.tracker.trace(input.monoClock())
}

export function isActionableResolution(resolution: TargetResolutionEvidence): boolean {
  const node = resolution.node
  if (resolution.outcome !== 'RESOLVED_UNIQUE' || node === undefined) return false
  if (node.visible !== true || node.enabled !== true) return false
  if (node.bounds === BRIDGE_NOT_MEASURED) return false
  if (node.bounds.right <= node.bounds.left || node.bounds.bottom <= node.bounds.top) return false
  return node.obscuredBy.length === 0
}

function summarizeTargetActionability(
  resolution: TargetResolutionEvidence | null | undefined,
): Record<string, unknown> | undefined {
  if (resolution === null || resolution === undefined) return undefined
  const node = resolution.node
  if (node === undefined) {
    return { outcome: resolution.outcome, actionable: false, reason: 'NO_NODE' }
  }
  const boundsMeasured = node.bounds !== BRIDGE_NOT_MEASURED
  const bounds =
    node.bounds === BRIDGE_NOT_MEASURED
      ? undefined
      : {
          left: node.bounds.left,
          top: node.bounds.top,
          right: node.bounds.right,
          bottom: node.bounds.bottom,
        }
  const nonEmptyBounds =
    node.bounds !== BRIDGE_NOT_MEASURED &&
    node.bounds.right > node.bounds.left &&
    node.bounds.bottom > node.bounds.top
  const actionable =
    resolution.outcome === 'RESOLVED_UNIQUE' &&
    node.visible === true &&
    node.enabled === true &&
    nonEmptyBounds &&
    node.obscuredBy.length === 0
  const reason =
    resolution.outcome !== 'RESOLVED_UNIQUE'
      ? 'NOT_UNIQUE'
      : node.visible !== true
        ? 'NOT_VISIBLE'
        : node.enabled !== true
          ? 'NOT_ENABLED'
          : !boundsMeasured
            ? 'BOUNDS_NOT_MEASURED'
            : !nonEmptyBounds
              ? 'EMPTY_BOUNDS'
              : node.obscuredBy.length > 0
                ? 'OBSCURED'
                : null

  return compact({
    outcome: resolution.outcome,
    actionable,
    reason,
    visible: node.visible,
    enabled: node.enabled,
    clickable: node.clickable,
    boundsMeasured,
    bounds,
    obscuredByCount: node.obscuredBy.length,
    className: node.className,
    packageName: node.packageName,
  })
}

function classifyFirstUnmet(
  boundary: InteractionReadinessBoundary | null,
  observation: InteractionReadinessObservation,
): PreActionFailureClass {
  switch (boundary) {
    case 'PROCESS_TERMINATED':
      return 'FORCE_STOP_NOT_CONFIRMED'
    case 'PROCESS_CREATED':
      return 'PROCESS_NOT_STARTED'
    case 'OS_SCHEDULED':
      return observation.processCreated === true ? 'COLD_START_OS_SUSPEND' : 'PROCESS_NOT_STARTED'
    case 'APP_LIFECYCLE_READY':
    case 'UI_VISIBLE':
      return 'APP_NOT_READY'
    case 'A11Y_SYNCHRONIZED':
      return 'A11Y_SYNC_PENDING'
    case 'UI_ACTIONABLE':
      return 'UI_NOT_ACTIONABLE'
    case 'SDK_READY':
      return 'SDK_NOT_READY'
    default:
      return 'UNCLASSIFIED'
  }
}

function compact(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== null))
}
