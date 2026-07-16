import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import type { AppSocketServer } from './socket.js'

let cachedAdbPath: string | null | undefined

function resolveAdbPath(): string | null {
  if (cachedAdbPath !== undefined) return cachedAdbPath
  const candidates = [
    process.env.ADB_PATH,
    `${homedir()}/Library/Android/sdk/platform-tools/adb`,
    '/opt/homebrew/bin/adb',
    '/usr/local/bin/adb',
    '/usr/bin/adb',
  ].filter((p): p is string => Boolean(p))
  cachedAdbPath = candidates.find((p) => existsSync(p)) ?? null
  return cachedAdbPath
}

function attachSpawnErrorHandler(proc: ChildProcess, label: string) {
  proc.on('error', (err) => {
    console.warn(`[ADB Bridge] ${label} failed:`, err.message)
  })
}

export function startAdbBridge(io: AppSocketServer) {
  const adbPath = resolveAdbPath()
  if (!adbPath) {
    console.warn(
      '[ADB Bridge] adb binary not found — logcat listener disabled (set ADB_PATH or install Android platform-tools)',
    )
    return
  }

  console.log('[ADB Bridge] Starting logcat listener...')

  // NOTE: never run `logcat -c`. Clearing the ring buffer here would wipe the
  // shared device history that Device Log Explorer's buffer/backfill queries
  // depend on. `-T 1` starts near the tail so we follow new lines live without
  // replaying the whole historical buffer through the socket on every boot.
  const adb = spawn(adbPath, ['logcat', '-s', 'InteractionEvent', '-T', '1'])
  attachSpawnErrorHandler(adb, 'logcat listener')

  adb.stdout.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n')
    for (let line of lines) {
      line = line.trim()
      if (!line) continue

      const jsonStart = line.indexOf('{')
      if (jsonStart !== -1) {
        const jsonStr = line.substring(jsonStart)
        try {
          const event = JSON.parse(jsonStr)
          io.emit('interaction', event)
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          console.error('[ADB Bridge] Failed to parse JSON:', message, 'Raw:', jsonStr)
        }
      }
    }
  })

  adb.on('close', (code) => {
    console.log(`[ADB Bridge] Logcat process exited with code ${code}`)
  })
}
