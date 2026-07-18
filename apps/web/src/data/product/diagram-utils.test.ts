import { describe, expect, it } from 'vitest'
import type { DiagramElement } from './nesy-types'
import { assertJourneyStepsComplete, collectDiagramNodeIds } from './diagram-utils'

const sample: DiagramElement[] = [
  { type: 'node', id: 'start', label: 'Start', variant: 'start' },
  { type: 'arrow' },
  { type: 'node', id: 'decide', label: 'OK?', variant: 'decision' },
  {
    type: 'branch',
    yes: {
      label: 'Yes',
      steps: [{ type: 'node', id: 'ok', label: 'Done', variant: 'end' }],
    },
    no: {
      label: 'No',
      steps: [{ type: 'node', id: 'fail', label: 'Fail', variant: 'error' }],
    },
  },
]

describe('collectDiagramNodeIds', () => {
  it('walks nodes inside branches', () => {
    expect(collectDiagramNodeIds(sample).sort()).toEqual(['decide', 'fail', 'ok', 'start'])
  })

  it('skips nodes without id', () => {
    const els: DiagramElement[] = [
      { type: 'node', label: 'Legacy', variant: 'process' },
      { type: 'node', id: 'a', label: 'A', variant: 'process' },
    ]
    expect(collectDiagramNodeIds(els)).toEqual(['a'])
  })
})

describe('assertJourneyStepsComplete', () => {
  it('reports missing and orphan step keys', () => {
    const result = assertJourneyStepsComplete(sample, {
      start: {},
      decide: {},
      ok: {},
      extra: {},
    })
    expect(result.missingInSteps).toEqual(['fail'])
    expect(result.orphanSteps).toEqual(['extra'])
  })
})
