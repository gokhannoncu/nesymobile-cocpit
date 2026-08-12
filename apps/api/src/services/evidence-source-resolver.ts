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
  // `event` is required because it is what selects the trusted source definition.
  //
  // `taskId` is NOT, and requiring it here blocked every run on this device. A
  // fact's scope at this boundary is the BridgeFlow correlation tuple
  // (`occurrenceId`, `iterationKey`) — `taskId` names a business task and is never
  // read below, so it cannot be part of evidence identity. Meanwhile the SDK sends
  // `taskId: ""` for everything that is not task-scoped: `SCREEN_READY`,
  // `SCREEN_EXITED`, `STATE_LOGIN`, `STATE_ROUTE`. Rejecting those is `blocking`,
  // which calls `blockRun`, which makes EVERY later continue gate return BLOCKED
  // without evaluating. Measured: a login run whose PIN entry, submit and real
  // authentication all succeeded still reported `continueGateResult: UNSATISFIED`
  // with zero oracle evaluations, because its first screen event was rejected here.
  //
  // Events that are not correlated BridgeFlow evidence already have a non-blocking
  // outcome below (`LEGACY_NO_CONTEXT`); letting them reach it is the whole fix.
  const sourceEvent = nonEmptyString(candidate.event)
  if (sourceEvent === undefined) {
    return rejected('durable event requires a non-empty event name', runId)
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
    // NOT a rejection. An undeclared wire is a diagnostic, not a contract
    // violation: the app emits many events per run (`INTERACTION_CLICK`,
    // `HTTP_CALL`, `SCREEN_READY`) and only a few are declared evidence.
    //
    // This used to be unreachable in practice because nothing correlated device
    // emits, so every frame stopped at LEGACY_NO_CONTEXT above. The moment the
    // host began stamping the occurrence onto the app's context, every one of
    // those ordinary events started arriving WITH a correlation tuple, reached
    // this line, and blocked the ordered lane — measured as `orderedLag: 10`
    // with the run's own evidence stuck behind unrelated click events.
    //
    // "I was not told this event means anything" is not the same claim as "this
    // event is malformed", and only the second is worth stopping a run for.
    return { status: 'LEGACY_NO_CONTEXT' }
  }
  if (!definition.deliveryLanes.includes(lane)) {
    // Ignored on this lane, not refused. `deliveryLanes` is a statement about
    // where the source may be BELIEVED — "do not count me on the receipt lane" —
    // and the frames themselves are fanned out to both lanes by the ingest, so a
    // lane the source does not claim is the normal case, not an anomaly.
    //
    // Refusing here blocked the whole scope: an ORDERED-only source arriving on
    // its receipt copy marked the run blocked, and the continue gate then returned
    // BLOCKED without evaluating — measured as a gate that gave up after four
    // UNKNOWN evaluations while the fact it was waiting for sat accepted in the
    // ordered lane.
    return { status: 'LEGACY_NO_CONTEXT' }
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
