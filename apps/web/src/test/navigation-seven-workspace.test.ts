import { describe, expect, it } from 'vitest'
import { WORKSPACES } from '@nesy/metronic/config/layout-21.config'
import type { MenuItem } from '@nesy/metronic/config/types'

describe('Navigation Seven-Workspace Guard', () => {
  it('has exactly seven top-level workspaces', () => {
    expect(WORKSPACES).toHaveLength(7)
  })

  it('contains the required workspace IDs', () => {
    const ids = WORKSPACES.map((w) => w.id)
    expect(ids).toContain('home')
    expect(ids).toContain('product')
    expect(ids).toContain('pm')
    expect(ids).toContain('engineering')
    expect(ids).toContain('debug-view')
    expect(ids).toContain('data-center')
    expect(ids).toContain('automation')
  })

  it('does not contain a "verdict" top-level workspace', () => {
    const ids = WORKSPACES.map((w) => w.id)
    expect(ids).not.toContain('verdict')
  })

  it('every workspace has a label', () => {
    for (const ws of WORKSPACES) {
      expect(ws.label).toBeDefined()
      expect(ws.label.length).toBeGreaterThan(0)
    }
  })

  it('every workspace has a path', () => {
    for (const ws of WORKSPACES) {
      expect(ws.path).toBeDefined()
      expect(ws.path.length).toBeGreaterThan(0)
    }
  })

  it('every workspace has an icon', () => {
    for (const ws of WORKSPACES) {
      expect(ws.icon).toBeDefined()
    }
  })

  it('every workspace has basePaths array', () => {
    for (const ws of WORKSPACES) {
      expect(ws.basePaths).toBeDefined()
      expect(ws.basePaths.length).toBeGreaterThan(0)
    }
  })

  // Phase 6: Automation workspace must have Domain Packs, Test Profiles, Test Campaigns
  it('automation workspace menu contains Domain Packs nav entry', () => {
    const automation = WORKSPACES.find((w) => w.id === 'automation')
    expect(automation).toBeDefined()
    const allPaths = flattenMenuPaths(automation!.menu)
    expect(allPaths).toContain('/automation/domain-packs')
  })

  it('automation workspace menu contains Test Profiles nav entry', () => {
    const automation = WORKSPACES.find((w) => w.id === 'automation')
    expect(automation).toBeDefined()
    const allPaths = flattenMenuPaths(automation!.menu)
    expect(allPaths).toContain('/automation/test-profiles')
  })

  it('automation workspace menu contains Test Campaigns nav entry', () => {
    const automation = WORKSPACES.find((w) => w.id === 'automation')
    expect(automation).toBeDefined()
    const allPaths = flattenMenuPaths(automation!.menu)
    expect(allPaths).toContain('/automation/test-campaigns')
  })

  // Phase 6: /pm/root-cause must not be orphan
  it('pm workspace menu contains root-cause entry', () => {
    const pm = WORKSPACES.find((w) => w.id === 'pm')
    expect(pm).toBeDefined()
    const allPaths = flattenMenuPaths(pm!.menu)
    expect(allPaths).toContain('/pm/root-cause')
  })
})

// Helper: recursively extract all paths from menu config
function flattenMenuPaths(menu: any[]): string[] {
  const paths: string[] = []
  function walk(items: any[]) {
    for (const item of items) {
      if (typeof item.path === 'string') {
        paths.push(item.path)
      }
      if (Array.isArray(item.children)) {
        walk(item.children)
      }
    }
  }
  walk(menu)
  return paths
}
