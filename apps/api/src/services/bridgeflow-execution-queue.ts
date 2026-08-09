import { BridgeFlowExecutor, createInMemoryMutationAdmission } from '@nesy/bridgeflow-executor'
import type { PrismaClient } from '@nesy/db'

import type { WorkflowRunExecutionQueue } from './workflow-run.service.js'
import type { CompiledPlanStore } from './workflow-compile.service.js'
import { PrismaExecutionPersistence } from './bridgeflow-prisma-persistence.js'

type QueueItem = Parameters<WorkflowRunExecutionQueue['enqueue']>[0]

export class BridgeFlowExecutionQueue implements WorkflowRunExecutionQueue {
  private readonly pending: QueueItem[] = []
  private processing = false

  constructor(
    private readonly options: {
      prisma: PrismaClient
      planStore: CompiledPlanStore
      logger?: (message: string, detail?: unknown) => void
      clock?: () => number
    },
  ) {}

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

    await this.options.prisma.verdictRunStart.updateMany({
      where: { runId: item.runId },
      data: { status: 'RUNNING' },
    })

    try {
      const executor = new BridgeFlowExecutor({
        persistence: new PrismaExecutionPersistence(this.options.prisma),
        mutationAdmission: createInMemoryMutationAdmission(),
        bridge: {
          act: async () => ({
            terminalState: 'FAILED',
            effectVerified: false,
            evidenceRef: 'bridgeflow:missing-real-bridge-port',
          }),
          waitAny: async () => ({ status: 'TIMEOUT', elapsedMs: 0 }),
          cancelWait: async () => ({ status: 'CANCELLED' }),
          cancelAction: async () => ({ status: 'CANCELLED' }),
        },
        evidence: { factsForOccurrence: () => [] },
        clock: this.options.clock ?? Date.now,
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
    } catch (error) {
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

  private async blockRun(item: QueueItem, reason: string): Promise<void> {
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
