/**
 * The property under test is mostly what the engine REFUSES to conclude. A
 * derived fact is a business claim assembled from other claims, and the failure
 * mode that matters is not "it did not fire" — it is "it fired about nothing in
 * particular".
 */
import { describe, expect, it } from 'vitest'
import type { DomainPackBundle } from '@nesy/domain-pack-contracts'
import type { NormalizedEvidenceFact } from '@nesy/oracle-engine'

import { deriveFacts, shipmentCorrelationAliases } from './derived-fact-engine.js'

function fact(
  factKey: string,
  value: boolean | 'UNKNOWN',
  correlationValue?: string,
): NormalizedEvidenceFact {
  return {
    factKey,
    occurrenceId: 'run-1:step-1:0',
    iterationKey: 'root',
    observedAtMs: 100,
    freshnessMaxAgeMs: 30_000,
    plane: 'APP',
    subtype: 'sdk',
    value,
    authority: 'PRIMARY',
    deliveryLane: 'ORDERED_REQUIRED',
    ...(correlationValue === undefined ? {} : { correlationValue }),
  }
}

function bundleWith(facts: unknown[]): DomainPackBundle {
  return { registries: { derivedFacts: { facts } } } as unknown as DomainPackBundle
}

const CORRELATED = bundleWith([
  {
    factKey: 'REMOTE.TOUR_APPROVAL_CONFIRMED',
    plane: 'REMOTE',
    authority: 'PRIMARY',
    displayName: 'Tour approval confirmed',
    provenance: {
      reducerKind: 'CORRELATED_ALL_OF',
      reducerVersion: 1,
      inputFactKeys: ['APP.TOUR_APPROVAL_REQUESTED', 'REMOTE.TOUR_APPROVAL_STATUS_APPROVED'],
      parameters: { correlationPath: 'approvalRequestCode' },
    },
    preserveInputs: true,
    requiresCorrelation: true,
  },
])

const ENTITY = bundleWith([
  {
    factKey: 'APP.ACTIVE_STOP_MATCHES',
    plane: 'APP',
    authority: 'PRIMARY',
    displayName: 'The active stop is the requested stop',
    provenance: {
      reducerKind: 'ENTITY_STATUS_EQUALS',
      reducerVersion: 1,
      inputFactKeys: ['APP.ACTIVE_STOP_OBSERVED'],
      parameters: { comparePath: 'stopCode', against: 'macro.input.stopCode' },
    },
    preserveInputs: true,
    requiresCorrelation: true,
  },
])

describe('CORRELATED_ALL_OF', () => {
  it('concludes true when every input is true and they describe the same entity', () => {
    const derived = deriveFacts({
      bundle: CORRELATED,
      facts: [
        fact('APP.TOUR_APPROVAL_REQUESTED', true, 'APR-9'),
        fact('REMOTE.TOUR_APPROVAL_STATUS_APPROVED', true, 'APR-9'),
      ],
    })
    expect(derived.map((f) => [f.factKey, f.value])).toEqual([
      ['REMOTE.TOUR_APPROVAL_CONFIRMED', true],
    ])
    expect(derived[0]?.reducerTrace).toContain('CORRELATED_ALL_OF@1')
  })

  // The whole reason `requiresCorrelation` exists: "a tour was requested" plus
  // "a tour was approved" is not evidence that THIS tour was approved.
  it('concludes false when the inputs describe DIFFERENT entities', () => {
    const derived = deriveFacts({
      bundle: CORRELATED,
      facts: [
        fact('APP.TOUR_APPROVAL_REQUESTED', true, 'APR-9'),
        fact('REMOTE.TOUR_APPROVAL_STATUS_APPROVED', true, 'APR-4'),
      ],
    })
    expect(derived.map((f) => f.value)).toEqual([false])
  })

  it('refuses to conclude anything when correlation is missing entirely', () => {
    const derived = deriveFacts({
      bundle: CORRELATED,
      facts: [
        fact('APP.TOUR_APPROVAL_REQUESTED', true),
        fact('REMOTE.TOUR_APPROVAL_STATUS_APPROVED', true),
      ],
    })
    // Not `false` — an unmet requirement names the gap, where a false would blame
    // the product for the harness having no way to check.
    expect(derived).toEqual([])
  })

  it('run_86ae37d3: APP full barcode containing this run waybill concludes true', () => {
    const shortBarcode = '6880051000294319'
    const waybill = '47446154448795'
    const fullBarcode = `N68801700099000001033068801100063001100010001${waybill}QV17381`
    const derived = deriveFacts({
      bundle: bundleWith([
        {
          factKey: 'REMOTE.DELIVERY_CONFIRMED',
          plane: 'REMOTE',
          authority: 'PRIMARY',
          displayName: 'Delivery confirmed',
          provenance: {
            reducerKind: 'CORRELATED_ALL_OF',
            reducerVersion: 1,
            inputFactKeys: ['REMOTE.DELIVERY_STATUS_COMPLETED', 'APP.DELIVERY_SUBMITTED'],
            parameters: { correlationPath: 'correlationId' },
          },
          preserveInputs: true,
          requiresCorrelation: true,
        },
      ]),
      facts: [
        fact('APP.DELIVERY_SUBMITTED', true, fullBarcode),
        fact('REMOTE.DELIVERY_STATUS_COMPLETED', true, waybill),
      ],
      correlationAliasGroups: [
        shipmentCorrelationAliases({ consignmentNumber: shortBarcode, proofLookupId: waybill }),
      ],
    })
    expect(derived.map((f) => [f.factKey, f.value])).toEqual([['REMOTE.DELIVERY_CONFIRMED', true]])
  })

  it('run_4957a69b: barcode and waybill aliases of THIS run conclude true, not FAIL_PRODUCT', () => {
    const barcode = '6880051000294210'
    const waybill = '95906865713279'
    const derived = deriveFacts({
      bundle: bundleWith([
        {
          factKey: 'REMOTE.DELIVERY_CONFIRMED',
          plane: 'REMOTE',
          authority: 'PRIMARY',
          displayName: 'Delivery confirmed',
          provenance: {
            reducerKind: 'CORRELATED_ALL_OF',
            reducerVersion: 1,
            inputFactKeys: ['REMOTE.DELIVERY_STATUS_COMPLETED', 'APP.DELIVERY_SUBMITTED'],
            parameters: { correlationPath: 'correlationId' },
          },
          preserveInputs: true,
          requiresCorrelation: true,
        },
      ]),
      facts: [
        fact('APP.DELIVERY_SUBMITTED', true, barcode),
        fact('REMOTE.DELIVERY_STATUS_COMPLETED', true, waybill),
      ],
      correlationAliasGroups: [
        shipmentCorrelationAliases({ consignmentNumber: barcode, proofLookupId: waybill }),
      ],
    })
    expect(derived.map((f) => [f.factKey, f.value])).toEqual([['REMOTE.DELIVERY_CONFIRMED', true]])
  })

  it('does not treat a full barcode embedding a different waybill as this run', () => {
    const derived = deriveFacts({
      bundle: bundleWith([
        {
          factKey: 'REMOTE.DELIVERY_CONFIRMED',
          plane: 'REMOTE',
          authority: 'PRIMARY',
          displayName: 'Delivery confirmed',
          provenance: {
            reducerKind: 'CORRELATED_ALL_OF',
            reducerVersion: 1,
            inputFactKeys: ['REMOTE.DELIVERY_STATUS_COMPLETED', 'APP.DELIVERY_SUBMITTED'],
            parameters: { correlationPath: 'correlationId' },
          },
          preserveInputs: true,
          requiresCorrelation: true,
        },
      ]),
      facts: [
        fact('APP.DELIVERY_SUBMITTED', true, 'N6880170009900000103306880110006300110001000199999999999999QV17381'),
        fact('REMOTE.DELIVERY_STATUS_COMPLETED', true, '47446154448795'),
      ],
      correlationAliasGroups: [
        shipmentCorrelationAliases({
          consignmentNumber: '6880051000294319',
          proofLookupId: '47446154448795',
        }),
      ],
    })
    expect(derived.map((f) => f.value)).toEqual([false])
  })

  it('still concludes false when different ids are not aliases of this run', () => {
    const derived = deriveFacts({
      bundle: CORRELATED,
      facts: [
        fact('APP.TOUR_APPROVAL_REQUESTED', true, 'APR-9'),
        fact('REMOTE.TOUR_APPROVAL_STATUS_APPROVED', true, 'APR-4'),
      ],
      correlationAliasGroups: [shipmentCorrelationAliases({ consignmentNumber: '6880', proofLookupId: '9590' })],
    })
    expect(derived.map((f) => f.value)).toEqual([false])
  })

  it('concludes false when an input contradicts it', () => {
    const derived = deriveFacts({
      bundle: CORRELATED,
      facts: [
        fact('APP.TOUR_APPROVAL_REQUESTED', true, 'APR-9'),
        fact('REMOTE.TOUR_APPROVAL_STATUS_APPROVED', false, 'APR-9'),
      ],
    })
    expect(derived.map((f) => f.value)).toEqual([false])
  })

  it('concludes nothing from a missing or UNKNOWN input', () => {
    expect(
      deriveFacts({ bundle: CORRELATED, facts: [fact('APP.TOUR_APPROVAL_REQUESTED', true, 'APR-9')] }),
    ).toEqual([])
    expect(
      deriveFacts({
        bundle: CORRELATED,
        facts: [
          fact('APP.TOUR_APPROVAL_REQUESTED', true, 'APR-9'),
          fact('REMOTE.TOUR_APPROVAL_STATUS_APPROVED', 'UNKNOWN', 'APR-9'),
        ],
      }),
    ).toEqual([])
  })
})

describe('ENTITY_STATUS_EQUALS', () => {
  it('concludes true when the observed entity is the requested one', () => {
    const derived = deriveFacts({
      bundle: ENTITY,
      facts: [fact('APP.ACTIVE_STOP_OBSERVED', true, 'STOP-7')],
      expectations: { 'macro.input.stopCode': 'STOP-7' },
    })
    expect(derived.map((f) => f.value)).toEqual([true])
  })

  // The wrong-row guard. A run that opened the wrong stop and then delivered
  // successfully would pass every downstream oracle without this.
  it('concludes false when the app opened a different entity', () => {
    const derived = deriveFacts({
      bundle: ENTITY,
      facts: [fact('APP.ACTIVE_STOP_OBSERVED', true, 'STOP-3')],
      expectations: { 'macro.input.stopCode': 'STOP-7' },
    })
    expect(derived.map((f) => f.value)).toEqual([false])
  })

  it('refuses to conclude when the observation carries no identity', () => {
    expect(
      deriveFacts({
        bundle: ENTITY,
        facts: [fact('APP.ACTIVE_STOP_OBSERVED', true)],
        expectations: { 'macro.input.stopCode': 'STOP-7' },
      }),
    ).toEqual([])
  })
})

describe('engine', () => {
  it('never overwrites a fact the run observed directly', () => {
    const derived = deriveFacts({
      bundle: ENTITY,
      facts: [fact('APP.ACTIVE_STOP_OBSERVED', true, 'STOP-3'), fact('APP.ACTIVE_STOP_MATCHES', true, 'STOP-3')],
      expectations: { 'macro.input.stopCode': 'STOP-7' },
    })
    expect(derived).toEqual([])
  })

  // Declared-but-unimplemented must stay silent. A fabricated conclusion from a
  // reducer nobody wrote is worse than a requirement that reports itself unmet.
  it('emits nothing for a reducer kind it does not implement', () => {
    const derived = deriveFacts({
      bundle: bundleWith([
        {
          factKey: 'APP.SOMETHING',
          plane: 'APP',
          authority: 'PRIMARY',
          displayName: 'Unimplemented',
          provenance: { reducerKind: 'TRANSITION_OBSERVED', reducerVersion: 1, inputFactKeys: ['APP.A'] },
          preserveInputs: true,
          requiresCorrelation: false,
        },
      ]),
      facts: [fact('APP.A', true, 'x')],
    })
    expect(derived).toEqual([])
  })
})
