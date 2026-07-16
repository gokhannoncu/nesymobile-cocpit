#!/usr/bin/env node
/**
 * Starts a dev process after freeing its port — single Node parent, no cmd batch
 * nesting, so Ctrl+C exits cleanly without "Terminate batch job (Y/N)?".
 *
 * Usage: node dev-runner.mjs --port 4001 -- <command> [args...]
 */
import { spawn, execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { killPort } from './kill-dev-ports.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

function parseArgs(argv) {
  let port = null
  let commandArgs = []
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--port') {
      port = Number(argv[++i])
      continue
    }
    if (argv[i] === '--') {
      commandArgs = argv.slice(i + 1)
      break
    }
  }
  return { port, commandArgs }
}

function resolveCommand(command, cwd) {
  if (command === 'tsx') {
    return {
      file: process.execPath,
      argsPrefix: [require.resolve('tsx/cli', { paths: [cwd] })],
    }
  }
  if (command === 'next') {
    return {
      file: process.execPath,
      argsPrefix: [require.resolve('next/dist/bin/next', { paths: [cwd] })],
    }
  }
  if (command === 'turbo') {
    return {
      file: process.execPath,
      argsPrefix: [require.resolve('turbo/bin/turbo', { paths: [repoRoot] })],
    }
  }
  return { file: command, argsPrefix: [] }
}

const { port, commandArgs } = parseArgs(process.argv.slice(2))

if (!commandArgs.length) {
  console.error('Usage: node dev-runner.mjs --port <n> -- <command> [args...]')
  process.exit(1)
}

if (port && port > 0) {
  console.log(`[dev] checking port ${port}...`)
  killPort(port)
}

const [command, ...rest] = commandArgs
const cwd = process.cwd()
const { file, argsPrefix } = resolveCommand(command, cwd)
const child = spawn(file, [...argsPrefix, ...rest], {
  cwd,
  env: process.env,
  stdio: 'inherit',
  windowsHide: true,
})

let forceExitTimer = null

function shutdown(force = false) {
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
  if (forceExitTimer) clearTimeout(forceExitTimer)
  process.exit(code ?? 0)
})

child.on('error', (error) => {
  console.error('[dev] failed to start process:', error.message)
  process.exit(1)
})
