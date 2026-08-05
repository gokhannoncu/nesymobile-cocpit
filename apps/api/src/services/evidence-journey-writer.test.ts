import { buildEvidenceRevisionIdempotencyKey } from '@nesy/execution-contract'
import { describe, expect, it, vi } from 'vitest'

import {
  EvidenceJourneyWriter,
  InMemoryEvidenceJourneyPersistence,
  PrismaEvidenceJourneyPersistence,
  persistBridgeFlowDurableEvidence,
} from './evidence-journey-writer.js'
import {
  StaticEvidenceSourceResolver,
  resolveBridgeFlowDurableEvent,
} from './evidence-source-resolver.js'

const observation = {
  runId: 'run-1',
  occurrenceId: 'occ-1',
  iterationKey: 'iteration-1',
  factKey: 'delivery.persisted',
  revision: 1,
  rawAuditIdentity: {
    runId: 'run-1',
    sessionId: 'session-1',
    seq: '41',
    rawEventRef: 'durable:run-1:session-1:41',
  },
  normalizedFact: {
    factKey: 'delivery.persisted',
    occurrenceId: 'occ-1',
    iterationKey: 'iteration-1',
    observedAtMs: 100,
    freshnessMaxAgeMs: 1_000,
    plane: 'APP' as const,
    subtype: 'sdk',
    value: true as const,
    authority: 'PRIMARY' as const,
    deliveryLane: 'ORDERED_REQUIRED' as const,
    rawEventId: 'durable:run-1:session-1:41',
    reducerTrace: ['sdk-event', 'delivery-reducer'],
  },
  reducerTrace: ['sdk-event', 'delivery-reducer'],
  authority: 'PRIMARY' as const,
  confidence: 1,
  correlationStatus: 'CORRELATED' as const,
  journey: {
    factKey: 'delivery.persisted',
    occurrenceId: 'occ-1',
    stage: 'EVALUATION' as const,
    state: 'OBSERVED' as const,
    reason: 'ordered fact evaluated',
  },
}

describe('EvidenceJourneyWriter', () => {
  it('is idempotent for replay and stores a later revision distinctly', async () => {
    const persistence = new InMemoryEvidenceJourneyPersistence()
    const writer = new EvidenceJourneyWriter(persistence)

    await writer.write(observation)
    await writer.write(observation)
    await writer.write({ ...observation, revision: 2 })

    expect(persistence.rows).toHaveLength(2)
    expect(persistence.rows.map((row) => row.revision)).toEqual([1, 2])
    expect(persistence.rows[0]).toMatchObject({
      rawAuditIdentity: observation.rawAuditIdentity,
      normalizedFact: observation.normalizedFact,
      reducerTrace: observation.reducerTrace,
      authority: 'PRIMARY',
      confidence: 1,
      correlationStatus: 'CORRELATED',
      journeyStage: 'EVALUATION',
      journeyState: 'OBSERVED',
      journeyReason: 'ordered fact evaluated',
    })
    expect(persistence.rows[0]?.idempotencyKey).toBe(
      buildEvidenceRevisionIdempotencyKey({
        runId: 'run-1',
        occurrenceId: 'occ-1',
        iterationKey: 'iteration-1',
        factKey: 'delivery.persisted',
        deliveryLane: 'ORDERED_REQUIRED',
        revision: 1,
      }),
    )
  })

  it('persists a correlated ordered durable event at the stable ingest seam', async () => {
    const persistence = new InMemoryEvidenceJourneyPersistence()
    const writer = new EvidenceJourneyWriter(persistence)
    const resolved = resolveBridgeFlowDurableEvent(
      {
        runId: 'run-1',
        sessionId: 'session-1',
        ts: 100,
        event: 'DELIVERY_PERSISTED',
        taskId: 'task-1',
        data: {
          occurrenceId: 'occ-1',
          iterationKey: 'iteration-1',
          factValue: 'true',
        },
      },
      'ORDERED_REQUIRED',
      new StaticEvidenceSourceResolver([
        {
          sourceEvent: 'DELIVERY_PERSISTED',
          factKey: 'delivery.persisted',
          plane: 'APP',
          subtype: 'sdk',
          authority: 'PRIMARY',
          deliveryLanes: ['ORDERED_REQUIRED'],
          freshnessMaxAgeMs: 1_000,
          valueField: 'factValue',
        },
      ]),
      {
        runId: 'run-1',
        sessionId: 'session-1',
        seq: '41',
        rawEventRef: 'durable:run-1:session-1:41',
      },
    )
    if (resolved.status !== 'ACCEPTED') throw new Error('fixture must resolve')

    await expect(
      persistBridgeFlowDurableEvidence(resolved, writer),
    ).resolves.toMatchObject({ revision: 1 })
    expect(persistence.rows).toHaveLength(1)
    expect(persistence.rows[0]).toMatchObject({
      revision: 1,
      correlationStatus: 'CORRELATED',
      journeyStage: 'CORRELATION',
      journeyState: 'OBSERVED',
      rawAuditIdentity: {
        runId: 'run-1',
        sessionId: 'session-1',
        seq: '41',
      },
    })
  })

  it('fails closed when concurrent allocation collides with another observation', async () => {
    const persistence = new PrismaEvidenceJourneyPersistence({
      bridgeFlowEvidenceFact: {
        findFirst: async () => null,
        aggregate: async () => ({ _max: { revision: 0 } }),
        upsert: async () => ({ rawEventRef: 'durable:other-observation' }),
        findMany: async () => [],
      },
    } as never)
    const writer = new EvidenceJourneyWriter(persistence)
    const resolved = resolveBridgeFlowDurableEvent(
      {
        runId: 'run-1',
        sessionId: 'session-1',
        ts: 100,
        event: 'DELIVERY_PERSISTED',
        taskId: 'task-1',
        data: {
          occurrenceId: 'occ-1',
          iterationKey: 'iteration-1',
          factValue: 'true',
        },
      },
      'ORDERED_REQUIRED',
      new StaticEvidenceSourceResolver([
        {
          sourceEvent: 'DELIVERY_PERSISTED',
          factKey: 'delivery.persisted',
          plane: 'APP',
          subtype: 'sdk',
          authority: 'PRIMARY',
          deliveryLanes: ['ORDERED_REQUIRED'],
          freshnessMaxAgeMs: 1_000,
          valueField: 'factValue',
        },
      ]),
      {
        runId: 'run-1',
        sessionId: 'session-1',
        seq: '42',
        rawEventRef: 'durable:run-1:session-1:42',
      },
    )
    if (resolved.status !== 'ACCEPTED') throw new Error('fixture must resolve')

    await expect(writer.writeResolved(resolved)).rejects.toThrow(
      'evidence revision allocation collision',
    )
  })

  it('persists and hydrates a durable run-level ordered block', async () => {
    const runBlock = {
      upsert: vi.fn(async () => ({})),
      findMany: vi.fn(async () => [
        {
          reason: 'partial ordered correlation',
          evidenceRef: 'durable:run-1:session-1:43',
          createdAt: new Date(0),
        },
      ]),
    }
    const writer = new EvidenceJourneyWriter(
      new PrismaEvidenceJourneyPersistence({
        bridgeFlowEvidenceFact: {},
        bridgeFlowEvidenceRunBlock: runBlock,
      } as never),
    )

    await writer.writeRunBlock(
      'run-1',
      {
        runId: 'run-1',
        sessionId: 'session-1',
        seq: '43',
        rawEventRef: 'durable:run-1:session-1:43',
      },
      'partial ordered correlation',
    )

    expect(runBlock.upsert).toHaveBeenCalledWith({
      where: {
        runId_idempotencyKey: {
          runId: 'run-1',
          idempotencyKey: expect.stringContaining('durable:run-1:session-1:43'),
        },
      },
      create: expect.objectContaining({
        runId: 'run-1',
        reason: 'partial ordered correlation',
        evidenceRef: 'durable:run-1:session-1:43',
      }),
      update: {},
    })
    await expect(writer.loadRunBlocks('run-1')).resolves.toEqual([
      {
        revision: 1,
        reason: 'partial ordered correlation',
        evidenceRef: 'durable:run-1:session-1:43',
      },
    ])
  })
})
