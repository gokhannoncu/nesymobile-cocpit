/**
 * BridgeDeviceManager → executor port adapters.
 *
 * These close the gap the queue used to paper over: its `bridge.act` returned a
 * constant `FAILED` with `evidenceRef: "bridgeflow:missing-real-bridge-port"`,
 * so no BRIDGE_ACTION step could ever succeed and no wait could ever settle on
 * anything but TIMEOUT.
 *
 * Two rules are load-bearing here:
 *
 *   1. `UNKNOWN_EFFECT` is passed through unchanged. Collapsing it into FAILED
 *      would license a retry of an action that may well have happened.
 *   2. `effectVerified` is only true when the device reported the gesture it
 *      actually performed. Transport success is not effect: a `tap_id` that
 *      returns ok without a completed gesture is exactly the case the executor
 *      must treat as evidence-insufficient.
 */

import type { UiWaitPlan, WaitAnyResult } from '@nesy/bridge-contract'
import type { BridgeFlowPlanStep } from '@nesy/bridgeflow-compiler'
import type { ControlExecutor } from '@nesy/control-contract'
import { createControlExecutor } from '@nesy/control-channels/node'
import type {
  BridgeActionResult,
  BridgeRuntimePort,
  GenericStepResult,
  GenericStepRuntimePort,
  StepExecutionContext,
  VariableRuntimePort,
} from '@nesy/bridgeflow-executor'
import type { TargetDefinition, DomainPackBundle } from '@nesy/domain-pack-contracts'
import type { BridgeDeviceManager } from './bridge-device-manager.js'
import { buildTargetFingerprint, isTargetFingerprint } from './bridgeflow-target-fingerprint.js'

const NO_TARGET = 'bridgeflow:bridge-action-without-resolved-target'

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

export function createBridgeRuntimePort(options: {
  manager: BridgeDeviceManager
  variables: VariableRuntimePort
  runId: string
}): BridgeRuntimePort {
  const { manager, variables, runId } = options

  return {
    async act(step: BridgeFlowPlanStep, context: StepExecutionContext): Promise<BridgeActionResult> {
      const action = asString(step.params['action']) ?? ''
      const args = (step.params['args'] ?? {}) as Record<string, unknown>

      if (action === 'back') {
        const envelope = await manager.back({ runId })
        return {
          terminalState: envelope.ok ? 'SUCCEEDED' : 'FAILED',
          // `back` addresses no node, so there is no post-action node evidence
          // to verify against; the step's continue gate is what confirms it.
          effectVerified: envelope.ok,
          evidenceRef: `bridge:back:${context.requestId}`,
        }
      }

      if (action === 'swipe') {
        const envelope = await manager.swipe(
          { x: Number(args['fromX'] ?? 0), y: Number(args['fromY'] ?? 0) },
          { x: Number(args['toX'] ?? 0), y: Number(args['toY'] ?? 0) },
          { runId, ...(args['durationMs'] === undefined ? {} : { durationMs: Number(args['durationMs']) }) },
        )
        return {
          terminalState: envelope.ok ? 'SUCCEEDED' : 'FAILED',
          effectVerified: envelope.ok,
          evidenceRef: `bridge:swipe:${context.requestId}`,
        }
      }

      const targetVariable = asString(step.params['targetVariable'])
      const fingerprint = targetVariable === undefined ? undefined : variables.get(targetVariable)
      if (!isTargetFingerprint(fingerprint)) {
        // The compiler already rejects a BRIDGE_ACTION whose target variable has
        // no prior RESOLVE_TARGET, so reaching here means the resolve step did
        // not produce one at runtime. Acting on a guess is the wrong-row bug.
        return { terminalState: 'FAILED', effectVerified: false, evidenceRef: NO_TARGET }
      }

      const byId = fingerprint.selector.by === 'id'
      const command =
        action === 'setText' || action === 'input_text'
          ? 'input_text'
          : action === 'activate'
            ? 'activate_id'
            : byId
              ? 'tap_id'
              : 'tap_text'

      const record = await manager.act(command, fingerprint, {
        runId,
        timeoutMs: step.timeoutMs,
        ...(command === 'input_text' ? { text: String(args['text'] ?? '') } : {}),
      })

      const terminalState = record.terminalState ?? 'FAILED'
      const gestureCompleted = record.markers.some((marker) => marker.phase === 'GESTURE_COMPLETED')

      return {
        terminalState,
        effectVerified: terminalState === 'SUCCEEDED' && gestureCompleted && record.method !== null,
        evidenceRef: `bridge:${record.command}:${record.requestId}`,
      }
    },

    async waitAny(plan: UiWaitPlan, context: StepExecutionContext): Promise<WaitAnyResult> {
      // The port carries no abort signal; cancellation arrives through
      // `cancelWait`, which the executor calls on the same wait id.
      return manager.waitAny(waitIdFor(context), plan)
    },

    async cancelWait(context: StepExecutionContext): Promise<unknown> {
      return manager.cancelWait(waitIdFor(context), 'executor cancelled the wait')
    },

    async cancelAction(requestId: string): Promise<unknown> {
      // Bridge v1 has no `cancel_request`; the host can only stop waiting on it.
      // Reporting a cancel the device never received would be a false record.
      return { status: 'HOST_ONLY', requestId }
    },
  }
}

function waitIdFor(context: StepExecutionContext): string {
  return `${context.occurrenceId}:${context.iterationKey}`
}

/**
 * Generic (non-Bridge, non-remote) step runtime.
 *
 * RESOLVE_TARGET is the one kind this process can honour end to end: the pack's
 * target registry plus a live device read produce the fingerprint every later
 * BRIDGE_ACTION depends on. Kinds with no host implementation fail loudly
 * instead of returning a success the run did not earn.
 */
export function createGenericStepRuntime(options: {
  manager: BridgeDeviceManager
  variables: VariableRuntimePort
  bundle: DomainPackBundle
  runId: string
  controlExecutor?: ControlExecutor
  logger?: (message: string, detail?: unknown) => void
}): GenericStepRuntimePort {
  const { manager, variables, bundle, runId } = options
  const targets = new Map<string, TargetDefinition>(
    bundle.registries.targets.map((target) => [target.targetKey, target]),
  )
  const applicationId = bundle.registries.applications[0]?.packageIdentity
  const controlExecutor = options.controlExecutor ?? (
    applicationId === undefined ? undefined : createControlExecutor({ applicationId })
  )

  return {
    async execute(step: BridgeFlowPlanStep, context: StepExecutionContext): Promise<GenericStepResult> {
      if (step.kind === 'SDK_QUERY') {
        if (controlExecutor === undefined) {
          options.logger?.('[BridgeFlowGenericSteps] no SDK control executor for SDK_QUERY', {
            planStepId: step.planStepId,
          })
          return { succeeded: false, actionResult: 'FAILED' }
        }
        const queryRef = asString(step.params['queryRef'])
        const outputVariable = asString(step.params['outputVariable'])
        const maxRows = Number(step.params['maxRows'] ?? 100)
        if (queryRef === undefined || outputVariable === undefined || !Number.isSafeInteger(maxRows) || maxRows < 1) {
          return { succeeded: false, actionResult: 'FAILED' }
        }

        const result = await controlExecutor.run(manager.deviceId, {
          op: 'sql_named',
          requestId: context.requestId,
          scope: runId,
          name: queryRef,
          maxRows,
        })
        if (!result.ok) {
          options.logger?.('[BridgeFlowGenericSteps] SDK_QUERY failed', {
            planStepId: step.planStepId,
            queryRef,
            code: result.code,
          })
          return { succeeded: false, actionResult: 'FAILED' }
        }
        const rows = Array.isArray(result.data.rows) ? result.data.rows.slice(0, maxRows) : []
        variables.set(outputVariable, rows)
        return {
          succeeded: true,
          actionResult: 'SUCCEEDED',
          outputVariable,
          output: rows,
        }
      }

      if (step.kind !== 'RESOLVE_TARGET') {
        options.logger?.('[BridgeFlowGenericSteps] no host runtime for step kind', {
          kind: step.kind,
          planStepId: step.planStepId,
        })
        return { succeeded: false, actionResult: 'FAILED' }
      }

      const targetRef = asString(step.params['targetRef'])
      const outputVariable = asString(step.params['outputVariable'])
      const target = targetRef === undefined ? undefined : targets.get(targetRef)
      if (target === undefined || outputVariable === undefined) {
        return { succeeded: false, actionResult: 'FAILED' }
      }

      const fingerprint = buildTargetFingerprint(target)
      if (fingerprint === undefined) {
        // The chain declares no strategy this host can turn into a selector.
        return { succeeded: false, actionResult: 'FAILED' }
      }

      const evidence = await manager.resolve(fingerprint, { runId })
      if (evidence.outcome !== 'RESOLVED_UNIQUE') {
        return { succeeded: false, actionResult: 'FAILED' }
      }

      return {
        succeeded: true,
        actionResult: 'SUCCEEDED',
        outputVariable,
        output: {
          ...fingerprint,
          ...(evidence.treeGen === undefined ? {} : { capturedTreeGen: evidence.treeGen }),
        },
      }
    },
  }
}
