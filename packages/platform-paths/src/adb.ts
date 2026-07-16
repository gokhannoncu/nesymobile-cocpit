import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'

function expandHome(path: string): string {
  return path.startsWith('~/') ? join(homedir(), path.slice(2)) : path
}

function firstExisting(paths: string[]): string | null {
  for (const candidate of paths) {
    const expanded = expandHome(candidate.trim())
    if (expanded && existsSync(expanded)) return expanded
  }
  return null
}

function envPath(name: string): string | null {
  const value = process.env[name]?.trim()
  return value || null
}

function platformEnvPath(): string | null {
  const os = platform()
  if (os === 'win32') {
    return envPath('ADB_PATH_WINDOWS') ?? envPath('ADB_PATH_WIN32')
  }
  if (os === 'darwin') {
    return envPath('ADB_PATH_DARWIN') ?? envPath('ADB_PATH_MACOS') ?? envPath('ADB_PATH_OSX')
  }
  return envPath('ADB_PATH_LINUX')
}

function defaultCandidates(): string[] {
  const home = homedir()
  const os = platform()

  if (os === 'win32') {
    const localAppData = process.env.LOCALAPPDATA ?? join(home, 'AppData', 'Local')
    return [
      join(localAppData, 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
      join(home, 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
      'C:\\Android\\platform-tools\\adb.exe',
      join(
        localAppData,
        'Microsoft',
        'WinGet',
        'Packages',
        'Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe',
        'platform-tools',
        'adb.exe',
      ),
    ]
  }

  if (os === 'darwin') {
    return [
      join(home, 'Library', 'Android', 'sdk', 'platform-tools', 'adb'),
      '/opt/homebrew/bin/adb',
      '/usr/local/bin/adb',
      '/usr/bin/adb',
    ]
  }

  return [
    join(home, 'Android', 'Sdk', 'platform-tools', 'adb'),
    '/usr/local/bin/adb',
    '/usr/bin/adb',
  ]
}

function resolveFromPath(): string | null {
  const os = platform()
  try {
    if (os === 'win32') {
      const output = execFileSync('where.exe', ['adb'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      })
      const first = output.split(/\r?\n/).map((line) => line.trim()).find(Boolean)
      return first && existsSync(first) ? first : null
    }

    const output = execFileSync('which', ['adb'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const resolved = output.trim()
    return resolved && existsSync(resolved) ? resolved : null
  } catch {
    return null
  }
}

let cachedAdbPath: string | null | undefined

/** Resolves adb binary: ADB_PATH → platform env → defaults → PATH lookup. */
export function resolveAdbPath(): string | null {
  if (cachedAdbPath !== undefined) return cachedAdbPath

  const candidates = [
    envPath('ADB_PATH'),
    platformEnvPath(),
    ...defaultCandidates(),
  ].filter((p): p is string => Boolean(p))

  cachedAdbPath = firstExisting(candidates) ?? resolveFromPath()
  return cachedAdbPath
}

export function getAdbPathHint(): string {
  const os = platform()
  if (os === 'win32') {
    return 'Set ADB_PATH_WINDOWS or ADB_PATH, or install Android platform-tools'
  }
  if (os === 'darwin') {
    return 'Set ADB_PATH_DARWIN or ADB_PATH, or install Android platform-tools'
  }
  return 'Set ADB_PATH_LINUX or ADB_PATH, or install Android platform-tools'
}

export function resetAdbPathCache(): void {
  cachedAdbPath = undefined
}
