import type { RunDetailResult } from './types'

export type LayerName = 'UI' | 'App' | 'Local' | 'Remote'
export type LayerState = 'PASS' | 'FAIL' | 'NOT_APPLICABLE' | 'NOT_MEASURED' | 'REQUIRED_PENDING'

export interface LayerApplicability {
  layer: LayerName
  state: LayerState
  reason?: string
  revision?: number
}

const PLANES: LayerName[] = ['UI', 'App', 'Local', 'Remote']

function mapPlane(raw: unknown): LayerName | null {
  if (typeof raw !== 'string') return null
  const key = raw.trim().toUpperCase()
  if (key === 'UI' || key === 'UI_PLANE') return 'UI'
  if (key === 'APP' || key === 'APP_PLANE') return 'App'
  if (key === 'LOCAL' || key === 'LOCAL_PLANE') return 'Local'
  if (key === 'REMOTE' || key === 'REMOTE_PLANE') return 'Remote'
  return null
}

function outcomeToState(raw: unknown): LayerState | null {
  if (typeof raw !== 'string') return null
  const key = raw.trim().toUpperCase()
  if (key === 'PASS' || key === 'PASSED' || key === 'SATISFIED') return 'PASS'
  if (key === 'FAIL' || key === 'FAILED' || key === 'VIOLATED') return 'FAIL'
  if (key === 'NOT_APPLICABLE' || key === 'N_A' || key === 'NA') return 'NOT_APPLICABLE'
  if (key === 'NOT_MEASURED') return 'NOT_MEASURED'
  if (key === 'REQUIRED_PENDING' || key === 'PENDING') return 'REQUIRED_PENDING'
  return null
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

  const evaluations = run?.oracleEvaluations ?? []
  for (const evaluation of evaluations) {
    const revision =
      typeof evaluation.revision === 'number'
        ? evaluation.revision
        : typeof evaluation.revision === 'string'
          ? Number(evaluation.revision)
          : undefined
    const requirements = evaluation.requirements
    const reqList = Array.isArray(requirements)
      ? requirements
      : requirements && typeof requirements === 'object'
        ? Object.values(requirements as Record<string, unknown>)
        : []

    for (const req of reqList) {
      if (!req || typeof req !== 'object') continue
      const row = req as Record<string, unknown>
      const layer =
        mapPlane(row.plane) ??
        mapPlane(row.layer) ??
        mapPlane(row.evidencePlane)
      if (!layer) continue
      const state =
        outcomeToState(row.state) ??
        outcomeToState(row.outcome) ??
        outcomeToState(row.status) ??
        outcomeToState(evaluation.outcome) ??
        outcomeToState(evaluation.status)
      if (!state) continue
      const prev = byLayer.get(layer)!
      const prevRev = prev.revision ?? -1
      const nextRev = Number.isFinite(revision) ? (revision as number) : prevRev
      if (nextRev >= prevRev) {
        byLayer.set(layer, {
          layer,
          state,
          revision: Number.isFinite(revision) ? (revision as number) : undefined,
          reason:
            typeof row.reason === 'string'
              ? row.reason
              : typeof evaluation.reason === 'string'
                ? evaluation.reason
                : undefined,
        })
      }
    }

    // Plane-level outcome on the evaluation itself.
    const evalPlane = mapPlane(evaluation.plane) ?? mapPlane(evaluation.layer)
    const evalState =
      outcomeToState(evaluation.outcome) ?? outcomeToState(evaluation.status)
    if (evalPlane && evalState) {
      const prev = byLayer.get(evalPlane)!
      const prevRev = prev.revision ?? -1
      const nextRev = Number.isFinite(revision) ? (revision as number) : prevRev
      if (nextRev >= prevRev) {
        byLayer.set(evalPlane, {
          layer: evalPlane,
          state: evalState,
          revision: Number.isFinite(revision) ? (revision as number) : undefined,
          reason: typeof evaluation.reason === 'string' ? evaluation.reason : prev.reason,
        })
      }
    }
  }

  // Mark planes that appear only as evidence facts (observed but not evaluated) as REQUIRED_PENDING
  // when journey/facts mention them — kept conservative: leave NOT_MEASURED unless evaluation hit.
  return PLANES.map((layer) => byLayer.get(layer)!)
}
