import { describe, expect, it } from 'vitest'
import { assertJourneyStepsComplete } from './diagram-utils'
import { USER_JOURNEYS } from './user-journeys'

describe('USER_JOURNEYS', () => {
  it('defines exactly five journeys', () => {
    expect(USER_JOURNEYS.map((j) => j.value)).toEqual([
      'tour-start',
      'delivery',
      'pickup',
      'red-label',
      'd4me',
    ])
  })

  it('has complete step maps for every diagram node id', () => {
    for (const journey of USER_JOURNEYS) {
      const { missingInSteps, orphanSteps } = assertJourneyStepsComplete(
        journey.diagram,
        journey.steps,
      )
      expect({ journey: journey.value, missingInSteps, orphanSteps }).toEqual({
        journey: journey.value,
        missingInSteps: [],
        orphanSteps: [],
      })
    }
  })

  it('every journey has a start node with an id', () => {
    for (const journey of USER_JOURNEYS) {
      const start = journey.diagram.find(
        (el) => el.type === 'node' && el.variant === 'start' && el.id,
      )
      expect(start, journey.value).toBeTruthy()
    }
  })
})
