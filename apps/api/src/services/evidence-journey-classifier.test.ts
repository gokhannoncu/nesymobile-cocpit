import { EVIDENCE_JOURNEY_STAGES } from '@nesy/execution-contract'
import { describe, expect, it } from 'vitest'

import { classifyEvidenceJourney } from './evidence-journey-classifier.js'

const observedStages = Object.fromEntries(
  EVIDENCE_JOURNEY_STAGES.slice(1).map((stage) => [
    stage,
    { outcome: 'OBSERVED' as const, reason: `${stage.toLowerCase()} observed` },
  ]),
)

describe('classifyEvidenceJourney', () => {
  it('returns the complete canonical nine-stage happy journey in order', () => {
    const entries = classifyEvidenceJourney({
      factKey: 'delivery.persisted',
      occurrenceId: 'occ-1',
      emitOutcome: 'POSITIVE',
      stages: observedStages,
    })

    expect(entries.map((entry) => entry.stage)).toEqual(EVIDENCE_JOURNEY_STAGES)
    expect(entries.every((entry) => entry.state === 'OBSERVED')).toBe(true)
  })

  it.each([
    ['POSITIVE', 'OBSERVED'],
    ['NEGATIVE', 'NOT_OBSERVED'],
    [undefined, 'UNKNOWN'],
  ] as const)('maps explicit SDK EmitOutcome %s to %s', (emitOutcome, expected) => {
    const [emit] = classifyEvidenceJourney({
      factKey: 'delivery.persisted',
      occurrenceId: 'occ-1',
      emitOutcome,
      stages: {},
    })

    expect(emit?.state).toBe(expected)
  })

  it('propagates an ordered poison block without inventing a root cause', () => {
    const entries = classifyEvidenceJourney({
      factKey: 'delivery.persisted',
      occurrenceId: 'occ-1',
      emitOutcome: 'POSITIVE',
      stages: {
        ORDERED: { outcome: 'BLOCKED', reason: 'ordered lane poison row' },
      },
    })

    expect(entries.find((entry) => entry.stage === 'ORDERED')).toMatchObject({
      state: 'BLOCKED',
      reason: 'ordered lane poison row',
    })
    expect(
      entries
        .filter((entry) => ['NORMALIZATION', 'CORRELATION', 'EVALUATION'].includes(entry.stage))
        .every((entry) => entry.state === 'BLOCKED' && entry.reason === 'blocked by ORDERED'),
    ).toBe(true)
  })
})
