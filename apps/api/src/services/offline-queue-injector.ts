/**
 * G90.10 BD.6 — offline queue session.
 *
 * Controlled device WAN cut representing OFFLINE_QUEUE. This object never
 * writes `observedClass`. Classification is `observeInjectedClass` after the
 * run, from the recorded LOCAL queue observation and product verdict.
 *
 * A cut without a LOCAL queue write stays TRIGGERED and does not become
 * EFFECT_OBSERVED. That is the anti-cheat: network-down is not OFFLINE_QUEUED.
 */

import type { InjectedFaultId } from '@nesy/workflow-contract'
import {
  advanceFaultInjectionPhase,
  emptyFaultInjectionProvenance,
  isOfflineQueueInjectionTarget,
  type FaultInjectionProvenance,
} from '@nesy/workflow-contract'

import type { DeviceWanCutter } from './device-wan-cutter.js'
import { isFaultInjectionAllowedEnvironment } from './fault-injection-environment.js'

export interface OfflineQueueArmTarget {
  planStepId: string
  occurrenceId: string
}

export interface OfflineQueueSession {
  snapshot(): FaultInjectionProvenance
  request(): FaultInjectionProvenance
  tryArm(target: OfflineQueueArmTarget): boolean
  applyCut(): Promise<boolean>
  markTriggered(): void
  markQueueObserved(present: boolean): void
  restore(): Promise<void>
}

export function createOfflineQueueSession(input: {
  injectedFault: InjectedFaultId | null
  clock?: () => number
  wan?: DeviceWanCutter
}): OfflineQueueSession {
  const clock = input.clock ?? Date.now
  const provenance = emptyFaultInjectionProvenance()
  const enabled = input.injectedFault === 'OFFLINE_QUEUE' && isFaultInjectionAllowedEnvironment()
  let armed: { planStepId: string } | null = null
  let cutApplied = false

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
      if (armed !== null) return armed.planStepId === target.planStepId
      if (!isOfflineQueueInjectionTarget(target)) return false
      setPhase('ARMED')
      armed = { planStepId: target.planStepId }
      provenance.armedAtMs = provenance.armedAtMs ?? clock()
      provenance.triggerPoint = `LOCAL_QUEUE:${target.planStepId}`
      provenance.occurrenceId = target.occurrenceId
      provenance.effectKind = 'LOCAL_QUEUE_PERSIST'
      provenance.abortKind = 'NONE'
      return true
    },

    async applyCut() {
      if (!enabled) return false
      if (provenance.phase !== 'ARMED' && provenance.phase !== 'TRIGGERED' && provenance.phase !== 'EFFECT_OBSERVED') {
        return false
      }
      if (input.wan === undefined) return false
      if (!cutApplied) {
        await input.wan.cut()
        cutApplied = true
      }
      this.markTriggered()
      return true
    },

    markTriggered() {
      if (!enabled) return
      setPhase('TRIGGERED')
      provenance.triggeredAtMs = provenance.triggeredAtMs ?? clock()
      provenance.effectKind = 'LOCAL_QUEUE_PERSIST'
      provenance.abortKind = 'NONE'
    },

    markQueueObserved(present) {
      if (!enabled) return
      if (provenance.phase !== 'TRIGGERED' && provenance.phase !== 'EFFECT_OBSERVED') return
      if (!present) return
      setPhase('EFFECT_OBSERVED')
      provenance.effectObservedAtMs = provenance.effectObservedAtMs ?? clock()
      provenance.effectKind = 'LOCAL_QUEUE_PERSIST'
      provenance.abortKind = 'NONE'
      provenance.actuallyFired = true
    },

    async restore() {
      if (!cutApplied || input.wan === undefined) return
      await input.wan.restore()
      cutApplied = false
    },
  }
}
