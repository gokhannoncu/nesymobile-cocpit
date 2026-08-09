import { readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  assertProvenanceConsistency,
  buildProvenanceDeepLinks,
} from '../lib/verdict-runtime/provenance-deep-links'

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'app')

function collectRoutes(dir: string, prefix = ''): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      const segment = /^\(.*\)$/.test(entry) ? '' : `/${entry}`
      out.push(...collectRoutes(full, prefix + segment))
    } else if (entry === 'page.tsx') {
      out.push(prefix || '/')
    }
  }
  return out
}

describe('Phase 7.23 provenance / deep-links', () => {
  it('builds list → editor → run detail → history chain', () => {
    const links = buildProvenanceDeepLinks({
      workflowSlug: 'field-courier-login',
      runId: 'run-42',
    })
    expect(links).toEqual({
      listPath: '/automation/list',
      editorPath: '/automation/field-courier-login',
      runDetailPath: '/automation/field-courier-login/runs/run-42',
      historyPath: '/automation/history',
    })

    const routes = collectRoutes(APP_DIR)
    expect(routes).toContain('/automation/list')
    expect(routes).toContain('/automation/history')
    expect(routes).toContain('/automation/[id]')
    expect(routes).toContain('/automation/[id]/runs/[runId]')
  })

  it('requires complete plan + pack provenance (fail-closed)', () => {
    const incomplete = assertProvenanceConsistency({
      workflowId: 'wf-1',
      workflowSlug: 'field-courier-login',
      runId: 'run-1',
      compiledPlanHash: null,
      domainPackKey: 'nesy.courier',
      domainPackVersion: '1.0.0',
      domainPackDigest: 'sha256:pack',
    })
    expect(incomplete.ok).toBe(false)
    expect(incomplete.reason).toMatch(/compiledPlanHash/)

    const complete = assertProvenanceConsistency({
      workflowId: 'wf-1',
      workflowSlug: 'field-courier-login',
      runId: 'run-1',
      compiledPlanHash: 'sha256:plan',
      domainPackKey: 'nesy.courier',
      domainPackVersion: '1.0.0',
      domainPackDigest: 'sha256:pack',
    })
    expect(complete.ok).toBe(true)
    expect(complete.links.runDetailPath).toContain('/runs/run-1')
  })
})
