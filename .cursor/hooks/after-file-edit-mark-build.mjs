#!/usr/bin/env node
/**
 * afterFileEdit — mark apps/web and/or apps/api for prod rebuild on agent stop.
 * Opt out: NESY_AUTO_PROD_BUILD=0
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const stateDir = join(repoRoot, '.cursor', 'hooks-state')
const statePath = join(stateDir, 'pending-build.json')

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
    return { web: false, api: false, files: [] }
  }
}

function saveState(state) {
  mkdirSync(stateDir, { recursive: true })
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

function classify(absPath) {
  const rel = relative(repoRoot, normalize(absPath)).split(/[/\\]/).join('/')
  if (!rel || rel.startsWith('..')) return null
  if (
    rel.startsWith('apps/web/src/') ||
    rel.startsWith('apps/web/public/') ||
    rel === 'apps/web/next.config.ts' ||
    rel === 'apps/web/next.config.js' ||
    rel === 'apps/web/package.json' ||
    rel === 'apps/web/tsconfig.json' ||
    rel.startsWith('packages/metronic/') ||
    rel.startsWith('packages/types/') ||
    rel.startsWith('packages/platform-paths/') ||
    rel.startsWith('packages/ui/')
  ) {
    return 'web'
  }
  if (
    rel.startsWith('apps/api/src/') ||
    rel === 'apps/api/package.json' ||
    rel === 'apps/api/tsconfig.json' ||
    rel.startsWith('packages/db/') ||
    rel.startsWith('packages/bridge-contract/') ||
    rel.startsWith('packages/bridge-client/') ||
    rel.startsWith('packages/bridgeflow-compiler/') ||
    rel.startsWith('packages/bridgeflow-executor/') ||
    rel.startsWith('packages/control-channels/') ||
    rel.startsWith('packages/control-contract/') ||
    rel.startsWith('packages/execution-contract/') ||
    rel.startsWith('packages/oracle-engine/') ||
    rel.startsWith('packages/workflow-contract/') ||
    rel.startsWith('packages/domain-pack-contracts/') ||
    rel.startsWith('domain-packs/')
  ) {
    return 'api'
  }
  return null
}

const raw = await readStdin()
if (process.env.NESY_AUTO_PROD_BUILD === '0') {
  process.stdout.write('{}\n')
  process.exit(0)
}

let payload = {}
try {
  payload = JSON.parse(raw || '{}')
} catch {
  process.stdout.write('{}\n')
  process.exit(0)
}

const filePath = payload.file_path || payload.filePath || ''
const kind = filePath ? classify(filePath) : null
if (kind) {
  const state = loadState()
  state[kind] = true
  if (!state.files.includes(filePath)) {
    state.files = [...state.files, filePath].slice(-40)
  }
  saveState(state)
  process.stderr.write(`[auto-prod-build] marked ${kind} dirty ← ${relative(repoRoot, filePath)}\n`)
}

process.stdout.write('{}\n')
