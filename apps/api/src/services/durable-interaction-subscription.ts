export const DURABLE_INTERACTION_API_VERSION = 'verdict-runtime.v1' as const

export type InteractionOrigin = 'BRIDGE_INJECTED' | 'MANUAL' | 'UNKNOWN'

export interface DurableInteractionEvent {
  eventId: string
  runId: string
  revision: number
  origin: InteractionOrigin
  confidence: number
  occurredAtMs: number
  summary: string
  secretRedacted: true
}

export interface InteractionSubscriptionCursor {
  runId: string
  afterRevision: number
}

/** Append-only per-run event log behind the revision cursor. */
export interface DurableInteractionStore {
  listByRun(runId: string): Promise<DurableInteractionEvent[]>
  append(event: DurableInteractionEvent): Promise<DurableInteractionEvent>
}

export class InMemoryDurableInteractionStore implements DurableInteractionStore {
  private readonly events = new Map<string, DurableInteractionEvent[]>()

  async listByRun(runId: string): Promise<DurableInteractionEvent[]> {
    return this.events.get(runId) ?? []
  }

  async append(event: DurableInteractionEvent): Promise<DurableInteractionEvent> {
    const list = this.events.get(event.runId) ?? []
    list.push(event)
    this.events.set(event.runId, list)
    return event
  }
}

export class DurableInteractionSubscription {
  constructor(
    private readonly store: DurableInteractionStore = new InMemoryDurableInteractionStore(),
  ) {}

  async append(
    event: Omit<DurableInteractionEvent, 'revision' | 'secretRedacted'>,
  ): Promise<DurableInteractionEvent> {
    const list = await this.store.listByRun(event.runId)
    const revision = (list.at(-1)?.revision ?? 0) + 1
    const stored: DurableInteractionEvent = {
      ...event,
      revision,
      secretRedacted: true,
      summary: redactSecrets(event.summary),
    }
    return this.store.append(stored)
  }

  async read(cursor: InteractionSubscriptionCursor) {
    const list = await this.store.listByRun(cursor.runId)
    const items = list.filter((event) => event.revision > cursor.afterRevision)
    return {
      apiVersion: DURABLE_INTERACTION_API_VERSION,
      runId: cursor.runId,
      afterRevision: cursor.afterRevision,
      latestRevision: list.at(-1)?.revision ?? cursor.afterRevision,
      items,
      reconnectCursor: {
        runId: cursor.runId,
        afterRevision: items.at(-1)?.revision ?? cursor.afterRevision,
      },
    }
  }
}

function redactSecrets(summary: string): string {
  return summary
    .replace(/(password|pin|token|secret)\s*[:=]\s*\S+/gi, '$1=[REDACTED]')
    .replace(/\b\d{4,8}\b/g, '[REDACTED_PIN]')
}
