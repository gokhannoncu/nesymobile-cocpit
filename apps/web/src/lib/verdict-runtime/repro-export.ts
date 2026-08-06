import type { RunDetailResult } from './types'

const SECRET_KEY = /(secret|password|token|pin|authorization|cookie|credential)/i

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEY.test(key) ? '[REDACTED]' : redact(entry)
    }
    return out
  }
  if (typeof value === 'string' && value.length > 8 && SECRET_KEY.test(value)) {
    return '[REDACTED]'
  }
  return value
}

export type ArtifactSlot =
  | 'app'
  | 'sdk'
  | 'bridge'
  | 'workflow'
  | 'device'
  | 'fingerprint'
  | 'action'
  | 'clock'
  | 'artifact'

export interface ReproExportManifest {
  apiVersion: 'repro-export.v1'
  exportedAt: string
  runId: string
  compiledPlanHash: string | null
  slots: Record<ArtifactSlot, { status: 'CAPTURED' | 'NOT_CAPTURED'; value?: unknown }>
  runtime: Record<string, unknown>
  /** Explicit: download must not open Act Mode. */
  opensActMode: false
}

function slot(
  captured: boolean,
  value?: unknown,
): { status: 'CAPTURED' | 'NOT_CAPTURED'; value?: unknown } {
  return captured
    ? { status: 'CAPTURED', value: value === undefined ? undefined : redact(value) }
    : { status: 'NOT_CAPTURED' }
}

export function buildReproExport(run: RunDetailResult): ReproExportManifest {
  const runtime = (run.runtime ?? {}) as Record<string, unknown>
  const correlation = run.correlation
  const runId = correlation.runId
  const compiledPlanHash =
    (typeof runtime.compiledPlanHash === 'string' && runtime.compiledPlanHash) ||
    (typeof (run as { compiledPlanHash?: unknown }).compiledPlanHash === 'string'
      ? String((run as { compiledPlanHash?: unknown }).compiledPlanHash)
      : null)

  const packKey = runtime.domainPackKey
  const packVersion = runtime.domainPackVersion
  const packDigest = runtime.domainPackDigest
  const bridge = runtime.bridgeProtocolVersion
  const sdk = runtime.sdkProtocolVersion
  const deviceId = run.run?.deviceId
  const fingerprint = runtime.deviceFingerprint ?? runtime.fingerprint
  const clock = runtime.runEpochMs ?? runtime.deviceMonoTs ?? runtime.clock
  const profile = runtime.profileSnapshot

  return {
    apiVersion: 'repro-export.v1',
    exportedAt: new Date().toISOString(),
    runId,
    compiledPlanHash,
    opensActMode: false,
    slots: {
      app: slot(Boolean(packKey && packVersion), { packKey, packVersion, packDigest }),
      sdk: slot(sdk !== undefined && sdk !== null, { sdkProtocolVersion: sdk }),
      bridge: slot(bridge !== undefined && bridge !== null, { bridgeProtocolVersion: bridge }),
      workflow: slot(Boolean(compiledPlanHash), {
        compiledPlanHash,
        workflowId: run.run?.workflowId,
        workflowSlug: run.run?.workflowSlug,
      }),
      device: slot(deviceId !== undefined && deviceId !== null, { deviceId }),
      fingerprint: slot(fingerprint !== undefined && fingerprint !== null, { fingerprint }),
      action: slot(
        Array.isArray(run.actionTransitions) && run.actionTransitions.length > 0,
        { transitionCount: run.actionTransitions.length },
      ),
      clock: slot(clock !== undefined && clock !== null, { clock }),
      artifact: slot(Boolean(profile) || Boolean(compiledPlanHash), {
        profileSnapshot: profile ? redact(profile) : undefined,
      }),
    },
    runtime: redact({
      engineType: correlation.engineType,
      domainPackKey: packKey,
      domainPackVersion: packVersion,
      domainPackDigest: packDigest,
      compiledPlanHash,
      bridgeProtocolVersion: bridge,
      sdkProtocolVersion: sdk,
      runEpochMs: runtime.runEpochMs,
    }) as Record<string, unknown>,
  }
}

export function downloadReproExport(manifest: ReproExportManifest): void {
  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `repro-${manifest.runId}-${manifest.exportedAt.replace(/[:.]/g, '-')}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
