/**
 * ===========================================================================
 *  DURABLE EVENT RUNTIME READ MODEL  (plan D.2 items 8, 9, 21)
 *
 *  Read-only. Every route here is a SELECT, and that is a constraint rather
 *  than a coincidence: a diagnostic surface that can mutate delivery state is a
 *  surface that will eventually be used to "unstick" a stream by hand, which is
 *  exactly how ordered evidence gets silently skipped.
 *
 *  ## Why this exists at all
 *
 *  A durable pipeline's worst failure is not a crash — it is stalling quietly.
 *  Consumer lag, oldest-unprocessed age, retry attempts and dead-lettered rows
 *  are all invisible from the outside and none of them break a test. Without a
 *  place to read them, "the event never arrived" gets diagnosed as an SDK fault
 *  with no evidence either way, which the plan explicitly forbids.
 * ===========================================================================
 */
import type { FastifyInstance, FastifyReply } from 'fastify'

import { getVerdictDurableRuntime } from '../services/verdict-wait-event.js'

/**
 * A durable-runtime read that cannot reach PostgreSQL is a 503, not a 500.
 *
 * The distinction matters operationally: 503 says "the runtime's backing store
 * is unreachable, the answer is unknown", whereas 500 would invite someone to
 * read an empty health payload as "nothing is wrong".
 */
async function withStore<T>(reply: FastifyReply, read: () => Promise<T>): Promise<T | undefined> {
  try {
    return await read()
  } catch (err) {
    await reply.code(503).send({
      status: 'unavailable',
      detail: err instanceof Error ? err.message : String(err),
    })
    return undefined
  }
}

export async function verdictEventsRoutes(app: FastifyInstance) {
  /** Streams needing attention: lag, undispatched receipts, or dead letters. */
  app.get('/events/health', async (_request, reply) => {
    const health = await withStore(reply, () => getVerdictDurableRuntime().health())
    if (!health) return
    return health
  })

  /**
   * Wire-level ingress counters for the device WS.
   *
   * Exists because the stream guard drops foreign-stream frames silently: no ack,
   * no row, no log. A device whose journal never drains has no other way to show
   * that its gap frames were received and discarded.
   */
  app.get('/events/ws-ingress', async () => {
    const { TestEventWsServer } = await import('../services/test-event-ws-server.js')
    return TestEventWsServer.ingressDiagnostics()
  })

  /**
   * The device's last reported screen per live run.
   *
   * `UI.*_READY` facts are produced from this state, so a wait that times out is
   * either "the device never reported the screen" or "the pack maps that screen to
   * a different runtime implementation". Both look like an absent fact from the
   * run record; only this tells them apart.
   */
  app.get('/events/screen-readiness', async () => {
    const { getScreenReadinessObserver } = await import(
      '../services/screen-readiness-observer.js'
    )
    return { runs: getScreenReadinessObserver().snapshot() }
  })

  /** One stream, reported whether it is healthy or not. */
  app.get<{ Params: { runId: string; sessionId: string } }>(
    '/events/health/:runId/:sessionId',
    async (request, reply) => {
      const { runId, sessionId } = request.params
      const health = await withStore(reply, () =>
        getVerdictDurableRuntime().health({ runId, sessionId }),
      )
      if (!health) return
      return health
    },
  )

  /**
   * The SDK's bounded `EmitOutcome` diagnostic (D.2 / C.14 companion).
   *
   * GET, and provably side-effect free: if answering "was seq N durable?" wrote
   * a durable event, a device unsure about delivery would generate load exactly
   * when the host is already struggling, and the question would become its own
   * answer.
   */
  app.get<{ Querystring: { runId?: string; sessionId?: string; throughSeq?: string } }>(
    '/events/emit-outcome',
    async (request, reply) => {
      const { runId, sessionId, throughSeq } = request.query
      if (!runId || !sessionId || !throughSeq) {
        return reply.code(400).send({
          status: 'invalid_request',
          detail: 'runId, sessionId and throughSeq are required',
        })
      }
      if (!/^\d{1,19}$/.test(throughSeq)) {
        // Rejected rather than coerced: seq is a Kotlin Long on the device, and a
        // silently truncated one would answer a question about a different event.
        return reply.code(400).send({
          status: 'invalid_request',
          detail: 'throughSeq must be a decimal string',
        })
      }
      const result = await withStore(reply, () =>
        getVerdictDurableRuntime().emitOutcomeDiagnostic(runId, sessionId, throughSeq),
      )
      if (!result) return
      return result
    },
  )
}
