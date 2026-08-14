import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isProxiedHost, isTrustedPac, PROXY_HOST_SUFFIXES } from './nesy-lan-proxy.js'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

describe('isProxiedHost', () => {
  it('proxies Nesy hosts and 10.x, leaves everything else direct', () => {
    expect(isProxiedHost('nesy-staging-api.cityexpress.rs')).toBe(true)
    expect(isProxiedHost('NESY-GRAYLOG.OVERSEAS.HR')).toBe(true)
    expect(isProxiedHost('overseas.hr')).toBe(true)
    expect(isProxiedHost('10.1.2.3')).toBe(true)

    expect(isProxiedHost('www.google.com')).toBe(false)
    expect(isProxiedHost('localhost')).toBe(false)
    expect(isProxiedHost('192.168.1.7')).toBe(false)
  })

  it('does not match a lookalike domain that only ends with the bare suffix', () => {
    expect(isProxiedHost('evil-overseas.hr')).toBe(false)
    expect(isProxiedHost('cityexpress.rs.attacker.com')).toBe(false)
  })
})

describe('isTrustedPac', () => {
  const pac = [
    'function FindProxyForURL(url, host) {',
    ...PROXY_HOST_SUFFIXES.map((suffix) => `  dnsDomainIs(host, "${suffix}") ||`),
    '  return "PROXY 192.168.1.7:8888";',
    '}',
  ].join('\n')

  it('accepts our own PAC for the expected proxy address', () => {
    expect(isTrustedPac(pac, '192.168.1.7:8888')).toBe(true)
  })

  it('rejects a foreign PAC, an empty body, or a different proxy address', () => {
    expect(isTrustedPac('function FindProxyForURL(u, h) { return "PROXY 192.168.1.7:8888" }', '192.168.1.7:8888')).toBe(
      false,
    )
    expect(isTrustedPac('', '192.168.1.7:8888')).toBe(false)
    expect(isTrustedPac(pac, '10.9.9.9:8888')).toBe(false)
  })
})

it('host list stays in sync with scripts/nesy-lan-proxy-config.mjs', () => {
  const script = readFileSync(join(repoRoot, 'scripts/nesy-lan-proxy-config.mjs'), 'utf8')
  const block = /PROXY_HOST_SUFFIXES\s*=\s*\[([^\]]*)\]/.exec(script)?.[1] ?? ''
  const fromScript = [...block.matchAll(/'([^']+)'/g)].map((match) => match[1])

  expect(fromScript).toEqual([...PROXY_HOST_SUFFIXES])
})
