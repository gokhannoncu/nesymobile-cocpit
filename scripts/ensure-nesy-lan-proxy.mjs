#!/usr/bin/env node
/**
 * On project start:
 *   macOS  — if Windows PAC is reachable, enable Automatic Proxy only (no global http_proxy)
 *   Windows — start the LAN CONNECT proxy if it is not already listening
 *
 * Override Windows IP: NESY_LAN_PROXY_HOST=192.168.1.7  or  .nesy-lan-proxy.host
 */
import { execFileSync, spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPacUrl, getProxyAddr, getProxyHost, getProxyPort } from './nesy-lan-proxy-config.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const SKIP_SERVICE = /bluetooth|bridge|iphone|ipad/i

async function pacReachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
    const text = await res.text()
    return res.ok && text.includes('FindProxyForURL')
  } catch {
    return false
  }
}

function listMacServices() {
  const out = execFileSync('networksetup', ['-listallnetworkservices'], { encoding: 'utf8' })
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('An asterisk') && !line.startsWith('*'))
    .filter((name) => !SKIP_SERVICE.test(name))
}

function getAutoProxy(service) {
  const out = execFileSync('networksetup', ['-getautoproxyurl', service], { encoding: 'utf8' })
  const url = /URL:\s*(\S+)/i.exec(out)?.[1]?.trim() ?? ''
  const enabled = /Enabled:\s*Yes/i.test(out)
  return { url: url === '(null)' ? '' : url, enabled }
}

function applyMacPac(service, pacUrl) {
  execFileSync('networksetup', ['-setautoproxyurl', service, pacUrl], { stdio: 'pipe' })
  execFileSync('networksetup', ['-setautoproxystate', service, 'on'], { stdio: 'pipe' })
  execFileSync('networksetup', ['-setwebproxystate', service, 'off'], { stdio: 'pipe' })
  execFileSync('networksetup', ['-setsecurewebproxystate', service, 'off'], { stdio: 'pipe' })
}

async function ensureMac() {
  const pacUrl = getPacUrl()
  if (!(await pacReachable(pacUrl))) {
    console.warn(
      `[nesy-lan-proxy] PAC unreachable (${pacUrl}). Windows proxy down? Set NESY_LAN_PROXY_HOST or .nesy-lan-proxy.host`,
    )
    return
  }

  const services = listMacServices()
  if (!services.length) {
    console.warn('[nesy-lan-proxy] no macOS network services found')
    return
  }

  for (const service of services) {
    try {
      const current = getAutoProxy(service)
      if (current.enabled && current.url === pacUrl) continue
      applyMacPac(service, pacUrl)
      console.log(`[nesy-lan-proxy] ${service}: PAC ${pacUrl} (HTTP/HTTPS system proxy off)`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[nesy-lan-proxy] ${service}: ${message}`)
    }
  }
}

async function ensureWindows() {
  const localPac = `http://127.0.0.1:${getProxyPort()}/proxy.pac`
  if (await pacReachable(localPac)) {
    console.log(`[nesy-lan-proxy] already listening — ${getPacUrl()}`)
    return
  }

  const child = spawn(process.execPath, [join(repoRoot, 'scripts/lan-vpn-proxy.mjs')], {
    cwd: repoRoot,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })
  child.unref()

  const started = Date.now()
  while (Date.now() - started < 4000) {
    if (await pacReachable(localPac)) {
      console.log(`[nesy-lan-proxy] started — ${getPacUrl()}`)
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  console.warn(`[nesy-lan-proxy] started process but PAC not reachable yet (${getProxyAddr()})`)
}

export async function ensureNesyLanProxy() {
  if (process.env.NESY_LAN_PROXY === '0') return
  if (process.platform === 'darwin') {
    await ensureMac()
    return
  }
  if (process.platform === 'win32') {
    await ensureWindows()
  }
}

const invokedDirectly = process.argv[1]?.replaceAll('\\', '/').endsWith('ensure-nesy-lan-proxy.mjs')
if (invokedDirectly) {
  ensureNesyLanProxy().catch((error) => {
    console.warn('[nesy-lan-proxy]', error instanceof Error ? error.message : error)
    process.exitCode = 0
  })
}
