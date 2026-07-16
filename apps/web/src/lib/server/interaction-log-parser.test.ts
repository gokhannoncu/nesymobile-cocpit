import { describe, expect, it } from 'vitest'
import { parseInteractionLogLine } from './interaction-log-parser'

describe('parseInteractionLogLine', () => {
  it('parses a valid event from an epoch logcat line', () => {
    const line =
      '1784152000.123 100 200 D InteractionEvent: {"id":"evt-1","timestamp":"2026-07-16T01:00:00.000+0300","offsetMs":42,"kind":"click","screen":"MainActivity","label":"Clicked","detail":null,"analyticsEvent":null}'

    expect(parseInteractionLogLine(line)).toEqual({
      id: 'evt-1',
      timestamp: '2026-07-16T01:00:00.000+0300',
      offsetMs: 42,
      kind: 'click',
      screen: 'MainActivity',
      label: 'Clicked',
      detail: null,
      analyticsEvent: null,
    })
  })

  it('rejects malformed and unknown event kinds', () => {
    expect(parseInteractionLogLine('D InteractionEvent: not-json')).toBeNull()
    expect(
      parseInteractionLogLine(
        'D InteractionEvent: {"id":"evt-2","timestamp":"2026-07-16T01:00:00Z","offsetMs":0,"kind":"secret","screen":"A","label":"B","detail":null,"analyticsEvent":null}',
      ),
    ).toBeNull()
  })
})
