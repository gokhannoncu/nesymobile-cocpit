#!/usr/bin/env node
/**
 * Run a command under the shared prod-build lock.
 *
 * Usage:
 *   node .cursor/hooks/with-prod-build-lock.mjs -- pnpm --filter @nesy/web build
 *   node .cursor/hooks/with-prod-build-lock.mjs pnpm --filter @nesy/api build
 *
 * If another session's auto-prod build (or locked manual build) is running,
 * this waits, then runs your command.
 */
import { spawnSync } from 'node:child_process'
import { acquireProdBuildLock, releaseProdBuildLock } from './prod-build-lock.mjs'

const argv = process.argv.slice(2)
const cmdArgs = argv[0] === '--' ? argv.slice(1) : argv

if (cmdArgs.length === 0) {
  process.stderr.write(
    'usage: node .cursor/hooks/with-prod-build-lock.mjs [--] <command> [args...]\n',
  )
  process.exit(2)
}

function log(line) {
  process.stderr.write(`[prod-build-lock] ${line}\n`)
}

let held = false
try {
  await acquireProdBuildLock({
    log,
    owner: `manual:${cmdArgs.slice(0, 4).join(' ')}`,
  })
  held = true

  const [command, ...args] = cmdArgs
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    windowsHide: true,
  })
  process.exitCode = result.status ?? 1
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  process.stderr.write(`[prod-build-lock] FAILED: ${message}\n`)
  process.exitCode = 1
} finally {
  if (held) releaseProdBuildLock({ log })
}
