#!/usr/bin/env node
/**
 * stop — if agent edited web/api sources, rebuild for `pnpm prod` and restart listeners.
 * Opt out: NESY_AUTO_PROD_BUILD=0
 *
 * Cross-session safety: acquires `.cursor/hooks-state/prod-build.lock` so two
 * agent sessions finishing at once cannot run parallel pnpm builds.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { killPort } from '../../scripts/kill-dev-ports.mjs'
import { acquireProdBuildLock, releaseProdBuildLock } from './prod-build-lock.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const stateDir = join(repoRoot, '.cursor', 'hooks-state')
const statePath = join(stateDir, 'pending-build.json')
const logPath = join(stateDir, 'auto-prod-build.log')
const require = createRequire(import.meta.url)

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = []
    process.stdin.on('data', (c) => chunks.push(c))
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    process.stdin.on('error', reject)
  })
}

function loadState() {
  try {
    return JSON.parse(readFileSync(statePath, 'utf8'))
  } catch {
    return null
  }
}

function clearState() {
  try {
    rmSync(statePath, { force: true })
  } catch {
    // ignore
  }
}

function log(line) {
  const text = `[auto-prod-build] ${line}`
  process.stderr.write(`${text}\n`)
  try {
    mkdirSync(stateDir, { recursive: true })
    writeFileSync(logPath, `${new Date().toISOString()} ${text}\n`, { flag: 'a' })
  } catch {
    // ignore
  }
}

function loadPreserveLineage() {
  try {
    return JSON.parse(readFileSync(join(stateDir, 'preserve-prod-lineage.json'), 'utf8'))
  } catch {
    return null
  }
}

function shouldPreserveApi() {
  const preserve = loadPreserveLineage()
  if (!preserve || preserve.doNotRestartApi !== true) return false
  if (!portInUse(4001)) return false
  if (preserve.apiPid) {
    const listening = spawnSync('lsof', ['-nP', '-iTCP:4001', '-sTCP:LISTEN', '-t'], {
      encoding: 'utf8',
    })
    const pids = (listening.stdout || '').trim().split(/\s+/).filter(Boolean)
    if (!pids.includes(String(preserve.apiPid))) return false
  }
  return true
}

function portInUse(port) {
  const result = spawnSync(
    process.platform === 'win32' ? 'powershell.exe' : 'lsof',
    process.platform === 'win32'
      ? [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          `(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Measure-Object).Count`,
        ]
      : ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'],
    { encoding: 'utf8', windowsHide: true },
  )
  if (process.platform === 'win32') {
    return Number((result.stdout || '').trim()) > 0
  }
  return result.status === 0 && Boolean((result.stdout || '').trim())
}

function runPnpm(filter, script) {
  log(`building ${filter} (${script})…`)
  const result = spawnSync(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['--filter', filter, script],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      windowsHide: true,
      env: process.env,
      maxBuffer: 20 * 1024 * 1024,
    },
  )
  if (result.status !== 0) {
    const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim()
    const clipped = output.slice(-2500)
    throw new Error(`${filter} ${script} failed (exit ${result.status})\n${clipped}`)
  }
  log(`${filter} build ok`)
}

function prepareWebProductionBuild() {
  const nextDir = join(repoRoot, 'apps', 'web', '.next')
  if (!existsSync(nextDir)) return
  log('removing apps/web/.next before production build (dev + build share this cache)…')
  rmSync(nextDir, { recursive: true, force: true })
}

function restartNextWeb() {
  const nextBin = require.resolve('next/dist/bin/next', {
    paths: [join(repoRoot, 'apps', 'web')],
  })
  log('restarting web on :4002…')
  killPort(4002)
  const child = spawn(process.execPath, [nextBin, 'start', '-p', '4002'], {
    cwd: join(repoRoot, 'apps', 'web'),
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: process.env,
  })
  child.unref()
}

function restartApi() {
  const serverJs = join(repoRoot, 'apps', 'api', 'dist', 'server.js')
  if (!existsSync(serverJs)) {
    log('api dist/server.js missing — skip restart')
    return
  }
  log('restarting api on :4001…')
  killPort(4001)
  const child = spawn(process.execPath, [serverJs], {
    cwd: join(repoRoot, 'apps', 'api'),
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: process.env,
  })
  child.unref()
}

const raw = await readStdin()
let payload = {}
try {
  payload = JSON.parse(raw || '{}')
} catch {
  process.stdout.write('{}\n')
  process.exit(0)
}

if (process.env.NESY_AUTO_PROD_BUILD === '0') {
  process.stdout.write('{}\n')
  process.exit(0)
}

if (payload.status === 'aborted') {
  process.stdout.write('{}\n')
  process.exit(0)
}

const peek = loadState()
if (!peek || (!peek.web && !peek.api)) {
  process.stdout.write('{}\n')
  process.exit(0)
}

let heldLock = false
try {
  await acquireProdBuildLock({
    log,
    owner: `stop-hook:${payload.conversation_id || payload.session_id || process.pid}`,
  })
  heldLock = true

  // Re-read under lock — another session may have already built + cleared.
  const state = loadState()
  if (!state || (!state.web && !state.api)) {
    log('nothing dirty after acquiring lock — skip')
    process.stdout.write('{}\n')
  } else {
    const webWasUp = state.web && portInUse(4002)
    const apiWasUp = state.api && portInUse(4001)

    // Clear before build so concurrent afterFileEdit marks stay for the next waiter.
    clearState()

    if (state.api) runPnpm('@nesy/api', 'build')
    if (state.web) {
      prepareWebProductionBuild()
      runPnpm('@nesy/web', 'build')
    }
    if (state.api && apiWasUp) {
      if (shouldPreserveApi()) {
        log('preserving recorded prod lineage — skip api restart (G90.9 qualification PID stays)')
      } else {
        restartApi()
      }
    }
    if (state.web && webWasUp) restartNextWeb()
    log('done')
    process.stdout.write('{}\n')
  }
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  log(`FAILED: ${message}`)
  // One automatic agent follow-up to surface the failure (loop_limit: 1).
  if ((payload.loop_count ?? 0) < 1) {
    process.stdout.write(
      `${JSON.stringify({
        followup_message:
          `Auto prod build failed after your edits. Fix the build error, then continue.\n\n${message.slice(0, 1800)}`,
      })}\n`,
    )
  } else {
    process.stdout.write('{}\n')
  }
} finally {
  if (heldLock) releaseProdBuildLock({ log })
}
