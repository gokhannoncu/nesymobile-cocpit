/**
 * Cross-session mutex for auto / manual prod builds.
 * Lock file: .cursor/hooks-state/prod-build.lock
 */
import { existsSync, mkdirSync, openSync, closeSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const stateDir = join(repoRoot, '.cursor', 'hooks-state')
export const lockPath = join(stateDir, 'prod-build.lock')

const DEFAULT_WAIT_MS = 15 * 60 * 1000
const DEFAULT_POLL_MS = 2000
const STALE_MS = 45 * 60 * 1000

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function readLock() {
  try {
    return JSON.parse(readFileSync(lockPath, 'utf8'))
  } catch {
    return null
  }
}

function removeLockFile() {
  try {
    unlinkSync(lockPath)
  } catch {
    // ignore
  }
}

function isStale(holder) {
  if (!holder) return true
  if (!isPidAlive(holder.pid)) return true
  const started = Date.parse(holder.startedAt || '')
  if (Number.isFinite(started) && Date.now() - started > STALE_MS) return true
  return false
}

/**
 * @param {{ waitMs?: number, pollMs?: number, log?: (msg: string) => void, owner?: string }} [opts]
 */
export async function acquireProdBuildLock(opts = {}) {
  const waitMs = opts.waitMs ?? DEFAULT_WAIT_MS
  const pollMs = opts.pollMs ?? DEFAULT_POLL_MS
  const log = opts.log ?? (() => {})
  const owner = opts.owner ?? `pid-${process.pid}`
  const deadline = Date.now() + waitMs

  mkdirSync(stateDir, { recursive: true })

  while (Date.now() < deadline) {
    try {
      const fd = openSync(lockPath, 'wx')
      const payload = {
        pid: process.pid,
        owner,
        startedAt: new Date().toISOString(),
      }
      writeFileSync(fd, `${JSON.stringify(payload, null, 2)}\n`)
      closeSync(fd)
      log(`acquired prod build lock (${owner})`)
      return payload
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && err.code !== 'EEXIST') {
        throw err
      }
    }

    const holder = readLock()
    if (isStale(holder)) {
      log(
        `clearing stale prod build lock (pid ${holder?.pid ?? '?'}, owner ${holder?.owner ?? '?'})`,
      )
      removeLockFile()
      continue
    }

    log(
      `waiting for prod build lock — held by pid ${holder.pid}` +
        (holder.owner ? ` (${holder.owner})` : '') +
        ` since ${holder.startedAt ?? '?'}`,
    )
    await sleep(pollMs)
  }

  const holder = readLock()
  throw new Error(
    `timed out after ${Math.round(waitMs / 1000)}s waiting for prod build lock` +
      (holder ? ` (held by pid ${holder.pid}${holder.owner ? ` / ${holder.owner}` : ''})` : ''),
  )
}

export function releaseProdBuildLock(opts = {}) {
  const log = opts.log ?? (() => {})
  const holder = readLock()
  if (!holder) return
  // Only release if we own it (or holder is dead).
  if (holder.pid === process.pid || !isPidAlive(holder.pid)) {
    removeLockFile()
    log('released prod build lock')
    return
  }
  log(`skip release — lock owned by pid ${holder.pid}`)
}

export function isProdBuildInProgress() {
  if (!existsSync(lockPath)) return false
  const holder = readLock()
  return Boolean(holder) && !isStale(holder)
}
