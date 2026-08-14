/**
 * BridgeFlow execution queue — the only path from an accepted Verdict run start
 * to a real execution.
 *
 * The queue used to build an executor with a stubbed bridge (`act` returning a
 * constant FAILED), no condition context, no variables, no oracle and no
 * generic-step runtime. That executes in the sense that it terminates: every
 * BRIDGE_ACTION failed, every wait timed out, and every CONDITION stopped the
 * run because `evaluateConditionStep` refuses to branch without a context.
 * This file now assembles the real ports.
 *
 * Failure modes stay distinguishable. A device whose Bridge preflight fails is
 * `BLOCKED` with the preflight remediation, not `FAILED`: the workflow was never
 * exercised, and recording it as a product failure would put a device problem
 * into the run's verdict.
 */

import { execFile } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { promisify } from 'node:util'
import { BridgeFlowExecutor, createInMemoryMutationAdmission } from '@nesy/bridgeflow-executor'
import type { PrismaClient } from '@nesy/db'
import type { DomainPackBundle, LaunchProfile } from '@nesy/domain-pack-contracts'
import type { NormalizedEvidenceFact } from '@nesy/oracle-engine'
import { getAdbPathHint, resolveAdbPath } from '@nesy/platform-paths'

import type { WorkflowRunExecutionQueue } from './workflow-run.service.js'
import type { CompiledPlanStore } from './workflow-compile.service.js'
import { PrismaExecutionPersistence } from './bridgeflow-prisma-persistence.js'
import { BridgeUnavailableError, type BridgeDeviceManager } from './bridge-device-manager.js'
import { BridgeDeviceGate } from './bridge-device-gate.js'
import { createAdbFacade, resolveDeviceGatePolicy } from './bridge-adb-facade.js'
import { BridgeFlowRunContext } from './bridgeflow-run-context.js'
import { createBridgeRuntimePort, createGenericStepRuntime } from './bridgeflow-device-ports.js'
import { createPackRemoteStepRuntime } from './bridgeflow-remote-steps.js'
import { createNesyBackofficeAdapter, type BackofficeAdapter } from './nesy-backoffice-adapter.js'
import { getDashboardAdminToken } from './nesy-admin-token.js'
import { getBridgeFlowEvidenceRuntime } from './bridgeflow-evidence-runtime.js'
import { getSdkObservationStore } from './sdk-observation-store.js'
import { deriveFacts } from './derived-fact-engine.js'
import { createControlExecutor } from '@nesy/control-channels/node'
import type { ControlExecutor } from '@nesy/control-contract'
import {
  getScreenReadinessObserver,
  type ScreenReadinessObserver,
} from './screen-readiness-observer.js'
import {
  InteractionReadinessTracker,
  observeInteractionReadiness,
  type InteractionReadinessTrace,
} from './cold-start-readiness.js'
import { buildTargetFingerprint } from './bridgeflow-target-fingerprint.js'
import { OracleEvaluationWorker } from './oracle-evaluation-worker.js'
import { publishRunLiveEvent, runLiveKeys, runLiveLevelFor } from './run-live-hub.js'
import { resolveDomainPack, type DomainPackResolution } from './domain-pack-registry.js'
import { DeviceWorkerRegistry } from './device-worker.js'
import { PrismaRemoteActionAttemptStore } from './phase6-prisma-stores.js'
import { createRunTelemetrySampler } from './run-telemetry-sampler.js'
import { getVerdictDurableRuntime } from './verdict-wait-event.js'
import {
  broadcastSetRun,
  getDeviceHealth,
  getDeviceBridgeState,
  setRunIdProperty,
  type DeviceBridgeState,
} from './test-event-bridge.js'
import {
  isNesyDashboardCountry,
  isNesyEnvironment,
  resolveBaseUrl,
  type NesyDashboardCountry,
  type NesyEnvironment,
} from '../nesy-env.js'

type QueueItem = Parameters<WorkflowRunExecutionQueue['enqueue']>[0]
type RemoteStepRuntime = ReturnType<typeof createPackRemoteStepRuntime>

const execFileAsync = promisify(execFile)
const UI_FACT_MAX_AGE_MS = 5_000
/** An app/local session observation stays usable this long; the requirement's own deadline governs waiting. */
const SDK_FACT_MAX_AGE_MS = 30_000

/**
 * Back-office credentials from the environment.
 *
 * Unset means unconfigured, and every remote operation then fails closed naming
 * that — which is the correct outcome. Inventing a host would send a dispatcher
 * mutation somewhere nobody chose.
 */
function createEnvBackofficeAdapter(): BackofficeAdapter {
  return createNesyBackofficeAdapter({
    credentials: async () => {
      const configuredCountry = process.env.NESY_REMOTE_ACTION_COUNTRY?.trim() ?? 'RS'
      const configuredEnv = process.env.NESY_REMOTE_ACTION_ENV?.trim() ?? 'stage'
      const country: NesyDashboardCountry = isNesyDashboardCountry(configuredCountry)
        ? configuredCountry
        : 'RS'
      const environment: NesyEnvironment = isNesyEnvironment(configuredEnv)
        ? configuredEnv
        : 'stage'
      const token = process.env.NESY_BACKOFFICE_TOKEN?.trim() || await getDashboardAdminToken(country, environment)
      return {
        baseUrl: process.env.NESY_BACKOFFICE_BASE_URL?.trim() || resolveBaseUrl(country, environment),
        token: token ?? '',
      }
    },
    // Without this the only trace of a back-office call was the attempt row's
    // status, so "SUCCEEDED but published no fact" had to be reproduced by hand
    // to find out what the backend actually answered. Fields the operation
    // declared sensitive are already redacted by the adapter.
    audit: (record) => {
      console.info(
        `[NesyBackoffice] ${record.operationRef} ${record.path} → ${record.status}` +
          ` resultCode=${record.resultCode ?? 'none'} in ${record.durationMs}ms`,
        { request: record.request, response: record.response },
      )
    },
  })
}

/**
 * Render a thrown value as one readable line.
 *
 * `error.message` alone drops the `cause` chain, and that chain is usually where
 * the actionable half lives: a `BridgeHostError` says "act failed", its cause
 * says "handshake did not answer within 15000ms". Reporting only the outer
 * message turns a diagnosable device problem into a generic step failure.
 */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const chain: string[] = []
  let current: Error | undefined = error
  const seen = new Set<Error>()
  while (current !== undefined && !seen.has(current)) {
    seen.add(current)
    const name = current.name && current.name !== 'Error' ? `${current.name}: ` : ''
    chain.push(`${name}${current.message}`)
    const cause: unknown = current.cause
    current = cause instanceof Error ? cause : undefined
  }
  return chain.join(' ← ')
}

function adbBinary(): string {
  const resolved = resolveAdbPath()
  if (resolved === null) {
    throw new Error(`adb binary not found. ${getAdbPathHint()}`)
  }
  return resolved
}

async function adbDevice(deviceId: string, args: string[], timeoutMs = 10_000): Promise<string> {
  const result = await execFileAsync(adbBinary(), ['-s', deviceId, ...args], {
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024,
  })
  return String(result.stdout).trim()
}

interface AndroidLaunchObservation {
  processCreated: boolean
  processId: number | null
  processState: string | null
  cpuTicks: number | null
  appLifecycleReady: boolean
  uiVisible: boolean
  rawActivity: string
  rawWindow: string
}

function parsePidList(stdout: string): number[] {
  return stdout
    .trim()
    .split(/\s+/)
    .map((value) => Number(value))
    .filter((value) => Number.isSafeInteger(value) && value > 0)
}

async function packageProcessIds(deviceId: string, applicationId: string): Promise<number[]> {
  try {
    return parsePidList(await adbDevice(deviceId, ['shell', 'pidof', applicationId]))
  } catch (error) {
    const detail = `${describeError(error)} ${String((error as { stderr?: unknown }).stderr ?? '')}`
    // `pidof` exits non-zero when the process is absent; that is the successful
    // observation this probe is asking for. Transport/device errors are not
    // absence and must not let a disconnected DUT "confirm" force-stop.
    if (/device .*not found|device offline|no devices|unauthorized|cannot connect to daemon/i.test(detail)) {
      throw error
    }
    return []
  }
}

async function forceStopAndConfirm(input: {
  deviceId: string
  applicationId: string
  deadlineMs?: number
  intervalMs?: number
}): Promise<{ confirmed: boolean; previousPids: number[]; remainingPids: number[] }> {
  const previousPids = await packageProcessIds(input.deviceId, input.applicationId)
  await adbDevice(input.deviceId, ['shell', 'am', 'force-stop', input.applicationId])

  const deadline = performance.now() + (input.deadlineMs ?? 5_000)
  let nextForceStopAt = performance.now() + 500
  let remainingPids = previousPids
  do {
    remainingPids = await packageProcessIds(input.deviceId, input.applicationId)
    if (remainingPids.length === 0) return { confirmed: true, previousPids, remainingPids }
    const now = performance.now()
    if (now >= nextForceStopAt) {
      await adbDevice(input.deviceId, ['shell', 'am', 'force-stop', input.applicationId])
      nextForceStopAt = now + 500
    }
    await sleep(input.intervalMs ?? 100)
  } while (performance.now() <= deadline)

  return { confirmed: false, previousPids, remainingPids }
}

async function launchApplication(deviceId: string, applicationId: string): Promise<void> {
  await adbDevice(
    deviceId,
    ['shell', 'monkey', '-p', applicationId, '-c', 'android.intent.category.LAUNCHER', '1'],
    15_000,
  )
}

async function observeAndroidLaunch(
  deviceId: string,
  applicationId: string,
): Promise<AndroidLaunchObservation> {
  const pids = await packageProcessIds(deviceId, applicationId)
  const processId = pids[0] ?? null
  const [stat, activity, window] = await Promise.all([
    processId === null
      ? Promise.resolve('')
      : adbDevice(deviceId, ['shell', 'cat', `/proc/${String(processId)}/stat`]).catch(() => ''),
    adbDevice(deviceId, ['shell', 'dumpsys', 'activity', 'activities']).catch(() => ''),
    adbDevice(deviceId, ['shell', 'dumpsys', 'window']).catch(() => ''),
  ])
  const statMatch = /^\d+\s+\(.+\)\s+(\S)\s+(?:\S+\s+){10}(\d+)\s+(\d+)/.exec(stat.trim())
  const processState = statMatch?.[1] ?? null
  const cpuTicks = statMatch === null ? null : Number(statMatch[2]) + Number(statMatch[3])
  const activityLines = activity
    .split('\n')
    .filter((line) => line.includes('mResumedActivity') || line.includes('topResumedActivity'))
    .join(' ')
  const windowLines = window
    .split('\n')
    .filter(
      (line) =>
        line.includes('mCurrentFocus') ||
        line.includes('mFocusedApp') ||
        line.includes('mFocusedWindow') ||
        (line.includes('visible windows') && line.includes(applicationId)),
    )
    .join(' ')

  return {
    processCreated: processId !== null,
    processId,
    processState,
    cpuTicks: Number.isFinite(cpuTicks) ? cpuTicks : null,
    appLifecycleReady: activityLines.includes(applicationId),
    uiVisible: windowLines.includes(applicationId),
    rawActivity: activityLines,
    rawWindow: windowLines,
  }
}

function findLaunchProfile(resolution: DomainPackResolution, profileKey: string | null | undefined): LaunchProfile | undefined {
  const key = profileKey?.trim()
  if (!key || !resolution.ok) return undefined
  return resolution.pack.bundle.registries.launchProfiles.find((profile) => profile.profileKey === key)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function readDeviceStateWithRetry(input: {
  deviceId: string
  applicationId: string
  runId: string
  /** Cold start needs a longer window: monkey returns before LoginFragment is up. */
  deadlineMs?: number
  intervalMs?: number
}): Promise<DeviceBridgeState | null> {
  const deadlineMs = input.deadlineMs ?? 1_500
  const intervalMs = input.intervalMs ?? 300
  const deadline = Date.now() + deadlineMs
  let last: DeviceBridgeState | null = null
  while (Date.now() <= deadline) {
    const startedAt = Date.now()
    last = await getDeviceBridgeState(input.deviceId, input.applicationId).catch(() => null)
    if (last?.runId === input.runId && last.currentScreen.trim() !== '') return last
    // The call is not free — measured at ~129ms, of which ~54ms is the `adb shell`
    // fork alone — so it already spaces the loop. Sleeping the full interval on top
    // of it overshoots readiness by up to a whole cycle, and it does so at the worst
    // possible moment: a call that ran long is a call that just crossed the Bridge's
    // cold-start stall, which is exactly when the screen is about to appear. Measured
    // on a real device: the slow poll returns not-ready and the very next one
    // succeeds in 24ms. So spend the interval, not interval + call.
    const remainingInterval = intervalMs - (Date.now() - startedAt)
    if (remainingInterval <= 0) continue
    if (Date.now() + remainingInterval > deadline) break
    await sleep(remainingInterval)
  }
  return last
}

export function screenMatchesScreenName(
  screen: DomainPackBundle['registries']['screens'][number],
  currentScreen: string,
): boolean {
  const current = currentScreen.trim()
  if (current === '') return false
  const runtime = screen.runtimeImplementation
  if (runtime.kind === 'FRAGMENT') return current === runtime.fragmentTag
  if (runtime.kind === 'COMPOSE') return current === runtime.routeKey
  if (runtime.kind === 'ACTIVITY') return current === runtime.componentName || current.endsWith(`/${runtime.componentName}`)
  return false
}

/**
 * Can the mere appearance of a screen settle this fact?
 *
 * A screen's `readiness.requiredFactKeys` is a list of everything that must hold
 * before the screen counts as ready, and only some of those are things the screen
 * itself demonstrates. `nesy.route.stop-list` requires `UI.ROUTE_LIST_READY` AND
 * `APP.AVAILABLE_STOPS_LOADED`; the first is what the device showing that screen
 * proves, the second is a backend projection (`plane: APP`, `kind: NAMED_QUERY`)
 * that a rendered screen says nothing about. Publishing both would manufacture
 * evidence that the stops were loaded, which is exactly the kind of fabricated
 * fact an oracle must never be handed.
 */
function isScreenObservableFact(bundle: DomainPackBundle, factKey: string): boolean {
  return bundle.registries.evidenceSources.some(
    (source) => source.factKey === factKey && source.plane === 'UI' && source.kind === 'BRIDGE_WATCH',
  )
}

/**
 * Publishes `UI.*_READY` for whatever screen the device is on RIGHT NOW, into the
 * scope of the occurrence that is asking.
 *
 * ## Why this is called from the evidence port and not once before the run
 *
 * It used to be a single pre-run publish with the occurrence id
 * `<runId>:wait-login-ready:0` written into the call. That hardcoding made it work
 * for exactly one step of exactly one workflow, and even there only if the first
 * evaluation landed inside the 5s freshness window — on a cold start it never did.
 * Driving it from `factsForOccurrence` instead makes the correlation tuple come
 * from the executor's own context, so it is right by construction for every step,
 * every workflow and every FOR_EACH iteration.
 *
 * ## Why `observedAtMs` is now and not the event's timestamp
 *
 * This is a STATE, not an event: the device sends `SCREEN_READY` /
 * `SCREEN_EXITED` while the UI settles and then goes quiet, so the last
 * transition is what holds until the next one. Stamping the transition's own time
 * would let a screen that is still up go stale after `UI_FACT_MAX_AGE_MS` and fail
 * the wait — which is the bug this replaces. The claim being made is "as of now,
 * the device's last transition says this screen is ready", and `subtype`
 * `SDK_STATE_SCREEN` is exactly that claim.
 */
/**
 * Republishes what `SDK_QUERY` steps observed into the scope of the occurrence
 * that is asking — the same correlation-at-question-time move
 * [publishLiveScreenReadiness] makes, and for the same reason: the observation
 * happens in one step, the oracle that needs it lives in another, and evidence is
 * scoped per occurrence.
 *
 * `observedAtMs` is carried through from the original read rather than restamped,
 * so an observation that has gone stale expires instead of being renewed forever.
 */
/**
 * Installs the precondition a launch profile PROMISES.
 *
 * `preparationOperationRefs` existed only in the contract, its validation and a
 * read model — nothing ever invoked it. Every `PREPARED_SESSION` and
 * `DIRECT_STATE` profile was therefore inert: a workflow whose slice declares
 * "starts from a signed-in app" was launched against whatever state the device
 * happened to be in, and died on its first wait. Login was the only workflow that
 * did not notice, because it is the one that creates its own precondition.
 *
 * Failure is the CALLER's to escalate as BLOCKED, never as a product failure: a
 * precondition that could not be installed means the workflow was never
 * exercised, and recording that as a defect would put a lab problem into the
 * product's verdict.
 */
async function applyLaunchPreparation(input: {
  controlExecutor: ControlExecutor
  deviceId: string
  runId: string
  profile: LaunchProfile
  logger?: (message: string, detail?: unknown) => void
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const refs = input.profile.preparationOperationRefs ?? []
  if (refs.length === 0) return { ok: true }

  for (const [index, operationRef] of refs.entries()) {
    const result = await input.controlExecutor.run(input.deviceId, {
      op: 'seed',
      verb: operationRef,
      // The operations default their own parameters (`prepareSession` marks the
      // session logged in unless told otherwise). Passing nothing keeps the pack
      // the only place that decides WHICH preparation runs, and the app the only
      // place that decides what it means.
      params: {},
      requestId: `${input.runId}-prep-${String(index)}`,
      scope: input.runId,
    })
    if (!result.ok) {
      return {
        ok: false,
        reason:
          `launch profile "${input.profile.profileKey}" could not install its precondition: ` +
          `operation "${operationRef}" answered ${result.code}`,
      }
    }
    input.logger?.('[BridgeFlowExecutionQueue] launch preparation applied', {
      runId: input.runId,
      operationRef,
    })
  }
  return { ok: true }
}

/** Fact keys are plane-prefixed by contract; the prefix is the authority on plane. */
function planeOf(factKey: string): NormalizedEvidenceFact['plane'] {
  if (factKey.startsWith('LOCAL.')) return 'LOCAL'
  if (factKey.startsWith('REMOTE.')) return 'REMOTE'
  if (factKey.startsWith('UI.')) return 'UI'
  return 'APP'
}

// Exported for `bridgeflow-oracle-evidence-visibility.test.ts`. The "a fact
// produced by one step reaches a later step's Final Oracle" invariant lives in
// these two helpers and nowhere else, and it has broken silently twice; a test
// that re-implemented them would keep passing through the third break.
export function publishSdkObservations(input: {
  evidenceRuntime: ReturnType<typeof getBridgeFlowEvidenceRuntime>
  observations: ReturnType<typeof getSdkObservationStore>
  runId: string
  occurrenceId: string
  iterationKey: string
}): void {
  const scope = {
    runId: input.runId,
    occurrenceId: input.occurrenceId,
    iterationKey: input.iterationKey,
  }
  let revision = input.evidenceRuntime.latestRevision(scope)
  for (const observation of input.observations.current(input.runId)) {
    revision += 1
    input.evidenceRuntime.publish({
      runId: input.runId,
      revision,
      lane: 'ORDERED_REQUIRED',
      correlationStatus: 'CORRELATED',
      trust: 'RESOLVER_ACCEPTED',
      // This run made the observation, so the run admitted it when it was made.
      // Re-judging it here would refuse every observation older than the window
      // simply for having been carried to a later occurrence.
      acceptedAtMs: observation.observedAtMs,
      fact: {
        factKey: observation.factKey,
        occurrenceId: input.occurrenceId,
        iterationKey: input.iterationKey,
        observedAtMs: observation.observedAtMs,
        freshnessMaxAgeMs: SDK_FACT_MAX_AGE_MS,
        // The pack's evidence source owns the plane, and the fact key prefix is
        // what carries it. All three planes travel this path: `nesy.db.session`
        // is LOCAL, `nesy.sessionState` is APP, and a back-office read is REMOTE.
        plane: planeOf(observation.factKey),
        subtype: observation.queryRef,
        value: observation.value,
        authority: 'PRIMARY',
        deliveryLane: 'ORDERED_REQUIRED',
        ...(observation.correlationValue === undefined
          ? {}
          : { correlationValue: observation.correlationValue }),
      } satisfies NormalizedEvidenceFact,
    })
  }
}

/**
 * Publishes the pack's derived conclusions as evidence.
 *
 * On BOTH lanes, deliberately. Continue gates read `RECEIPT_SAFE` and the final
 * oracle reads `ORDERED_REQUIRED`, so a conclusion published to one lane is
 * missing from the other — and the wrong-row guard (`APP.ACTIVE_STOP_MATCHES`)
 * is exactly the kind of derived fact a GATE has to see before the run walks
 * further into the wrong record.
 *
 * `reducerTrace` travels with the fact: a conclusion without its derivation is an
 * assertion nobody can re-litigate six months later.
 */
export function publishDerivedFacts(input: {
  evidenceRuntime: ReturnType<typeof getBridgeFlowEvidenceRuntime>
  derived: readonly NormalizedEvidenceFact[]
  runId: string
  occurrenceId: string
  iterationKey: string
}): void {
  if (input.derived.length === 0) return
  const scope = {
    runId: input.runId,
    occurrenceId: input.occurrenceId,
    iterationKey: input.iterationKey,
  }
  let revision = input.evidenceRuntime.latestRevision(scope)
  for (const lane of ['ORDERED_REQUIRED', 'RECEIPT_SAFE'] as const) {
    for (const fact of input.derived) {
      revision += 1
      input.evidenceRuntime.publish({
        runId: input.runId,
        revision,
        lane,
        correlationStatus: 'CORRELATED',
        trust: 'RESOLVER_ACCEPTED',
        // A conclusion is as ADMITTED as the observations it was drawn from.
        // Without this the derived fact was stamped with its inputs'
        // `observedAtMs` but admitted at `now()`, so every derivation performed
        // more than one freshness window after its inputs was published and then
        // immediately filtered back out — the same aging-in-transit failure that
        // `publishSdkObservations` fixes above, still live on the derived path.
        // The oracle saw `APP.TOUR_APPROVAL_REQUESTED` and `REMOTE.TOUR_APPROVED`
        // and not the conclusion joining them, which is the one fact the
        // requirement names.
        acceptedAtMs: fact.observedAtMs,
        fact: { ...fact, deliveryLane: lane },
      })
    }
  }
}

function publishLiveScreenReadiness(input: {
  bundle: DomainPackBundle
  evidenceRuntime: ReturnType<typeof getBridgeFlowEvidenceRuntime>
  observer: Pick<ScreenReadinessObserver, 'current'>
  runId: string
  occurrenceId: string
  iterationKey: string
  clock: () => number
}): void {
  const state = input.observer.current(input.runId)
  // `ready: false` means the device left the screen. Publishing nothing then is
  // deliberate: a wait must keep waiting, and there is no "not ready" fact to
  // assert — absence is what the oracle reads as unmet.
  if (state === undefined || !state.ready) return

  const revisionBase = input.evidenceRuntime.latestRevision({
    runId: input.runId,
    occurrenceId: input.occurrenceId,
    iterationKey: input.iterationKey,
  })
  let revision = revisionBase + 1
  for (const screen of input.bundle.registries.screens) {
    if (!screenMatchesScreenName(screen, state.screen)) continue
    for (const factKey of screen.readiness.requiredFactKeys.filter((key) =>
      isScreenObservableFact(input.bundle, key),
    )) {
      input.evidenceRuntime.publish({
        runId: input.runId,
        revision,
        lane: 'RECEIPT_SAFE',
        correlationStatus: 'CORRELATED',
        trust: 'RESOLVER_ACCEPTED',
        fact: {
          factKey,
          occurrenceId: input.occurrenceId,
          iterationKey: input.iterationKey,
          observedAtMs: input.clock(),
          freshnessMaxAgeMs: UI_FACT_MAX_AGE_MS,
          plane: 'UI',
          subtype: 'SDK_STATE_SCREEN',
          value: true,
          authority: 'PRIMARY',
          deliveryLane: 'RECEIPT_SAFE',
          rawEventId: `sdk-state:${input.runId}:${screen.screenKey}:${factKey}`,
        } satisfies NormalizedEvidenceFact,
      })
      revision += 1
    }
  }
}

export interface BridgeFlowExecutionQueueOptions {
  prisma: PrismaClient
  planStore: CompiledPlanStore
  logger?: (message: string, detail?: unknown) => void
  clock?: () => number
  /** Test seam: acquire the device Bridge for a run. */
  acquireBridge?: (input: {
    deviceId: string
    runId: string
    executionId: string
  }) => Promise<BridgeDeviceManager>
  /** Test seam: override the whole REMOTE_ACTION runtime. */
  remoteRuntime?: RemoteStepRuntime
  /** Test seam: back-office transport. Defaults to the env-configured adapter. */
  backofficeAdapter?: BackofficeAdapter
  /** Test seam: resolve the pinned domain pack. */
  resolvePack?: (input: {
    packKey: string
    packVersion: string
    packDigest?: string
  }) => DomainPackResolution
  /** Test seam: the attached/allowlisted/not-production check that gates the launch. */
  admissionGate?: (deviceId: string) => Promise<{ ok: true } | { ok: false; reason: string }>
  /** Test seams for the G90.2b pre-action state machine. */
  monoClock?: () => number
  readinessDeadlineMs?: number
  forceStop?: typeof forceStopAndConfirm
  launch?: typeof launchApplication
  observeLaunch?: typeof observeAndroidLaunch
  readDeviceState?: typeof getDeviceBridgeState
  readDeviceHealth?: typeof getDeviceHealth
  setRunId?: typeof setRunIdProperty
  broadcastRun?: typeof broadcastSetRun
}

function readinessTarget(input: {
  bundle: DomainPackBundle
  plan: unknown
  profile: LaunchProfile
}) {
  const expectedScreen = input.bundle.registries.screens.find(
    (screen) => screen.screenKey === input.profile.entry.expectedScreenRef,
  )
  const steps = Array.isArray((input.plan as { steps?: unknown }).steps)
    ? ((input.plan as { steps: readonly Record<string, unknown>[] }).steps)
    : []
  const firstResolve = steps.find((step) => step['kind'] === 'RESOLVE_TARGET')
  const params = firstResolve?.['params']
  const targetRef =
    params !== null && typeof params === 'object' && typeof (params as Record<string, unknown>)['targetRef'] === 'string'
      ? String((params as Record<string, unknown>)['targetRef'])
      : null
  const target =
    targetRef === null
      ? undefined
      : input.bundle.registries.targets.find((candidate) => candidate.targetKey === targetRef)
  const targetOnExpectedScreen =
    target !== undefined && expectedScreen !== undefined && target.screenRef === expectedScreen.screenKey
      ? target
      : undefined
  const fingerprint =
    targetOnExpectedScreen === undefined ? undefined : buildTargetFingerprint(targetOnExpectedScreen)
  return { expectedScreen, target: targetOnExpectedScreen, fingerprint }
}

async function acquireBridgeFromRegistry(input: {
  deviceId: string
  runId: string
  executionId: string
}): Promise<BridgeDeviceManager> {
  const worker = DeviceWorkerRegistry.getOrCreate(input.deviceId)
  return worker.acquireBridge(input.runId, input.executionId, Date.now())
}

/**
 * Bridge acquisition failure → the run's termination reason.
 *
 * Shared by both acquisition paths (awaited up front for a warm start, collected
 * after the launch for a cold one) so the two cannot drift into reporting the
 * same failure differently. `BridgeUnavailableError` carries the remediation, and
 * dropping it is what left the earlier version of this reporting a bare message
 * that named no fix.
 */
function describeBridgeAcquisitionFailure(error: unknown): string {
  if (error instanceof BridgeUnavailableError) return `${error.message} — ${error.failure.remediation}`
  return error instanceof Error ? error.message : String(error)
}

/**
 * The subset of preflight that must answer BEFORE the app is touched.
 *
 * `acquireBridge` runs the full preflight, but it now runs concurrently with the
 * app's cold start, so the checks that decide whether this process may drive the
 * device at all have to be pulled ahead of the launch. Everything else in
 * preflight only describes the device; these three refuse it.
 */
async function admissionGateFromRegistry(
  deviceId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const gate = new BridgeDeviceGate(createAdbFacade(), resolveDeviceGatePolicy())
  const result = await gate.admissionGate(deviceId)
  if (result.ok) return { ok: true }
  return { ok: false, reason: `${result.failure.detail} — ${result.failure.remediation}` }
}

export class BridgeFlowExecutionQueue implements WorkflowRunExecutionQueue {
  private readonly pending: QueueItem[] = []
  private processing = false

  constructor(private readonly options: BridgeFlowExecutionQueueOptions) {}

  enqueue(input: QueueItem): void {
    this.pending.push(input)
    void this.drain()
  }

  private async drain(): Promise<void> {
    if (this.processing) return
    this.processing = true
    try {
      while (this.pending.length > 0) {
        const item = this.pending.shift()
        if (!item) continue
        await this.execute(item)
      }
    } finally {
      this.processing = false
    }
  }

  private async execute(item: QueueItem): Promise<void> {
    const plan = await this.options.planStore.get({
      planRef: item.compiledPlanRef,
      planHash: item.compiledPlanHash,
    })

    if (!plan) {
      await this.blockRun(item, 'compiled BridgeFlowPlan is not available in this API process')
      return
    }

    const resolvePack = this.options.resolvePack ?? resolveDomainPack
    const resolution = resolvePack({
      packKey: item.domainPackKey,
      packVersion: item.domainPackVersion,
      packDigest: item.domainPackDigest,
    })
    if (!resolution.ok) {
      await this.blockRun(item, resolution.message)
      return
    }

    const clock = this.options.clock ?? Date.now
    const applicationId = item.appId?.trim() || resolution.pack.bundle.registries.applications[0]?.packageIdentity
    if (applicationId === undefined || applicationId.trim() === '') {
      await this.blockRun(item, 'domain pack application package identity is missing')
      return
    }

    const requestedProfileKey = item.profileKey?.trim()
    const launchProfile = findLaunchProfile(resolution, requestedProfileKey)
    if (requestedProfileKey && launchProfile === undefined) {
      await this.blockRun(item, `launch profile ${requestedProfileKey} is not available in the pinned domain pack`)
      return
    }

    const coldStart = launchProfile?.startMode === 'COLD_START'

    const acquire = this.options.acquireBridge ?? acquireBridgeFromRegistry
    let manager: BridgeDeviceManager | null = null
    if (!coldStart) {
      try {
        manager = await acquire({
          deviceId: item.deviceId,
          runId: item.runId,
          executionId: item.executionId,
        })
      } catch (error) {
        await this.blockRun(item, describeBridgeAcquisitionFailure(error))
        return
      }
    }
    if (coldStart) {
      const admission = await (this.options.admissionGate ?? admissionGateFromRegistry)(item.deviceId)
      if (!admission.ok) {
        await this.blockRun(item, admission.reason)
        return
      }
    }

    // `setprop` must land BEFORE the process starts — the app reads the run id at
    // boot and will not pick up a later write.
    const propertySet = await (this.options.setRunId ?? setRunIdProperty)(item.deviceId, item.runId)
    let deviceState: DeviceBridgeState | null = null
    let sessionSet = false

    if (coldStart && launchProfile !== undefined) {
      if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/.test(applicationId)) {
        await this.blockRun(item, `application id ${applicationId} is not a package name`)
        return
      }

      const monoClock = this.options.monoClock ?? performance.now.bind(performance)
      const deadlineMs = this.options.readinessDeadlineMs ?? 45_000
      const tracker = new InteractionReadinessTracker(monoClock(), deadlineMs)
      let stopped: Awaited<ReturnType<typeof forceStopAndConfirm>>
      try {
        stopped = await (this.options.forceStop ?? forceStopAndConfirm)({
          deviceId: item.deviceId,
          applicationId,
        })
      } catch (error) {
        const trace = tracker.trace(monoClock(), false)
        await this.blockRun(
          item,
          `FORCE_STOP_NOT_CONFIRMED · ${describeError(error)}`,
          trace,
        )
        return
      }
      if (!stopped.confirmed) {
        const baseTrace = tracker.trace(monoClock(), false)
        const trace: InteractionReadinessTrace = {
          ...baseTrace,
          supportingEvidence: {
            ...baseTrace.supportingEvidence,
            previousPids: stopped.previousPids,
            remainingPids: stopped.remainingPids,
          },
        }
        await this.blockRun(item, 'FORCE_STOP_NOT_CONFIRMED · package process remained alive', trace)
        return
      }
      tracker.mark('PROCESS_TERMINATED', monoClock(), {
        previousPids: stopped.previousPids,
        packageProcessAbsent: true,
      })

      try {
        await (this.options.launch ?? launchApplication)(item.deviceId, applicationId)
      } catch (error) {
        const trace = tracker.trace(monoClock())
        await this.blockRun(item, `PROCESS_NOT_STARTED · launch failed: ${describeError(error)}`, trace)
        return
      }

      // Acquire only after the previous process is proven dead. Reusing a socket
      // handshaken against the process we just killed would make SDK_READY a lie.
      try {
        manager = await acquire({
          deviceId: item.deviceId,
          runId: item.runId,
          executionId: item.executionId,
        })
      } catch (error) {
        const trace = tracker.trace(monoClock())
        await this.blockRun(item, describeBridgeAcquisitionFailure(error), trace)
        return
      }

      sessionSet = await (this.options.broadcastRun ?? broadcastSetRun)(item.deviceId, applicationId, item.runId, {
        wsEnabled: true,
        wsPort: 8765,
      })

      const target = readinessTarget({
        bundle: resolution.pack.bundle,
        plan,
        profile: launchProfile,
      })
      if (target.expectedScreen === undefined || target.target === undefined || target.fingerprint === undefined) {
        const baseTrace = tracker.trace(monoClock())
        const trace: InteractionReadinessTrace = {
          ...baseTrace,
          failureClass: 'UNCLASSIFIED',
          supportingEvidence: {
            ...baseTrace.supportingEvidence,
            configurationError:
              'cold profile has no addressable first RESOLVE_TARGET on its expected screen',
          },
        }
        await this.blockRun(item, 'UNCLASSIFIED · cold-start actionability contract is missing', trace)
        return
      }
      const expectedScreen = target.expectedScreen
      const readinessTargetDefinition = target.target
      const readinessFingerprint = target.fingerprint

      const readState = this.options.readDeviceState ?? getDeviceBridgeState
      const readHealth = this.options.readDeviceHealth ?? getDeviceHealth
      const observeLaunch = this.options.observeLaunch ?? observeAndroidLaunch
      let firstCpuTicks: number | null = null
      let lastState: DeviceBridgeState | null = null
      const trace = await observeInteractionReadiness({
        tracker,
        monoClock,
        sample: async () => {
          const [android, state, health, targetResolution] = await Promise.all([
            observeLaunch(item.deviceId, applicationId),
            readState(item.deviceId, applicationId).catch(() => null),
            readHealth(item.deviceId, applicationId).catch(() => null),
            manager!.resolve(readinessFingerprint, { runId: item.runId }).catch(() => null),
          ])
          lastState = state
          if (firstCpuTicks === null && android.cpuTicks !== null) firstCpuTicks = android.cpuTicks
          const screenVisible =
            state !== null && screenMatchesScreenName(expectedScreen, state.currentScreen)
          const cpuAdvanced =
            android.cpuTicks !== null && firstCpuTicks !== null && android.cpuTicks > firstCpuTicks
          const osScheduled =
            android.processCreated &&
            (android.appLifecycleReady ||
              android.uiVisible ||
              cpuAdvanced ||
              (android.processState !== null && android.processState !== 'S'))
          const sdkReady =
            state?.runId === item.runId &&
            state.sessionId.trim() !== '' &&
            health?.wal !== undefined &&
            (health.wsAuth !== undefined || health.ws !== undefined) &&
            manager!.getCapabilities() !== null
          return {
            processCreated: android.processCreated,
            processId: android.processId,
            processState: android.processState,
            cpuTicks: android.cpuTicks,
            osScheduled,
            appLifecycleReady: android.appLifecycleReady || screenVisible,
            uiVisible: android.uiVisible && screenVisible,
            currentScreen: state?.currentScreen ?? null,
            targetResolution,
            sdkReady,
            sessionId: state?.sessionId ?? null,
            detail: {
              propertySet,
              sessionSet,
              expectedScreenRef: launchProfile.entry.expectedScreenRef,
              targetRef: readinessTargetDefinition.targetKey,
              walObserved: health?.wal !== undefined,
              wsAuthObserved: health?.wsAuth !== undefined,
              wsObserved: health?.ws !== undefined,
              rawActivity: android.rawActivity,
              rawWindow: android.rawWindow,
            },
          }
        },
      })
      deviceState = lastState
      await this.persistReadinessTrace(item, trace)
      this.publishReadiness(item.runId, trace)
      if (trace.status !== 'INTERACTION_READY') {
        await this.blockRun(
          item,
          `${trace.failureClass ?? 'UNCLASSIFIED'} · first unmet ${trace.firstUnmet ?? '<unknown>'}`,
          trace,
        )
        return
      }
    } else {
      sessionSet = await (this.options.broadcastRun ?? broadcastSetRun)(item.deviceId, applicationId, item.runId, {
        wsEnabled: true,
        wsPort: 8765,
      })
      deviceState = await readDeviceStateWithRetry({
        deviceId: item.deviceId,
        applicationId,
        runId: item.runId,
        deadlineMs: 5_000,
      })
      // The observed run fence is authoritative. Either control mechanism may
      // report a transport-level miss even though the other established the
      // session; conversely, two accepted sends without an observed runId are
      // not proof that the app adopted it.
      if (deviceState?.runId !== item.runId) {
        await this.blockRun(
          item,
          `SDK run session could not be established through Verdict control channel ` +
            `(setprop=${String(propertySet)}, broadcast=${String(sessionSet)}, observed=${deviceState?.runId || '<none>'})`,
        )
        return
      }
    }

    if (manager === null) {
      await this.blockRun(item, 'device Bridge was never acquired for this run')
      return
    }
    // One control channel for the whole run: launch preparation installs the
    // profile's precondition through it, the bridge port tells the app which
    // occurrence its emits belong to, and the generic-step runtime reads named
    // queries.
    const controlExecutor =
      applicationId === undefined ? undefined : createControlExecutor({ applicationId })
    const telemetrySampler =
      deviceState?.runId === item.runId && deviceState.sessionId.trim() !== ''
        ? createRunTelemetrySampler({
            prisma: this.options.prisma,
            runId: item.runId,
            sessionId: deviceState.sessionId,
            deviceId: item.deviceId,
            applicationId,
            clock,
            ...(this.options.logger === undefined ? {} : { logger: this.options.logger }),
          })
        : null

    // The launch profile's precondition is installed BEFORE the plan runs and
    // AFTER the run session exists — the operations are scoped to this run, and a
    // session prepared under no run would belong to nobody.
    if (launchProfile !== undefined && controlExecutor !== undefined) {
      const prepared = await applyLaunchPreparation({
        controlExecutor,
        deviceId: item.deviceId,
        runId: item.runId,
        profile: launchProfile,
        ...(this.options.logger === undefined ? {} : { logger: this.options.logger }),
      })
      if (!prepared.ok) {
        await telemetrySampler?.stop({ finalCapture: true })
        await this.blockRun(item, prepared.reason)
        return
      }
    }

    const evidenceRuntime = getBridgeFlowEvidenceRuntime()
    const sdkObservations = getSdkObservationStore()
    const screenObserver = getScreenReadinessObserver()
    // Seed the observer from the pre-run snapshot so a screen the device settled on
    // BEFORE the first `SCREEN_READY` reached us is still known. From here on the
    // event stream owns the state; this only covers the gap at the start.
    // Same gap, for SURFACES. A dialog announces itself once, when it opens — and
    // it routinely opens BEFORE the host attaches this run, so the announcement was
    // addressed to nobody and `select-route` waited out its deadline against a
    // route dialog that was on screen the whole time. The device now reports
    // visibility as state, and this seeds it; the SURFACE_* events still cover a
    // dialog that appears once the run is already listening.
    if (deviceState?.runId === item.runId && deviceState.raw['route_dialog_visible'] === true) {
      sdkObservations.record(item.runId, {
        factKey: 'UI.ROUTE_DIALOG_READY',
        value: true,
        observedAtMs: clock(),
        queryRef: 'device-state:route_dialog_visible',
      })
    }
    if (deviceState?.runId === item.runId && deviceState.currentScreen.trim() !== '') {
      screenObserver.observe(
        { runId: item.runId, screen: deviceState.currentScreen, event: 'SCREEN_READY' },
        clock(),
      )
      this.options.logger?.('[BridgeFlowExecutionQueue] seeded screen readiness from get_state', {
        runId: item.runId,
        screen: deviceState.currentScreen,
        coldStart,
      })
    } else {
      this.options.logger?.('[BridgeFlowExecutionQueue] screen readiness seed missed get_state', {
        runId: item.runId,
        observedRunId: deviceState?.runId ?? null,
        currentScreen: deviceState?.currentScreen ?? '',
        coldStart,
      })
    }

    await this.options.prisma.verdictRunStart.updateMany({
      where: { runId: item.runId },
      data: { status: 'RUNNING' },
    })
    // The cockpit run list reads `workflow_runs.status`, not the run-start row.
    // Leaving it at `queued` for the whole execution shows every live run as
    // pending.
    await this.markRunRow(item.runId, { status: 'running', startedAt: new Date(clock()) })

    const persistence = new PrismaExecutionPersistence(this.options.prisma)
    const runInputs = item.inputs ?? {}
    // What an `ENTITY_STATUS_EQUALS` derivation compares the OBSERVED entity
    // against. The pack names the source (`macro.input.stopCode`); the value can
    // only come from this run, because it is what THIS run asked for.
    const runInputExpectations: Record<string, string | undefined> = Object.fromEntries(
      Object.entries(runInputs).flatMap(([name, value]) =>
        typeof value === 'string'
          ? [
              [`macro.input.${name}`, value],
              [`run.input.${name}`, value],
            ]
          : [],
      ),
    )
    const runContext = new BridgeFlowRunContext({
      capabilities: manager.getCapabilities(),
      runInputs,
      clock,
    })
    /**
     * Bring one occurrence's evidence up to date and return everything it can
     * see. The executor's evidence port and the oracle worker's `refreshFacts`
     * BOTH go through here; that is the point of it existing.
     *
     * Three producers, none of which can address an occurrence on its own:
     *
     *   Screen readiness — the device reports its screen continuously but cannot
     *   know which plan occurrence is asking, so the correlation can only be made
     *   at the moment of the question.
     *
     *   SDK and back-office observations — made in one occurrence, read from
     *   another.
     *
     *   Derived facts — appended, never substituted (`preserveInputs` is always
     *   true), because a conclusion that replaced its inputs would leave the next
     *   reader unable to see what it was built from. Published rather than only
     *   returned: the oracle worker builds its own set from
     *   `runtime.currentFacts` and never calls the derivation engine.
     */
    const refreshOccurrenceEvidence = (
      occurrenceId: string,
      iterationKey: string,
    ): readonly NormalizedEvidenceFact[] => {
      publishLiveScreenReadiness({
        bundle: resolution.pack.bundle,
        evidenceRuntime,
        observer: screenObserver,
        runId: item.runId,
        occurrenceId,
        iterationKey,
        clock,
      })
      publishSdkObservations({
        evidenceRuntime,
        observations: sdkObservations,
        runId: item.runId,
        occurrenceId,
        iterationKey,
      })
      const observed = evidenceRuntime.currentFacts(
        { runId: item.runId, occurrenceId, iterationKey },
        clock(),
      )
      const derived = deriveFacts({
        bundle: resolution.pack.bundle,
        facts: observed,
        expectations: runInputExpectations,
      })
      publishDerivedFacts({
        evidenceRuntime,
        derived,
        runId: item.runId,
        occurrenceId,
        iterationKey,
      })
      // Set VERDICT_FACT_TRACE to a file path to record what each occurrence can
      // actually see. Three wrong hypotheses died to this trace and the real
      // cause only became visible once the fact VALUES were printed next to the
      // keys — "the oracle cannot see the fact" and "the oracle can see a fact
      // that says false" look identical in a requirement state.
      const tracePath = process.env.VERDICT_FACT_TRACE
      if (tracePath !== undefined && tracePath !== '') {
        try {
          appendFileSync(
            tracePath,
            `${JSON.stringify({
              at: new Date(clock()).toISOString(),
              occurrenceId,
              iterationKey,
              ordered: evidenceRuntime
                .currentFacts(
                  { runId: item.runId, occurrenceId, iterationKey },
                  clock(),
                  'ORDERED_REQUIRED',
                )
                .map((f) => `${f.factKey}=${String(f.value)}/${f.authority}`),
              derived: derived.map((f) => f.factKey),
            })}\n`,
            'utf8',
          )
        } catch {
          // Diagnostics must never take a run down.
        }
      }
      return [...observed, ...derived]
    }
    const oracle = new OracleEvaluationWorker({
      runtime: evidenceRuntime,
      persistence,
      clock,
      // THE SAME VIEW THE EXECUTOR GETS, not a narrower one.
      //
      // This used to publish live screen readiness and nothing else, while the
      // executor's `factsForOccurrence` port below also republished SDK and
      // back-office observations into the asking occurrence and recomputed the
      // pack's derived facts. The oracle worker re-reads facts on its own loop
      // for the whole of an EVENTUAL deadline, so for most of a run the only
      // reader that matters was looking through the smaller window.
      //
      // Measured on device: every step of TOUR_APPROVAL_LIFECYCLE succeeded and
      // all five REQUIRED facts still came back REQUIRED_TIMEOUT. Two of them had
      // already settled a continue gate in the same run.
      //
      refreshFacts: (scope) => {
        refreshOccurrenceEvidence(scope.occurrenceId, scope.iterationKey)
      },
    })

    telemetrySampler?.start()
    try {
      const executor = new BridgeFlowExecutor({
        persistence,
        mutationAdmission: createInMemoryMutationAdmission(),
        bridge: createBridgeRuntimePort({
          manager,
          variables: runContext,
          runId: item.runId,
          runInputs,
          // Shared with the generic-step runtime below so both speak to the app
          // over ONE control channel rather than each opening its own.
          ...(controlExecutor === undefined ? {} : { controlExecutor }),
          ...(this.options.logger === undefined ? {} : { logger: this.options.logger }),
        }),
        evidence: {
          factsForOccurrence: (occurrenceId: string, iterationKey: string) => {
            const facts = refreshOccurrenceEvidence(occurrenceId, iterationKey)
            // Facts are also handed to the condition resolver: a branch that
            // reads `sdk.state.*` must see what the oracle lane saw, not a
            // second, differently-filtered view of the same run.
            runContext.observeFacts(facts)
            return facts
          },
        },
        conditionContext: runContext.conditionContext(),
        variables: runContext,
        remoteRuntime:
          this.options.remoteRuntime ??
          createPackRemoteStepRuntime({
            runId: item.runId,
            bundle: resolution.pack.bundle,
            adapter: this.options.backofficeAdapter ?? createEnvBackofficeAdapter(),
            variables: runContext,
            runInputs,
            evidence: evidenceRuntime,
            observations: sdkObservations,
            attemptStore: new PrismaRemoteActionAttemptStore(this.options.prisma),
            clock,
            ...(this.options.logger === undefined ? {} : { logger: this.options.logger }),
          }),
        genericSteps: createGenericStepRuntime({
          manager,
          variables: runContext,
          bundle: resolution.pack.bundle,
          runId: item.runId,
          applicationId,
          runInputs,
          observations: sdkObservations,
          ...(controlExecutor === undefined ? {} : { controlExecutor }),
          ...(this.options.logger === undefined ? {} : { logger: this.options.logger }),
        }),
        oracle: {
          runContinueGate: (work) => oracle.runContinueGate(work),
          runFinalOracle: (work) => oracle.runFinalOracle(work),
        },
        clock,
      })

      const result = await executor.execute({
        runId: item.runId,
        deviceId: item.deviceId,
        plan: plan as never,
        profile: {
          profileKey: item.profileKey ?? 'default',
          profileVersion: item.profileVersion ?? 'unversioned',
          releaseGate: item.releaseGate === true,
        },
      })

      await this.options.prisma.verdictRunStart.updateMany({
        where: { runId: item.runId },
        data: { status: result.lifecycle === 'CLOSED' ? 'TERMINAL' : result.lifecycle },
      })
      // `productVerdict` carries whether the product passed; the run row's
      // status says whether the execution itself finished. Conflating the two
      // is how a completed run that found a real defect reads as an infra
      // failure.
      await this.markRunRow(item.runId, {
        status: 'completed',
        completedAt: new Date(clock()),
      })
      await this.closeDurableRunStream(
        item.runId,
        deviceState,
        result.terminationReason ?? 'COMPLETED',
      )
    } catch (error) {
      // The thrown message is the ONLY account of why this run died: the executor
      // crashed, so no step, oracle or evidence row explains it. Logging it and
      // nothing else left `failed` runs diagnosable only from API stdout — which
      // is not where anyone reads run history from.
      await this.recordExecutionFailure(item, describeError(error))
      this.options.logger?.('[BridgeFlowExecutionQueue] execution failed', {
        runId: item.runId,
        error: describeError(error),
      })
    } finally {
      await telemetrySampler?.stop({ finalCapture: true })
      // The observer is process-wide, so a finished run's screen must not linger:
      // it would be a slow leak in a long-lived API and could answer a later
      // question with a retired run's screen.
      screenObserver.forget(item.runId)
      // Same reasoning for SDK observations: process-wide store, so a finished
      // run's session reads must not outlive it.
      sdkObservations.clear(item.runId)
    }
  }

  private publishReadiness(runId: string, trace: InteractionReadinessTrace): void {
    const failed = trace.status !== 'INTERACTION_READY'
    publishRunLiveEvent({
      runId,
      kind: 'DEVICE',
      level: failed ? 'ERROR' : 'SUCCESS',
      title: failed
        ? `Interaction readiness failed · ${trace.failureClass ?? 'UNCLASSIFIED'}`
        : 'Interaction readiness reached',
      dedupeKey: runLiveKeys.device(
        trace.status,
        String(Math.round(trace.endedMonoTs)),
        trace.firstUnmet ?? 'INTERACTION_READY',
      ),
      detail: { readiness: trace },
    })
  }

  private async persistReadinessTrace(
    item: QueueItem,
    trace: InteractionReadinessTrace,
  ): Promise<void> {
    await this.options.prisma.bridgeFlowRunRuntime.upsert({
      where: { runId: item.runId },
      create: {
        runId: item.runId,
        engineType: 'BRIDGEFLOW',
        compiledPlanRef: item.compiledPlanRef,
        compiledPlanHash: item.compiledPlanHash,
        domainPackKey: item.domainPackKey,
        domainPackVersion: item.domainPackVersion,
        domainPackDigest: item.domainPackDigest,
        workflowIrSchemaVersion: 1,
        compilerVersion: 'unknown',
        bridgeProtocolVersion: '1',
        sdkProtocolVersion: '1',
        runEpochMs: BigInt(this.options.clock?.() ?? Date.now()),
        runEpochUnit: 'MONOTONIC_MS',
        readinessStatus: trace.status,
        readinessClass: trace.failureClass,
        readinessTrace: trace as never,
      },
      update: {
        readinessStatus: trace.status,
        readinessClass: trace.failureClass,
        readinessTrace: trace as never,
      },
    })
  }

  /**
   * Persist a mid-flight execution crash.
   *
   * `ABORTED` on the closed termination axis, and the real message in
   * `failureDetail`: putting the message into `terminationReason` would make an
   * axis with a fixed vocabulary unreadable for every consumer that switches on
   * it. `NEEDS_ATTENTION` because a crashed executor is infrastructure news, and
   * the product verdict stays `NOT_EVALUATED` — the workflow never reached one.
   */
  private async recordExecutionFailure(item: QueueItem, detail: string): Promise<void> {
    const clock = this.options.clock ?? Date.now
    await this.markRunRow(item.runId, { status: 'failed', completedAt: new Date(clock()) })
    publishRunLiveEvent({
      runId: item.runId,
      kind: 'RUN_RESULT',
      level: 'ERROR',
      title: `Execution crashed · ${detail}`,
      dedupeKey: runLiveKeys.runtime('CLOSED', 'NOT_EVALUATED', 'ABORTED'),
      detail: { failureDetail: detail, deviceId: item.deviceId },
    })
    try {
      await Promise.all([
        this.options.prisma.verdictRunStart.updateMany({
          where: { runId: item.runId },
          data: { status: 'FAILED' },
        }),
        this.options.prisma.bridgeFlowRunRuntime.upsert({
          where: { runId: item.runId },
          create: {
            runId: item.runId,
            engineType: 'BRIDGEFLOW',
            compiledPlanRef: item.compiledPlanRef,
            compiledPlanHash: item.compiledPlanHash,
            domainPackKey: item.domainPackKey,
            domainPackVersion: item.domainPackVersion,
            domainPackDigest: item.domainPackDigest,
            workflowIrSchemaVersion: 1,
            compilerVersion: 'unknown',
            bridgeProtocolVersion: '1',
            sdkProtocolVersion: '1',
            runEpochMs: BigInt(clock()),
            runEpochUnit: 'MONOTONIC_MS',
            lifecycle: 'CLOSED',
            productVerdict: 'NOT_EVALUATED',
            schedulerDisposition: 'RELEASED',
            operationalDisposition: 'NEEDS_ATTENTION',
            terminationReason: 'ABORTED',
            failureDetail: detail,
          },
          update: {
            lifecycle: 'CLOSED',
            productVerdict: 'NOT_EVALUATED',
            schedulerDisposition: 'RELEASED',
            operationalDisposition: 'NEEDS_ATTENTION',
            terminationReason: 'ABORTED',
            failureDetail: detail,
          },
        }),
      ])
    } catch (persistError) {
      // Losing the diagnosis is worse than losing the status write, so say so
      // explicitly rather than letting an empty `failureDetail` read as "no cause".
      this.options.logger?.('[BridgeFlowExecutionQueue] failure detail could not be persisted', {
        runId: item.runId,
        detail,
        error: describeError(persistError),
      })
    }
  }

  /**
   * Mirror execution lifecycle onto the `workflow_runs` row the cockpit reads.
   *
   * Best-effort: a run row that cannot be updated must not abort an execution
   * that is otherwise fine, but the failure is logged rather than swallowed.
   */
  private async markRunRow(
    runId: string,
    data: { status: string; startedAt?: Date; completedAt?: Date },
  ): Promise<void> {
    try {
      await this.options.prisma.workflowRun.updateMany({ where: { id: runId }, data })
      publishRunLiveEvent({
        runId,
        kind: 'RUN_STATUS',
        level: runLiveLevelFor(data.status),
        title: `Run ${data.status}`,
        dedupeKey: runLiveKeys.runStatus(data.status),
        detail: { status: data.status },
      })
    } catch (error) {
      this.options.logger?.('[BridgeFlowExecutionQueue] run row update failed', {
        runId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private async closeDurableRunStream(
    runId: string,
    deviceState: DeviceBridgeState | null,
    reason: string,
  ): Promise<void> {
    if (deviceState?.runId !== runId || deviceState.sessionId.trim() === '') return
    try {
      await getVerdictDurableRuntime().closeRun(
        { runId, sessionId: deviceState.sessionId },
        reason,
      )
    } catch (error) {
      this.options.logger?.('[BridgeFlowExecutionQueue] durable stream close failed', {
        runId,
        sessionId: deviceState.sessionId,
        error: describeError(error),
      })
    }
  }

  /**
   * A run that never reached the workflow. The preflight remediation is written
   * to BOTH `terminationReason` and `failureDetail`: `failureDetail` is where it
   * belongs, but existing rows and the editor's blocked-run toast already read
   * the reason off `terminationReason`, and dropping it there would blank the
   * message for every consumer that has not moved over yet.
   */
  private async blockRun(
    item: QueueItem,
    reason: string,
    readinessTrace?: InteractionReadinessTrace,
  ): Promise<void> {
    await this.markRunRow(item.runId, { status: 'blocked', completedAt: new Date(this.options.clock?.() ?? Date.now()) })
    // The remediation is the whole value of a blocked run, and the watcher can
    // only report it a poll later — by which time the operator has already read
    // "blocked" with no cause next to it.
    publishRunLiveEvent({
      runId: item.runId,
      kind: 'RUN_RESULT',
      level: 'ERROR',
      title: `Run blocked before the workflow ran · ${reason}`,
      dedupeKey: runLiveKeys.runtime('CLOSED', 'NOT_EVALUATED', reason),
      detail: { reason, deviceId: item.deviceId, workflowRef: item.workflowRef },
    })
    await Promise.all([
      this.options.prisma.verdictRunStart.updateMany({
        where: { runId: item.runId },
        data: { status: 'BLOCKED' },
      }),
      this.options.prisma.bridgeFlowRunRuntime.upsert({
        where: { runId: item.runId },
        create: {
          runId: item.runId,
          engineType: 'BRIDGEFLOW',
          compiledPlanRef: item.compiledPlanRef,
          compiledPlanHash: item.compiledPlanHash,
          domainPackKey: item.domainPackKey,
          domainPackVersion: item.domainPackVersion,
          domainPackDigest: item.domainPackDigest,
          workflowIrSchemaVersion: 1,
          compilerVersion: 'unknown',
          bridgeProtocolVersion: '1',
          sdkProtocolVersion: '1',
          runEpochMs: BigInt(this.options.clock?.() ?? Date.now()),
          runEpochUnit: 'MONOTONIC_MS',
          lifecycle: 'CLOSED',
          productVerdict: 'NOT_EVALUATED',
          schedulerDisposition: 'RELEASED',
          operationalDisposition: 'BLOCKED',
          terminationReason: reason,
          failureDetail: reason,
          ...(readinessTrace === undefined
            ? {}
            : {
                readinessStatus: readinessTrace.status,
                readinessClass: readinessTrace.failureClass,
                readinessTrace: readinessTrace as never,
              }),
        },
        update: {
          lifecycle: 'CLOSED',
          productVerdict: 'NOT_EVALUATED',
          schedulerDisposition: 'RELEASED',
          operationalDisposition: 'BLOCKED',
          terminationReason: reason,
          failureDetail: reason,
          ...(readinessTrace === undefined
            ? {}
            : {
                readinessStatus: readinessTrace.status,
                readinessClass: readinessTrace.failureClass,
                readinessTrace: readinessTrace as never,
              }),
        },
      }),
    ])
  }
}
