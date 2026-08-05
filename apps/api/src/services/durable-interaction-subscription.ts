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

export class DurableInteractionSubscription {
  private readonly events = new Map<string, DurableInteractionEvent[]>()

  append(event: Omit<DurableInteractionEvent, 'revision' | 'secretRedacted'>): DurableInteractionEvent {
    const list = this.events.get(event.runId) ?? []
    const revision = (list.at(-1)?.revision ?? 0) + 1
    const stored: DurableInteractionEvent = {
      ...event,
      revision,
      secretRedacted: true,
      summary: redactSecrets(event.summary),
    }
    list.push(stored)
    this.events.set(event.runId, list)
    return stored
  }

  read(cursor: InteractionSubscriptionCursor) {
    const list = this.events.get(cursor.runId) ?? []
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
