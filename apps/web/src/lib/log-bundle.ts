// Builds local diagnostic bundles (ZIP / JSON / TXT) from a stored session.
//
// Privacy rules are applied to event messages, raw lines, stack traces and
// context during export only — the session in IndexedDB is left untouched. If
// any enabled rule fails to compile, the bundle is NOT produced (fail closed).

import { zipSync, strToU8 } from 'fflate'
import {
  buildMaskManifest,
  compilePrivacyRules,
  createMaskAccumulator,
  maskText,
} from './log-privacy'
import type {
  BundleFormat,
  LogEvent,
  PrivacyRule,
  StoredLogBundle,
  StoredLogSession,
} from '@/data/engineering/device-lab/device-lab-types'

export interface BuildBundleInput {
  session: StoredLogSession
  events: LogEvent[]
  privacyRules: PrivacyRule[]
  format: BundleFormat
  /** Bundle id (timestamp + crypto.randomUUID from the caller). */
  id: string
  createdAt: string
}

const EXT: Record<BundleFormat, string> = { zip: 'zip', json: 'json', txt: 'txt' }
const MIME: Record<BundleFormat, string> = {
  zip: 'application/zip',
  json: 'application/json',
  txt: 'text/plain;charset=utf-8',
}

function correlationSummary(events: LogEvent[]) {
  const tally = (key: keyof LogEvent) => {
    const counts = new Map<string, number>()
    for (const e of events) {
      const v = e[key]
      if (typeof v === 'string' && v) counts.set(v, (counts.get(v) ?? 0) + 1)
    }
    return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]))
  }
  return {
    shipmentIds: tally('shipmentId'),
    requestIds: tally('requestId'),
    fiscalIds: tally('fiscalId'),
    correlationIds: tally('correlationId'),
  }
}

/**
 * Produces a StoredLogBundle. Throws if a privacy rule cannot be compiled.
 */
export function buildBundle(input: BuildBundleInput): StoredLogBundle {
  const { session, events, privacyRules, format, id, createdAt } = input

  const { compiled, errors } = compilePrivacyRules(privacyRules)
  if (errors.length > 0) {
    throw new Error(
      `Cannot export: ${errors.length} privacy rule(s) failed to compile — ` +
        errors.map((e) => `${e.label} (${e.message})`).join('; '),
    )
  }

  const acc = createMaskAccumulator()
  const maskedEvents = events.map((e) => ({
    ...e,
    message: maskText(e.message, compiled, acc),
    raw: maskText(e.raw, compiled, acc),
    stackTrace: e.stackTrace ? maskText(e.stackTrace, compiled, acc) : undefined,
  }))
  const maskedContext = Object.fromEntries(
    Object.entries(session.context).map(([k, v]) => [k, maskText(v, compiled, acc)]),
  )

  const maskManifest = buildMaskManifest(compiled, acc)
  const correlation = correlationSummary(events)

  const manifest = {
    tool: 'NesyMobile Device Log Explorer',
    generatedAt: createdAt,
    sessionId: session.id,
    device: session.device,
    config: session.config,
    preset: session.presetLabel,
    linkedRunId: session.linkedRunId,
    startedAt: session.startedAt,
    stoppedAt: session.stoppedAt,
    status: session.status,
    eventCount: maskedEvents.length,
    markerCount: session.markers.length,
    privacy: {
      applied: maskManifest,
      totalRedactions: maskManifest.reduce((n, m) => n + m.hits, 0),
    },
  }

  const eventsJsonl = maskedEvents.map((e) => JSON.stringify(e)).join('\n')
  const logcatTxt = maskedEvents.map((e) => e.raw).join('\n')
  const markersJson = JSON.stringify(session.markers, null, 2)
  const deviceJson = JSON.stringify({ ...session.device, context: maskedContext }, null, 2)
  const correlationJson = JSON.stringify(correlation, null, 2)
  const manifestJson = JSON.stringify(manifest, null, 2)

  let blob: Blob
  if (format === 'zip') {
    const zipped = zipSync(
      {
        'manifest.json': strToU8(manifestJson),
        'events.jsonl': strToU8(eventsJsonl),
        'logcat.txt': strToU8(logcatTxt),
        'markers.json': strToU8(markersJson),
        'device.json': strToU8(deviceJson),
        'correlation.json': strToU8(correlationJson),
      },
      { level: 6 },
    )
    // Copy into a standalone ArrayBuffer so the Blob owns its bytes.
    blob = new Blob([zipped.slice()], { type: MIME.zip })
  } else if (format === 'json') {
    blob = new Blob(
      [
        JSON.stringify(
          {
            manifest,
            events: maskedEvents,
            markers: session.markers,
            device: { ...session.device, context: maskedContext },
            correlation,
          },
          null,
          2,
        ),
      ],
      { type: MIME.json },
    )
  } else {
    const header =
      `# NesyMobile Device Log Explorer — ${session.device.name}\n` +
      `# Session ${session.id} · ${manifest.eventCount} events · generated ${createdAt}\n` +
      `# Redactions: ${manifest.privacy.totalRedactions}\n\n`
    blob = new Blob([header + logcatTxt + '\n'], { type: MIME.txt })
  }

  const filename = `nesy-logs-${session.id}.${EXT[format]}`
  return {
    id,
    sessionId: session.id,
    createdAt,
    format,
    filename,
    sizeBytes: blob.size,
    eventCount: maskedEvents.length,
    deviceName: session.device.name,
    blob,
    maskManifest,
  }
}

/** Triggers a browser download of a stored bundle's blob. */
export function downloadBundle(bundle: StoredLogBundle): void {
  const url = URL.createObjectURL(bundle.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = bundle.filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
