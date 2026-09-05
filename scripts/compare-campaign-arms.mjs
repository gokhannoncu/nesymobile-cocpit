#!/usr/bin/env node
/**
 * Build the A/B/C comparison table from finished profile runs.
 *
 * Totals only compare when two arms walked the same steps, which is why every
 * row is also reported per step occurrence: an arm that stops early still says
 * something true about the cost of one step, and that is the number a workload
 * difference cannot quietly inflate.
 *
 *   node scripts/compare-campaign-arms.mjs <label>=<runDir> [<label>=<runDir> ...]
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const arms = process.argv.slice(2).map((entry) => {
  const at = entry.indexOf('=')
  if (at < 0) throw new Error(`expected <label>=<runDir>, got ${entry}`)
  return { label: entry.slice(0, at), dir: resolve(entry.slice(at + 1)) }
})
if (arms.length === 0) throw new Error('at least one <label>=<runDir> is required')

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const round = (value, digits = 2) =>
  value === null || value === undefined ? null : Number(value.toFixed(digits))

function measure({ label, dir }) {
  const analysis = readJson(join(dir, 'analysis.json'))
  const summary = readJson(join(dir, 'summary.json'))
  const rows = Array.isArray(summary) ? summary : Object.values(summary.groups ?? summary)
  const span = (name) => rows.find((row) => row.name === name) ?? null

  const transaction = span('db.transaction')
  const dbCalls = Object.values(analysis.dbCallCounts ?? {}).reduce((sum, value) => sum + value, 0)
  // A step is only counted once even when it re-occurs, because the plan's own
  // occurrence list is what makes two arms comparable.
  const occurrences = (analysis.steps ?? []).length
  const dbMs = analysis.categoryUnionMs?.db ?? 0

  const snapshotPath = join(dir, '..', 'run-snapshot.json')
  const snapshot = existsSync(snapshotPath) ? readJson(snapshotPath) : null

  return {
    label,
    runId: dir.split('/').at(-1),
    runDurationSec: round(analysis.runDurationMs / 1000, 3),
    dbUnionSec: round(dbMs / 1000, 3),
    dbSharePct: round((dbMs / analysis.runDurationMs) * 100, 1),
    transactions: transaction?.count ?? 0,
    transactionP50Ms: round(transaction?.p50Ms),
    transactionP95Ms: round(transaction?.p95Ms),
    dbCalls,
    occurrences,
    dbMsPerOccurrence: occurrences ? round(dbMs / occurrences) : null,
    txPerOccurrence: occurrences ? round((transaction?.count ?? 0) / occurrences, 2) : null,
    oracleSec: round((analysis.categoryUnionMs?.oracle ?? 0) / 1000, 3),
    sdkSec: round((analysis.categoryUnionMs?.sdk_control ?? 0) / 1000, 3),
    bridgeSec: round((analysis.categoryUnionMs?.bridge_client ?? 0) / 1000, 3),
    verdict: snapshot?.run?.product_verdict ?? null,
    status: snapshot?.run?.status ?? null,
    cleanup: snapshot?.run?.cleanup_result ?? null,
    lastStep: (analysis.steps ?? []).at(-1)?.stepId ?? null,
    steps: analysis.steps ?? [],
    stepIds: (analysis.steps ?? []).map((step) => step.stepId),
  }
}

const measured = arms.map(measure)
const comparable = new Set(measured.map((arm) => `${arm.occurrences}:${arm.lastStep}`)).size === 1

/**
 * Live business state decides how far a run gets — an unapproved tour ends the
 * day early no matter which database is behind it. The steps every arm actually
 * executed are therefore the only scope where a total may be divided, and this
 * is the number the campaign should report when the arms stop in different
 * places.
 */
function commonPrefix(all) {
  const shared = all
    .map((arm) => new Set(arm.stepIds))
    .reduce((left, right) => new Set([...left].filter((id) => right.has(id))))
  return all.map((arm) => {
    const steps = arm.steps.filter((step) => shared.has(step.stepId))
    const dbMs = steps.reduce((sum, step) => sum + (step.dbMs ?? 0), 0)
    const wallMs = steps.reduce((sum, step) => sum + (step.durationMs ?? 0), 0)
    return {
      label: arm.label,
      sharedSteps: steps.length,
      dbSec: round(dbMs / 1000, 3),
      stepWallSec: round(wallMs / 1000, 3),
      dbMsPerSharedStep: steps.length ? round(dbMs / steps.length) : null,
      transactionP50Ms: arm.transactionP50Ms,
    }
  })
}

const columns = [
  ['Arm', (a) => a.label],
  ['Run', (a) => a.runId.slice(0, 12) + '…'],
  ['Steps', (a) => a.occurrences],
  ['Last step', (a) => a.lastStep ?? '—'],
  ['Verdict', (a) => a.verdict ?? '—'],
  ['Total s', (a) => a.runDurationSec],
  ['DB s', (a) => a.dbUnionSec],
  ['DB %', (a) => a.dbSharePct],
  ['Tx', (a) => a.transactions],
  ['Tx p50 ms', (a) => a.transactionP50Ms],
  ['DB ms/step', (a) => a.dbMsPerOccurrence],
  ['Tx/step', (a) => a.txPerOccurrence],
  ['Oracle s', (a) => a.oracleSec],
  ['SDK s', (a) => a.sdkSec],
]

const header = columns.map(([name]) => name)
const body = measured.map((arm) => columns.map(([, read]) => String(read(arm) ?? '—')))
const widths = header.map((name, index) =>
  Math.max(name.length, ...body.map((row) => row[index].length)),
)
const line = (cells) => '| ' + cells.map((cell, i) => cell.padEnd(widths[i])).join(' | ') + ' |'
console.log(line(header))
console.log('|' + widths.map((w) => '-'.repeat(w + 2)).join('|') + '|')
for (const row of body) console.log(line(row))

console.log()
console.log(comparable ? 'SAME_SCOPE: totals are comparable.' : 'NOT_COMPARABLE totals: arms differ in step scope; use the per-step columns.')

const ratios = []
for (let i = 1; i < measured.length; i += 1) {
  const before = measured[i - 1]
  const after = measured[i]
  ratios.push({
    comparison: `${before.label} → ${after.label}`,
    sameScope: before.occurrences === after.occurrences && before.lastStep === after.lastStep,
    transactionCostRatio: after.transactionP50Ms ? round(before.transactionP50Ms / after.transactionP50Ms) : null,
    transactionsPerStepRatio: after.txPerOccurrence ? round(before.txPerOccurrence / after.txPerOccurrence) : null,
    dbPerStepRatio: after.dbMsPerOccurrence ? round(before.dbMsPerOccurrence / after.dbMsPerOccurrence) : null,
    totalRatio: after.runDurationSec ? round(before.runDurationSec / after.runDurationSec) : null,
  })
}
const shared = commonPrefix(measured)
console.log()
console.log('Common steps every arm executed:')
console.log(JSON.stringify(shared, null, 2))

const sharedRatios = []
for (let i = 1; i < shared.length; i += 1) {
  const before = shared[i - 1]
  const after = shared[i]
  sharedRatios.push({
    comparison: `${before.label} → ${after.label}`,
    sharedSteps: after.sharedSteps,
    dbTimeRatio: after.dbSec ? round(before.dbSec / after.dbSec) : null,
    transactionCostRatio: after.transactionP50Ms ? round(before.transactionP50Ms / after.transactionP50Ms) : null,
  })
}

console.log()
console.log(JSON.stringify(
  { arms: measured.map(({ steps, stepIds, ...rest }) => rest), ratios, shared, sharedRatios, sameScope: comparable },
  null,
  2,
))
