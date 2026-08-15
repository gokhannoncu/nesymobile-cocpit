/**
 * G90.10 BD.2 — network disconnect session.
 *
 * Controlled host-side transport cut representing NETWORK_DISCONNECT.
 * This object never writes `observedClass`. Classification is
 * `observeInjectedClass` after the run, from the recorded observation.
 */

import type { InjectedFaultId } from '@nesy/workflow-contract'
import {
  advanceFaultInjectionPhase,
  emptyFaultInjectionProvenance,
  isNetworkDisconnectInjectionTarget,
  type ExternalActionSpec,
  type FaultInjectionProvenance,
} from '@nesy/workflow-contract'

export interface NetworkDisconnectArmTarget {
  planStepId: string
  occurrenceId: string
  spec: Pick<ExternalActionSpec, 'effectClass' | 'operationRef' | 'timeoutPolicy'>
}

export interface NetworkDisconnectSession {
  snapshot(): FaultInjectionProvenance
  request(): FaultInjectionProvenance
  tryArm(target: NetworkDisconnectArmTarget): boolean
  injectionForCall(operationRef: string): { cut: true } | null
  markTriggered(operationRef: string): void
  markTransportObserved(): void
}

export function createNetworkDisconnectSession(input: {
  injectedFault: InjectedFaultId | null
  clock?: () => number
}): NetworkDisconnectSession {
  const clock = input.clock ?? Date.now
  const provenance = emptyFaultInjectionProvenance()
  const enabled = input.injectedFault === 'NETWORK_DISCONNECT'

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
      if (!isNetworkDisconnectInjectionTarget(target.spec)) return false
      setPhase('ARMED')
      provenance.armedAtMs = provenance.armedAtMs ?? clock()
      provenance.triggerPoint = `REMOTE_ACTION:${target.spec.operationRef}@${target.planStepId}`
      provenance.occurrenceId = target.occurrenceId
      provenance.declaredTimeoutMs = target.spec.timeoutPolicy.timeoutMs
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
      return { cut: true }
    },

    markTriggered(operationRef) {
      if (!enabled) return
      setPhase('TRIGGERED')
      provenance.triggeredAtMs = provenance.triggeredAtMs ?? clock()
      provenance.effectKind = 'HOST_TRANSPORT_CUT'
      if (provenance.triggerPoint === null) {
        provenance.triggerPoint = `REMOTE_ACTION:${operationRef}`
      }
    },

    markTransportObserved() {
      if (!enabled) return
      if (provenance.phase !== 'TRIGGERED' && provenance.phase !== 'EFFECT_OBSERVED') return
      setPhase('EFFECT_OBSERVED')
      provenance.effectObservedAtMs = provenance.effectObservedAtMs ?? clock()
      provenance.abortKind = 'TRANSPORT'
      provenance.effectKind = 'HOST_TRANSPORT_CUT'
      provenance.actuallyFired = true
    },
  }
}
