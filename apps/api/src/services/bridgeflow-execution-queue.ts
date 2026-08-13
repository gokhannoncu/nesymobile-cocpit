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
import { OracleEvaluationWorker } from './oracle-evaluation-worker.js'
import { resolveDomainPack, type DomainPackResolution } from './domain-pack-registry.js'
import { DeviceWorkerRegistry } from './device-worker.js'
import { PrismaRemoteActionAttemptStore } from './phase6-prisma-stores.js'
import {
  broadcastSetRun,
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

function findLaunchProfile(resolution: DomainPackResolution, profileKey: string | null | undefined): LaunchProfile | undefined {
  const key = profileKey?.trim()
  if (!key || !resolution.ok) return undefined
  return resolution.pack.bundle.registries.launchProfiles.find((profile) => profile.profileKey === key)
}

async function prepareApplicationLaunch(input: {
  deviceId: string
  applicationId: string
  profile: LaunchProfile | undefined
  logger?: (message: string, detail?: unknown) => void
}): Promise<string | null> {
  if (input.profile?.startMode !== 'COLD_START') return null

  // Package names are interpolated into a single shell line below, so anything
  // that is not a package name is refused here rather than quoted and hoped for.
  if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/.test(input.applicationId)) {
    return `application id ${input.applicationId} is not a package name`
  }

  try {
    // One `adb shell`, not two. Each invocation pays a full round trip plus a
    // shell fork on the device — measured at ~54ms — and the stop/launch pair is
    // sequential by nature, so there is nothing to lose by sending it as one line.
    await adbDevice(
      input.deviceId,
      [
        'shell',
        `am force-stop ${input.applicationId}; ` +
          `monkey -p ${input.applicationId} -c android.intent.category.LAUNCHER 1`,
      ],
      15_000,
    )
    input.logger?.('[BridgeFlowExecutionQueue] launched application for COLD_START profile', {
      deviceId: input.deviceId,
      applicationId: input.applicationId,
      profileKey: input.profile.profileKey,
    })
    return null
  } catch (error) {
    return (
      `application launch failed for ${input.applicationId} (${input.profile.profileKey}): ` +
      (error instanceof Error ? error.message : String(error))
    )
  }
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

    // Preflight is ~950ms of adb, and a cold start leaves the host idle for ~2.6s
    // while the app boots. Overlapping the two removes preflight from the critical
    // path entirely. It is safe because adb stays healthy during a boot: measured,
    // only the Bridge's own TCP service stalls (two window transitions, ~1.2s and
    // ~1.45s) and every adb call issued inside that window returned normally.
    //
    // Only for COLD_START. Without a launch there is no dead time to hide anything
    // behind, so the stricter ordering is kept: a device whose Bridge is unusable
    // is reported before this process has touched it at all.
    const acquire = this.options.acquireBridge ?? acquireBridgeFromRegistry
    let managerPromise: Promise<BridgeDeviceManager> | null = null
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
      // The checks that REFUSE a device — attached, allowlisted, not a production
      // build — cannot ride along in that concurrent phase. Force-stopping and
      // relaunching an app is already an intrusion, so they answer first, at a
      // measured ~60ms. Everything else in preflight merely describes the device.
      const admission = await (this.options.admissionGate ?? admissionGateFromRegistry)(item.deviceId)
      if (!admission.ok) {
        await this.blockRun(item, admission.reason)
        return
      }
      managerPromise = acquire({
        deviceId: item.deviceId,
        runId: item.runId,
        executionId: item.executionId,
      })
      // The await is several statements below; without this the rejection would
      // surface as an unhandled promise before it surfaces as a blocked run.
      managerPromise.catch(() => undefined)
    }

    // `setprop` must land BEFORE the process starts — the app reads the run id at
    // boot and will not pick up a later write.
    const propertySet = await setRunIdProperty(item.deviceId, item.runId)
    const launchFailure = await prepareApplicationLaunch({
      deviceId: item.deviceId,
      applicationId,
      profile: launchProfile,
      ...(this.options.logger === undefined ? {} : { logger: this.options.logger }),
    })
    if (launchFailure !== null) {
      await this.blockRun(item, launchFailure)
      return
    }

    const sessionSet = await broadcastSetRun(item.deviceId, applicationId, item.runId, {
      wsEnabled: true,
      wsPort: 8765,
    })

    // Collect the preflight that has been running alongside the launch. Awaited
    // here rather than at first use so an unreachable Bridge is reported in about
    // a second, and — more importantly — BEFORE the state wait below, which would
    // otherwise spend up to 20s failing and then blame the SDK run session for
    // what is actually a dead Bridge.
    if (managerPromise !== null) {
      try {
        manager = await managerPromise
      } catch (error) {
        await this.blockRun(item, describeBridgeAcquisitionFailure(error))
        return
      }
    }
    if (manager === null) {
      await this.blockRun(item, 'device Bridge was never acquired for this run')
      return
    }

    // Cold start: SCREEN_READY often fires with empty runId before set_run, and the
    // fragment will not re-emit once LoginFragment is already resumed. The host must
    // therefore wait for get_state(current_screen) under the new runId — 1.5s was too
    // short (monkey returns before the login UI is up), so wait-login-ready timed out
    // against a visible LoginFragment with zero evidence facts.
    const stateWaitMs = coldStart ? 20_000 : 5_000
    let deviceState: DeviceBridgeState | null = null
    if (!propertySet || !sessionSet) {
      deviceState = await readDeviceStateWithRetry({
        deviceId: item.deviceId,
        applicationId,
        runId: item.runId,
        deadlineMs: stateWaitMs,
      })
      if (deviceState?.runId !== item.runId) {
        await this.blockRun(
          item,
          `SDK run session could not be established through Verdict control channel ` +
            `(setprop=${String(propertySet)}, broadcast=${String(sessionSet)}, observed=${deviceState?.runId || '<none>'})`,
        )
        return
      }
    }
    deviceState ??= await readDeviceStateWithRetry({
      deviceId: item.deviceId,
      applicationId,
      runId: item.runId,
      deadlineMs: stateWaitMs,
    })
    // One control channel for the whole run: launch preparation installs the
    // profile's precondition through it, the bridge port tells the app which
    // occurrence its emits belong to, and the generic-step runtime reads named
    // queries.
    const controlExecutor =
      applicationId === undefined ? undefined : createControlExecutor({ applicationId })

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
      // The observer is process-wide, so a finished run's screen must not linger:
      // it would be a slow leak in a long-lived API and could answer a later
      // question with a retired run's screen.
      screenObserver.forget(item.runId)
      // Same reasoning for SDK observations: process-wide store, so a finished
      // run's session reads must not outlive it.
      sdkObservations.clear(item.runId)
    }
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
    } catch (error) {
      this.options.logger?.('[BridgeFlowExecutionQueue] run row update failed', {
        runId,
        error: error instanceof Error ? error.message : String(error),
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
  private async blockRun(item: QueueItem, reason: string): Promise<void> {
    await this.markRunRow(item.runId, { status: 'blocked', completedAt: new Date(this.options.clock?.() ?? Date.now()) })
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
        },
        update: {
          lifecycle: 'CLOSED',
          productVerdict: 'NOT_EVALUATED',
          schedulerDisposition: 'RELEASED',
          operationalDisposition: 'BLOCKED',
          terminationReason: reason,
          failureDetail: reason,
        },
      }),
    ])
  }
}
