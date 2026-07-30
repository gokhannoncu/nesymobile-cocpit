import { describe, it, expect } from 'vitest'
import {
  createLogcatParser,
  parseLogcatLine,
  minLevelLetter,
  type LogcatParserOptions,
} from './logcat-log-parser'
import type { LogEvent } from '@/data/engineering/device-lab/device-lab-types'

const APP_UID = 10723

function collect(lines: string[], opts: Partial<LogcatParserOptions> = {}): LogEvent[] {
  const out: LogEvent[] = []
  const parser = createLogcatParser(
    {
      appUid: opts.appUid ?? APP_UID,
      packageName: opts.packageName ?? 'com.arasdigital.nesymobile.test',
      sources: opts.sources ?? [],
      levels: opts.levels ?? [],
    },
    (e) => out.push(e),
  )
  for (const l of lines) parser.feed(l)
  parser.flush()
  return out
}

describe('parseLogcatLine', () => {
  it('parses an epoch,uid formatted line', () => {
    const p = parseLogcatLine(
      '         1784183401.246  1000  1429  2069 I SurfaceFlinger: Current= 120, Period= 120',
    )
    expect(p).not.toBeNull()
    expect(p!.epochMs).toBe(1784183401246)
    expect(p!.uid).toBe(1000)
    expect(p!.pid).toBe(1429)
    expect(p!.tid).toBe(2069)
    expect(p!.level).toBe('info')
    expect(p!.tag).toBe('SurfaceFlinger')
    expect(p!.message).toBe('Current= 120, Period= 120')
  })

  it('handles a symbolic uid column as null', () => {
    const p = parseLogcatLine('  1784183401.264   gps  1542 32517 D MPE_SE  : sensor check')
    expect(p!.uid).toBeNull()
    expect(p!.tag).toBe('MPE_SE')
    expect(p!.level).toBe('debug')
  })

  it('returns null for non-log lines', () => {
    expect(parseLogcatLine('--------- beginning of main')).toBeNull()
    expect(parseLogcatLine('')).toBeNull()
  })

  it('maps every level letter', () => {
    const letters: Array<[string, string]> = [
      ['V', 'verbose'], ['D', 'debug'], ['I', 'info'],
      ['W', 'warn'], ['E', 'error'], ['F', 'fatal'],
    ]
    for (const [letter, level] of letters) {
      const p = parseLogcatLine(`1784183401.100 10723 100 100 ${letter} T: m`)
      expect(p!.level).toBe(level)
    }
  })
})

describe('source classification', () => {
  const line = (uid: string, level: string, tag: string, msg: string) =>
    `1784183401.100 ${uid} 12847 12912 ${level} ${tag}: ${msg}`

  it('classifies OkHttpLog as okhttp', () => {
    const [e] = collect([line('10723', 'D', 'OkHttpLog', '<-- 200 https://api')])
    expect(e!.source).toBe('okhttp')
  })

  it('classifies the offline-queue pipeline', () => {
    const [e] = collect([line('10723', 'I', 'RequestSenderService', 'request_enqueued')])
    expect(e!.source).toBe('offline-queue')
  })

  it('classifies payment and location service tags', () => {
    const [pay] = collect([line('10723', 'I', 'RaiPay', 'charge ok')])
    expect(pay!.source).toBe('payment')
    const [loc] = collect([line('10723', 'I', 'ARAS_LOCATION_SERVICE', 'fix')])
    expect(loc!.source).toBe('location')
  })

  it('classifies an unknown tag under the app uid as app', () => {
    const [e] = collect([line('10723', 'I', 'SomeRandomTag', 'hello')])
    expect(e!.source).toBe('app')
    expect(e!.packageName).toBe('com.arasdigital.nesymobile.test')
  })

  it('classifies structured and legacy interaction tags as app', () => {
    const [structured] = collect([line('1000', 'I', 'NESY_TEST_EVENT', 'NESY_TEST_EVENT|{"v":1}')])
    const [legacy] = collect([line('1000', 'D', 'InteractionEvent', '{"id":"legacy"}')])
    expect(structured!.source).toBe('app')
    expect(legacy!.source).toBe('app')
  })

  it('classifies unknown tags from other uids as system', () => {
    const [e] = collect([line('1000', 'I', 'SurfaceFlinger', 'frame')])
    expect(e!.source).toBe('system')
    expect(e!.packageName).toBeNull()
  })

  it('classifies fatal level as crash', () => {
    const [e] = collect([line('10723', 'F', 'anything', 'boom')])
    expect(e!.source).toBe('crash')
    expect(e!.buffer).toBe('crash')
  })
})

describe('correlation extraction', () => {
  it('extracts shipment / request / correlation ids', () => {
    const [e] = collect([
      '1784183401.100 10723 12847 12912 I DeliveryViewModel: delivery for shipmentId=SHP-442 requestId=req-7812 correlationId=corr-del-442',
    ])
    expect(e!.shipmentId).toBe('SHP-442')
    expect(e!.requestId).toBe('req-7812')
    expect(e!.correlationId).toBe('corr-del-442')
  })

  it('extracts a bare SHP token and fiscal id', () => {
    const [e] = collect([
      '1784183401.100 10723 12847 12912 I Fiscal: created SHP-999 fiscalInvoiceId=FSC-88201',
    ])
    expect(e!.shipmentId).toBe('SHP-999')
    expect(e!.fiscalId).toBe('FSC-88201')
  })
})

describe('crash stack coalescing', () => {
  it('merges frames into a single crash event stackTrace', () => {
    const events = collect([
      '1784183401.100 10723 12847 12847 E AndroidRuntime: FATAL EXCEPTION: main',
      '1784183401.101 10723 12847 12847 E AndroidRuntime: java.lang.NullPointerException: boom',
      '1784183401.102 10723 12847 12847 E AndroidRuntime: \tat com.arasdigital.Foo.bar(Foo.kt:42)',
      '1784183401.103 10723 12847 12847 E AndroidRuntime: \tat com.arasdigital.Baz.qux(Baz.kt:10)',
      '1784183401.104 10723 12847 12847 E AndroidRuntime: Caused by: java.lang.IllegalStateException',
      '1784183402.000 10723 12847 12847 I NextTag: unrelated line',
    ])
    const crash = events.find((e) => e.source === 'crash')!
    expect(crash).toBeDefined()
    expect(crash.stackTrace).toContain('at com.arasdigital.Foo.bar(Foo.kt:42)')
    expect(crash.stackTrace).toContain('Caused by:')
    // The unrelated info line is emitted as its own event.
    expect(events.some((e) => e.tag === 'NextTag')).toBe(true)
  })
})

describe('filtering', () => {
  const lines = [
    '1784183401.100 10723 1 1 I OkHttpLog: net',
    '1784183401.100 10723 1 1 E OkHttpLog: net-err',
    '1784183401.100 10723 1 1 I DeliveryFragment: app',
    '1784183401.100 1000 1 1 I SurfaceFlinger: sys',
  ]

  it('filters by source', () => {
    const events = collect(lines, { sources: ['okhttp'] })
    expect(events).toHaveLength(2)
    expect(events.every((e) => e.source === 'okhttp')).toBe(true)
  })

  it('filters by level', () => {
    const events = collect(lines, { levels: ['error'] })
    expect(events).toHaveLength(1)
    expect(events[0]!.level).toBe('error')
  })
})

describe('robustness', () => {
  it('ignores malformed lines and keeps parsing', () => {
    const events = collect([
      'garbage line without structure',
      '1784183401.100 10723 1 1 I Good: ok',
      '',
      '--------- beginning of crash',
    ])
    expect(events).toHaveLength(1)
    expect(events[0]!.message).toBe('ok')
  })

  it('produces deterministic ids for identical lines (reconnect dedup)', () => {
    const a = collect(['1784183401.100 10723 1 1 I Tag: same'])
    const b = collect(['1784183401.100 10723 1 1 I Tag: same'])
    expect(a[0]!.id).toBe(b[0]!.id)
  })
})

describe('minLevelLetter', () => {
  it('returns the most verbose requested level', () => {
    expect(minLevelLetter(['info', 'error'])).toBe('I')
    expect(minLevelLetter(['warn', 'fatal'])).toBe('W')
    expect(minLevelLetter([])).toBe('V')
  })
})
