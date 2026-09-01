import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PAGE_MIGRATION_MANIFEST } from '../lib/page-migration-manifest'
import {
  catalogItemToWorkflowListItem,
  formatRunEnvironmentLabel,
  workflowRunApiToHistoryRow,
} from '../lib/verdict-runtime/adapters'
import type { WorkflowCatalogItemApi, WorkflowRunApi } from '../lib/verdict-runtime/types'

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'app')

function collectPages(dir: string, prefix = ''): Map<string, string> {
  const out = new Map<string, string>()
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      const segment = /^\(.*\)$/.test(entry) ? '' : `/${entry}`
      for (const [k, v] of collectPages(full, prefix + segment)) out.set(k, v)
    } else if (entry === 'page.tsx') {
      out.set(prefix || '/', full)
    }
  }
  return out
}

const PAGE_FILES = collectPages(APP_DIR)

const DTO_CUTOVER_ROUTES: Array<{
  route: string
  mustMatch: RegExp
  label: string
}> = [
  {
    route: '/automation/list',
    mustMatch: /fetchVerdictWorkflowCatalog/,
    label: 'WorkflowCatalogQuery',
  },
  {
    route: '/automation/history',
    mustMatch: /fetchVerdictRunHistory/,
    label: 'RunHistoryQuery',
  },
  {
    route: '/automation/field-login',
    mustMatch: /startPinnedVerdictRun|fetchVerdictDomainPacks/,
    label: 'WorkflowRunApi + pack pin',
  },
  {
    route: '/automation/01-load-tour-flow',
    mustMatch: /fetchVerdictDomainPacks/,
    label: 'WorkflowRunApi + pack pin',
  },
  {
    route: '/debug-view/interactions',
    mustMatch: /fetchVerdictInteractions/,
    label: 'DurableInteractionSubscription',
  },
]

describe('DTO cutover — CHECKPOINT 33/34/37/38/44', () => {
  for (const { route, mustMatch, label } of DTO_CUTOVER_ROUTES) {
    it(`${route} is VERDICT_RUNTIME and binds ${label}`, () => {
      const entry = PAGE_MIGRATION_MANIFEST.find((e) => e.routePattern === route)
      expect(entry, `Missing manifest entry for ${route}`).toBeDefined()
      expect(entry!.currentSource).toBe('VERDICT_RUNTIME')
      expect(entry!.targetSource).toBe('VERDICT_RUNTIME')

      const file = PAGE_FILES.get(route)
      expect(file, `Missing page for ${route}`).toBeDefined()
      const src = readFileSync(file!, 'utf8')
      expect(src).toMatch(/verdict-runtime\/client/)
      expect(src).toMatch(mustMatch)
    })
  }

  it('load-tour workspace starts runs via startPinnedVerdictRun', () => {
    const workspace = join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      'components',
      'automation',
      'load-tour-flow-workspace.tsx',
    )
    const src = readFileSync(workspace, 'utf8')
    expect(src).toMatch(/startPinnedVerdictRun/)
    expect(src).not.toMatch(/startWorkflowRun\b/)
  })

  it('catalog adapter preserves slug and lastRun', () => {
    const item: WorkflowCatalogItemApi = {
      id: 'w1',
      slug: 'demo-flow',
      name: 'Demo',
      description: null,
      status: 'active',
      category: 'ops',
      icon: 'zap',
      iconClassName: '',
      currentVersionId: 'v1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      latestVersion: { id: 'v1', version: 2, createdAt: '2026-01-02T00:00:00.000Z' },
      lastRun: {
        id: 'r1',
        status: 'success',
        createdAt: '2026-01-03T00:00:00.000Z',
        duration: 1200,
      },
    }
    const mapped = catalogItemToWorkflowListItem(item)
    expect(mapped.slug).toBe('demo-flow')
    expect(mapped.lastRun?.id).toBe('r1')
    expect(mapped.latestVersion?.version).toBe(2)
  })

  it('history adapter maps workflow join + duration', () => {
    const item: WorkflowRunApi = {
      apiVersion: 'verdict-runtime.v1',
      partial: false,
      correlation: {
        runId: 'r9',
        engineType: 'BRIDGEFLOW',
      },
      run: {
        id: 'r9',
        workflowId: 'w9',
        workflowSlug: 'field-courier-login',
        workflowName: 'Field Courier Login',
        versionId: 'v9',
        status: 'failed',
        mode: 'full',
        deviceId: 'd1',
        startedAt: '2026-01-04T00:00:00.000Z',
        completedAt: '2026-01-04T00:01:00.000Z',
        duration: 60_000,
        createdAt: '2026-01-04T00:00:00.000Z',
      },
      runtime: { engineType: 'BRIDGEFLOW' },
    }
    const row = workflowRunApiToHistoryRow(item)
    expect(row.id).toBe('r9')
    expect(row.workflow?.slug).toBe('field-courier-login')
    expect(row.duration).toBe(60_000)
    expect(row.startedAt).toBe('2026-01-04T00:00:00.000Z')
    expect(row.deviceId).toBe('d1')
  })

  it('history adapter maps device serial, label, and workflow version', () => {
    const item: WorkflowRunApi = {
      apiVersion: 'verdict-runtime.v1',
      partial: false,
      correlation: {
        runId: 'r11',
        engineType: 'BRIDGEFLOW',
      },
      run: {
        id: 'r11',
        workflowId: 'w11',
        workflowSlug: 'open-stop',
        workflowName: 'Opening a stop opens the requested stop',
        versionId: 'v11',
        workflowVersion: 1,
        status: 'completed',
        mode: 'full',
        deviceId: 'R6CW400BC8N',
        deviceModelName: 'SM-A346E',
        deviceLabel: 'Courier A',
        createdAt: '2026-09-01T20:25:01.964Z',
      },
      runtime: { engineType: 'BRIDGEFLOW' },
    }
    const row = workflowRunApiToHistoryRow(item)
    expect(row.deviceId).toBe('R6CW400BC8N')
    expect(row.device).toEqual({ modelName: 'SM-A346E', label: 'Courier A' })
    expect(row.version?.version).toBe(1)
  })

  it('history adapter maps country and environment for the RS-STAGE chip', () => {
    const item: WorkflowRunApi = {
      apiVersion: 'verdict-runtime.v1',
      partial: false,
      correlation: { runId: 'r12', engineType: 'BRIDGEFLOW' },
      run: {
        id: 'r12',
        workflowId: 'w12',
        workflowSlug: 'open-stop',
        workflowName: 'Opening a stop',
        versionId: 'v12',
        workflowVersion: 1,
        status: 'completed',
        country: 'RS',
        environment: 'stage',
        createdAt: '2026-09-01T20:25:01.964Z',
      },
      runtime: { engineType: 'BRIDGEFLOW' },
    }
    const row = workflowRunApiToHistoryRow(item)
    expect(row.country).toBe('RS')
    expect(row.environment).toBe('stage')
    expect(row.version?.version).toBe(1)
    expect(formatRunEnvironmentLabel(row)).toBe('RS-STAGE')
  })

  it('history adapter falls back to RS-STAGE when the run did not persist an environment', () => {
    const item: WorkflowRunApi = {
      apiVersion: 'verdict-runtime.v1',
      partial: false,
      correlation: { runId: 'r13', engineType: 'BRIDGEFLOW' },
      run: {
        id: 'r13',
        workflowId: 'w13',
        workflowSlug: 'process-parcel',
        workflowName: 'A scanned parcel is accepted and persisted',
        versionId: 'v13',
        workflowVersion: 1,
        status: 'completed',
        createdAt: '2026-09-01T20:25:01.964Z',
      },
      runtime: { engineType: 'BRIDGEFLOW' },
    }
    const row = workflowRunApiToHistoryRow(item)
    expect(formatRunEnvironmentLabel(row)).toBe('RS-STAGE')
    expect(row.version?.version).toBe(1)
  })

  it('history adapter derives duration from timestamps when the stored field is empty', () => {
    const item: WorkflowRunApi = {
      apiVersion: 'verdict-runtime.v1',
      partial: false,
      correlation: {
        runId: 'r10',
        engineType: 'BRIDGEFLOW',
      },
      run: {
        id: 'r10',
        workflowId: 'w10',
        workflowSlug: 'parcel-accept',
        workflowName: 'A scanned parcel is accepted and persisted',
        versionId: 'v10',
        status: 'completed',
        mode: 'full',
        startedAt: '2026-09-01T20:25:05.114Z',
        completedAt: '2026-09-01T20:25:41.132Z',
        createdAt: '2026-09-01T20:25:01.964Z',
        duration: null,
      },
      runtime: { engineType: 'BRIDGEFLOW' },
    }
    expect(workflowRunApiToHistoryRow(item).duration).toBe(36_018)
  })
})
