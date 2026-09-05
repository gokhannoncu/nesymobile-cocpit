import { createHash } from 'node:crypto'
import { Prisma, prisma, type PrismaClient } from '@nesy/db'

export interface ReportingOutboxEvent {
  eventId: string
  runId: string
  occurrenceId?: string
  requestId?: string
  originId: string
  schemaVersion: number
  sequence: bigint
  revision: number
  kind: string
  payloadHash: string
  payload: Prisma.InputJsonValue
}

export interface ReportingSink {
  send(events: readonly ReportingOutboxEvent[]): Promise<void>
}

export interface ReportingOutboxWorkerMetrics {
  claimed: number
  delivered: number
  failed: number
  oldestPendingAgeMs: number | null
  sendMs: number
}

type ReportingPrisma = Pick<PrismaClient, '$transaction'> & {
  bridgeFlowReportingOutbox: {
    upsert(input: unknown): Promise<unknown>
    findMany(input: unknown): Promise<unknown[]>
    updateMany(input: unknown): Promise<{ count: number }>
    count(input: unknown): Promise<number>
  }
  bridgeFlowReportingProjection: {
    upsert(input: unknown): Promise<unknown>
  }
}

export function reportingPayloadHash(payload: unknown): string {
  return createHash('sha256')
    .update(stableJson(payload))
    .digest('hex')
}

export function buildReportingEvent(input: {
  runId: string
  occurrenceId?: string
  requestId?: string
  originId: string
  sequence: bigint
  revision: number
  kind: string
  payload: Prisma.InputJsonValue
  schemaVersion?: number
}): ReportingOutboxEvent {
  const schemaVersion = input.schemaVersion ?? 1
  const eventId = [
    input.originId,
    input.runId,
    input.occurrenceId ?? 'run',
    input.kind,
    input.sequence.toString(),
    input.revision.toString(),
    schemaVersion.toString(),
  ].join(':')
  return {
    ...input,
    schemaVersion,
    eventId,
    payloadHash: reportingPayloadHash(input.payload),
  }
}

export class PrismaReportingOutbox {
  constructor(private readonly client: ReportingPrisma) {}

  async enqueue(event: ReportingOutboxEvent, tx?: ReportingPrisma): Promise<void> {
    const client = tx ?? this.client
    await client.bridgeFlowReportingOutbox.upsert({
      where: { eventId: event.eventId },
      create: {
        eventId: event.eventId,
        runId: event.runId,
        occurrenceId: event.occurrenceId ?? null,
        requestId: event.requestId ?? null,
        originId: event.originId,
        schemaVersion: event.schemaVersion,
        sequence: event.sequence,
        revision: event.revision,
        kind: event.kind,
        payloadHash: event.payloadHash,
        payload: event.payload,
      },
      update: {},
    })
  }

  async drainBatch(options: {
    workerId: string
    sink: ReportingSink
    batchSize?: number
    claimMs?: number
    now?: Date
  }): Promise<ReportingOutboxWorkerMetrics> {
    const now = options.now ?? new Date()
    const claimExpiresAt = new Date(now.getTime() + (options.claimMs ?? 30_000))
    const batchSize = options.batchSize ?? 50
    const rows = await this.client.bridgeFlowReportingOutbox.findMany({
      where: {
        status: { in: ['PENDING', 'RETRY'] },
        nextAttemptAt: { lte: now },
        OR: [{ claimExpiresAt: null }, { claimExpiresAt: { lte: now } }],
      },
      orderBy: [{ createdAt: 'asc' }],
      take: batchSize,
      select: outboxSelect,
    })
    const ids = rows.map((row) => asOutboxRow(row).id)
    if (ids.length === 0) {
      return {
        claimed: 0,
        delivered: 0,
        failed: 0,
        oldestPendingAgeMs: await this.oldestPendingAgeMs(now),
        sendMs: 0,
      }
    }
    const claimed = await this.client.bridgeFlowReportingOutbox.updateMany({
      where: {
        id: { in: ids },
        status: { in: ['PENDING', 'RETRY'] },
        OR: [{ claimExpiresAt: null }, { claimExpiresAt: { lte: now } }],
      },
      data: {
        status: 'IN_FLIGHT',
        claimedBy: options.workerId,
        claimExpiresAt,
        attempts: { increment: 1 },
      },
    })
    if (claimed.count === 0) {
      return {
        claimed: 0,
        delivered: 0,
        failed: 0,
        oldestPendingAgeMs: await this.oldestPendingAgeMs(now),
        sendMs: 0,
      }
    }
    const claimedRows = rows.map(asOutboxRow).slice(0, claimed.count)
    const events = claimedRows.map(rowToEvent)
    const started = Date.now()
    try {
      await options.sink.send(events)
      await this.client.bridgeFlowReportingOutbox.updateMany({
        where: { id: { in: claimedRows.map((row) => row.id) }, claimedBy: options.workerId },
        data: {
          status: 'DELIVERED',
          deliveredAt: new Date(),
          claimExpiresAt: null,
          lastError: null,
        },
      })
      return {
        claimed: claimed.count,
        delivered: events.length,
        failed: 0,
        oldestPendingAgeMs: await this.oldestPendingAgeMs(now),
        sendMs: Date.now() - started,
      }
    } catch (error) {
      await this.client.bridgeFlowReportingOutbox.updateMany({
        where: { id: { in: claimedRows.map((row) => row.id) }, claimedBy: options.workerId },
        data: {
          status: 'RETRY',
          claimExpiresAt: null,
          nextAttemptAt: new Date(Date.now() + 5_000),
          lastError: error instanceof Error ? error.message.slice(0, 500) : 'reporting sink failed',
        },
      })
      return {
        claimed: claimed.count,
        delivered: 0,
        failed: events.length,
        oldestPendingAgeMs: await this.oldestPendingAgeMs(now),
        sendMs: Date.now() - started,
      }
    }
  }

  async oldestPendingAgeMs(now = new Date()): Promise<number | null> {
    const [oldest] = await this.client.bridgeFlowReportingOutbox.findMany({
      where: { status: { in: ['PENDING', 'RETRY', 'IN_FLIGHT'] } },
      orderBy: [{ createdAt: 'asc' }],
      take: 1,
      select: { createdAt: true },
    })
    const createdAt = asMaybeDate((oldest as { createdAt?: unknown } | undefined)?.createdAt)
    return createdAt === undefined ? null : Math.max(0, now.getTime() - createdAt.getTime())
  }
}

export class PrismaReportingProjectionSink implements ReportingSink {
  constructor(private readonly client: ReportingPrisma) {}

  async send(events: readonly ReportingOutboxEvent[]): Promise<void> {
    for (const event of events) {
      await this.client.bridgeFlowReportingProjection.upsert({
        where: { eventId: event.eventId },
        create: {
          eventId: event.eventId,
          runId: event.runId,
          occurrenceId: event.occurrenceId ?? null,
          originId: event.originId,
          schemaVersion: event.schemaVersion,
          sequence: event.sequence,
          revision: event.revision,
          kind: event.kind,
          payloadHash: event.payloadHash,
          payload: event.payload,
        },
        update: {},
      })
    }
  }
}

export function createPrismaReportingOutbox(): PrismaReportingOutbox {
  return new PrismaReportingOutbox(prisma as unknown as ReportingPrisma)
}

const outboxSelect = {
  id: true,
  eventId: true,
  runId: true,
  occurrenceId: true,
  requestId: true,
  originId: true,
  schemaVersion: true,
  sequence: true,
  revision: true,
  kind: true,
  payloadHash: true,
  payload: true,
  createdAt: true,
} as const

function rowToEvent(row: OutboxRow): ReportingOutboxEvent {
  return {
    eventId: row.eventId,
    runId: row.runId,
    ...(row.occurrenceId === null ? {} : { occurrenceId: row.occurrenceId }),
    ...(row.requestId === null ? {} : { requestId: row.requestId }),
    originId: row.originId,
    schemaVersion: row.schemaVersion,
    sequence: BigInt(row.sequence),
    revision: row.revision,
    kind: row.kind,
    payloadHash: row.payloadHash,
    payload: row.payload as Prisma.InputJsonValue,
  }
}

interface OutboxRow {
  id: string
  eventId: string
  runId: string
  occurrenceId: string | null
  requestId: string | null
  originId: string
  schemaVersion: number
  sequence: bigint | number | string
  revision: number
  kind: string
  payloadHash: string
  payload: unknown
  createdAt: Date
}

function asOutboxRow(value: unknown): OutboxRow {
  return value as OutboxRow
}

function asMaybeDate(value: unknown): Date | undefined {
  return value instanceof Date ? value : undefined
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}
