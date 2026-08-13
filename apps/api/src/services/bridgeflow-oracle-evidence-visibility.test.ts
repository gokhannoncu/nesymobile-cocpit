/**
 * QUEUE-LEVEL regression lock for one sentence:
 *
 *   A fact produced by one step must reach the Final Oracle of a later step.
 *
 * Nothing about a run is trustworthy without it. Every step can SUCCEED, every
 * observation can be made, and the run still reports `REQUIRED_TIMEOUT` on facts
 * it is holding — which reads as a product defect and is not one. That has
 * happened twice on device, from two different causes, and until now no test
 * failed for either:
 *
 *   1. Occurrence scoping. Evidence is keyed by
 *      `(runId, occurrenceId, iterationKey)` and `currentFacts` only returns
 *      facts whose `occurrenceId` matches the ASKING scope. A step publishing
 *      under its own occurrence is invisible to every later step. The fix is
 *      republication at question time (`SdkObservationStore` +
 *      `publishSdkObservations`), not a looser filter — the filter is what stops
 *      one FOR_EACH iteration satisfying the next.
 *
 *   2. Freshness re-judged on republication. Carrying a fact forward looked like
 *      a new admission, so any fact older than its own window was refused in
 *      transit. Measured on run_309118ae: a 120s optional push wait aged out all
 *      five REQUIRED facts gathered before it. Freshness gates ADMISSION, not
 *      RESIDENCE — see `bridgeflow-evidence-runtime.ts`.
 *
 * ## Why this file tests the queue's helpers directly
 *
 * `publishSdkObservations` and `publishDerivedFacts` were module-private; they
 * are exported now solely for this test, and that is deliberate. The invariant
 * lives in the `acceptedAtMs` these two pass (or fail to pass) and in the lanes
 * they publish on. A test that re-created their bodies would lock a copy and go
 * on passing through the next regression, which is the exact failure mode this
 * file exists to end. Standing up the whole queue instead would need Prisma, a
 * device and a compiled plan to assert three properties of four in-memory
 * objects.
 *
 * The wiring below mirrors `refreshOccurrenceEvidence` — the queue's single
 * entry point that BOTH the executor's `evidence.factsForOccurrence` port and
 * the oracle worker's `refreshFacts` call. That sharing is the thing under
 * protection: when the oracle had its own narrower refresh, it was the only
 * reader that mattered for the whole of an EVENTUAL deadline and the only one
 * looking through the small window.
 */

import type { DomainPackBundle } from '@nesy/domain-pack-contracts'
import { describe, expect, it } from 'vitest'

import { BridgeFlowEvidenceRuntime } from './bridgeflow-evidence-runtime.js'
import {
  publishDerivedFacts,
  publishSdkObservations,
} from './bridgeflow-execution-queue.js'
import { deriveFacts } from './derived-fact-engine.js'
import { SdkObservationStore } from './sdk-observation-store.js'

const RUN_ID = 'run-oracle-visibility'

/** The step that OBSERVES: an SDK_QUERY early in the slice. */
const PRODUCING = { occurrenceId: `${RUN_ID}:read-session:0`, iterationKey: 'iteration-1' }
/** The step that ASSERTS: the Final Oracle, occurrences later. */
const CONSUMING = { occurrenceId: `${RUN_ID}:assert-approved:0`, iterationKey: 'iteration-1' }

const OBSERVED_AT = 1_700_000_000_000
/**
 * The wait that actually caused the outage. `SDK_FACT_MAX_AGE_MS` is 30s, so any
 * read taken this late is on the far side of the window from its observation —
 * exactly where the second bug lived.
 */
const ORACLE_ASKS_AT = OBSERVED_AT + 120_000

function scopeOf(step: { occurrenceId: string; iterationKey: string }) {
  return { runId: RUN_ID, ...step }
}

/**
 * A pack whose only content is the derivation under test. The engine reads
 * `registries.derivedFacts.facts` and nothing else, so a real bundle would add
 * hundreds of lines of irrelevant registry and hide what this test is about.
 */
const bundle = {
  registries: {
    derivedFacts: {
      facts: [
        {
          factKey: 'REMOTE.TOUR_APPROVAL_CONFIRMED',
          plane: 'REMOTE',
          authority: 'PRIMARY',
          displayName: 'Tour approval confirmed',
          preserveInputs: true,
          // The cross-plane conclusion. Correlation is required because "the
          // backend approved a tour" and "the courier requested one" are only
          // evidence together if they name the same tour.
          requiresCorrelation: true,
          provenance: {
            reducerKind: 'CORRELATED_ALL_OF',
            reducerVersion: 1,
            inputFactKeys: ['APP.TOUR_APPROVAL_REQUESTED', 'REMOTE.TOUR_APPROVED'],
          },
        },
      ],
    },
  },
} as unknown as DomainPackBundle

/** One `refreshOccurrenceEvidence` cycle, minus live screen readiness (device-only). */
function refreshOccurrenceEvidence(
  runtime: BridgeFlowEvidenceRuntime,
  observations: SdkObservationStore,
  step: { occurrenceId: string; iterationKey: string },
  nowMs: number,
) {
  publishSdkObservations({ evidenceRuntime: runtime, observations, runId: RUN_ID, ...step })
  const observed = runtime.currentFacts(scopeOf(step), nowMs)
  const derived = deriveFacts({ bundle, facts: observed })
  publishDerivedFacts({ evidenceRuntime: runtime, derived, runId: RUN_ID, ...step })
  return { observed, derived }
}

describe('evidence produced by one step reaches a later step’s oracle', () => {
  it('carries an observation made in one occurrence into the occurrence that asks', () => {
    const runtime = new BridgeFlowEvidenceRuntime({ now: () => OBSERVED_AT })
    const observations = new SdkObservationStore()

    // The producing step records; it never publishes into its own scope, because
    // an occurrence cannot address occurrences that do not exist yet.
    observations.record(RUN_ID, {
      factKey: 'APP.SESSION_ACTIVE',
      value: true,
      observedAtMs: OBSERVED_AT,
      queryRef: 'nesy.sessionState',
    })
    // Publishing into the PRODUCING scope too proves the carry-forward is not an
    // artefact of the fact having only ever existed in one place.
    publishSdkObservations({
      evidenceRuntime: runtime,
      observations,
      runId: RUN_ID,
      ...PRODUCING,
    })

    publishSdkObservations({
      evidenceRuntime: runtime,
      observations,
      runId: RUN_ID,
      ...CONSUMING,
    })

    const seenByOracle = runtime.currentFacts(scopeOf(CONSUMING), OBSERVED_AT + 1)
    expect(seenByOracle.map((fact) => fact.factKey)).toContain('APP.SESSION_ACTIVE')
    // The republished copy must be addressed to the ASKING occurrence. If it kept
    // the producer's id it would be filtered out again one layer down, which is
    // the first bug wearing a different hat.
    const carried = seenByOracle.find((fact) => fact.factKey === 'APP.SESSION_ACTIVE')
    expect(carried?.occurrenceId).toBe(CONSUMING.occurrenceId)
    expect(carried?.observedAtMs).toBe(OBSERVED_AT)
  })

  it('keeps it visible when the oracle asks later than the fact’s freshness window', () => {
    const runtime = new BridgeFlowEvidenceRuntime({ now: () => ORACLE_ASKS_AT })
    const observations = new SdkObservationStore()
    observations.record(RUN_ID, {
      factKey: 'APP.SESSION_ACTIVE',
      value: true,
      observedAtMs: OBSERVED_AT,
      queryRef: 'nesy.sessionState',
    })

    // 120s after the read — the run spent it inside an optional push wait. Every
    // fact gathered before that wait used to disappear here, all at once, while
    // every step that produced them reported SUCCEEDED.
    publishSdkObservations({
      evidenceRuntime: runtime,
      observations,
      runId: RUN_ID,
      ...CONSUMING,
    })

    expect(
      runtime.currentFacts(scopeOf(CONSUMING), ORACLE_ASKS_AT).map((fact) => fact.factKey),
    ).toContain('APP.SESSION_ACTIVE')
  })

  it('still refuses an observation that was already stale when it was offered', () => {
    // The counterpart to the test above, and the reason the fix is `acceptedAtMs`
    // rather than deleting the freshness check. Freshness has one job — refuse an
    // observation that had already aged out at the moment the run was asked to
    // admit it — and that job is intact. Losing this half would let a genuinely
    // ancient reading settle a requirement.
    const runtime = new BridgeFlowEvidenceRuntime({ now: () => ORACLE_ASKS_AT })
    runtime.publish({
      runId: RUN_ID,
      revision: 1,
      lane: 'ORDERED_REQUIRED',
      correlationStatus: 'CORRELATED',
      trust: 'RESOLVER_ACCEPTED',
      acceptedAtMs: OBSERVED_AT + 60_000,
      fact: {
        factKey: 'APP.STALE_ON_ARRIVAL',
        occurrenceId: CONSUMING.occurrenceId,
        iterationKey: CONSUMING.iterationKey,
        observedAtMs: OBSERVED_AT,
        freshnessMaxAgeMs: 30_000,
        plane: 'APP',
        subtype: 'nesy.sessionState',
        value: true,
        authority: 'PRIMARY',
        deliveryLane: 'ORDERED_REQUIRED',
      },
    })

    expect(
      runtime.currentFacts(scopeOf(CONSUMING), ORACLE_ASKS_AT).map((fact) => fact.factKey),
    ).not.toContain('APP.STALE_ON_ARRIVAL')
  })

  it('PUBLISHES the derived conclusion rather than only returning it', () => {
    // The third way this invariant breaks. `refreshOccurrenceEvidence` returns
    // `[...observed, ...derived]` to the executor, and if that were the only
    // delivery the derivation would be invisible to the oracle worker — the
    // worker builds its own set from `runtime.currentFacts` and never calls the
    // derivation engine. The conclusion would exist, be correct, and never be
    // read by the thing that decides the verdict.
    const runtime = new BridgeFlowEvidenceRuntime({ now: () => ORACLE_ASKS_AT })
    const observations = new SdkObservationStore()
    for (const factKey of ['APP.TOUR_APPROVAL_REQUESTED', 'REMOTE.TOUR_APPROVED']) {
      observations.record(RUN_ID, {
        factKey,
        value: true,
        observedAtMs: OBSERVED_AT,
        queryRef: 'nesy.tourApproval',
        // Same tour. Without this the derivation refuses to fire, which is the
        // correct conservative behaviour and would make this test vacuous.
        correlationValue: 'TOUR-4711',
      })
    }

    const { derived } = refreshOccurrenceEvidence(
      runtime,
      observations,
      CONSUMING,
      ORACLE_ASKS_AT,
    )
    expect(derived.map((fact) => fact.factKey)).toEqual(['REMOTE.TOUR_APPROVAL_CONFIRMED'])

    // What the oracle worker actually reads: the ORDERED_REQUIRED lane of the
    // runtime, with no derivation step of its own.
    const orderedLane = runtime.currentFacts(
      scopeOf(CONSUMING),
      ORACLE_ASKS_AT,
      'ORDERED_REQUIRED',
    )
    expect(orderedLane.map((fact) => fact.factKey)).toContain('REMOTE.TOUR_APPROVAL_CONFIRMED')
    // Inputs are appended to, never replaced — a conclusion that consumed its own
    // provenance leaves the next reader unable to see what it was built from.
    expect(orderedLane.map((fact) => fact.factKey)).toEqual(
      expect.arrayContaining(['APP.TOUR_APPROVAL_REQUESTED', 'REMOTE.TOUR_APPROVED']),
    )

    // And on RECEIPT_SAFE, because continue gates read that lane. A derived
    // wrong-row guard missing from the gate lane lets the run walk further into
    // the wrong record before anything notices.
    expect(
      runtime
        .currentFacts(scopeOf(CONSUMING), ORACLE_ASKS_AT, 'RECEIPT_SAFE')
        .map((fact) => fact.factKey),
    ).toContain('REMOTE.TOUR_APPROVAL_CONFIRMED')
  })
})
