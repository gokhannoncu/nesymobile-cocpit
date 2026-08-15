#!/usr/bin/env node
/**
 * G90.10 BD.3 live qualification — Host B only.
 *
 * Refuses the G90.9 qualification lineage (PID 55798 / commit 3770d2a).
 * This is not a D60 campaign and not a login Host A run.
 *
 * Required after: G90.10 commit → fresh build → fresh pnpm prod → new PID.
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const G90_9_PID = '55798'
const G90_9_COMMIT = '3770d2a'

function sh(cmd, args) {
  return spawnSync(cmd, args, { cwd: REPO, encoding: 'utf8' }).stdout.trim()
}

function commandOf(pid) {
  return sh('ps', ['-p', String(pid), '-o', 'command=']).replace(/\s+/g, ' ')
}

const apiPid = sh('lsof', ['-nP', '-iTCP:4001', '-sTCP:LISTEN', '-t']).split(/\s+/).filter(Boolean)[0]
const apiCommand = apiPid ? commandOf(apiPid) : null
const head = sh('git', ['rev-parse', '--short', 'HEAD'])
const issues = []

if (!apiCommand || !/dist\/server\.js/.test(apiCommand)) {
  issues.push(`:4001 is not node dist/server.js (${apiCommand ?? 'none'})`)
}
if (apiPid === G90_9_PID) {
  issues.push(`PID ${G90_9_PID} is the G90.9 qualification lineage — open a fresh prod after the G90.10 commit`)
}
if (head === G90_9_COMMIT) {
  issues.push(`HEAD ${head} is still the G90.9 reference commit — commit BD.3 first`)
}
if (/tsx watch|src\/server\.ts/.test(apiCommand ?? '')) {
  issues.push(':4001 is tsx/dev')
}

console.log(JSON.stringify({ apiPid, apiCommand, head, host: 'B', injectedFault: 'BACKEND_TIMEOUT' }, null, 2))
if (issues.length > 0) {
  console.error('BD.3 live smoke preflight failed:')
  for (const issue of issues) console.error(`  ${issue}`)
  process.exit(2)
}

console.error('BD.3 live smoke is ready for Host B (complete-delivery / tour-approval).')
console.error('Prepared-session Host B run is not started by this preflight.')
process.exit(3)
