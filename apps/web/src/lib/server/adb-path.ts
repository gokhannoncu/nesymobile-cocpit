import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'
import { getAdbPathHint } from '@nesy/platform-paths'

export { resolveAdbPath } from '@nesy/platform-paths'

function envPath(name: string): string | null {
  const value = process.env[name]?.trim()
  return value || null
}

function platformSqliteEnvPath(): string | null {
  const os = platform()
  if (os === 'win32') return envPath('SQLITE3_PATH_WINDOWS') ?? envPath('SQLITE3_PATH_WIN32')
  if (os === 'darwin') return envPath('SQLITE3_PATH_DARWIN') ?? envPath('SQLITE3_PATH_MACOS')
  return envPath('SQLITE3_PATH_LINUX')
}

function defaultSqliteCandidates(): string[] {
  const home = homedir()
  const os = platform()
  if (os === 'win32') {
    return [
      'C:\\Program Files\\SQLite\\sqlite3.exe',
      join(home, 'scoop', 'shims', 'sqlite3.exe'),
    ]
  }
  if (os === 'darwin') {
    return ['/opt/homebrew/bin/sqlite3', '/usr/local/bin/sqlite3', '/usr/bin/sqlite3']
  }
  return ['/usr/bin/sqlite3', '/usr/local/bin/sqlite3']
}

function resolveSqliteFromPath(): string | null {
  try {
    const os = platform()
    const output = execFileSync(os === 'win32' ? 'where.exe' : 'which', ['sqlite3'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: os === 'win32',
    })
    const first = output.split(/\r?\n/).map((line) => line.trim()).find(Boolean)
    return first && existsSync(first) ? first : null
  } catch {
    return null
  }
}

let cachedSqlitePath: string | null | undefined

export function resolveSqlitePath(): string | null {
  if (cachedSqlitePath !== undefined) return cachedSqlitePath
  const candidates = [
    envPath('SQLITE3_PATH'),
    platformSqliteEnvPath(),
    ...defaultSqliteCandidates(),
  ].filter((p): p is string => Boolean(p))
  cachedSqlitePath = candidates.find((p) => existsSync(p)) ?? resolveSqliteFromPath()
  return cachedSqlitePath
}

export function getAdbResolutionHint(): string {
  return getAdbPathHint()
}
