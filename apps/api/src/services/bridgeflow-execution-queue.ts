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

import { BridgeFlowExecutor, createInMemoryMutationAdmission } from '@nesy/bridgeflow-executor'
import type { PrismaClient } from '@nesy/db'

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
import { OracleEvaluationWorker } from './oracle-evaluation-worker.js'
import { resolveDomainPack, type DomainPackResolution } from './domain-pack-registry.js'
import { DeviceWorkerRegistry } from './device-worker.js'
import { PrismaRemoteActionAttemptStore } from './phase6-prisma-stores.js'
import { broadcastSetRun, setRunIdProperty } from './test-event-bridge.js'
import {
  isNesyDashboardCountry,
  isNesyEnvironment,
  resolveBaseUrl,
  type NesyDashboardCountry,
  type NesyEnvironment,
} from '../nesy-env.js'

type QueueItem = Parameters<WorkflowRunExecutionQueue['enqueue']>[0]
type RemoteStepRuntime = ReturnType<typeof createPackRemoteStepRuntime>

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
    const applicationId = resolution.pack.bundle.registries.applications[0]?.packageIdentity
    if (applicationId === undefined || applicationId.trim() === '') {
      await this.blockRun(item, 'domain pack application package identity is missing')
      return
    }

    const propertySet = await setRunIdProperty(item.deviceId, item.runId)
    const sessionSet = await broadcastSetRun(item.deviceId, applicationId, item.runId, {
      wsEnabled: true,
      wsPort: 8765,
    })
    if (!propertySet || !sessionSet) {
      await this.blockRun(item, 'SDK run session could not be established through Verdict control channel')
      return
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
    const evidenceRuntime = getBridgeFlowEvidenceRuntime()
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
          factsForOccurrence: (occurrenceId) => {
            // Facts are also handed to the condition resolver: a branch that
            // reads `sdk.state.*` must see what the oracle lane saw, not a
            // second, differently-filtered view of the same run.
            const facts = evidenceRuntime.currentFacts(
              { runId: item.runId, occurrenceId, iterationKey: '' },
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
      await this.markRunRow(item.runId, { status: 'failed', completedAt: new Date(clock()) })
      await this.options.prisma.verdictRunStart.updateMany({
        where: { runId: item.runId },
        data: { status: 'FAILED' },
      })
      this.options.logger?.('[BridgeFlowExecutionQueue] execution failed', {
        runId: item.runId,
        error: error instanceof Error ? error.message : String(error),
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
        },
        update: {
          lifecycle: 'CLOSED',
          productVerdict: 'NOT_EVALUATED',
          schedulerDisposition: 'RELEASED',
          operationalDisposition: 'BLOCKED',
          terminationReason: reason,
        },
      }),
    ])
  }
}
