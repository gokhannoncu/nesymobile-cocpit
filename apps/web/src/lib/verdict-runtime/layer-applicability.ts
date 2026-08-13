import type { RunDetailResult } from './types'

export type LayerName = 'UI' | 'App' | 'Local' | 'Remote'
export type LayerState = 'PASS' | 'FAIL' | 'NOT_APPLICABLE' | 'NOT_MEASURED' | 'REQUIRED_PENDING'

export interface LayerApplicability {
  layer: LayerName
  state: LayerState
  reason?: string
  revision?: number
}

export const LAYER_ARCHITECTURE: Record<
  LayerName,
  { short: string; role: string; accent: 'emerald' | 'blue' | 'amber' | 'purple' }
> = {
  UI: { short: 'UI', role: 'Bridge', accent: 'emerald' },
  App: { short: 'APP', role: 'SDK', accent: 'blue' },
  Local: { short: 'LOCAL', role: 'Local DB', accent: 'amber' },
  Remote: { short: 'REMOTE', role: 'Backend', accent: 'purple' },
}

const PLANES: LayerName[] = ['UI', 'App', 'Local', 'Remote']

const STATE_PRIORITY: Record<LayerState, number> = {
  FAIL: 5,
  REQUIRED_PENDING: 4,
  PASS: 3,
  NOT_APPLICABLE: 2,
  NOT_MEASURED: 1,
}

function emptyLayers(reason = 'No persisted evaluation for this plane'): LayerApplicability[] {
  return PLANES.map((layer) => ({ layer, state: 'NOT_MEASURED' as const, reason }))
}

function mapPlane(raw: unknown): LayerName | null {
  if (typeof raw !== 'string') return null
  const key = raw.trim().toUpperCase()
  if (key === 'UI' || key === 'UI_PLANE') return 'UI'
  if (key === 'APP' || key === 'APP_PLANE') return 'App'
  if (key === 'LOCAL' || key === 'LOCAL_PLANE') return 'Local'
  if (key === 'REMOTE' || key === 'REMOTE_PLANE') return 'Remote'
  return null
}

export function planeFromFactKey(factKey: string): LayerName | null {
  const normalized = factKey.trim()
  const upper = normalized.toUpperCase()
  if (upper.startsWith('UI.')) return 'UI'
  if (upper.startsWith('APP.')) return 'App'
  if (upper.startsWith('LOCAL.')) return 'Local'
  if (upper.startsWith('REMOTE.')) return 'Remote'
  const lower = normalized.toLowerCase()
  if (lower.startsWith('ui.')) return 'UI'
  if (lower.startsWith('app.')) return 'App'
  if (lower.startsWith('local.')) return 'Local'
  if (lower.startsWith('remote.')) return 'Remote'
  return null
}

function outcomeToState(raw: unknown): LayerState | null {
  if (typeof raw !== 'string') return null
  const key = raw.trim().toUpperCase()
  if (key === 'PASS' || key === 'PASSED' || key === 'SATISFIED') return 'PASS'
  if (
    key === 'FAIL' ||
    key === 'FAILED' ||
    key === 'VIOLATED' ||
    key === 'EVIDENCE_CONFLICT' ||
    key === 'STALE' ||
    key === 'WRONG_OCCURRENCE'
  ) {
    return 'FAIL'
  }
  if (key === 'NOT_APPLICABLE' || key === 'N_A' || key === 'NA') return 'NOT_APPLICABLE'
  if (key === 'NOT_MEASURED') return 'NOT_MEASURED'
  if (
    key === 'REQUIRED_PENDING' ||
    key === 'PENDING' ||
    key === 'REQUIRED_TIMEOUT' ||
    key === 'WARNING_TIMEOUT'
  ) {
    return 'REQUIRED_PENDING'
  }
  return null
}

function mergeLayerState(current: LayerState, next: LayerState): LayerState {
  return STATE_PRIORITY[next] > STATE_PRIORITY[current] ? next : current
}

function pickText(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

/** `at_ms` is a Postgres BigInt, so it can arrive as a number or a string. */
function numberOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function revisionOf(evaluation: Record<string, unknown>): number {
  const revision = evaluation.revision
  if (typeof revision === 'number' && Number.isFinite(revision)) return revision
  if (typeof revision === 'string') {
    const parsed = Number(revision)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function requirementEntries(requirements: unknown): Array<[string, Record<string, unknown>]> {
  if (Array.isArray(requirements)) {
    return requirements.flatMap((entry, index) => {
      if (!entry || typeof entry !== 'object') return []
      const row = entry as Record<string, unknown>
      const factKey = pickText(row.factKey, row.fact_key) ?? `req-${index}`
      return [[factKey, row] as const]
    })
  }
  if (!requirements || typeof requirements !== 'object') return []
  return Object.entries(requirements as Record<string, unknown>).flatMap(([key, value]) => {
    if (key === '__worker') return []
    if (!value || typeof value !== 'object') return []
    const row = value as Record<string, unknown>
    const factKey = pickText(row.factKey, row.fact_key, key) ?? key
    return [[factKey, row] as const]
  })
}

function applyEvaluationToLayers(
  byLayer: Map<LayerName, LayerApplicability>,
  evaluation: Record<string, unknown>,
): void {
  const revision = revisionOf(evaluation)

  for (const [factKey, row] of requirementEntries(evaluation.requirements)) {
    const layer =
      mapPlane(row.plane) ??
      mapPlane(row.layer) ??
      mapPlane(row.evidencePlane) ??
      planeFromFactKey(factKey)
    if (!layer) continue

    const state =
      outcomeToState(row.state) ??
      outcomeToState(row.outcome) ??
      outcomeToState(row.status)
    if (!state) continue

    const prev = byLayer.get(layer)!
    const prevRev = prev.revision ?? -1
    if (revision < prevRev) continue

    const mergedState = revision === prevRev ? mergeLayerState(prev.state, state) : state
    byLayer.set(layer, {
      layer,
      state: mergedState,
      revision,
      reason:
        typeof row.reason === 'string'
          ? row.reason
          : typeof evaluation.reason === 'string'
            ? evaluation.reason
            : prev.reason,
    })
  }

  const evalPlane = mapPlane(evaluation.plane) ?? mapPlane(evaluation.layer)
  const evalState =
    outcomeToState(evaluation.outcome) ?? outcomeToState(evaluation.status)
  if (evalPlane && evalState) {
    const prev = byLayer.get(evalPlane)!
    const prevRev = prev.revision ?? -1
    if (revision >= prevRev) {
      byLayer.set(evalPlane, {
        layer: evalPlane,
        state: revision === prevRev ? mergeLayerState(prev.state, evalState) : evalState,
        revision,
        reason: typeof evaluation.reason === 'string' ? evaluation.reason : prev.reason,
      })
    }
  }
}

function pickLatestEvaluation(
  evaluations: readonly Record<string, unknown>[],
  occurrenceId: string,
  evaluatorKind?: 'FINAL_ORACLE' | 'CONTINUE_GATE',
): Record<string, unknown> | null {
  const matches = evaluations.filter((evaluation) => {
    const id = pickText(evaluation.occurrenceId, evaluation.occurrence_id)
    if (id !== occurrenceId) return false
    if (!evaluatorKind) return true
    const kind = pickText(evaluation.evaluatorKind, evaluation.evaluator_kind)?.toUpperCase()
    return kind === evaluatorKind
  })
  if (matches.length === 0) return null
  return matches.reduce((latest, current) =>
    revisionOf(current) >= revisionOf(latest) ? current : latest,
  )
}

/**
 * The Bridge's own verdict on a step, read from the action transition log.
 *
 * `terminal` may only be written together with the `EFFECT_VERIFIED` phase, so a
 * transition carrying one is proof that the Bridge resolved a target, dispatched
 * the gesture and then checked the effect — which is precisely what the UI plane
 * asserts. Steps that never touch the screen (SDK queries, assertions, waits)
 * write no such row and correctly yield no UI verdict here.
 */
function deriveBridgeUiPlane(
  occurrenceId: string,
  transitions: readonly Record<string, unknown>[] | undefined,
): LayerApplicability | null {
  let latest: { atMs: number; terminal: string } | null = null

  for (const row of transitions ?? []) {
    if (!row || typeof row !== 'object') continue
    const id = pickText(row.occurrenceId, row.occurrence_id)
    if (id !== occurrenceId) continue
    const phase = pickText(row.phase)?.toUpperCase()
    if (phase !== 'EFFECT_VERIFIED') continue
    const terminal = pickText(row.terminal)?.toUpperCase()
    if (!terminal) continue

    const atMs = numberOf(row.atMs ?? row.at_ms) ?? 0
    if (latest === null || atMs >= latest.atMs) latest = { atMs, terminal }
  }

  if (latest === null) return null

  // UNKNOWN_EFFECT and CANCELLED are deliberately not FAIL: the Bridge is saying
  // it could not determine whether the effect landed, and turning "we don't know"
  // into "the UI was wrong" would be inventing a verdict.
  const state: LayerState =
    latest.terminal === 'SUCCEEDED'
      ? 'PASS'
      : latest.terminal === 'FAILED'
        ? 'FAIL'
        : latest.terminal === 'SKIPPED'
          ? 'NOT_APPLICABLE'
          : 'NOT_MEASURED'

  const reason =
    latest.terminal === 'SUCCEEDED'
      ? 'Bridge resolved the target, dispatched the gesture and verified the effect'
      : latest.terminal === 'SKIPPED'
        ? 'Target was declared absent, so the Bridge had nothing to act on'
        : `Bridge reported ${latest.terminal}`

  return { layer: 'UI', state, reason }
}

/**
 * Derive four-plane ticks for one step occurrence.
 *
 * Two independent sources feed this, matching how the system actually splits
 * responsibilities: the Bridge's action transitions carry the UI plane, and the
 * oracle evaluation carries whichever planes its policy required.
 *
 * Returns `null` when neither source produced anything for the step, because
 * four empty ticks read as "we failed to measure" rather than the truth, which
 * is that this step had no per-step verdict to give.
 *
 * Planes no source mentions stay NOT_APPLICABLE rather than NOT_MEASURED: they
 * were deliberately out of scope for the step, not missed.
 */
export function deriveStepLayerApplicability(
  occurrenceId: string,
  evaluations: readonly Record<string, unknown>[] | undefined,
  actionTransitions?: readonly Record<string, unknown>[],
): LayerApplicability[] | null {
  const list = evaluations ?? []
  const finalOracle = pickLatestEvaluation(list, occurrenceId, 'FINAL_ORACLE')
  const continueGate = pickLatestEvaluation(list, occurrenceId, 'CONTINUE_GATE')
  const evaluation = finalOracle ?? continueGate
  const bridgeUi = deriveBridgeUiPlane(occurrenceId, actionTransitions)

  if (!evaluation && !bridgeUi) return null

  const byLayer = new Map<LayerName, LayerApplicability>()
  for (const layer of PLANES) {
    byLayer.set(layer, {
      layer,
      state: 'NOT_APPLICABLE',
      reason: 'Not part of this step',
    })
  }

  if (evaluation) applyEvaluationToLayers(byLayer, evaluation)

  if (bridgeUi) {
    // The oracle may also carry a UI.* requirement. Both are UI-plane evidence,
    // so the more severe of the two wins rather than the last one written.
    const current = byLayer.get('UI')!
    const merged = mergeLayerState(current.state, bridgeUi.state)
    byLayer.set('UI', {
      layer: 'UI',
      state: merged,
      ...(current.revision === undefined ? {} : { revision: current.revision }),
      reason: merged === bridgeUi.state ? bridgeUi.reason : current.reason,
    })
  }

  return PLANES.map((layer) => byLayer.get(layer)!)
}

/**
 * Derive four-plane layer badges from persisted oracle evaluations + evidence planes.
 * Does not invent PASS — empty planes stay NOT_MEASURED.
 */
export function deriveLayerApplicability(run: RunDetailResult | null | undefined): LayerApplicability[] {
  const byLayer = new Map<LayerName, LayerApplicability>()
  for (const layer of PLANES) {
    byLayer.set(layer, { layer, state: 'NOT_MEASURED', reason: 'No persisted evaluation for this plane' })
  }

  for (const evaluation of run?.oracleEvaluations ?? []) {
    if (!evaluation || typeof evaluation !== 'object') continue
    applyEvaluationToLayers(byLayer, evaluation as Record<string, unknown>)
  }

  return PLANES.map((layer) => byLayer.get(layer)!)
}

export function emptyLayerApplicability(): LayerApplicability[] {
  return emptyLayers()
}
