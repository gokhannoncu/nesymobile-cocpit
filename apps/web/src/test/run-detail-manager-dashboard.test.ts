import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string): string {
  return readFileSync(resolve(__dirname, '..', path), 'utf8')
}

describe('run detail manager dashboard wiring', () => {
  it('loads durable sources independently and keeps route states local', () => {
    const page = source('app/(cockpit)/automation/[id]/runs/[runId]/page.tsx')
    const loading = source('app/(cockpit)/automation/[id]/runs/[runId]/loading.tsx')
    const error = source('app/(cockpit)/automation/[id]/runs/[runId]/error.tsx')

    expect(page).toContain('Promise.allSettled')
    expect(page).toContain('fetchVerdictRunTelemetry')
    expect(page).toContain('initialSourceErrors')
    expect(loading).toContain('Loading run dashboard')
    expect(error).toContain('Retry dashboard')
  })

  it('exposes the two-tier information architecture and debounced supplemental refresh', () => {
    const live = source('components/automation/run-detail/RunDetailLive.tsx')
    const diagnostics = source('components/automation/run-detail/RunDetailDiagnostics.tsx')

    expect(live).toContain("defaultValue=\"summary\"")
    expect(live).toContain("label: 'Performance'")
    expect(live).toContain("label: 'Execution'")
    expect(live).toContain("label: 'Evidence & Diagnostics'")
    expect(live).toContain('SUPPLEMENTAL_DEBOUNCE_MS')
    expect(live).toContain('Promise.allSettled')
    expect(diagnostics).toContain('Last successful data remains visible')
  })

  it('uses real chart series and explicit unavailable states', () => {
    const performance = source('components/automation/run-detail/RunDetailPerformance.tsx')
    const metronicPackage = readFileSync(
      resolve(__dirname, '../../../../packages/metronic/package.json'),
      'utf8',
    )

    expect(performance).toContain("@nesy/metronic/components/ui/chart")
    expect(JSON.parse(metronicPackage).dependencies.recharts).toBeDefined()
    expect(performance).toContain('heapUsedMb')
    expect(performance).toContain('heapCommittedMb')
    expect(performance).toContain('ReferenceLine')
    expect(performance).toContain('NOT_MEASURED')
    expect(performance).toContain('aria-label')
  })

  it('includes interaction/result filters and never hardcodes gate PASS', () => {
    const feed = source('components/automation/run-detail/RunLiveFeed.tsx')
    const timeline = source('components/automation/run-detail/GateOracleTimeline.tsx')

    expect(feed).toContain("'INTERACTION'")
    expect(feed).toContain("'RUN_RESULT'")
    expect(feed).toContain('aria-expanded')
    expect(timeline).toContain('<Timeline')
    expect(timeline).not.toMatch(/>PASS</)
  })

  it('calls the concrete telemetry endpoint through a typed client', () => {
    const client = source('lib/verdict-runtime/client.ts')
    const types = source('lib/verdict-runtime/types.ts')

    expect(client).toContain('fetchVerdictRunTelemetry')
    expect(client).toContain('/telemetry')
    expect(types).toContain("apiVersion: 'verdict-run-telemetry.v1'")
    expect(types).toContain('RunTelemetryMemorySample')
  })
})
