import { describe, expect, it } from 'vitest'
import type { LiveScreenField } from '../data/debug-view/live-types'
import { diffCurrentScreenFields } from '../data/debug-view/screen-state-diff'

function field(
  name: string,
  value: unknown,
  group: LiveScreenField['group'] = 'screen',
): LiveScreenField {
  const kind: LiveScreenField['kind'] =
    value == null
      ? 'null'
      : Array.isArray(value)
        ? 'array'
        : typeof value === 'object'
          ? 'object'
          : (typeof value as 'string' | 'number' | 'boolean')
  return {
    name,
    value,
    kind,
    count: Array.isArray(value) ? value.length : kind === 'object' ? Object.keys(value as object).length : null,
    group,
  }
}

describe('diffCurrentScreenFields', () => {
  it('reports changed, added and removed fragment fields', () => {
    const changes = diffCurrentScreenFields(
      [field('query', ''), field('loading', false), field('obsolete', 1)],
      [field('query', 'ABC'), field('loading', false), field('selected', { id: 7 })],
    )

    expect(changes).toEqual([
      { field: 'query', kind: 'changed', valueKind: 'string', before: '', after: 'ABC' },
      {
        field: 'selected',
        kind: 'added',
        valueKind: 'object',
        before: undefined,
        after: { id: 7 },
      },
      { field: 'obsolete', kind: 'removed', valueKind: 'number', before: 1, after: undefined },
    ])
  })

  it('ignores activity-scoped shared state', () => {
    expect(diffCurrentScreenFields([field('currentTask', null, 'shared')], [field('currentTask', 7, 'shared')])).toEqual([])
  })
})
