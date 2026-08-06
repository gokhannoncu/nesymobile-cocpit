import type {
  EvidenceAuthority,
  EvidenceDeliveryLane,
  EvidencePlane,
  NormalizedEvidenceFact,
  NormalizedFactValue,
} from '@nesy/oracle-engine'

import type {
  EvidencePublication,
  EvidenceScope,
} from './bridgeflow-evidence-runtime.js'

export interface DurableEvidenceAuditIdentity {
  runId: string
  sessionId: string
  seq: string
  rawEventRef: string
}

export interface EvidenceSourceDefinition {
  sourceEvent: string
  factKey: string
  plane: EvidencePlane
  subtype: string
  authority: EvidenceAuthority
  deliveryLanes: readonly EvidenceDeliveryLane[]
  freshnessMaxAgeMs: number
  valueField: string
  confidence?: number
}

export interface EvidenceSourceResolver {
  resolve(sourceEvent: string): EvidenceSourceDefinition | undefined
  /** Catalog of every registered/static definition — never fabricates rows. */
  list(): readonly EvidenceSourceDefinition[]
}

export class StaticEvidenceSourceResolver implements EvidenceSourceResolver {
  private readonly bySourceEvent: ReadonlyMap<string, EvidenceSourceDefinition>

  constructor(definitions: readonly EvidenceSourceDefinition[]) {
    const bySourceEvent = new Map<string, EvidenceSourceDefinition>()
    for (const definition of definitions) {
      validateDefinition(definition)
      if (bySourceEvent.has(definition.sourceEvent)) {
        throw new Error(`duplicate evidence source definition ${definition.sourceEvent}`)
      }
      bySourceEvent.set(definition.sourceEvent, {
        ...definition,
        deliveryLanes: [...definition.deliveryLanes],
      })
    }
    this.bySourceEvent = bySourceEvent
  }

  resolve(sourceEvent: string): EvidenceSourceDefinition | undefined {
    const definition = this.bySourceEvent.get(sourceEvent)
    return definition === undefined
      ? undefined
      : { ...definition, deliveryLanes: [...definition.deliveryLanes] }
  }

  list(): readonly EvidenceSourceDefinition[] {
    return [...this.bySourceEvent.values()].map((definition) => ({
      ...definition,
      deliveryLanes: [...definition.deliveryLanes],
    }))
  }
}

export class EvidenceSourceRegistry implements EvidenceSourceResolver {
  private readonly definitions = new Map<string, EvidenceSourceDefinition>()

  register(definition: EvidenceSourceDefinition): () => void {
    validateDefinition(definition)
    if (this.definitions.has(definition.sourceEvent)) {
      throw new Error(`evidence source ${definition.sourceEvent} is already registered`)
    }
    this.definitions.set(definition.sourceEvent, {
      ...definition,
      deliveryLanes: [...definition.deliveryLanes],
    })
    return () => {
      this.definitions.delete(definition.sourceEvent)
    }
  }

  resolve(sourceEvent: string): EvidenceSourceDefinition | undefined {
    const definition = this.definitions.get(sourceEvent)
    return definition === undefined
      ? undefined
      : { ...definition, deliveryLanes: [...definition.deliveryLanes] }
  }

  list(): readonly EvidenceSourceDefinition[] {
    return [...this.definitions.values()].map((definition) => ({
      ...definition,
      deliveryLanes: [...definition.deliveryLanes],
    }))
  }
}

export interface ResolverAcceptedEvidence {
  status: 'ACCEPTED'
  audit: DurableEvidenceAuditIdentity
  confidence: number
  publication: Omit<EvidencePublication, 'revision'> & { revision?: undefined }
}

export interface ResolverRejectedEvidence {
  status: 'REJECTED'
  blocking: true
  reason: string
  runId?: string
  scope?: EvidenceScope
}

export type DurableEvidenceResolution =
  | ResolverAcceptedEvidence
  | ResolverRejectedEvidence
  | { status: 'LEGACY_NO_CONTEXT' }

export function resolveBridgeFlowDurableEvent(
  candidate: unknown,
  lane: EvidenceDeliveryLane,
  resolver: EvidenceSourceResolver,
  audit: DurableEvidenceAuditIdentity,
): DurableEvidenceResolution {
  const auditError = validateAudit(audit)
  if (auditError !== undefined) return rejected(auditError)
  if (!isRecord(candidate)) return rejected('durable event payload must be an object', audit.runId)

  const runId = nonEmptyString(candidate.runId)
  const sessionId = nonEmptyString(candidate.sessionId)
  if (runId === undefined || sessionId === undefined) {
    return rejected('durable event requires non-empty runId and sessionId', audit.runId)
  }
  if (runId !== audit.runId || sessionId !== audit.sessionId) {
    return rejected('durable event identity does not match committed inbox identity', audit.runId)
  }
  if (!finiteNonNegative(candidate.ts)) {
    return rejected('durable event ts must be a finite non-negative number', runId)
  }
  const sourceEvent = nonEmptyString(candidate.event)
  const taskId = nonEmptyString(candidate.taskId)
  if (sourceEvent === undefined || taskId === undefined) {
    return rejected('durable event requires non-empty event and taskId', runId)
  }
  if (candidate.data === undefined || candidate.data === null) return { status: 'LEGACY_NO_CONTEXT' }
  if (!isRecord(candidate.data)) return rejected('durable event data must be an object', runId)
  const data = candidate.data
  const correlationFields = [
    'occurrenceId',
    'iterationKey',
    'factValue',
    'factKey',
    'plane',
    'subtype',
    'authority',
    'confidence',
  ]
  if (!correlationFields.some((field) => field in data)) return { status: 'LEGACY_NO_CONTEXT' }

  const occurrenceId = nonEmptyString(data.occurrenceId)
  const iterationKey = nonEmptyString(data.iterationKey)
  if (occurrenceId === undefined || iterationKey === undefined) {
    return rejected('partial or malformed BridgeFlow correlation tuple', runId)
  }
  const scope = { runId, occurrenceId, iterationKey }
  const definition = resolver.resolve(sourceEvent)
  if (definition === undefined) {
    return rejected(`unknown evidence source ${sourceEvent}`, runId, scope)
  }
  if (!definition.deliveryLanes.includes(lane)) {
    return rejected(`source ${sourceEvent} is not trusted for lane ${lane}`, runId, scope)
  }

  for (const [field, trusted] of [
    ['factKey', definition.factKey],
    ['plane', definition.plane],
    ['subtype', definition.subtype],
    ['authority', definition.authority],
  ] as const) {
    if (field in data && data[field] !== trusted) {
      return rejected(`${field} does not match trusted source definition`, runId, scope)
    }
  }

  const value = parseFactValue(data[definition.valueField])
  if (value === undefined) {
    return rejected(`invalid ${definition.valueField} for source ${sourceEvent}`, runId, scope)
  }
  const confidence = parseConfidence(data.confidence, definition.confidence ?? 1)
  if (confidence === undefined) {
    return rejected('confidence must be a finite number between 0 and 1', runId, scope)
  }

  const fact: NormalizedEvidenceFact = {
    factKey: definition.factKey,
    occurrenceId,
    iterationKey,
    observedAtMs: candidate.ts as number,
    freshnessMaxAgeMs: definition.freshnessMaxAgeMs,
    plane: definition.plane,
    subtype: definition.subtype,
    value,
    authority: definition.authority,
    deliveryLane: lane,
    rawEventId: audit.rawEventRef,
    reducerTrace: [`trusted:${sourceEvent}`],
  }
  return {
    status: 'ACCEPTED',
    audit: { ...audit },
    confidence,
    publication: {
      runId,
      fact,
      lane,
      correlationStatus: 'CORRELATED',
      trust: 'RESOLVER_ACCEPTED',
    },
  }
}

function validateDefinition(definition: EvidenceSourceDefinition): void {
  if (
    nonEmptyString(definition.sourceEvent) === undefined ||
    nonEmptyString(definition.factKey) === undefined ||
    nonEmptyString(definition.subtype) === undefined
  ) {
    throw new Error('evidence source definitions require non-empty sourceEvent, factKey, and subtype')
  }
  if (!finitePositiveInteger(definition.freshnessMaxAgeMs)) {
    throw new Error(`invalid freshnessMaxAgeMs for ${definition.sourceEvent}`)
  }
  if (definition.deliveryLanes.length === 0) {
    throw new Error(`evidence source ${definition.sourceEvent} must declare a delivery lane`)
  }
  if (parseConfidence(undefined, definition.confidence ?? 1) === undefined) {
    throw new Error(`invalid confidence for ${definition.sourceEvent}`)
  }
}

function validateAudit(audit: DurableEvidenceAuditIdentity): string | undefined {
  if (
    nonEmptyString(audit.runId) === undefined ||
    nonEmptyString(audit.sessionId) === undefined ||
    nonEmptyString(audit.rawEventRef) === undefined
  ) {
    return 'durable audit identity fields must be non-empty strings'
  }
  if (!/^(0|[1-9]\d{0,18})$/.test(audit.seq)) {
    return 'durable inbox seq must be an unsigned 64-bit decimal string'
  }
  try {
    if (BigInt(audit.seq) > 9_223_372_036_854_775_807n) {
      return 'durable inbox seq exceeds signed 64-bit range'
    }
  } catch {
    return 'durable inbox seq is invalid'
  }
  return undefined
}

function rejected(
  reason: string,
  runId?: string,
  scope?: EvidenceScope,
): ResolverRejectedEvidence {
  return {
    status: 'REJECTED',
    blocking: true,
    reason,
    ...(runId === undefined ? {} : { runId }),
    ...(scope === undefined ? {} : { scope }),
  }
}

function parseFactValue(value: unknown): NormalizedFactValue | undefined {
  if (value === 'true' || value === true) return true
  if (value === 'false' || value === false) return false
  if (value === 'UNKNOWN' || value === 'NOT_APPLICABLE') return value
  return undefined
}

function parseConfidence(value: unknown, fallback: number): number | undefined {
  const candidate = value === undefined ? fallback : typeof value === 'string' ? Number(value) : value
  return typeof candidate === 'number' &&
    Number.isFinite(candidate) &&
    candidate >= 0 &&
    candidate <= 1
    ? candidate
    : undefined
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

function finiteNonNegative(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function finitePositiveInteger(value: unknown): boolean {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
