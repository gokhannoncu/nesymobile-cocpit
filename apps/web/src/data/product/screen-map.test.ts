import { describe, expect, it } from 'vitest'
import {
  SCREEN_DOMAINS,
  SCREEN_MAP_EDGES,
  SCREEN_MAP_NODES,
  assertScreenMapIntegrity,
  orthogonalEdgePath,
} from './screen-map'

describe('assertScreenMapIntegrity', () => {
  it('accepts the curated courier screen map', () => {
    expect(assertScreenMapIntegrity(SCREEN_MAP_NODES, SCREEN_MAP_EDGES)).toEqual({
      duplicateNodeIds: [],
      orphanEdgeEnds: [],
      duplicateEdgeIds: [],
      invalidDomains: [],
    })
  })

  it('reports duplicate nodes, orphan edges, and invalid domains', () => {
    const result = assertScreenMapIntegrity(
      [
        {
          id: 'a',
          label: 'A',
          domain: 'auth',
          summary: 'A',
          x: 0,
          y: 0,
        },
        {
          id: 'a',
          label: 'A2',
          domain: 'not-a-domain' as (typeof SCREEN_DOMAINS)[number],
          summary: 'dup',
          x: 10,
          y: 10,
        },
      ],
      [
        { id: 'e1', from: 'a', to: 'missing', label: 'Go' },
        { id: 'e1', from: 'a', to: 'a', label: 'Again' },
      ],
    )

    expect(result.duplicateNodeIds).toEqual(['a'])
    expect(result.orphanEdgeEnds).toEqual(['e1:to:missing'])
    expect(result.duplicateEdgeIds).toEqual(['e1'])
    expect(result.invalidDomains).toEqual(['a:not-a-domain'])
  })
})

describe('SCREEN_MAP curated graph', () => {
  it('keeps product scope between 15 and 25 nodes', () => {
    expect(SCREEN_MAP_NODES.length).toBeGreaterThanOrEqual(15)
    expect(SCREEN_MAP_NODES.length).toBeLessThanOrEqual(25)
  })

  it('covers every domain at least once', () => {
    const used = new Set(SCREEN_MAP_NODES.map((n) => n.domain))
    for (const domain of SCREEN_DOMAINS) {
      expect(used.has(domain)).toBe(true)
    }
  })

  it('has labeled directed edges', () => {
    expect(SCREEN_MAP_EDGES.length).toBeGreaterThan(10)
    for (const edge of SCREEN_MAP_EDGES) {
      expect(edge.label.trim().length).toBeGreaterThan(0)
      expect(edge.from).not.toBe(edge.to)
    }
  })
})

describe('orthogonalEdgePath', () => {
  it('builds an elbow path between two node centers', () => {
    const path = orthogonalEdgePath(
      { x: 0, y: 0, width: 100, height: 40 },
      { x: 200, y: 100, width: 100, height: 40 },
    )
    expect(path.startsWith('M ')).toBe(true)
    expect(path.includes('L ')).toBe(true)
  })
})
