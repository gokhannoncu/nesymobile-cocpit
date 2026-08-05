import { buildRunManifest, createInitialStepOutcome } from '@nesy/execution-contract'
import { describe, expect, it, vi } from 'vitest'

import {
  PrismaExecutionPersistence,
  type PrismaRuntimeClient,
} from './bridgeflow-prisma-persistence.js'

function delegate() {
  return {
    create: vi.fn(async () => ({})),
    update: vi.fn(async () => ({})),
    upsert: vi.fn(async () => ({})),
  }
}

function clientFixture(): PrismaRuntimeClient {
  return {
    bridgeFlowRunRuntime: delegate(),
    bridgeFlowStepOccurrence: delegate(),
    bridgeFlowActionTransition: delegate(),
    bridgeFlowWaitEvent: delegate(),
    bridgeFlowOracleEvaluation: delegate(),
  } as unknown as PrismaRuntimeClient
}

describe('PrismaExecutionPersistence', () => {
  it('durably maps executor records to BridgeFlow runtime tables', async () => {
    const client = clientFixture()
    const persistence = new PrismaExecutionPersistence(
      client,
      () => new Date('2026-08-05T14:00:00.000Z'),
    )
    const manifest = buildRunManifest({
      runId: 'run-1',
      workflowRef: 'workflow/demo',
      workflowVersion: 1,
      engineType: 'BRIDGEFLOW',
      compiledPlanRef: 'plan-1',
      compiledPlanHash: 'sha256:plan',
      domainPackKey: 'courier',
      domainPackVersion: '1.0.0',
      domainPackDigest: 'sha256:pack',
      workflowIrSchemaVersion: 1,
      compilerVersion: 'phase-4c',
      bridgeProtocolVersion: '1',
      sdkProtocolVersion: '1',
      runEpochMs: 42,
      profile: {
        profileKey: 'default',
        profileVersion: '1',
        releaseGate: false,
      },
      reducerGraphDigest: 'sha256:graph',
    })

    await persistence.persistRunStart({ runId: 'run-1', engineType: 'BRIDGEFLOW', manifest })
    await persistence.persistStepOccurrence({
      runId: 'run-1',
      occurrenceId: 'occ-1',
      planStepId: 'step-1',
      occurrenceIndex: 0,
      iterationKey: 'root',
      requestId: 'request-1',
      outcome: { ...createInitialStepOutcome(), actionResult: 'SUCCEEDED' },
    })
    await persistence.persistActionTransition({
      runId: 'run-1',
      occurrenceId: 'occ-1',
      transition: {
        phase: 'EFFECT_VERIFIED',
        requestId: 'request-1',
        atMs: 50,
        evidenceRef: 'bridge:verified',
        terminal: 'SUCCEEDED',
      },
    })
    await persistence.persistRunResult({
      runId: 'run-1',
      result: {
        lifecycle: 'CLOSED',
        productVerdict: 'PASS_ONLINE',
        evaluationFailureClass: 'NONE',
        terminationReason: 'COMPLETED',
        cleanupResult: 'SUCCEEDED',
        resourceReleaseResult: 'RELEASED',
        schedulerDisposition: 'RELEASED',
        operationalDisposition: 'OK',
      },
    })

    expect(client.bridgeFlowRunRuntime.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { runId: 'run-1' },
        create: expect.objectContaining({ runEpochMs: 42n, compiledPlanHash: 'sha256:plan' }),
      }),
    )
    expect(client.bridgeFlowStepOccurrence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { runId_occurrenceId: { runId: 'run-1', occurrenceId: 'occ-1' } },
      }),
    )
    expect(client.bridgeFlowActionTransition.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          runId_occurrenceId_requestId_phase: {
            runId: 'run-1',
            occurrenceId: 'occ-1',
            requestId: 'request-1',
            phase: 'EFFECT_VERIFIED',
          },
        },
        create: expect.objectContaining({ occurrenceId: 'occ-1', atMs: 50n }),
      }),
    )
    expect(client.bridgeFlowRunRuntime.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ productVerdict: 'PASS_ONLINE' }),
      }),
    )
  })
})
