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
import { BridgeFlowRunContext } from './bridgeflow-run-context.js'
import { createBridgeRuntimePort, createGenericStepRuntime } from './bridgeflow-device-ports.js'
import { createPackRemoteStepRuntime } from './bridgeflow-remote-steps.js'
import { createNesyBackofficeAdapter, type BackofficeAdapter } from './nesy-backoffice-adapter.js'
import { getDashboardAdminToken } from './nesy-admin-token.js'
import { getBridgeFlowEvidenceRuntime } from './bridgeflow-evidence-runtime.js'
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

  try {
    await adbDevice(input.deviceId, ['shell', 'am', 'force-stop', input.applicationId])
    await adbDevice(
      input.deviceId,
      ['shell', 'monkey', '-p', input.applicationId, '-c', 'android.intent.category.LAUNCHER', '1'],
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
}): Promise<DeviceBridgeState | null> {
  let last: DeviceBridgeState | null = null
  for (let attempt = 0; attempt < 5; attempt += 1) {
    last = await getDeviceBridgeState(input.deviceId, input.applicationId).catch(() => null)
    if (last?.runId === input.runId && last.currentScreen.trim() !== '') return last
    await sleep(300)
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
}

async function acquireBridgeFromRegistry(input: {
  deviceId: string
  runId: string
  executionId: string
}): Promise<BridgeDeviceManager> {
  const worker = DeviceWorkerRegistry.getOrCreate(input.deviceId)
  return worker.acquireBridge(input.runId, input.executionId, Date.now())
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

    let manager: BridgeDeviceManager
    try {
      manager = await (this.options.acquireBridge ?? acquireBridgeFromRegistry)({
        deviceId: item.deviceId,
        runId: item.runId,
        executionId: item.executionId,
      })
    } catch (error) {
      const reason =
        error instanceof BridgeUnavailableError
          ? `${error.message} — ${error.failure.remediation}`
          : error instanceof Error
            ? error.message
            : String(error)
      await this.blockRun(item, reason)
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
    let deviceState: DeviceBridgeState | null = null
    if (!propertySet || !sessionSet) {
      deviceState = await readDeviceStateWithRetry({
        deviceId: item.deviceId,
        applicationId,
        runId: item.runId,
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
    })
    const evidenceRuntime = getBridgeFlowEvidenceRuntime()
    const screenObserver = getScreenReadinessObserver()
    // Seed the observer from the pre-run snapshot so a screen the device settled on
    // BEFORE the first `SCREEN_READY` reached us is still known. From here on the
    // event stream owns the state; this only covers the gap at the start.
    if (deviceState?.runId === item.runId && deviceState.currentScreen.trim() !== '') {
      screenObserver.observe(
        { runId: item.runId, screen: deviceState.currentScreen, event: 'SCREEN_READY' },
        clock(),
      )
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
    const runContext = new BridgeFlowRunContext({
      capabilities: manager.getCapabilities(),
      runInputs,
      clock,
    })
    const oracle = new OracleEvaluationWorker({
      runtime: evidenceRuntime,
      persistence,
      clock,
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
        }),
        evidence: {
          factsForOccurrence: (occurrenceId, iterationKey) => {
            // Screen readiness is produced HERE, against the caller's own scope.
            // The device reports its screen continuously but cannot know which plan
            // occurrence is asking, so the correlation can only be made at the
            // moment of the question.
            publishLiveScreenReadiness({
              bundle: resolution.pack.bundle,
              evidenceRuntime,
              observer: screenObserver,
              runId: item.runId,
              occurrenceId,
              iterationKey,
              clock,
            })
            // Facts are also handed to the condition resolver: a branch that
            // reads `sdk.state.*` must see what the oracle lane saw, not a
            // second, differently-filtered view of the same run.
            const facts = evidenceRuntime.currentFacts(
              { runId: item.runId, occurrenceId, iterationKey },
              clock(),
            )
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
