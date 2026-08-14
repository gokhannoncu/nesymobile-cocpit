/**
 * Route Nesy / corporate hosts through the Windows LAN CONNECT proxy.
 *
 * macOS system PAC only covers apps that read system proxy settings; Node's
 * fetch ignores it, so the API would try to reach VPN-only Nesy hosts directly
 * and fail DNS. This mirrors scripts/nesy-lan-proxy-config.mjs at the dispatcher
 * level: Nesy hosts and 10.x go through the proxy, everything else stays direct.
 *
 * Disabled on Windows — that machine owns the VPN and reaches Nesy directly.
 *
 *   NESY_LAN_PROXY=0            off everywhere
 *   NESY_API_PROXY=http://h:p   force a proxy (skips platform + PAC checks)
 *   NESY_LAN_PROXY_HOST / .nesy-lan-proxy.host   Windows LAN IP
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Agent, Dispatcher, ProxyAgent, setGlobalDispatcher } from 'undici'

/** Keep in sync with scripts/nesy-lan-proxy-config.mjs (guarded by a test). */
export const PROXY_HOST_SUFFIXES = [
  '.overseas.hr',
  '.cityexpress.rs',
  '.expressone.si',
  '.expressone.ba',
  '.expressone.me',
  '.expressone.bg',
  '.starex.az',
] as const

export const DEFAULT_PROXY_PORT = 8888
export const DEFAULT_WINDOWS_HOST = '192.168.1.7'

export function isProxiedHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  return PROXY_HOST_SUFFIXES.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix))
}

/**
 * Reachability alone is not trust: on a foreign network the configured IP may
 * belong to an unrelated device. Require our own host list and proxy address.
 */
export function isTrustedPac(text: string, proxyAddr: string): boolean {
  if (!text.includes('FindProxyForURL')) return false
  if (!text.includes(`PROXY ${proxyAddr}`)) return false
  return PROXY_HOST_SUFFIXES.every((suffix) => text.includes(suffix))
}

function readHostFile(): string | null {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = join(dir, '.nesy-lan-proxy.host')
    if (existsSync(candidate)) {
      const first = readFileSync(candidate, 'utf8').trim().split(/\s+/)[0]
      if (first) return first.replace(/^https?:\/\//, '').split(':')[0] ?? null
      return null
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

function resolveProxyAddr(): string {
  const fromEnv = process.env.NESY_LAN_PROXY_HOST?.trim()
  const host =
    (fromEnv ? fromEnv.replace(/^https?:\/\//, '').split(':')[0] : null) ??
    readHostFile() ??
    DEFAULT_WINDOWS_HOST
  const parsed = Number(process.env.NESY_LAN_PROXY_PORT ?? DEFAULT_PROXY_PORT)
  const port = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PROXY_PORT
  return `${host}:${port}`
}

/** undici's close/destroy accept either a callback or return a promise. */
function settle(work: Promise<unknown>, callback?: () => void): Promise<void> | void {
  const done = work.then(() => undefined)
  if (!callback) return done
  void done.then(callback, callback)
}

/** Sends Nesy traffic to the proxy pool and leaves the rest on a direct pool. */
class SplitDispatcher extends Dispatcher {
  constructor(
    private readonly direct: Agent,
    private readonly viaProxy: ProxyAgent,
  ) {
    super()
  }

  dispatch(options: Dispatcher.DispatchOptions, handler: Dispatcher.DispatchHandlers): boolean {
    const origin = typeof options.origin === 'string' ? options.origin : options.origin?.href
    let proxied = false
    try {
      if (origin) proxied = isProxiedHost(new URL(origin).hostname)
    } catch {
      proxied = false
    }
    const pool = proxied ? this.viaProxy : this.direct
    return pool.dispatch(options, handler)
  }

  close(): Promise<void>
  close(callback: () => void): void
  close(callback?: () => void): Promise<void> | void {
    return settle(Promise.all([this.direct.close(), this.viaProxy.close()]), callback)
  }

  destroy(): Promise<void>
  destroy(err: Error | null): Promise<void>
  destroy(callback: () => void): void
  destroy(err: Error | null, callback: () => void): void
  destroy(
    errOrCallback?: Error | null | (() => void),
    maybeCallback?: () => void,
  ): Promise<void> | void {
    const err = typeof errOrCallback === 'function' ? null : (errOrCallback ?? null)
    const callback = typeof errOrCallback === 'function' ? errOrCallback : maybeCallback
    return settle(Promise.all([this.direct.destroy(err), this.viaProxy.destroy(err)]), callback)
  }
}

export interface NesyProxyResult {
  enabled: boolean
  proxyAddr?: string
  reason?: string
}

async function fetchPac(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

export async function installNesyProxyDispatcher(): Promise<NesyProxyResult> {
  if (process.env.NESY_LAN_PROXY === '0') {
    return { enabled: false, reason: 'NESY_LAN_PROXY=0' }
  }

  const forced = process.env.NESY_API_PROXY?.trim()
  if (forced) {
    const addr = forced.replace(/^https?:\/\//, '').replace(/\/$/, '')
    setGlobalDispatcher(new SplitDispatcher(new Agent(), new ProxyAgent(`http://${addr}`)))
    return { enabled: true, proxyAddr: addr, reason: 'NESY_API_PROXY' }
  }

  if (process.platform === 'win32') {
    return { enabled: false, reason: 'running on the proxy host — direct VPN access' }
  }

  const proxyAddr = resolveProxyAddr()
  const pac = await fetchPac(`http://${proxyAddr}/proxy.pac`)
  if (pac === null) {
    return { enabled: false, reason: `PAC unreachable at ${proxyAddr}` }
  }
  if (!isTrustedPac(pac, proxyAddr)) {
    return { enabled: false, reason: `${proxyAddr} is not the Nesy proxy` }
  }

  setGlobalDispatcher(new SplitDispatcher(new Agent(), new ProxyAgent(`http://${proxyAddr}`)))
  return { enabled: true, proxyAddr }
}
