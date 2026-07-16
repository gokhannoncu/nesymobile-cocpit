import { describe, expect, it, vi } from 'vitest'
import { createOkHttpLogParser } from './okhttp-log-parser'

describe('createOkHttpLogParser', () => {
  it('preserves authorization headers for Network Inspector', () => {
    const onTransaction = vi.fn()
    const parser = createOkHttpLogParser(onTransaction)
    const prefix = '1784152000.123 100 200 D OkHttpLog: '

    parser.feed(`${prefix}--> GET https://example.test/Task/Info`)
    parser.feed(`${prefix}Authorization: Bearer secret-token`)
    parser.feed(`${prefix}X-Correlation-ID: trace-1`)
    parser.feed(`${prefix}--> END GET`)
    parser.feed(`${prefix}<-- 200 https://example.test/Task/Info (76ms)`)
    parser.feed(`${prefix}<-- END HTTP (2-byte body)`)

    expect(onTransaction).toHaveBeenCalledOnce()
    expect(onTransaction.mock.calls[0]?.[0].requestHeaders).toMatchObject({
      Authorization: 'Bearer secret-token',
      'X-Correlation-ID': 'trace-1',
    })
  })
})
