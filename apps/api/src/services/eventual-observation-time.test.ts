import { describe, expect, it } from 'vitest'

import {
  eventualObservedAtMs,
  isTrustedSourceEventAtMs,
  parseProofEventDate,
} from './eventual-observation-time.js'

describe('eventual observation time', () => {
  it('parses the RS staging proof eventDate ISO string', () => {
    expect(parseProofEventDate('2026-08-17T07:13:16.579Z')).toBe(Date.parse('2026-08-17T07:13:16.579Z'))
  })

  it('does not invent a source event from empty or invalid payload fields', () => {
    expect(parseProofEventDate(null)).toBeNull()
    expect(parseProofEventDate('')).toBeNull()
    expect(parseProofEventDate('not-a-date')).toBeNull()
    expect(parseProofEventDate(0)).toBeNull()
    expect(isTrustedSourceEventAtMs(undefined)).toBe(false)
  })

  it('uses trusted sourceEventAtMs, never the HTTP request start', () => {
    expect(
      eventualObservedAtMs({
        sourceEventAtMs: 116_000,
        completedAtMs: 121_200,
      }),
    ).toBe(116_000)
  })

  it('falls back to HTTP completion when the payload has no source event', () => {
    expect(
      eventualObservedAtMs({
        sourceEventAtMs: null,
        completedAtMs: 121_200,
      }),
    ).toBe(121_200)
  })

  it('refuses the request-start false-PASS: late Delivered stays after the deadline', () => {
    const requestedAtMs = 119_800
    const deadlineMs = 120_000
    const sourceEventAtMs = 121_000
    const completedAtMs = 121_200
    const observedAtMs = eventualObservedAtMs({ sourceEventAtMs, completedAtMs })
    expect(observedAtMs).not.toBe(requestedAtMs)
    expect(observedAtMs).toBe(121_000)
    expect(observedAtMs).toBeGreaterThanOrEqual(deadlineMs)
  })
})
