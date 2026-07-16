import { describe, it, expect } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import { buildBundle } from './log-bundle'
import type {
  LogEvent,
  PrivacyRule,
  StoredLogSession,
} from '@/data/engineering/device-lab/device-lab-types'

function makeEvent(over: Partial<LogEvent> = {}): LogEvent {
  return {
    id: 'e1',
    timestamp: '2026-07-16T09:00:00.000Z',
    epochMs: 1784192400000,
    source: 'okhttp',
    level: 'info',
    tag: 'OkHttpLog',
    message: 'auth Bearer secretTOKEN123 shipmentId=SHP-1',
    processId: 1,
    threadId: 2,
    uid: 10723,
    packageName: 'com.arasdigital.nesymobile.test',
    buffer: 'main',
    shipmentId: 'SHP-1',
    raw: '1784192400.000 10723 1 2 I OkHttpLog: auth Bearer secretTOKEN123 shipmentId=SHP-1',
    ...over,
  }
}

const session: StoredLogSession = {
  id: '1784192400000-uuid',
  device: { serial: 'R6', name: 'Samsung A34', androidVersion: '14', appVersion: '8.4.60', packageName: 'com.arasdigital.nesymobile.test' },
  config: { serial: 'R6', mode: 'live', sources: [], levels: [], timeRange: 'now', from: null, to: null, captureMode: 'quick', presetId: null },
  status: 'stopped',
  startedAt: '2026-07-16T09:00:00.000Z',
  stoppedAt: '2026-07-16T09:05:00.000Z',
  eventCount: 2,
  markers: [{ id: 'm1', timestamp: '2026-07-16T09:01:00.000Z', label: 'checkpoint', type: 'user' }],
  context: { note: 'token Bearer secretTOKEN123' },
  presetId: null,
  presetLabel: 'Payment & Fiscal',
  linkedRunId: null,
}

const tokenRule: PrivacyRule = {
  id: 'token', label: 'Access Token',
  pattern: 'Bearer [A-Za-z0-9\\-._~+/]+=*', replacement: 'Bearer ***', enabled: true,
}

describe('buildBundle', () => {
  const base = {
    session,
    events: [makeEvent(), makeEvent({ id: 'e2', shipmentId: 'SHP-2', message: 'no secrets here', raw: '... no secrets here' })],
    privacyRules: [tokenRule],
    id: 'bundle-1',
    createdAt: '2026-07-16T09:06:00.000Z',
  }

  it('produces a zip with all six documents and masks tokens', async () => {
    const bundle = buildBundle({ ...base, format: 'zip' })
    expect(bundle.format).toBe('zip')
    expect(bundle.filename.endsWith('.zip')).toBe(true)
    expect(bundle.sizeBytes).toBeGreaterThan(0)
    const bytes = new Uint8Array(await bundle.blob.arrayBuffer())
    const files = unzipSync(bytes)
    expect(Object.keys(files).sort()).toEqual(
      ['correlation.json', 'device.json', 'events.jsonl', 'logcat.txt', 'manifest.json', 'markers.json'],
    )
    const logcat = strFromU8(files['logcat.txt']!)
    expect(logcat).not.toContain('secretTOKEN123')
    expect(logcat).toContain('Bearer ***')
    const correlation = JSON.parse(strFromU8(files['correlation.json']!))
    expect(correlation.shipmentIds).toHaveProperty('SHP-1')
    expect(correlation.shipmentIds).toHaveProperty('SHP-2')
    const manifest = JSON.parse(strFromU8(files['manifest.json']!))
    expect(manifest.privacy.totalRedactions).toBeGreaterThanOrEqual(1)
  })

  it('produces json and txt formats', async () => {
    const json = buildBundle({ ...base, format: 'json' })
    const parsed = JSON.parse(await json.blob.text())
    expect(parsed.events).toHaveLength(2)
    expect(JSON.stringify(parsed)).not.toContain('secretTOKEN123')

    const txt = buildBundle({ ...base, format: 'txt' })
    const text = await txt.blob.text()
    expect(text).toContain('# NesyMobile Device Log Explorer')
    expect(text).not.toContain('secretTOKEN123')
  })

  it('masks context values too', async () => {
    const json = buildBundle({ ...base, format: 'json' })
    const parsed = JSON.parse(await json.blob.text())
    expect(parsed.device.context.note).toContain('Bearer ***')
  })

  it('refuses to export when a privacy rule cannot compile', () => {
    const badRule: PrivacyRule = { id: 'bad', label: 'Bad', pattern: '([', replacement: 'x', enabled: true }
    expect(() => buildBundle({ ...base, privacyRules: [badRule], format: 'zip' })).toThrow(/privacy rule/i)
  })
})
