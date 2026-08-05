import {
  EVIDENCE_JOURNEY_STAGES,
  type EvidenceJourneyEntry,
  type EvidenceJourneyStage,
  type EvidenceJourneyState,
} from '@nesy/execution-contract'

export type ExplicitStageOutcome = Exclude<EvidenceJourneyState, 'PENDING' | 'UNKNOWN'>

export interface ExplicitStageObservation {
  outcome: ExplicitStageOutcome
  reason?: string
}

export interface EvidenceJourneyObservation {
  factKey: string
  occurrenceId: string
  emitOutcome?: 'POSITIVE' | 'NEGATIVE'
  stages: Partial<Record<EvidenceJourneyStage, ExplicitStageObservation>>
  authority?: EvidenceJourneyEntry['authority']
  confidence?: number
}

export function classifyEvidenceJourney(
  observation: EvidenceJourneyObservation,
): readonly EvidenceJourneyEntry[] {
  let blockedBy: EvidenceJourneyStage | undefined

  return EVIDENCE_JOURNEY_STAGES.map((stage) => {
    let state: EvidenceJourneyState
    let reason: string | undefined

    if (blockedBy !== undefined) {
      state = 'BLOCKED'
      reason = `blocked by ${blockedBy}`
    } else if (stage === 'EMIT') {
      state =
        observation.emitOutcome === 'POSITIVE'
          ? 'OBSERVED'
          : observation.emitOutcome === 'NEGATIVE'
            ? 'NOT_OBSERVED'
            : 'UNKNOWN'
      reason =
        observation.emitOutcome === 'POSITIVE'
          ? 'explicit SDK emit diagnostic was positive'
          : observation.emitOutcome === 'NEGATIVE'
            ? 'explicit SDK emit diagnostic was negative'
            : 'no explicit SDK emit diagnostic'
    } else {
      const explicit = observation.stages[stage]
      state = explicit?.outcome ?? 'PENDING'
      reason = explicit?.reason
    }

    if (state === 'BLOCKED' && blockedBy === undefined) blockedBy = stage
    return {
      factKey: observation.factKey,
      occurrenceId: observation.occurrenceId,
      stage,
      state,
      ...(reason === undefined ? {} : { reason }),
      ...(observation.authority === undefined ? {} : { authority: observation.authority }),
      ...(observation.confidence === undefined ? {} : { confidence: observation.confidence }),
    }
  })
}
