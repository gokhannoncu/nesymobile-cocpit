import { Prisma, prisma, type PrismaClient } from '@nesy/db'
import type {
  ExecutionPersistencePort,
  PersistedActionTransition,
  PersistedOracleEvaluation,
  PersistedRunResult,
  PersistedRunStart,
  PersistedWaitResult,
} from '@nesy/bridgeflow-executor'
import type { StepOccurrence } from '@nesy/execution-contract'

export type PrismaRuntimeClient = Pick<
  PrismaClient,
  | 'bridgeFlowRunRuntime'
  | 'bridgeFlowStepOccurrence'
  | 'bridgeFlowActionTransition'
  | 'bridgeFlowWaitEvent'
  | 'bridgeFlowOracleEvaluation'
>

export class PrismaExecutionPersistence implements ExecutionPersistencePort {
  constructor(
    private readonly client: PrismaRuntimeClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async persistRunStart(record: PersistedRunStart): Promise<void> {
    const { manifest } = record
    const profile = manifest.profile
    const data = {
      engineType: record.engineType,
      compiledPlanRef: manifest.compiledPlanRef,
      compiledPlanHash: manifest.compiledPlanHash,
      domainPackKey: manifest.domainPackKey,
      domainPackVersion: manifest.domainPackVersion,
      domainPackDigest: manifest.domainPackDigest,
      workflowIrSchemaVersion: manifest.workflowIrSchemaVersion,
      compilerVersion: manifest.compilerVersion,
      bridgeProtocolVersion: manifest.bridgeProtocolVersion,
      sdkProtocolVersion: manifest.sdkProtocolVersion,
      runEpochMs: BigInt(manifest.runEpochMs),
      runEpochUnit: manifest.runEpochUnit,
      profileSnapshot: toInputJson(profile),
      campaignId: profile.campaignId,
      buildRef: profile.buildRef,
      datasetRef: profile.datasetRef,
      deviceCell: profile.deviceCell,
      repetitionIndex: profile.repetitionIndex,
      faultPlanRef: profile.faultPlanRef,
      telemetryPolicyRef: profile.telemetryPolicyRef,
      releaseGate: profile.releaseGate,
      lifecycle: 'RUNNING',
      schedulerDisposition: 'LEASED',
    }
    await this.client.bridgeFlowRunRuntime.upsert({
      where: { runId: record.runId },
      create: { runId: record.runId, ...data },
      update: data,
    })
  }

  async persistStepOccurrence(occurrence: StepOccurrence): Promise<void> {
    const terminal = occurrence.outcome.actionResult !== 'RUNNING'
    const data = {
      planStepId: occurrence.planStepId,
      occurrenceIndex: occurrence.occurrenceIndex,
      iterationKey: occurrence.iterationKey,
      requestId: occurrence.requestId,
      lifecycle: terminal ? 'COMPLETED' : 'RUNNING',
      actionResult: occurrence.outcome.actionResult,
      continueGateResult: occurrence.outcome.continueGateResult,
      finalOracleResult: occurrence.outcome.finalOracleResult,
      cleanupResult: occurrence.outcome.cleanupResult,
      ...(terminal ? { completedAt: this.now() } : { startedAt: this.now() }),
    }
    await this.client.bridgeFlowStepOccurrence.upsert({
      where: {
        runId_occurrenceId: {
          runId: occurrence.runId,
          occurrenceId: occurrence.occurrenceId,
        },
      },
      create: {
        runId: occurrence.runId,
        occurrenceId: occurrence.occurrenceId,
        ...data,
      },
      update: data,
    })
  }

  async persistActionTransition(record: PersistedActionTransition): Promise<void> {
    const transition = record.transition
    const data = {
      atMs: BigInt(transition.atMs),
      evidenceRef: transition.evidenceRef,
      terminal: transition.terminal,
    }
    await this.client.bridgeFlowActionTransition.upsert({
      where: {
        runId_occurrenceId_requestId_phase: {
          runId: record.runId,
          occurrenceId: record.occurrenceId,
          requestId: transition.requestId,
          phase: transition.phase,
        },
      },
      create: {
        runId: record.runId,
        occurrenceId: record.occurrenceId,
        requestId: transition.requestId,
        phase: transition.phase,
        ...data,
      },
      update: data,
    })
  }

  async persistWaitResult(result: PersistedWaitResult): Promise<void> {
    const data = {
      requestId: result.requestId,
      status: result.status,
      resultKey: result.key,
      cancelStatus: result.cancelStatus,
      terminalAt: this.now(),
    }
    await this.client.bridgeFlowWaitEvent.upsert({
      where: {
        runId_occurrenceId_waitPlanId: {
          runId: result.runId,
          occurrenceId: result.occurrenceId,
          waitPlanId: result.waitPlanId,
        },
      },
      create: {
        runId: result.runId,
        occurrenceId: result.occurrenceId,
        waitPlanId: result.waitPlanId,
        ...data,
      },
      update: data,
    })
  }

  async persistOracleEvaluation(record: PersistedOracleEvaluation): Promise<void> {
    const evaluation = record.evaluation
    await this.client.bridgeFlowOracleEvaluation.create({
      data: {
        runId: record.runId,
        occurrenceId: record.occurrenceId,
        evaluatorKind: record.evaluatorKind,
        outcome: evaluation.outcome,
        productVerdict: 'productVerdict' in evaluation ? evaluation.productVerdict : undefined,
        evaluationFailureClass:
          'evaluationFailureClass' in evaluation ? evaluation.evaluationFailureClass : undefined,
        requirements:
          'requirementsByFact' in evaluation
            ? toInputJson(evaluation.requirementsByFact)
            : undefined,
        evidenceRefs: [...evaluation.evidenceRefs],
      },
    })
  }

  async persistRunResult(record: PersistedRunResult): Promise<void> {
    await this.client.bridgeFlowRunRuntime.update({
      where: { runId: record.runId },
      data: {
        lifecycle: record.result.lifecycle,
        productVerdict: record.result.productVerdict,
        evaluationFailureClass: record.result.evaluationFailureClass,
        terminationReason: record.result.terminationReason,
        cleanupResult: record.result.cleanupResult,
        resourceReleaseResult: record.result.resourceReleaseResult,
        schedulerDisposition: record.result.schedulerDisposition,
        operationalDisposition: record.result.operationalDisposition,
      },
    })
  }
}

export function createPrismaExecutionPersistence(): PrismaExecutionPersistence {
  return new PrismaExecutionPersistence(prisma)
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}
