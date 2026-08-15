import { existsSync, readFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

export const DEFAULT_PROXY_PORT = 8888
export const DEFAULT_WINDOWS_HOST = '192.168.1.7'

export const PROXY_HOST_SUFFIXES = [
  '.overseas.hr',
  '.cityexpress.rs',
  '.expressone.si',
  '.expressone.ba',
  '.expressone.me',
  '.expressone.bg',
  '.starex.az',
  '.arasdx.com',
  '.sps-sro.sk',
  '.mongodb.com',
  '.mongodb.net',
]

/** Hosts from apps/api/src/graylog-env.ts DEFAULT_BASE_URLS */
export function readGraylogHosts() {
  const file = join(repoRoot, 'apps/api/src/graylog-env.ts')
  if (!existsSync(file)) return []
  const text = readFileSync(file, 'utf8')
  return [...text.matchAll(/https:\/\/([a-z0-9.-]+)/gi)].map((match) => match[1].toLowerCase())
}

export function readConfiguredHost() {
  const fromEnv = process.env.NESY_LAN_PROXY_HOST?.trim()
  if (fromEnv) return fromEnv.replace(/^https?:\/\//, '').split(':')[0]

  const file = join(repoRoot, '.nesy-lan-proxy.host')
  if (!existsSync(file)) return null
  const line = readFileSync(file, 'utf8').trim().split(/\s+/)[0]
  return line ? line.replace(/^https?:\/\//, '').split(':')[0] : null
}

export function detectLanIPv4() {
  const nets = networkInterfaces()
  const candidates = []
  for (const [name, addrs] of Object.entries(nets)) {
    if (!addrs || /virtual|vmware|vbox|loopback|docker|wsl|bluetooth|fortinet|vpn/i.test(name)) {
      continue
    }
    for (const addr of addrs) {
      if (addr.internal || addr.family !== 'IPv4') continue
      if (addr.address.startsWith('169.254.')) continue
      candidates.push(addr.address)
    }
  }
  return candidates.find((ip) => ip.startsWith('192.168.')) ?? candidates[0] ?? null
}

/** PAC / Mac must point at the Windows LAN IP, never this Mac's own address. */
export function getProxyHost() {
  const configured = readConfiguredHost()
  if (configured) return configured
  if (process.platform === 'win32') return detectLanIPv4() ?? DEFAULT_WINDOWS_HOST
  return DEFAULT_WINDOWS_HOST
}

export function getProxyPort() {
  const n = Number(process.env.NESY_LAN_PROXY_PORT ?? DEFAULT_PROXY_PORT)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PROXY_PORT
}

export function getProxyAddr() {
  return `${getProxyHost()}:${getProxyPort()}`
}

export function getPacUrl() {
  return `http://${getProxyAddr()}/proxy.pac`
}

export function isAllowedHost(hostname) {
  const host = hostname.toLowerCase()
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  if (readGraylogHosts().includes(host)) return true
  return PROXY_HOST_SUFFIXES.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix))
}

export function isAllowedConnectPort(port) {
  return Number.isSafeInteger(port) && port >= 1 && port <= 65_535
}

/**
 * A reachable PAC is not enough to trust it — on a foreign network the
 * configured IP may belong to an unrelated device. Require our own host list
 * and proxy address before pointing macOS at it.
 */
export function isTrustedPac(text, proxyAddr = getProxyAddr()) {
  if (typeof text !== 'string' || !text.includes('FindProxyForURL')) return false
  if (!text.includes(`PROXY ${proxyAddr}`)) return false
  return PROXY_HOST_SUFFIXES.every((suffix) => text.includes(suffix))
}

export function buildPac(proxyAddr = getProxyAddr()) {
  const suffixChecks = PROXY_HOST_SUFFIXES.flatMap((suffix) => [
    `dnsDomainIs(host, "${suffix}")`,
    `shExpMatch(host, "*${suffix}")`,
  ])
  const hostChecks = [...new Set(readGraylogHosts())].map((host) => `host == "${host}"`)
  const checks = [...suffixChecks, ...hostChecks].join(' ||\n    ')

  return `function FindProxyForURL(url, host) {
  host = host.toLowerCase();
  if (
    ${checks} ||
    isInNet(host, "10.0.0.0", "255.0.0.0")
  ) {
    return "PROXY ${proxyAddr}";
  }
  return "DIRECT";
}
`
}
