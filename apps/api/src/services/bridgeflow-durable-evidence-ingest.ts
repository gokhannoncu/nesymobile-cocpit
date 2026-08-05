import type { EvidenceDeliveryLane } from '@nesy/oracle-engine'

import {
  type BridgeFlowEvidenceRuntime,
  type EvidencePublication,
  type EvidenceScope,
} from './bridgeflow-evidence-runtime.js'
import {
  type EvidenceJourneyWriter,
  type PersistedEvidenceJourneyRevision,
} from './evidence-journey-writer.js'
import {
  resolveBridgeFlowDurableEvent,
  type DurableEvidenceAuditIdentity,
  type DurableEvidenceResolution,
  type EvidenceSourceResolver,
} from './evidence-source-resolver.js'

export type PreparedDurableEvidence =
  | {
      status: 'ACCEPTED'
      publication: EvidencePublication
      persisted: PersistedEvidenceJourneyRevision
    }
  | Exclude<DurableEvidenceResolution, { status: 'ACCEPTED' }>

export class DurableBridgeFlowEvidenceIngest {
  constructor(
    private readonly options: {
      resolver: EvidenceSourceResolver
      writer: EvidenceJourneyWriter
      runtime: BridgeFlowEvidenceRuntime
    },
  ) {}

  async persist(
    candidate: unknown,
    lane: EvidenceDeliveryLane,
    audit: DurableEvidenceAuditIdentity,
  ): Promise<PreparedDurableEvidence> {
    const resolution = resolveBridgeFlowDurableEvent(
      candidate,
      lane,
      this.options.resolver,
      audit,
    )
    if (resolution.status === 'LEGACY_NO_CONTEXT') return resolution
    if (resolution.status === 'REJECTED') {
      await this.blockRejected(
        resolution,
        audit,
        resolution.reason,
        lane === 'ORDERED_REQUIRED',
      )
      if (lane === 'ORDERED_REQUIRED') {
        throw new Error(`ordered evidence rejected: ${resolution.reason}`)
      }
      return resolution
    }
    const persisted = await this.options.writer.writeResolved(resolution)
    return {
      status: 'ACCEPTED',
      persisted,
      publication: {
        ...resolution.publication,
        revision: persisted.revision,
      },
    }
  }

  publish(prepared: PreparedDurableEvidence): void {
    if (prepared.status === 'ACCEPTED') this.options.runtime.publish(prepared.publication)
  }

  async observeOrderedBlock(
    candidate: unknown,
    audit: DurableEvidenceAuditIdentity,
    reason: string,
  ): Promise<void> {
    const resolution = resolveBridgeFlowDurableEvent(
      candidate,
      'ORDERED_REQUIRED',
      this.options.resolver,
      audit,
    )
    if (resolution.status === 'LEGACY_NO_CONTEXT') return
    if (resolution.status === 'ACCEPTED') {
      const scope = scopeOf(resolution.publication)
      const blocked = {
        revision: boundedBlockRevision(
          this.options.runtime.latestRevision(scope),
        ),
        reason,
        evidenceRef: audit.rawEventRef,
      }
      this.options.runtime.block(scope, blocked)
      await this.options.writer.writeBlock(scope, audit, reason)
      return
    }
    await this.blockRejected(resolution, audit, reason, true)
  }

  async observeMalformedOrderedRow(
    audit: DurableEvidenceAuditIdentity,
    reason: string,
  ): Promise<void> {
    await this.persistAndBlockRun(audit.runId, audit, reason, true)
  }

  async hydrate(scope: EvidenceScope): Promise<void> {
    this.options.runtime.hydrate(await this.options.writer.loadScope(scope))
    for (const blocked of await this.options.writer.loadBlocks(scope)) {
      this.options.runtime.block(scope, blocked)
    }
    for (const blocked of await this.options.writer.loadRunBlocks(scope.runId)) {
      this.options.runtime.blockRun(scope.runId, blocked)
    }
  }

  closeScope(scope: EvidenceScope, reason: string): void {
    this.options.runtime.closeScope(scope, reason)
  }

  evictScope(scope: EvidenceScope): void {
    this.options.runtime.evictScope(scope)
  }

  private blockRejected(
    resolution: Extract<DurableEvidenceResolution, { status: 'REJECTED' }>,
    audit: DurableEvidenceAuditIdentity,
    reason: string,
    durable: boolean,
  ): Promise<void> {
    if (resolution.scope !== undefined) {
      return this.persistAndBlock(resolution.scope, audit, reason, durable)
    } else if (resolution.runId !== undefined) {
      return this.persistAndBlockRun(resolution.runId, audit, reason, durable)
    }
    return Promise.resolve()
  }

  private async persistAndBlockRun(
    runId: string,
    audit: DurableEvidenceAuditIdentity,
    reason: string,
    durable: boolean,
  ): Promise<void> {
    this.options.runtime.blockRun(runId, {
      revision: 1,
      reason,
      evidenceRef: audit.rawEventRef,
    })
    if (durable) await this.options.writer.writeRunBlock(runId, audit, reason)
  }

  private async persistAndBlock(
    scope: EvidenceScope,
    audit: DurableEvidenceAuditIdentity,
    reason: string,
    durable: boolean,
  ): Promise<void> {
    const persisted = durable
      ? await this.options.writer.writeBlock(scope, audit, reason)
      : undefined
    this.options.runtime.block(scope, {
      revision:
        persisted?.revision ??
        boundedBlockRevision(this.options.runtime.latestRevision(scope)),
      reason,
      evidenceRef: audit.rawEventRef,
    })
  }
}

function scopeOf(publication: Omit<EvidencePublication, 'revision'>): EvidenceScope {
  return {
    runId: publication.runId,
    occurrenceId: publication.fact.occurrenceId,
    iterationKey: publication.fact.iterationKey,
  }
}

function boundedBlockRevision(latest: number): number {
  return Math.min(2_147_483_647, Math.max(1, latest + 1))
}
