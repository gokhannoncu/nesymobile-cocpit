/**
 * Phase 7.16 — Evidence Journey stage fixtures (CHECKPOINT 46–53).
 */

import { EVIDENCE_JOURNEY_STAGES } from '@nesy/execution-contract'
import { describe, expect, it } from 'vitest'
import { classifyEvidenceJourney } from './evidence-journey-classifier.js'

describe('Phase 7.16 evidence journey fixtures', () => {
  it('46 — SDK emit NEGATIVE maps to EMIT NOT_OBSERVED without inventing later root cause', () => {
    const entries = classifyEvidenceJourney({
      factKey: 'f',
      occurrenceId: 'occ-1',
      emitOutcome: 'NEGATIVE',
      stages: {},
    })
    expect(entries.find((e) => e.stage === 'EMIT')?.state).toBe('NOT_OBSERVED')
    expect(entries.find((e) => e.stage === 'WAL')?.state).toBe('PENDING')
  })

  it('47 — TRANSPORT NOT_OBSERVED blocks downstream stages', () => {
    const entries = classifyEvidenceJourney({
      factKey: 'f',
      occurrenceId: 'occ-1',
      emitOutcome: 'POSITIVE',
      stages: {
        WAL: { outcome: 'OBSERVED' },
        TRANSPORT: { outcome: 'NOT_OBSERVED', reason: 'auth failure' },
      },
    })
    expect(entries.find((e) => e.stage === 'TRANSPORT')).toMatchObject({
      state: 'NOT_OBSERVED',
      reason: 'auth failure',
    })
    expect(
      entries
        .filter((e) => ['INBOX', 'RECEIPT', 'ORDERED', 'NORMALIZATION', 'CORRELATION', 'EVALUATION'].includes(e.stage))
        .every((e) => e.state === 'BLOCKED' && e.reason === 'blocked by TRANSPORT'),
    ).toBe(true)
  })

  it('48 — host commit observed at RECEIPT while EVALUATION stays PENDING', () => {
    const entries = classifyEvidenceJourney({
      factKey: 'f',
      occurrenceId: 'occ-1',
      emitOutcome: 'POSITIVE',
      stages: {
        WAL: { outcome: 'OBSERVED' },
        TRANSPORT: { outcome: 'OBSERVED' },
        INBOX: { outcome: 'OBSERVED' },
        RECEIPT: { outcome: 'OBSERVED', reason: 'host commit' },
      },
    })
    expect(entries.find((e) => e.stage === 'RECEIPT')?.state).toBe('OBSERVED')
    expect(entries.find((e) => e.stage === 'EVALUATION')?.state).toBe('PENDING')
  })

  it('49 — ORDERED BLOCKED poisons normalization/correlation/evaluation', () => {
    const entries = classifyEvidenceJourney({
      factKey: 'f',
      occurrenceId: 'occ-1',
      emitOutcome: 'POSITIVE',
      stages: {
        ORDERED: { outcome: 'BLOCKED', reason: 'ordered gap' },
      },
    })
    expect(entries.find((e) => e.stage === 'ORDERED')?.state).toBe('BLOCKED')
    for (const stage of ['NORMALIZATION', 'CORRELATION', 'EVALUATION'] as const) {
      expect(entries.find((e) => e.stage === stage)).toMatchObject({
        state: 'BLOCKED',
        reason: 'blocked by ORDERED',
      })
    }
  })

  it('50 — NORMALIZATION failure is not an SDK emit failure', () => {
    const entries = classifyEvidenceJourney({
      factKey: 'f',
      occurrenceId: 'occ-1',
      emitOutcome: 'POSITIVE',
      stages: {
        WAL: { outcome: 'OBSERVED' },
        TRANSPORT: { outcome: 'OBSERVED' },
        INBOX: { outcome: 'OBSERVED' },
        RECEIPT: { outcome: 'OBSERVED' },
        ORDERED: { outcome: 'OBSERVED' },
        NORMALIZATION: { outcome: 'NOT_OBSERVED', reason: 'schema reject' },
      },
    })
    expect(entries.find((e) => e.stage === 'EMIT')?.state).toBe('OBSERVED')
    expect(entries.find((e) => e.stage === 'NORMALIZATION')?.state).toBe('NOT_OBSERVED')
    expect(entries.find((e) => e.stage === 'CORRELATION')?.state).toBe('BLOCKED')
  })

  it('51 — CORRELATION miss is not SDK/WAL failure', () => {
    const entries = classifyEvidenceJourney({
      factKey: 'f',
      occurrenceId: 'occ-1',
      emitOutcome: 'POSITIVE',
      stages: {
        WAL: { outcome: 'OBSERVED' },
        TRANSPORT: { outcome: 'OBSERVED' },
        INBOX: { outcome: 'OBSERVED' },
        RECEIPT: { outcome: 'OBSERVED' },
        ORDERED: { outcome: 'OBSERVED' },
        NORMALIZATION: { outcome: 'OBSERVED' },
        CORRELATION: { outcome: 'NOT_OBSERVED', reason: 'entity mismatch' },
      },
    })
    expect(entries.find((e) => e.stage === 'EMIT')?.state).toBe('OBSERVED')
    expect(entries.find((e) => e.stage === 'WAL')?.state).toBe('OBSERVED')
    expect(entries.find((e) => e.stage === 'CORRELATION')?.state).toBe('NOT_OBSERVED')
    expect(entries.find((e) => e.stage === 'EVALUATION')?.state).toBe('BLOCKED')
  })

  it('52 — missing emit diagnostic stays UNKNOWN, not synthetic SDK failure', () => {
    const entries = classifyEvidenceJourney({
      factKey: 'f',
      occurrenceId: 'occ-1',
      stages: {},
    })
    expect(entries.find((e) => e.stage === 'EMIT')?.state).toBe('UNKNOWN')
    expect(entries.find((e) => e.stage === 'EMIT')?.reason).toMatch(/no explicit SDK emit/i)
  })

  it('53 companion — journey length stays the canonical nine stages', () => {
    const entries = classifyEvidenceJourney({
      factKey: 'f',
      occurrenceId: 'occ-1',
      emitOutcome: 'POSITIVE',
      stages: {},
    })
    expect(entries.map((e) => e.stage)).toEqual([...EVIDENCE_JOURNEY_STAGES])
  })
})
