/**
 * ===========================================================================
 *  RUN LIVE WATCHER — the safety net under the live hub.
 *
 *  ## Why a poller exists next to direct publishing
 *
 *  The producers that publish into [RunLiveHub] cover the paths this process
 *  drives itself. They cannot cover everything: a row written by the recovery
 *  worker, the oracle worker's own revision loop, a fanout consumer, or any
 *  future writer nobody remembered to instrument would be durable and
 *  invisible. The read model is the one place where "what actually happened" is
 *  complete, so a subscriber watching a run also gets a diff of it.
 *
 *  Duplicates are impossible rather than tolerated: every row diffed here is
 *  keyed by its durable identity through [runLiveKeys], and the hub refuses a
 *  key it has already announced — no matter which of the two paths saw it first.
 *
 *  ## Why it only runs while somebody is watching
 *
 *  Polling a run nobody has open is pure cost. The watcher is ref-counted by
 *  the socket layer's room membership, so an idle API polls nothing at all, and
 *  a run that reaches a terminal lifecycle stops being polled even while its
 *  page stays open.
 * ===========================================================================
 */

import { getEvidenceJourney, getRunDetail } from './verdict-runtime-read-model.js'
import {
  getRunLiveHub,
  runLiveKeys,
  runLiveLevelFor as outcomeLevel,
  type RunLiveEventKind,
  type RunLiveEventLevel,
} from './run-live-hub.js'

const POLL_INTERVAL_MS = 1_500
/** How long to keep diffing after the run reports a terminal lifecycle. */
const TERMINAL_GRACE_MS = 4_000

type Row = Record<string, unknown>

interface WatchState {
  timer: NodeJS.Timeout
  terminalSinceMs: number | null
  polling: boolean
  /** The first pass records history without announcing it. */
  seeded: boolean
}

const watched = new Map<string, WatchState>()

/** Idempotent: the socket layer calls this per subscriber, not per run. */
export function startRunLiveWatcher(runId: string): void {
  const key = runId.trim()
  if (key === '' || watched.has(key)) return

  const state: WatchState = {
    timer: setInterval(() => {
      void pollOnce(key)
    }, POLL_INTERVAL_MS),
    terminalSinceMs: null,
    polling: false,
    seeded: false,
  }
  // `unref` so a watcher can never hold the process open on shutdown.
  state.timer.unref?.()
  watched.set(key, state)
  void pollOnce(key)
}

export function stopRunLiveWatcher(runId: string): void {
  const key = runId.trim()
  const state = watched.get(key)
  if (state === undefined) return
  clearInterval(state.timer)
  watched.delete(key)
}

export function runLiveWatcherCount(): number {
  return watched.size
}

async function pollOnce(runId: string): Promise<void> {
  const state = watched.get(runId)
  if (state === undefined) return
  // A slow database must not stack polls on top of each other.
  if (state.polling) return
  state.polling = true

  try {
    const detail = await getRunDetail(runId)
    if (detail === null) return

    // The seeding pass claims every identity the run already has, so opening a
    // finished run does not replay its whole history as if it were live. It runs
    // even for a live run: rows written before the page opened are history too,
    // and the page loaded them with its initial snapshot.
    const announcing = state.seeded
    state.seeded = true

    const run = asRow(detail.run)
    const runtime = asRow(detail.runtime)
    const status = pick(run, 'status')
    const lifecycle = pick(runtime, 'lifecycle')
    const productVerdict = pick(runtime, 'productVerdict')
    const terminationReason = pick(runtime, 'terminationReason')

    if (status !== '') {
      emit(announcing, runId, {
        key: runLiveKeys.runStatus(status),
        kind: 'RUN_STATUS',
        level: outcomeLevel(status),
        title: `Run ${status}`,
        detail: { status },
      })
    }
    if (lifecycle !== '') {
      emit(announcing, runId, {
        key: runLiveKeys.runtime(lifecycle, productVerdict, terminationReason),
        kind: lifecycle.toUpperCase() === 'CLOSED' ? 'RUN_RESULT' : 'RUN_STATUS',
        level: statusLevel(status, productVerdict),
        title: `Run ${lifecycle}${productVerdict === '' ? '' : ` · ${productVerdict}`}`,
        detail: {
          lifecycle,
          productVerdict,
          terminationReason,
          operationalDisposition: pick(runtime, 'operationalDisposition'),
          failureDetail: pick(runtime, 'failureDetail'),
        },
      })
    }

    announce(announcing, runId, detail.steps, (row) => {
      const occurrenceId = pick(row, 'occurrenceId', 'occurrence_id')
      const planStepId = pick(row, 'planStepId', 'plan_step_id')
      const stepLifecycle = pick(row, 'lifecycle')
      const actionResult = pick(row, 'actionResult', 'action_result')
      return {
        key: runLiveKeys.step(occurrenceId, stepLifecycle, actionResult),
        kind: 'STEP',
        level: stepLifecycle === 'COMPLETED' ? outcomeLevel(actionResult) : 'INFO',
        title: `${planStepId || occurrenceId} ${stepLifecycle}${actionResult === '' ? '' : ` · ${actionResult}`}`,
        detail: {
          occurrenceId,
          planStepId,
          lifecycle: stepLifecycle,
          actionResult,
          continueGateResult: pick(row, 'continueGateResult', 'continue_gate_result'),
          finalOracleResult: pick(row, 'finalOracleResult', 'final_oracle_result'),
          iterationKey: pick(row, 'iterationKey', 'iteration_key'),
        },
      }
    })

    announce(announcing, runId, detail.actionTransitions, (row) => {
      const occurrenceId = pick(row, 'occurrenceId', 'occurrence_id')
      const requestId = pick(row, 'requestId', 'request_id')
      const phase = pick(row, 'phase')
      const terminal = pick(row, 'terminal')
      return {
        key: runLiveKeys.action(occurrenceId, requestId, phase),
        kind: 'ACTION',
        level: outcomeLevel(terminal),
        title: `${occurrenceId} · ${phase}`,
        detail: {
          occurrenceId,
          requestId,
          phase,
          terminal,
          evidenceRef: pick(row, 'evidenceRef', 'evidence_ref'),
        },
      }
    })

    announce(announcing, runId, detail.waits, (row) => {
      const occurrenceId = pick(row, 'occurrenceId', 'occurrence_id')
      const waitPlanId = pick(row, 'waitPlanId', 'wait_plan_id')
      const waitStatus = pick(row, 'status')
      return {
        key: runLiveKeys.wait(occurrenceId, waitPlanId, waitStatus),
        kind: 'WAIT',
        level: outcomeLevel(waitStatus),
        title: `wait ${waitPlanId || occurrenceId} → ${waitStatus}`,
        detail: {
          occurrenceId,
          waitPlanId,
          status: waitStatus,
          resultKey: pick(row, 'resultKey', 'result_key'),
          cancelStatus: pick(row, 'cancelStatus', 'cancel_status'),
        },
      }
    })

    announce(announcing, runId, detail.oracleEvaluations, (row) => {
      const occurrenceId = pick(row, 'occurrenceId', 'occurrence_id')
      const evaluatorKind = pick(row, 'evaluatorKind', 'evaluator_kind')
      const revision = pick(row, 'revision')
      const outcome = pick(row, 'outcome')
      return {
        key: runLiveKeys.oracle(occurrenceId, evaluatorKind, revision),
        kind: 'ORACLE',
        level: outcomeLevel(outcome),
        title: `${evaluatorKind} rev${revision} → ${outcome}`,
        detail: {
          occurrenceId,
          evaluatorKind,
          revision,
          outcome,
          productVerdict: pick(row, 'productVerdict', 'product_verdict'),
          evaluationFailureClass: pick(row, 'evaluationFailureClass', 'evaluation_failure_class'),
        },
      }
    })

    announce(announcing, runId, detail.remoteActions, (row) => {
      const operationRef = pick(row, 'operationRef', 'operation_ref')
      const attempt = pick(row, 'attempt')
      const remoteStatus = pick(row, 'status')
      return {
        key: runLiveKeys.remoteAction(operationRef, attempt, remoteStatus),
        kind: 'ACTION',
        level: outcomeLevel(remoteStatus),
        title: `remote ${operationRef} → ${remoteStatus}`,
        detail: {
          operationRef,
          attempt,
          status: remoteStatus,
          resultCode: pick(row, 'resultCode', 'result_code'),
        },
      }
    })

    // Evidence is the reason a gate passed or timed out, so a live view without
    // it can show a wait failing and never show what the oracle could see.
    const journey = await getEvidenceJourney(runId)
    announce(announcing, runId, journey.items, (row) => {
      const occurrenceId = pick(row, 'occurrenceId', 'occurrence_id')
      const factKey = pick(row, 'factKey', 'fact_key')
      const revision = pick(row, 'revision')
      return {
        key: runLiveKeys.evidence(occurrenceId, factKey, revision),
        kind: 'EVIDENCE',
        level: 'INFO',
        title: `${factKey} = ${valueText(row.value)}`,
        detail: {
          occurrenceId,
          factKey,
          revision,
          plane: pick(row, 'plane'),
          deliveryLane: pick(row, 'deliveryLane', 'delivery_lane'),
          authority: pick(row, 'authority'),
          journeyState: pick(row, 'journeyState', 'journey_state'),
          value: row.value,
        },
      }
    })

    // A closed run writes nothing more, so keep diffing only long enough for the
    // last rows of the closing transaction to become visible.
    if (isTerminalLifecycle(lifecycle) || isTerminalStatus(status)) {
      state.terminalSinceMs ??= Date.now()
      if (Date.now() - state.terminalSinceMs > TERMINAL_GRACE_MS) stopRunLiveWatcher(runId)
    } else {
      state.terminalSinceMs = null
    }
  } catch {
    // A read model that is briefly unavailable must not kill the watcher: the
    // next tick is the retry, and the socket status already tells the operator
    // whether the stream itself is up.
  } finally {
    const current = watched.get(runId)
    if (current !== undefined) current.polling = false
  }
}

interface Announcement {
  key: string
  kind: RunLiveEventKind
  level: RunLiveEventLevel
  title: string
  detail: Record<string, unknown>
}

function announce(
  announcing: boolean,
  runId: string,
  rows: readonly Record<string, unknown>[],
  describe: (row: Row) => Announcement,
): void {
  for (const raw of rows) emit(announcing, runId, describe(asRow(raw)))
}

function emit(announcing: boolean, runId: string, announcement: Announcement): void {
  const hub = getRunLiveHub()
  if (!announcing) {
    hub.claimKey(runId, announcement.key)
    return
  }
  hub.publish({
    runId,
    kind: announcement.kind,
    level: announcement.level,
    title: announcement.title,
    detail: announcement.detail,
    dedupeKey: announcement.key,
  })
}

function statusLevel(status: string, productVerdict: string): RunLiveEventLevel {
  const verdict = outcomeLevel(productVerdict)
  return verdict === 'INFO' ? outcomeLevel(status) : verdict
}

function isTerminalLifecycle(lifecycle: string): boolean {
  return lifecycle.toUpperCase() === 'CLOSED'
}

function isTerminalStatus(status: string): boolean {
  return ['completed', 'failed', 'blocked', 'cancelled'].includes(status.trim().toLowerCase())
}

function asRow(value: unknown): Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Row)
    : {}
}

function pick(row: Row, ...keys: string[]): string {
  for (const key of keys) {
    const rendered = text(row[key])
    if (rendered !== '') return rendered
  }
  return ''
}

function text(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value)
  }
  if (value instanceof Date) return value.toISOString()
  return ''
}

function valueText(value: unknown): string {
  if (value === undefined || value === null) return 'null'
  if (typeof value === 'object') {
    const json = JSON.stringify(value)
    return json.length > 120 ? `${json.slice(0, 117)}…` : json
  }
  return String(value)
}
