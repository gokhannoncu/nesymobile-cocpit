import { describe, expect, it, vi } from 'vitest'

import {
  buildReportingEvent,
  PrismaReportingOutbox,
  PrismaReportingProjectionSink,
  type ReportingOutboxEvent,
} from './bridgeflow-reporting-outbox.js'

function clientFixture() {
  const outboxRows: any[] = []
  const projectionRows: any[] = []
  const outbox = {
    upsert: vi.fn(async ({ where, create }: any) => {
      if (!outboxRows.some((row) => row.eventId === where.eventId)) {
        outboxRows.push({
          id: `outbox-${outboxRows.length + 1}`,
          createdAt: new Date('2026-09-05T07:59:00.000Z'),
          status: 'PENDING',
          attempts: 0,
          nextAttemptAt: new Date('2026-09-05T07:59:00.000Z'),
          claimExpiresAt: null,
          claimedBy: null,
          ...create,
        })
      }
    }),
    findMany: vi.fn(async ({ where, take, select }: any = {}) => {
      void select
      let rows = outboxRows
      if (where?.status?.in) rows = rows.filter((row) => where.status.in.includes(row.status))
      if (where?.nextAttemptAt?.lte) rows = rows.filter((row) => row.nextAttemptAt === undefined || row.nextAttemptAt <= where.nextAttemptAt.lte)
      return rows.slice(0, take ?? rows.length)
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const ids = where?.id?.in ?? []
      const matched = outboxRows.filter((row) => ids.includes(row.id))
      for (const row of matched) {
        Object.assign(row, {
          ...data,
          attempts: data.attempts?.increment === undefined
            ? row.attempts
            : row.attempts + data.attempts.increment,
        })
      }
      return { count: matched.length }
    }),
    count: vi.fn(async ({ where }: any = {}) =>
      outboxRows.filter((row) => where?.status?.in === undefined || where.status.in.includes(row.status)).length),
  }
  const projection = {
    upsert: vi.fn(async ({ where, create }: any) => {
      if (!projectionRows.some((row) => row.eventId === where.eventId)) projectionRows.push(create)
    }),
  }
  return {
    client: {
      bridgeFlowReportingOutbox: outbox,
      bridgeFlowReportingProjection: projection,
      $transaction: vi.fn(async (work: (tx: unknown) => unknown) => work({})),
    } as never,
    outboxRows,
    projectionRows,
  }
}

describe('BridgeFlow reporting outbox', () => {
  it('builds stable event IDs and payload hashes for retries', () => {
    const left = buildReportingEvent({
      runId: 'run-1',
      originId: 'origin-1',
      sequence: 1n,
      revision: 1,
      kind: 'STEP_PROJECTION',
      payload: { b: 2, a: 1 },
    })
    const right = buildReportingEvent({
      runId: 'run-1',
      originId: 'origin-1',
      sequence: 1n,
      revision: 1,
      kind: 'STEP_PROJECTION',
      payload: { a: 1, b: 2 },
    })
    expect(left.eventId).toEqual(right.eventId)
    expect(left.payloadHash).toEqual(right.payloadHash)
  })

  it('keeps accepted events idempotent when ACK is lost and retried', async () => {
    const { client, outboxRows, projectionRows } = clientFixture()
    const outbox = new PrismaReportingOutbox(client)
    const sink = new PrismaReportingProjectionSink(client)
    const event = eventFixture()
    await outbox.enqueue(event)

    await expect(sink.send([event])).resolves.toBeUndefined()
    await outbox.drainBatch({
      workerId: 'worker-1',
      sink,
      now: new Date('2026-09-05T08:00:00.000Z'),
    })

    expect(projectionRows).toHaveLength(1)
    expect(outboxRows[0]).toMatchObject({ status: 'DELIVERED' })
  })

  it('preserves backlog when sink is offline and drains later', async () => {
    const { client, outboxRows, projectionRows } = clientFixture()
    const outbox = new PrismaReportingOutbox(client)
    await outbox.enqueue(eventFixture())
    const offline = { send: vi.fn(async () => { throw new Error('offline') }) }

    const failed = await outbox.drainBatch({
      workerId: 'worker-1',
      sink: offline,
      now: new Date('2026-09-05T08:00:00.000Z'),
    })
    expect(failed).toMatchObject({ claimed: 1, delivered: 0, failed: 1 })
    expect(outboxRows[0]).toMatchObject({ status: 'RETRY' })

    const drained = await outbox.drainBatch({
      workerId: 'worker-2',
      sink: new PrismaReportingProjectionSink(client),
      now: new Date(Date.now() + 10_000),
    })
    expect(drained).toMatchObject({ claimed: 1, delivered: 1, failed: 0 })
    expect(projectionRows).toHaveLength(1)
  })
})

function eventFixture(): ReportingOutboxEvent {
  return buildReportingEvent({
    runId: 'run-1',
    occurrenceId: 'occ-1',
    requestId: 'request-1',
    originId: 'origin-1',
    sequence: 1n,
    revision: 1,
    kind: 'STEP_PROJECTION',
    payload: { status: 'SUCCEEDED' },
  })
}
