#!/usr/bin/env node
/**
 * Quiet NESY Cockpit for `pnpm dev` / `pnpm prod` / `pnpm fastprod`.
 * Status panel only (DB / API / Web). Pass --verbose for raw Turbo logs.
 *
 * Usage: node scripts/cockpit-runner.mjs --mode dev|prod|fastprod [--verbose]
 */
import { spawn, execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  applyHealthProbe,
  applyLogLine,
  createCockpitState,
  createLineFeed,
  createLineRewriter,
  DEFAULT_PORTS,
  formatStatusPanel,
} from './cockpit-log.mjs'
import { ensureNesyLanProxy } from './ensure-nesy-lan-proxy.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

function parseArgs(argv) {
  let mode = null
  let verbose = false
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--mode') {
      const value = argv[i + 1]
      if (value === 'dev' || value === 'prod' || value === 'fastprod') mode = value
      i += 1
      continue
    }
    if (argv[i] === '--verbose' || argv[i] === '-v') {
      verbose = true
    }
  }
  return { mode, verbose }
}

/** True when prior `next build` / api `tsc` outputs exist for a skip-build start. */
function hasProductionArtifacts() {
  return (
    existsSync(join(repoRoot, 'apps/web/.next/BUILD_ID')) &&
    existsSync(join(repoRoot, 'apps/api/dist/server.js'))
  )
}

const { mode, verbose } = parseArgs(process.argv.slice(2))
if (!mode) {
  console.error('Usage: node scripts/cockpit-runner.mjs --mode dev|prod|fastprod [--verbose]')
  process.exit(1)
}

// fastprod skips turbo's build→start chain only when artifacts already exist;
// otherwise it falls through to the same build+start path as prod.
const skipBuild = mode === 'fastprod' && hasProductionArtifacts()
const turboTask = mode === 'dev' ? 'dev' : 'start'
let turboBin
try {
  turboBin = require.resolve('turbo/bin/turbo', { paths: [repoRoot] })
} catch (error) {
  console.error('[cockpit] turbo not found — run pnpm install at repo root')
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

if (mode === 'fastprod' && !skipBuild) {
  console.error(
    '[cockpit] fastprod: no production build found (apps/web/.next/BUILD_ID) — building first',
  )
}

const state = createCockpitState(mode, DEFAULT_PORTS)
let panelLines = 0
let renderScheduled = false

function renderPanel() {
  const panel = formatStatusPanel(state)
  const nextLines = panel.split('\n').length
  if (panelLines > 0) {
    process.stdout.write(`\x1b[${panelLines}A\x1b[0J`)
  } else {
    process.stdout.write('\n')
  }
  process.stdout.write(`${panel}\n`)
  panelLines = nextLines
}

function scheduleRender() {
  if (renderScheduled) return
  renderScheduled = true
  setImmediate(() => {
    renderScheduled = false
    renderPanel()
  })
}

async function probe(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) })
    return res.ok || res.status < 500
  } catch {
    return false
  }
}

async function runHealthProbes() {
  const [apiOk, webOk] = await Promise.all([
    probe(`http://127.0.0.1:${state.ports.api}/health`),
    probe(`http://127.0.0.1:${state.ports.web}`),
  ])
  let changed = false
  if (applyHealthProbe(state, 'api', apiOk)) changed = true
  if (applyHealthProbe(state, 'web', webOk)) changed = true
  // If api+web are up, dependency packages are effectively ready
  if (apiOk && webOk && state.db.status !== 'failed' && state.db.status !== 'ready') {
    state.db.status = 'ready'
    state.db.detail = 'ready'
    changed = true
  }
  if (changed && !verbose) scheduleRender()
}

try {
  await ensureNesyLanProxy()
} catch (error) {
  console.warn('[nesy-lan-proxy]', error instanceof Error ? error.message : error)
}

renderPanel()

const turboArgs = [turboBin, 'run', turboTask, '--ui=stream']
if (skipBuild) turboArgs.push('--only')

const child = spawn(
  process.execPath,
  turboArgs,
  {
    cwd: repoRoot,
    env: {
      ...process.env,
      FORCE_COLOR: process.env.FORCE_COLOR ?? '0',
    },
    stdio: ['inherit', 'pipe', 'pipe'],
    windowsHide: true,
  },
)

if (verbose) {
  const rewriteStdout = createLineRewriter((s) => process.stdout.write(s))
  const rewriteStderr = createLineRewriter((s) => process.stderr.write(s))
  child.stdout.on('data', rewriteStdout)
  child.stderr.on('data', rewriteStderr)
} else {
  const onLine = (line) => {
    if (applyLogLine(state, line)) scheduleRender()
  }
  const feedStdout = createLineFeed(onLine)
  const feedStderr = createLineFeed(onLine)
  child.stdout.on('data', feedStdout)
  child.stderr.on('data', feedStderr)
}

const healthTimer = setInterval(() => {
  void runHealthProbes()
}, 1000)
healthTimer.unref?.()

let forceExitTimer = null

function shutdown(force = false) {
  clearInterval(healthTimer)
  if (child.exitCode != null || child.signalCode != null) {
    process.exit(0)
    return
  }
  if (force || process.platform === 'win32') {
    if (child.pid) {
      try {
        execFileSync('taskkill.exe', ['/PID', String(child.pid), '/F', '/T'], {
          stdio: 'ignore',
          windowsHide: true,
        })
      } catch {
        child.kill('SIGKILL')
      }
    }
    process.exit(0)
    return
  }
  child.kill('SIGTERM')
  forceExitTimer = setTimeout(() => {
    child.kill('SIGKILL')
    process.exit(1)
  }, 2500)
  forceExitTimer.unref?.()
}

process.on('SIGINT', () => shutdown(false))
process.on('SIGTERM', () => shutdown(false))

child.on('exit', (code) => {
  clearInterval(healthTimer)
  if (forceExitTimer) clearTimeout(forceExitTimer)
  if (code && code !== 0 && !verbose) {
    state.error = `Turbo exited with code ${code}`
    if (state.api.status !== 'ready') state.api.status = 'failed'
    if (state.web.status !== 'ready') state.web.status = 'failed'
    renderPanel()
  }
  process.exit(code ?? 0)
})

child.on('error', (error) => {
  clearInterval(healthTimer)
  console.error('\n[cockpit] failed to start turbo:', error.message)
  process.exit(1)
})
