#!/usr/bin/env node
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'apps/api/package.json'))
const args = process.argv.slice(2)
const arg = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback
const intArg = (name, fallback) => {
  const raw = arg(name)
  return raw === undefined ? fallback : Number.parseInt(raw, 10)
}
const envFile = resolve(arg('--env-file', join(root, 'apps/api/.env')))
const output = resolve(arg('--output', join(root, 'artifacts/live-profile/local-postgres-campaign/db-benchmark.json')))
const branch = arg('--db-branch', 'unspecified')
require('dotenv').config({ path: envFile, quiet: true })
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const nowIso = () => new Date().toISOString()
const sample = async (work) => {
  const started = performance.now()
  await work()
  return performance.now() - started
}
const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil((sorted.length - 1) * p))]
}
const stats = (values) => ({
  n: values.length,
  medianMs: percentile(values, 0.5),
  p95Ms: percentile(values, 0.95),
  minMs: Math.min(...values),
  maxMs: Math.max(...values),
  samplesMs: values,
})
const dbSummary = () => {
  const raw = process.env.DATABASE_URL
  if (!raw) return { configured: false }
  try {
    const url = new URL(raw)
    return {
      configured: true,
      protocol: url.protocol.replace(':', ''),
      host: url.hostname,
      port: url.port || '(default)',
      database: url.pathname.replace(/^\//, '') || '(none)',
      user: url.username ? 'set' : 'unset',
      password: url.password ? 'set' : 'unset',
    }
  } catch {
    return { configured: true, parse: 'failed', length: raw.length }
  }
}

try {
  mkdirSync(dirname(output), { recursive: true, mode: 0o700 })
  const firstConnectMs = await sample(() => prisma.$connect())
  const identity = (await prisma.$queryRaw`
    select version() as version,
           current_database() as database,
           inet_server_addr()::text as server_addr,
           inet_server_port() as server_port,
           current_setting('TimeZone') as timezone,
           current_setting('server_encoding') as encoding
  `)[0]
  for (let i = 0; i < intArg('--warmup', 5); i += 1) await prisma.$queryRaw`select 1`

  const selectSamples = []
  for (let i = 0; i < intArg('--select-count', 30); i += 1) {
    selectSamples.push(await sample(() => prisma.$queryRaw`select 1`))
  }

  const txSamples = []
  for (let i = 0; i < intArg('--tx-count', 20); i += 1) {
    txSamples.push(await sample(() => prisma.$transaction(async (tx) => {
      await tx.$queryRaw`select 1`
      await tx.$queryRaw`select 1`
      await tx.$queryRaw`select 1`
    })))
  }

  const explain = await prisma.$queryRawUnsafe('EXPLAIN (ANALYZE, FORMAT JSON) SELECT 1')
  const plan = explain[0]?.['QUERY PLAN']?.[0]
  const result = {
    schemaVersion: 1,
    measuredAt: nowIso(),
    branch,
    envFile: envFile.replace(root, '<repo>'),
    databaseUrl: dbSummary(),
    firstConnectMs,
    identity: {
      ...identity,
      version: String(identity.version).split(' on ')[0],
    },
    select1: stats(selectSamples),
    threeSelectTransaction: stats(txSamples),
    serverExplain: {
      planningMs: plan?.['Planning Time'] ?? null,
      executionMs: plan?.['Execution Time'] ?? null,
    },
  }
  writeFileSync(output, JSON.stringify(result, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value, 2), { mode: 0o600 })
  console.log(JSON.stringify({ output, branch, select1: result.select1, threeSelectTransaction: result.threeSelectTransaction }))
} finally {
  await prisma.$disconnect()
}
