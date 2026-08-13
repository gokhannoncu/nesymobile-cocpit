import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertProvenanceConsistency } from '../lib/verdict-runtime/provenance-deep-links'
import type { RunDetailResult } from '../lib/verdict-runtime/types'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PAGE = join(ROOT, 'app/(cockpit)/automation/[id]/runs/[runId]/page.tsx')
// The page is the server shell that fetches the durable snapshot; the panels
// live in the client body that streams run events on top of it.
const BODY = join(ROOT, 'components/automation/run-detail/RunDetailLive.tsx')
const PANEL = join(ROOT, 'components/automation/run-detail/ProvenancePanel.tsx')

describe('Phase 7 residual — Run Detail provenance panel', () => {
  it('wires ProvenancePanel into the BridgeFlow run detail page', () => {
    const page = readFileSync(PAGE, 'utf8')
    const body = readFileSync(BODY, 'utf8')
    const panel = readFileSync(PANEL, 'utf8')
    expect(page).toContain('RunDetailLive')
    expect(body).toContain('ProvenancePanel')
    expect(panel).toContain('assertProvenanceConsistency')
    expect(panel).toContain('sourceMap')
  })

  it('marks incomplete run runtime pins as fail-closed', () => {
    const run = {
      apiVersion: 'verdict-runtime.v1',
      partial: false,
      correlation: { runId: 'run-1', engineType: 'BRIDGEFLOW' },
      run: { id: 'run-1', workflowId: 'wf-1', workflowSlug: 'field-courier-login' },
      runtime: {
        compiledPlanHash: 'sha256:plan',
        domainPackKey: 'nesy.courier',
        // version/digest missing on purpose
      },
      steps: [],
      waits: [],
      actionTransitions: [],
      oracleEvaluations: [],
      testExecutions: [],
      resourceLeases: [],
      remoteActions: [],
    } satisfies RunDetailResult

    const check = assertProvenanceConsistency({
      workflowId: String(run.run.workflowId),
      workflowSlug: String(run.run.workflowSlug),
      runId: run.correlation.runId,
      compiledPlanHash: String(run.runtime.compiledPlanHash),
      domainPackKey: String(run.runtime.domainPackKey),
      domainPackVersion: null,
      domainPackDigest: null,
    })
    expect(check.ok).toBe(false)
    expect(check.reason).toMatch(/domain pack provenance incomplete/)
  })
})
