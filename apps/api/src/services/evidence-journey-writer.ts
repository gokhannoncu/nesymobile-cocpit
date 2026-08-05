import { Prisma, prisma, type PrismaClient } from '@nesy/db'
import { buildEvidenceRevisionIdempotencyKey, type EvidenceJourneyEntry } from '@nesy/execution-contract'
import type { EvidenceDeliveryLane, NormalizedEvidenceFact } from '@nesy/oracle-engine'
import {
  type BridgeFlowEvidenceRuntime,
  type BlockedRevision,
  type EvidencePublication,
  type EvidenceScope,
} from './bridgeflow-evidence-runtime.js'
import { classifyEvidenceJourney } from './evidence-journey-classifier.js'
import type {
  DurableEvidenceAuditIdentity,
  ResolverAcceptedEvidence,
} from './evidence-source-resolver.js'

export type EvidenceCorrelationStatus =
  | 'PENDING'
  | 'CORRELATED'
  | 'MISMATCH'
  | 'STALE'
  | 'CONFLICT'

export interface RawEvidenceAuditIdentity {
  runId: string
  sessionId: string
  seq: string
  rawEventRef: string
}

export interface EvidenceJourneyWrite {
  runId: string
  occurrenceId: string
  iterationKey: string
  factKey: string
  revision: number
  rawAuditIdentity: RawEvidenceAuditIdentity
  normalizedFact: NormalizedEvidenceFact
  reducerTrace: readonly string[]
  authority: NormalizedEvidenceFact['authority']
  confidence: number
  correlationStatus: EvidenceCorrelationStatus
  journey: EvidenceJourneyEntry
}

export interface PersistedEvidenceJourneyRevision extends EvidenceJourneyWrite {
  idempotencyKey: string
  journeyStage: EvidenceJourneyEntry['stage']
  journeyState: EvidenceJourneyEntry['state']
  journeyReason?: string
}

export interface PersistedEvidenceRunBlock {
  runId: string
  idempotencyKey: string
  reason: string
  evidenceRef: string
}

export interface EvidenceJourneyPersistencePort {
  allocateEvidenceRevision(identity: {
    runId: string
    occurrenceId: string
    iterationKey: string
    factKey: string
    deliveryLane: EvidenceDeliveryLane
    observationId: string
  }): Promise<number>
  upsertEvidenceRevision(record: PersistedEvidenceJourneyRevision): Promise<void>
  loadEvidenceScope(scope: EvidenceScope): Promise<readonly EvidencePublication[]>
  loadEvidenceBlocks(scope: EvidenceScope): Promise<readonly BlockedRevision[]>
  persistRunBlock(block: PersistedEvidenceRunBlock): Promise<void>
  loadRunBlocks(runId: string): Promise<readonly BlockedRevision[]>
}

export class EvidenceJourneyWriter {
  constructor(private readonly persistence: EvidenceJourneyPersistencePort) {}

  async write(observation: EvidenceJourneyWrite): Promise<PersistedEvidenceJourneyRevision> {
    if (!Number.isInteger(observation.revision) || observation.revision < 1) {
      throw new Error('evidence revision must be a positive integer')
    }
    const idempotencyKey = buildEvidenceRevisionIdempotencyKey({
      runId: observation.runId,
      occurrenceId: observation.occurrenceId,
      iterationKey: observation.iterationKey,
      factKey: observation.factKey,
      deliveryLane: observation.normalizedFact.deliveryLane,
      revision: observation.revision,
    })
    const record: PersistedEvidenceJourneyRevision = {
      ...observation,
      idempotencyKey,
      journeyStage: observation.journey.stage,
      journeyState: observation.journey.state,
      ...(observation.journey.reason === undefined
        ? {}
        : { journeyReason: observation.journey.reason }),
    }
    await this.persistence.upsertEvidenceRevision(record)
    return record
  }

  async writeResolved(
    resolved: ResolverAcceptedEvidence,
  ): Promise<PersistedEvidenceJourneyRevision> {
    const publication = resolved.publication
    const fact = publication.fact
    const revision = await this.persistence.allocateEvidenceRevision({
      runId: publication.runId,
      occurrenceId: fact.occurrenceId,
      iterationKey: fact.iterationKey,
      factKey: fact.factKey,
      deliveryLane: fact.deliveryLane,
      observationId: resolved.audit.rawEventRef,
    })
    const ordered = publication.lane === 'ORDERED_REQUIRED'
    const journey = classifyEvidenceJourney({
      factKey: fact.factKey,
      occurrenceId: fact.occurrenceId,
      stages: {
        INBOX: { outcome: 'OBSERVED', reason: 'durable inbox row committed' },
        RECEIPT: { outcome: 'OBSERVED', reason: 'receipt-safe row available' },
        ...(ordered
          ? {
              ORDERED: { outcome: 'OBSERVED' as const, reason: 'contiguous ordered row consumed' },
              NORMALIZATION: {
                outcome: 'OBSERVED' as const,
                reason: 'trusted source normalized',
              },
              CORRELATION: {
                outcome: 'OBSERVED' as const,
                reason: 'run, occurrence, and iteration correlated',
              },
            }
          : {}),
      },
      authority: fact.authority,
      confidence: resolved.confidence,
    })
    const currentStage = ordered ? 'CORRELATION' : 'RECEIPT'
    const currentJourney = journey.find((entry) => entry.stage === currentStage)
    if (currentJourney === undefined) throw new Error(`missing ${currentStage} journey transition`)
    return this.write({
      runId: publication.runId,
      occurrenceId: fact.occurrenceId,
      iterationKey: fact.iterationKey,
      factKey: fact.factKey,
      revision,
      rawAuditIdentity: resolved.audit,
      normalizedFact: fact,
      reducerTrace: fact.reducerTrace ?? [],
      authority: fact.authority,
      confidence: resolved.confidence,
      correlationStatus: 'CORRELATED',
      journey: currentJourney,
    })
  }

  loadScope(scope: EvidenceScope): Promise<readonly EvidencePublication[]> {
    return this.persistence.loadEvidenceScope(scope)
  }

  loadBlocks(scope: EvidenceScope): Promise<readonly BlockedRevision[]> {
    return this.persistence.loadEvidenceBlocks(scope)
  }

  loadRunBlocks(runId: string): Promise<readonly BlockedRevision[]> {
    return this.persistence.loadRunBlocks(runId)
  }

  async writeRunBlock(
    runId: string,
    audit: DurableEvidenceAuditIdentity,
    reason: string,
  ): Promise<PersistedEvidenceRunBlock> {
    const evidenceRef = audit.rawEventRef
    const block = {
      runId,
      idempotencyKey: `evidence-run-block:v1:${evidenceRef.length}:${evidenceRef}`,
      reason,
      evidenceRef,
    }
    await this.persistence.persistRunBlock(block)
    return block
  }

  async writeBlock(
    scope: EvidenceScope,
    audit: DurableEvidenceAuditIdentity,
    reason: string,
  ): Promise<PersistedEvidenceJourneyRevision> {
    const factKey = '__ordered_block__'
    const deliveryLane = 'ORDERED_REQUIRED' as const
    const revision = await this.persistence.allocateEvidenceRevision({
      ...scope,
      factKey,
      deliveryLane,
      observationId: `${audit.rawEventRef}:block`,
    })
    return this.write({
      ...scope,
      factKey,
      revision,
      rawAuditIdentity: audit,
      normalizedFact: {
        factKey,
        occurrenceId: scope.occurrenceId,
        iterationKey: scope.iterationKey,
        observedAtMs: 0,
        freshnessMaxAgeMs: 2_147_483_647,
        plane: 'LOCAL',
        subtype: 'durable-ordering',
        value: 'UNKNOWN',
        authority: 'FALLBACK',
        deliveryLane,
        rawEventId: audit.rawEventRef,
        reducerTrace: ['durable ordered rejection'],
      },
      reducerTrace: ['durable ordered rejection'],
      authority: 'FALLBACK',
      confidence: 0,
      correlationStatus: 'MISMATCH',
      journey: {
        factKey,
        occurrenceId: scope.occurrenceId,
        stage: 'ORDERED',
        state: 'BLOCKED',
        reason,
      },
    })
  }
}

export class InMemoryEvidenceJourneyPersistence implements EvidenceJourneyPersistencePort {
  private readonly byIdempotencyKey = new Map<string, PersistedEvidenceJourneyRevision>()
  private readonly revisionByObservation = new Map<string, number>()
  private readonly runBlockByIdempotencyKey = new Map<string, PersistedEvidenceRunBlock>()

  get rows(): readonly PersistedEvidenceJourneyRevision[] {
    return [...this.byIdempotencyKey.values()]
  }

  get runBlocks(): readonly PersistedEvidenceRunBlock[] {
    return [...this.runBlockByIdempotencyKey.values()]
  }

  async allocateEvidenceRevision(identity: {
    runId: string
    occurrenceId: string
    iterationKey: string
    factKey: string
    deliveryLane: EvidenceDeliveryLane
    observationId: string
  }): Promise<number> {
    const observationKey = JSON.stringify([
      identity.runId,
      identity.occurrenceId,
      identity.iterationKey,
      identity.factKey,
      identity.deliveryLane,
      identity.observationId,
    ])
    const existing = this.revisionByObservation.get(observationKey)
    if (existing !== undefined) return existing
    const latest = Math.max(
      0,
      ...this.rows
        .filter(
          (row) =>
            row.runId === identity.runId &&
            row.occurrenceId === identity.occurrenceId &&
            row.iterationKey === identity.iterationKey &&
            row.factKey === identity.factKey &&
            row.normalizedFact.deliveryLane === identity.deliveryLane,
        )
        .map((row) => row.revision),
    )
    const revision = boundedNextRevision(latest)
    this.revisionByObservation.set(observationKey, revision)
    return revision
  }

  async upsertEvidenceRevision(record: PersistedEvidenceJourneyRevision): Promise<void> {
    this.byIdempotencyKey.set(record.idempotencyKey, structuredClone(record))
  }

  async loadEvidenceScope(scope: EvidenceScope): Promise<readonly EvidencePublication[]> {
    return this.rows
      .filter(
        (row) =>
          row.runId === scope.runId &&
          row.occurrenceId === scope.occurrenceId &&
          row.iterationKey === scope.iterationKey,
      )
      .filter((row) => row.journeyState !== 'BLOCKED')
      .map(toPublication)
  }

  async loadEvidenceBlocks(scope: EvidenceScope): Promise<readonly BlockedRevision[]> {
    return this.rows
      .filter(
        (row) =>
          row.runId === scope.runId &&
          row.occurrenceId === scope.occurrenceId &&
          row.iterationKey === scope.iterationKey &&
          row.journeyState === 'BLOCKED',
      )
      .map((row) => ({
        revision: row.revision,
        reason: row.journeyReason ?? 'durable ordered evidence blocked',
        evidenceRef: row.rawAuditIdentity.rawEventRef,
      }))
  }

  async persistRunBlock(block: PersistedEvidenceRunBlock): Promise<void> {
    this.runBlockByIdempotencyKey.set(block.idempotencyKey, structuredClone(block))
  }

  async loadRunBlocks(runId: string): Promise<readonly BlockedRevision[]> {
    return this.runBlocks
      .filter((block) => block.runId === runId)
      .map((block, index) => ({
        revision: index + 1,
        reason: block.reason,
        evidenceRef: block.evidenceRef,
      }))
  }
}

export type PrismaEvidenceClient = Pick<
  PrismaClient,
  'bridgeFlowEvidenceFact' | 'bridgeFlowEvidenceRunBlock'
>

export class PrismaEvidenceJourneyPersistence implements EvidenceJourneyPersistencePort {
  constructor(private readonly client: PrismaEvidenceClient) {}

  async allocateEvidenceRevision(identity: {
    runId: string
    occurrenceId: string
    iterationKey: string
    factKey: string
    deliveryLane: EvidenceDeliveryLane
    observationId: string
  }): Promise<number> {
    const existing = await this.client.bridgeFlowEvidenceFact.findFirst({
      where: {
        runId: identity.runId,
        occurrenceId: identity.occurrenceId,
        iterationKey: identity.iterationKey,
        factKey: identity.factKey,
        deliveryLane: identity.deliveryLane,
        rawEventRef: identity.observationId,
      },
      select: { revision: true },
    })
    if (existing !== null) return existing.revision
    const latest = await this.client.bridgeFlowEvidenceFact.aggregate({
      where: {
        runId: identity.runId,
        occurrenceId: identity.occurrenceId,
        iterationKey: identity.iterationKey,
        factKey: identity.factKey,
        deliveryLane: identity.deliveryLane,
      },
      _max: { revision: true },
    })
    return boundedNextRevision(latest._max.revision ?? 0)
  }

  async upsertEvidenceRevision(record: PersistedEvidenceJourneyRevision): Promise<void> {
    const fact = record.normalizedFact
    const data = {
      idempotencyKey: record.idempotencyKey,
      plane: fact.plane,
      sourceSubtype: fact.subtype,
      value: toInputJson(fact.value),
      authority: record.authority,
      deliveryLane: fact.deliveryLane,
      rawEventRef: record.rawAuditIdentity.rawEventRef,
      reducerTrace: toInputJson({
        steps: [...record.reducerTrace],
        rawAuditIdentity: record.rawAuditIdentity,
        confidence: record.confidence,
        journeyReason: record.journeyReason ?? null,
        resolverAccepted: true,
      }),
      freshnessMaxAgeMs: fact.freshnessMaxAgeMs,
      correlationStatus: record.correlationStatus,
      journeyStage: record.journeyStage,
      journeyState: record.journeyState,
      observedAt: new Date(fact.observedAtMs),
    }
    const stored = await this.client.bridgeFlowEvidenceFact.upsert({
      where: {
        runId_occurrenceId_iterationKey_factKey_deliveryLane_revision: {
          runId: record.runId,
          occurrenceId: record.occurrenceId,
          iterationKey: record.iterationKey,
          factKey: record.factKey,
          deliveryLane: fact.deliveryLane,
          revision: record.revision,
        },
      },
      create: {
        runId: record.runId,
        occurrenceId: record.occurrenceId,
        iterationKey: record.iterationKey,
        factKey: record.factKey,
        revision: record.revision,
        ...data,
      },
      update: {},
    })
    if (
      typeof stored === 'object' &&
      stored !== null &&
      'rawEventRef' in stored &&
      stored.rawEventRef !== record.rawAuditIdentity.rawEventRef
    ) {
      throw new Error(
        `evidence revision allocation collision at ${record.factKey} revision ${record.revision}`,
      )
    }
  }

  async loadEvidenceScope(scope: EvidenceScope): Promise<readonly EvidencePublication[]> {
    const rows = await this.client.bridgeFlowEvidenceFact.findMany({
      where: {
        runId: scope.runId,
        occurrenceId: scope.occurrenceId,
        iterationKey: scope.iterationKey,
      },
      orderBy: { revision: 'asc' },
    })
    const publications: EvidencePublication[] = []
    for (const row of rows) {
      const metadata = asRecord(row.reducerTrace)
      const fact = persistedFact({
        factKey: row.factKey,
        occurrenceId: row.occurrenceId,
        iterationKey: row.iterationKey,
        observedAtMs: row.observedAt.getTime(),
        freshnessMaxAgeMs: row.freshnessMaxAgeMs,
        plane: row.plane,
        subtype: row.sourceSubtype,
        value: row.value,
        authority: row.authority,
        deliveryLane: row.deliveryLane,
        rawEventId: row.rawEventRef,
        reducerTrace: metadata?.steps,
      })
      if (
        metadata?.resolverAccepted !== true ||
        row.correlationStatus !== 'CORRELATED' ||
        fact === undefined
      ) {
        continue
      }
      publications.push({
        runId: row.runId,
        fact,
        revision: row.revision,
        lane: fact.deliveryLane,
        correlationStatus: 'CORRELATED',
        trust: 'RESOLVER_ACCEPTED',
      })
    }
    return publications
  }

  async loadEvidenceBlocks(scope: EvidenceScope): Promise<readonly BlockedRevision[]> {
    const rows = await this.client.bridgeFlowEvidenceFact.findMany({
      where: {
        runId: scope.runId,
        occurrenceId: scope.occurrenceId,
        iterationKey: scope.iterationKey,
        journeyState: 'BLOCKED',
        deliveryLane: 'ORDERED_REQUIRED',
      },
      orderBy: { revision: 'asc' },
    })
    return rows.map((row) => {
      const metadata = asRecord(row.reducerTrace)
      return {
        revision: row.revision,
        reason:
          typeof metadata?.journeyReason === 'string'
            ? metadata.journeyReason
            : 'durable ordered evidence blocked',
        ...(row.rawEventRef === null ? {} : { evidenceRef: row.rawEventRef }),
      }
    })
  }

  async persistRunBlock(block: PersistedEvidenceRunBlock): Promise<void> {
    await this.client.bridgeFlowEvidenceRunBlock.upsert({
      where: {
        runId_idempotencyKey: {
          runId: block.runId,
          idempotencyKey: block.idempotencyKey,
        },
      },
      create: block,
      update: {},
    })
  }

  async loadRunBlocks(runId: string): Promise<readonly BlockedRevision[]> {
    const rows = await this.client.bridgeFlowEvidenceRunBlock.findMany({
      where: { runId },
      orderBy: { createdAt: 'asc' },
    })
    return rows.map((row, index) => ({
      revision: index + 1,
      reason: row.reason,
      ...(row.evidenceRef === null ? {} : { evidenceRef: row.evidenceRef }),
    }))
  }
}

export function createPrismaEvidenceJourneyWriter(): EvidenceJourneyWriter {
  return new EvidenceJourneyWriter(new PrismaEvidenceJourneyPersistence(prisma))
}

export async function persistBridgeFlowDurableEvidence(
  resolved: ResolverAcceptedEvidence,
  writer: EvidenceJourneyWriter,
): Promise<PersistedEvidenceJourneyRevision> {
  return writer.writeResolved(resolved)
}

export async function hydrateEvidenceScope(
  scope: EvidenceScope,
  persistence: EvidenceJourneyPersistencePort,
  runtime: BridgeFlowEvidenceRuntime,
): Promise<void> {
  runtime.hydrate(await persistence.loadEvidenceScope(scope))
  for (const blocked of await persistence.loadEvidenceBlocks(scope)) runtime.block(scope, blocked)
  for (const blocked of await persistence.loadRunBlocks(scope.runId)) {
    runtime.blockRun(scope.runId, blocked)
  }
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function boundedNextRevision(latest: number): number {
  if (!Number.isInteger(latest) || latest < 0 || latest >= 2_147_483_647) {
    throw new Error('evidence logical revision exhausted Prisma Int range')
  }
  return latest + 1
}

function toPublication(row: PersistedEvidenceJourneyRevision): EvidencePublication {
  return {
    runId: row.runId,
    fact: structuredClone(row.normalizedFact),
    revision: row.revision,
    lane: row.normalizedFact.deliveryLane,
    correlationStatus:
      row.correlationStatus === 'CORRELATED'
        ? 'CORRELATED'
        : row.correlationStatus === 'PENDING'
          ? 'PENDING'
          : 'MISMATCH',
    trust: 'RESOLVER_ACCEPTED',
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function persistedFact(input: {
  factKey: string
  occurrenceId: string
  iterationKey: string
  observedAtMs: number
  freshnessMaxAgeMs: number | null
  plane: string
  subtype: string
  value: unknown
  authority: string
  deliveryLane: string
  rawEventId: string | null
  reducerTrace: unknown
}): NormalizedEvidenceFact | undefined {
  if (
    !['UI', 'APP', 'LOCAL', 'REMOTE'].includes(input.plane) ||
    !['PRIMARY', 'CONFIRMATORY', 'FALLBACK'].includes(input.authority) ||
    !['RECEIPT_SAFE', 'ORDERED_REQUIRED'].includes(input.deliveryLane) ||
    (input.value !== true &&
      input.value !== false &&
      input.value !== 'UNKNOWN' &&
      input.value !== 'NOT_APPLICABLE') ||
    input.freshnessMaxAgeMs === null ||
    !Number.isInteger(input.freshnessMaxAgeMs) ||
    input.freshnessMaxAgeMs <= 0
  ) {
    return undefined
  }
  return {
    factKey: input.factKey,
    occurrenceId: input.occurrenceId,
    iterationKey: input.iterationKey,
    observedAtMs: input.observedAtMs,
    freshnessMaxAgeMs: input.freshnessMaxAgeMs,
    plane: input.plane as NormalizedEvidenceFact['plane'],
    subtype: input.subtype,
    value: input.value,
    authority: input.authority as NormalizedEvidenceFact['authority'],
    deliveryLane: input.deliveryLane as NormalizedEvidenceFact['deliveryLane'],
    ...(input.rawEventId === null ? {} : { rawEventId: input.rawEventId }),
    reducerTrace: Array.isArray(input.reducerTrace)
      ? input.reducerTrace.filter((entry): entry is string => typeof entry === 'string')
      : [],
  }
}
