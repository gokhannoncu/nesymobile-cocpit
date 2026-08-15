/**
 * G90.10 BD.3 — backend timeout session.
 *
 * Holds injector provenance for one run. The adapter deadline path is the
 * effect; this object never writes `observedClass`. Classification is
 * `observeInjectedClass` after the run, from the recorded observation.
 */

import type { InjectedFaultId } from '@nesy/workflow-contract'
import {
  advanceFaultInjectionPhase,
  emptyFaultInjectionProvenance,
  isBackendTimeoutInjectionTarget,
  type ExternalActionSpec,
  type FaultInjectionProvenance,
} from '@nesy/workflow-contract'

export const BACKEND_TIMEOUT_LAB_DEADLINE_MS = 80

export interface BackendTimeoutArmTarget {
  planStepId: string
  occurrenceId: string
  spec: Pick<ExternalActionSpec, 'effectClass' | 'operationRef' | 'timeoutPolicy'>
}

export interface BackendTimeoutSession {
  snapshot(): FaultInjectionProvenance
  request(): FaultInjectionProvenance
  tryArm(target: BackendTimeoutArmTarget): boolean
  injectionForCall(operationRef: string): { timeoutMs: number } | null
  markTriggered(operationRef: string, timeoutMs: number): void
  markDeadlineObserved(): void
}

export function createBackendTimeoutSession(input: {
  injectedFault: InjectedFaultId | null
  clock?: () => number
}): BackendTimeoutSession {
  const clock = input.clock ?? Date.now
  const provenance = emptyFaultInjectionProvenance()
  const enabled = input.injectedFault === 'BACKEND_TIMEOUT'

  const setPhase = (phase: NonNullable<FaultInjectionProvenance['phase']>) => {
    provenance.phase = advanceFaultInjectionPhase(provenance.phase, phase)
  }

  return {
    snapshot() {
      return { ...provenance }
    },

    request() {
      if (!enabled) return this.snapshot()
      setPhase('REQUESTED')
      provenance.requestedAtMs = provenance.requestedAtMs ?? clock()
      return this.snapshot()
    },

    tryArm(target) {
      if (!enabled) return false
      if (!isBackendTimeoutInjectionTarget(target.spec)) return false
      setPhase('ARMED')
      provenance.armedAtMs = provenance.armedAtMs ?? clock()
      provenance.triggerPoint = `REMOTE_ACTION:${target.spec.operationRef}@${target.planStepId}`
      provenance.occurrenceId = target.occurrenceId
      provenance.declaredTimeoutMs = target.spec.timeoutPolicy.timeoutMs
      provenance.injectedTimeoutMs = BACKEND_TIMEOUT_LAB_DEADLINE_MS
      return true
    },

    injectionForCall(operationRef) {
      if (!enabled) return null
      if (provenance.phase !== 'ARMED' && provenance.phase !== 'TRIGGERED' && provenance.phase !== 'EFFECT_OBSERVED') {
        return null
      }
      if (provenance.triggerPoint !== null && !provenance.triggerPoint.includes(`:${operationRef}@`)) {
        return null
      }
      return { timeoutMs: BACKEND_TIMEOUT_LAB_DEADLINE_MS }
    },

    markTriggered(operationRef, timeoutMs) {
      if (!enabled) return
      setPhase('TRIGGERED')
      provenance.triggeredAtMs = provenance.triggeredAtMs ?? clock()
      provenance.effectKind = 'ADAPTER_DEADLINE_ABORT'
      provenance.injectedTimeoutMs = timeoutMs
      if (provenance.triggerPoint === null) {
        provenance.triggerPoint = `REMOTE_ACTION:${operationRef}`
      }
    },

    markDeadlineObserved() {
      if (!enabled) return
      if (provenance.phase !== 'TRIGGERED' && provenance.phase !== 'EFFECT_OBSERVED') return
      setPhase('EFFECT_OBSERVED')
      provenance.effectObservedAtMs = provenance.effectObservedAtMs ?? clock()
      provenance.abortKind = 'DEADLINE'
      provenance.effectKind = 'ADAPTER_DEADLINE_ABORT'
      provenance.actuallyFired = true
    },
  }
}
