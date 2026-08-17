/**
 * Computes the Domain Pack's DERIVED facts from the facts a run observed.
 *
 * The pack has always declared these (`DerivedFactGraph`) and nothing ever read
 * the declaration, so every derived fact had no producer: `APP.LOGIN_SUCCEEDED`,
 * `APP.ACTIVE_STOP_MATCHES`, `REMOTE.DELIVERY_CONFIRMED` and
 * `REMOTE.TOUR_APPROVAL_CONFIRMED` could not be satisfied by any run, however
 * well the product behaved. A macro requiring one was not being strict; it was
 * asking a question nothing could answer.
 *
 * ## What a derivation may and may not conclude
 *
 * A derivation NEVER invents a positive. Every reducer here can produce three
 * outcomes and the middle one matters most:
 *
 *   - `true`  — the inputs are present and say so.
 *   - `false` — the inputs are present and contradict it. This is a real negative
 *               and the oracle should read it as a violation, not as a gap.
 *   - absent  — the inputs are not there, or not correlatable. Nothing is emitted,
 *               and the requirement stays unmet rather than becoming a false
 *               negative that blames the product for the harness's blind spot.
 *
 * ## Correlation
 *
 * `requiresCorrelation` is not decoration. "The backend approved a tour" plus
 * "the courier requested one" is only evidence when the two describe the SAME
 * tour. Facts carry `correlationValue` for exactly this, and a derivation that
 * requires correlation refuses to fire when the inputs do not all carry the same
 * non-empty value — including when they carry none at all. Refusing is the
 * conservative direction: the cost is an unmet requirement, where the alternative
 * is a business conclusion about no particular entity.
 *
 * One exception is this run's own shipment aliases: the scan barcode and the
 * waybill are two identifiers of the same consignment. Treating them as
 * different entities made `REMOTE.DELIVERY_CONFIRMED` false after a real
 * delivery (`run_4957a69b`). Tour approval codes are not in that alias group.
 */

import type { DerivedFactDefinition, DomainPackBundle } from '@nesy/domain-pack-contracts'
import type { NormalizedEvidenceFact } from '@nesy/oracle-engine'

/** Derived facts are conclusions about the observations, so they are as fresh as the freshest input. */
function freshnessFor(inputs: readonly NormalizedEvidenceFact[]): number {
  return Math.min(...inputs.map((fact) => fact.freshnessMaxAgeMs))
}

function observedAtFor(inputs: readonly NormalizedEvidenceFact[]): number {
  // The LAST observation is when the conclusion became true; an earlier stamp
  // would make a fresh conclusion look stale.
  return Math.max(...inputs.map((fact) => fact.observedAtMs))
}

/**
 * Identifiers this run already declared as the same shipment (scan barcode and
 * waybill). Not a global synonym table: only values THIS run supplied.
 */
export function shipmentCorrelationAliases(
  runInputs: Readonly<Record<string, unknown>>,
): readonly string[] {
  const aliases = [
    'consignmentNumber',
    'proofLookupId',
    'shipment',
    'shipmentId',
    'barcode',
    'fullBarcode',
  ]
    .map((key) => {
      const value = runInputs[key]
      return typeof value === 'string' ? value.trim() : ''
    })
    .filter((value) => value !== '')
  return [...new Set(aliases)]
}

/** Digit shipment ids only — tour codes like APR-9 must not substring-match. */
function isShipmentToken(value: string): boolean {
  return /^\d{10,}$/.test(value)
}

function belongsToShipmentAliases(value: string, aliases: ReadonlySet<string>): boolean {
  if (aliases.has(value)) return true
  for (const alias of aliases) {
    if (isShipmentToken(alias) && value.includes(alias)) return true
    if (isShipmentToken(value) && alias.includes(value)) return true
  }
  return false
}

function sameCorrelatedEntity(
  values: readonly string[],
  aliasGroups: readonly (readonly string[])[],
): boolean {
  if (new Set(values).size === 1) return true
  return aliasGroups.some((group) => {
    const aliases = new Set(group)
    return values.every((value) => belongsToShipmentAliases(value, aliases))
  })
}

function correlatedAllOf(
  definition: DerivedFactDefinition,
  byKey: ReadonlyMap<string, NormalizedEvidenceFact>,
  aliasGroups: readonly (readonly string[])[],
): boolean | undefined {
  const inputs: NormalizedEvidenceFact[] = []
  for (const factKey of definition.provenance.inputFactKeys) {
    const fact = byKey.get(factKey)
    if (fact === undefined || fact.value === 'UNKNOWN') return undefined
    inputs.push(fact)
  }
  if (inputs.some((fact) => fact.value === false)) return false

  if (definition.requiresCorrelation) {
    const values = inputs.map((fact) => fact.correlationValue?.trim() ?? '')
    if (values.some((value) => value === '')) return undefined
    // Different strings are a real negative UNLESS this run already said they
    // name the same shipment. run_4957a69b: APP barcode + proof waybill both
    // true → CORRELATED_ALL_OF emitted false → FAIL_PRODUCT. Tour approval
    // codes are not in the shipment alias group, so APR-9 vs APR-4 stays false.
    if (!sameCorrelatedEntity(values, aliasGroups)) return false
  }
  return true
}

/**
 * The observed entity is the one the run asked for.
 *
 * `comparePath` names the field on the observation and `against` names where the
 * expected value comes from; both are pack vocabulary, so the host reads the
 * observation's `correlationValue` and the caller supplies the expectation.
 */
function entityStatusEquals(
  definition: DerivedFactDefinition,
  byKey: ReadonlyMap<string, NormalizedEvidenceFact>,
  expected: string | undefined,
): boolean | undefined {
  const inputs: NormalizedEvidenceFact[] = []
  for (const factKey of definition.provenance.inputFactKeys) {
    const fact = byKey.get(factKey)
    if (fact === undefined || fact.value === 'UNKNOWN') return undefined
    inputs.push(fact)
  }
  // The observation has to have happened at all before its identity can match.
  if (inputs.some((fact) => fact.value === false)) return false

  const observed = inputs.find((fact) => (fact.correlationValue ?? '').trim() !== '')?.correlationValue?.trim()
  if (observed === undefined || expected === undefined || expected.trim() === '') return undefined
  return observed === expected.trim()
}

export interface DeriveFactsInput {
  bundle: DomainPackBundle
  facts: readonly NormalizedEvidenceFact[]
  /**
   * Values an `ENTITY_STATUS_EQUALS` derivation compares against, keyed by the
   * definition's `parameters.against` (e.g. `macro.input.stopCode`). Supplied by
   * the run rather than read from the pack: the expectation is what THIS run
   * asked for, not a property of the pack.
   */
  expectations?: Readonly<Record<string, string | undefined>>
  /**
   * Groups of identifiers the run already treats as one entity. Used only to
   * stop CORRELATED_ALL_OF calling a barcode/waybill pair a different shipment.
   */
  correlationAliasGroups?: readonly (readonly string[])[]
}

/**
 * Derived facts for one occurrence's fact set.
 *
 * Returns only what could be concluded — never the inputs, which are preserved
 * by the caller (`preserveInputs` is always true and validation enforces it).
 */
export function deriveFacts(input: DeriveFactsInput): NormalizedEvidenceFact[] {
  const definitions = input.bundle.registries.derivedFacts?.facts ?? []
  if (definitions.length === 0 || input.facts.length === 0) return []

  const byKey = new Map(input.facts.map((fact) => [fact.factKey, fact]))
  const derived: NormalizedEvidenceFact[] = []

  for (const definition of definitions) {
    // A derived fact the run already observed directly is left alone: re-deriving
    // it could contradict the observation, and two rows for one fact key is an
    // EVIDENCE_CONFLICT the oracle would rightly refuse.
    if (byKey.has(definition.factKey)) continue

    const inputs = definition.provenance.inputFactKeys
      .map((factKey) => byKey.get(factKey))
      .filter((fact): fact is NormalizedEvidenceFact => fact !== undefined)
    if (inputs.length === 0) continue

    let value: boolean | undefined
    switch (definition.provenance.reducerKind) {
      case 'CORRELATED_ALL_OF':
        value = correlatedAllOf(definition, byKey, input.correlationAliasGroups ?? [])
        break
      case 'ENTITY_STATUS_EQUALS': {
        const against = definition.provenance.parameters?.['against']
        value = entityStatusEquals(
          definition,
          byKey,
          typeof against === 'string' ? input.expectations?.[against] : undefined,
        )
        break
      }
      default:
        // Declared but not implemented. Emitting nothing is the honest outcome:
        // the requirement stays unmet and names the fact, which is a far better
        // report than a fabricated conclusion from a reducer nobody wrote.
        value = undefined
    }
    if (value === undefined) continue

    const reference = inputs[0]!
    derived.push({
      factKey: definition.factKey,
      occurrenceId: reference.occurrenceId,
      iterationKey: reference.iterationKey,
      observedAtMs: observedAtFor(inputs),
      freshnessMaxAgeMs: freshnessFor(inputs),
      plane: definition.plane,
      subtype: `derived:${definition.provenance.reducerKind.toLowerCase()}`,
      value,
      authority: definition.authority,
      deliveryLane: reference.deliveryLane,
      // The derivation trace. Without it a derived fact is an assertion with no
      // provenance, and the first disputed verdict cannot be re-litigated.
      reducerTrace: [
        `${definition.provenance.reducerKind}@${String(definition.provenance.reducerVersion)}`,
        ...definition.provenance.inputFactKeys,
      ],
    })
  }

  return derived
}
