import { describe, expect, it } from 'vitest'
import {
  asInteractionOrigin,
  countInteractionOrigins,
} from '../lib/verdict-runtime/interaction-origin-metrics'

describe('Phase 7.17 interaction origins', () => {
  it('normalizes invalid origin to UNKNOWN', () => {
    expect(asInteractionOrigin('BRIDGE_INJECTED')).toBe('BRIDGE_INJECTED')
    expect(asInteractionOrigin('MANUAL')).toBe('MANUAL')
    expect(asInteractionOrigin('UNKNOWN')).toBe('UNKNOWN')
    expect(asInteractionOrigin('weird')).toBe('UNKNOWN')
    expect(asInteractionOrigin(null)).toBe('UNKNOWN')
  })

  it('keeps human baseline MANUAL-only (BRIDGE never inflates)', () => {
    const counts = countInteractionOrigins([
      { origin: 'BRIDGE_INJECTED' },
      { origin: 'BRIDGE_INJECTED' },
      { origin: 'MANUAL' },
      { origin: 'UNKNOWN' },
      { origin: 'not-a-real-origin' },
    ])
    expect(counts).toEqual({
      bridge: 2,
      manual: 1,
      unknown: 2,
      humanBaseline: 1,
    })
    expect(counts.humanBaseline).not.toBe(counts.bridge + counts.manual + counts.unknown)
  })
})
