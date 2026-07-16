#!/usr/bin/env node
/**
 * Frees dev ports before `pnpm dev` (API: 4001, Web: 4002).
 * Uses non-interactive kill (no "Terminate batch job Y/N?" on Windows).
 */
import { execFileSync } from 'node:child_process'
import { platform } from 'node:os'
import { pathToFileURL } from 'node:url'

const DEFAULT_PORTS = [4001, 4002]

function killPidWindows(pid) {
  try {
    execFileSync('taskkill.exe', ['/PID', String(pid), '/F', '/T'], {
      stdio: 'ignore',
      windowsHide: true,
    })
    return true
  } catch {
    return false
  }
}

function listListeningPidsWindows(port) {
  try {
    const output = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        `$ErrorActionPreference='SilentlyContinue'; ` +
          `(Get-NetTCPConnection -LocalPort ${port} -State Listen | ` +
          `Select-Object -ExpandProperty OwningProcess -Unique) -join [Environment]::NewLine`,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true },
    )

    return [...new Set(output.split(/\r?\n/).map((s) => s.trim()).filter((s) => /^\d+$/.test(s)))]
  } catch {
    return []
  }
}

function killPortWindows(port) {
  const pids = listListeningPidsWindows(port)
  const killed = []
  for (const pid of pids) {
    if (killPidWindows(pid)) killed.push(pid)
  }
  return killed
}

function killPortUnix(port) {
  let output = ''
  try {
    output = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return []
  }

  const killed = []
  for (const pid of output.split(/\r?\n/).filter(Boolean)) {
    try {
      execFileSync('kill', ['-9', pid], { stdio: 'ignore' })
      killed.push(pid)
    } catch {
      // ignore
    }
  }
  return killed
}

/** Kill a single listening port. Returns killed PIDs. */
export function killPort(port) {
  const kill = platform() === 'win32' ? killPortWindows : killPortUnix
  const killed = kill(port)
  if (killed.length === 0) {
    console.log(`[dev] port ${port} is free`)
  } else {
    console.log(`[dev] port ${port} freed (killed PID ${killed.join(', ')})`)
  }
  return killed
}

export function killPorts(ports) {
  const label = ports.length === 1 ? `port ${ports[0]}` : ports.join(', ')
  console.log(`[dev] checking ${label}...`)
  for (const port of ports) {
    killPort(port)
  }
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const CLI_PORTS = process.argv.slice(2).map(Number).filter((p) => p > 0)
  const ports = CLI_PORTS.length > 0 ? CLI_PORTS : DEFAULT_PORTS
  killPorts(ports)
}
