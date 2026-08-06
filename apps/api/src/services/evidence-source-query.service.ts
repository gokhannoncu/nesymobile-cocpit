import { prisma } from '@nesy/db'

import {
  type EvidenceSourceDefinition,
  type EvidenceSourceResolver,
} from './evidence-source-resolver.js'

export const EVIDENCE_SOURCE_API_VERSION = 'verdict-runtime.v1' as const

export interface EvidenceSourceCatalogItem {
  sourceEvent: string
  factKey: string
  plane: string
  subtype: string
  authority: string
  deliveryLanes: readonly string[]
  freshnessMaxAgeMs: number
  valueField: string
  confidence?: number
}

export interface EvidenceSourceCatalogResult {
  apiVersion: typeof EVIDENCE_SOURCE_API_VERSION
  partial: boolean
  items: EvidenceSourceCatalogItem[]
  blockedReason?: string
}

export interface EvidenceSourceConflict {
  factKey: string
  reason: string
  authorities: readonly string[]
}

export interface RunEvidenceSourceItem extends EvidenceSourceCatalogItem {
  observed: boolean
  lastObservedAt?: string
  deliveryLane?: string
}

export interface RunEvidenceSourceResult {
  apiVersion: typeof EVIDENCE_SOURCE_API_VERSION
  runId: string
  partial: boolean
  items: RunEvidenceSourceItem[]
  conflicts: EvidenceSourceConflict[]
  blockedReason?: string
}

/**
 * Read-model over the runtime evidence source registry. Empty registry → empty
 * items with `partial: true` so the cockpit can show a clear gap instead of a
 * fabricated catalog.
 */
export class EvidenceSourceQueryService {
  constructor(private readonly resolver: EvidenceSourceResolver) {}

  list(): EvidenceSourceCatalogResult {
    const items = this.resolver.list().map(toCatalogItem)
    return {
      apiVersion: EVIDENCE_SOURCE_API_VERSION,
      partial: items.length === 0,
      items,
      ...(items.length === 0
        ? { blockedReason: 'no evidence sources registered in the runtime resolver' }
        : {}),
    }
  }

  async listForRun(runId: string): Promise<RunEvidenceSourceResult> {
    if (runId.trim() === '') {
      return {
        apiVersion: EVIDENCE_SOURCE_API_VERSION,
        runId,
        partial: true,
        items: [],
        conflicts: [],
        blockedReason: 'runId is required',
      }
    }

    const catalog = this.resolver.list()
    const rows = await prisma.$queryRaw<
      {
        factKey: string
        authority: string
        deliveryLane: string
        observedAt: Date
        correlationStatus: string
      }[]
    >`
      SELECT
        fact_key AS "factKey",
        authority,
        delivery_lane AS "deliveryLane",
        observed_at AS "observedAt",
        correlation_status AS "correlationStatus"
      FROM bridgeflow_evidence_fact
      WHERE run_id = ${runId}
      ORDER BY observed_at ASC
    `

    if (rows.length === 0) {
      return {
        apiVersion: EVIDENCE_SOURCE_API_VERSION,
        runId,
        partial: true,
        items: [],
        conflicts: [],
        blockedReason: 'no evidence facts observed for this run',
      }
    }

    const byFactKey = new Map<string, typeof rows>()
    for (const row of rows) {
      const group = byFactKey.get(row.factKey) ?? []
      group.push(row)
      byFactKey.set(row.factKey, group)
    }

    const conflicts: EvidenceSourceConflict[] = []
    for (const [factKey, group] of byFactKey) {
      const authorities = [...new Set(group.map((row) => row.authority))]
      if (authorities.length > 1) {
        conflicts.push({
          factKey,
          reason: 'multiple authorities observed for the same factKey',
          authorities,
        })
      }
      if (group.some((row) => row.correlationStatus === 'CONFLICT')) {
        conflicts.push({
          factKey,
          reason: 'correlation_status CONFLICT recorded on at least one fact',
          authorities,
        })
      }
    }

    const items: RunEvidenceSourceItem[] = catalog
      .filter((definition) => byFactKey.has(definition.factKey))
      .map((definition) => {
        const observations = byFactKey.get(definition.factKey) ?? []
        const last = observations[observations.length - 1]
        return {
          ...toCatalogItem(definition),
          observed: true,
          lastObservedAt: last?.observedAt.toISOString(),
          deliveryLane: last?.deliveryLane,
        }
      })

    const unmatchedFactKeys = [...byFactKey.keys()].filter(
      (factKey) => !catalog.some((definition) => definition.factKey === factKey),
    )

    return {
      apiVersion: EVIDENCE_SOURCE_API_VERSION,
      runId,
      // Observed facts with no registry match are a real gap — surface via
      // partial rather than inventing catalog rows for them.
      partial: unmatchedFactKeys.length > 0 || catalog.length === 0,
      items,
      conflicts,
      ...(unmatchedFactKeys.length > 0
        ? {
            blockedReason: `observed factKeys without registry definitions: ${unmatchedFactKeys.join(', ')}`,
          }
        : {}),
    }
  }
}

function toCatalogItem(definition: EvidenceSourceDefinition): EvidenceSourceCatalogItem {
  return {
    sourceEvent: definition.sourceEvent,
    factKey: definition.factKey,
    plane: definition.plane,
    subtype: definition.subtype,
    authority: definition.authority,
    deliveryLanes: [...definition.deliveryLanes],
    freshnessMaxAgeMs: definition.freshnessMaxAgeMs,
    valueField: definition.valueField,
    ...(definition.confidence === undefined ? {} : { confidence: definition.confidence }),
  }
}
