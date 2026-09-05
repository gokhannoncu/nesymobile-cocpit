#!/usr/bin/env node
/**
 * Start the API for one campaign arm without editing `apps/api/.env`.
 *
 * The arm's DB, persistence mode and profiler state are process-level env, so
 * the committed configuration keeps describing normal operation and a rollback
 * is "stop this process and start the normal one".
 *
 *   node scripts/campaign-api-arm.mjs --env-file <file> --persistence serial|batch [--no-profile]
 */
import { spawn, execFileSync } from 'node:child_process'
import { existsSync, readFileSync, openSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const arg = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback)
const envFile = resolve(arg('--env-file', join(root, 'apps/api/.env')))
const persistence = arg('--persistence', 'batch')
const logFile = resolve(arg('--log', join(root, 'artifacts/live-profile/campaign-api.log')))
if (!['serial', 'batch'].includes(persistence)) throw new Error('--persistence must be serial or batch')
if (!existsSync(envFile)) throw new Error('env file not found: ' + envFile)

const listening = (() => {
  try {
    return execFileSync('lsof', ['-t', '-iTCP:4001', '-sTCP:LISTEN'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
  } catch { return [] }
})()
if (listening.length > 0) throw new Error('port 4001 still held by PID(s) ' + listening.join(',') + '; stop the previous arm first')

const env = { ...process.env }
for (const line of readFileSync(envFile, 'utf8').split('\n')) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
  if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '')
}
env.NESY_PERSISTENCE_BATCH = persistence === 'batch' ? '1' : '0'
env.NESY_LIVE_PROFILE = args.includes('--no-profile') ? '0' : '1'

const url = new URL(env.DATABASE_URL)
console.log(JSON.stringify({
  arm: { persistence, profiler: env.NESY_LIVE_PROFILE === '1' },
  database: { host: url.hostname, port: url.port || '(default)', name: url.pathname.replace(/^\//, '') },
  envFile: envFile.replace(root, '<repo>'), logFile: logFile.replace(root, '<repo>'),
}))

const out = openSync(logFile, 'a')
const child = spawn(process.execPath, ['dist/server.js'], {
  cwd: join(root, 'apps/api'), env, detached: true, stdio: ['ignore', out, out],
})
child.unref()
console.log(JSON.stringify({ pid: child.pid }))
