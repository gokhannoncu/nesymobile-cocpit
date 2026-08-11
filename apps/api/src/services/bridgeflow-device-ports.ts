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

import type {
  BridgeActionRecord,
  TargetResolutionEvidence,
  UiWaitPlan,
  WaitAnyResult,
} from '@nesy/bridge-contract'
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

/**
 * `evidenceRef` for one bridge action, carrying WHY when the device refused.
 *
 * `BridgeActionRecord.error` holds the device's own code — `stale_tree`,
 * `not_settled`, `obscured`, `not_found` — and it used to be dropped here, so a
 * `REJECTED` step persisted `bridge:tap_text:<requestId>` and nothing else. That
 * names the command and the request and answers none of the questions anyone asks
 * next. `treeGen` rides along because the most common refusal is a stale tree, and
 * the generation is what makes that diagnosable instead of merely plausible.
 */
function describeActionEvidence(record: BridgeActionRecord): string {
  const parts = [`bridge:${record.command}:${record.requestId}`]
  if (record.error !== undefined && record.error !== '') {
    parts.push(record.error)
    if (record.treeGen !== undefined) parts.push(`treeGen=${String(record.treeGen)}`)
  }
  // A contaminated action is not a product failure — somebody touched the screen —
  // so it has to be distinguishable from one, and only the record says which.
  if (record.contaminated === true) {
    parts.push(`contaminated=${record.contaminationDetection ?? 'unspecified'}`)
  }
  return parts.join(':')
}

/**
 * `evidenceRef` for one target resolution, carrying WHY it did not resolve.
 *
 * `RESOLVE_TARGET` used to persist `action_result: FAILED` and nothing else, so a
 * run report could not distinguish "the node is not on screen" (`not_found`) from
 * "two nodes match this selector" (`AMBIGUOUS`, with `matched`) from "the tree
 * moved under us" (`STALE_TREE`, with `treeGen`) — three different bugs with three
 * different fixes. The selector is included because the same target key can be
 * resolved by id or by text depending on the chain the pack declares.
 */
function describeResolutionEvidence(evidence: TargetResolutionEvidence): string {
  const { by, value } = evidence.fingerprint.selector
  const parts = [`resolve:${by}=${value}`, evidence.outcome, `strength=${evidence.strength}`]
  if (evidence.matchedCount !== undefined) parts.push(`matched=${String(evidence.matchedCount)}`)
  if (evidence.treeGen !== undefined) parts.push(`treeGen=${String(evidence.treeGen)}`)
  if (evidence.deviceError !== undefined && evidence.deviceError !== '') {
    parts.push(evidence.deviceError)
  }
  return parts.join(':')
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function resolveArgValue(
  value: unknown,
  runInputs: Readonly<Record<string, unknown>>,
  variables: VariableRuntimePort,
): unknown {
  if (typeof value !== 'string') return value
  if (value.startsWith('run.input.')) {
    const path = value.slice('run.input.'.length)
    return path.split('.').reduce<unknown>((acc, key) => {
      if (acc !== null && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[key]
      }
      return undefined
    }, runInputs)
  }
  if (value.startsWith('var.')) {
    return variables.get(value.slice('var.'.length))
  }
  return value
}

export function createBridgeRuntimePort(options: {
  manager: BridgeDeviceManager
  variables: VariableRuntimePort
  runId: string
  runInputs?: Readonly<Record<string, unknown>>
}): BridgeRuntimePort {
  const { manager, variables, runId } = options
  const runInputs = options.runInputs ?? {}

  return {
    async act(step: BridgeFlowPlanStep, context: StepExecutionContext): Promise<BridgeActionResult> {
      const action = asString(step.params['action']) ?? ''
      const rawArgs = (step.params['args'] ?? {}) as Record<string, unknown>
      const args: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(rawArgs)) {
        args[key] = resolveArgValue(value, runInputs, variables)
      }
      // Macro IR uses `valueRef: "run.input.pin"`; Bridge input_text needs `text`.
      if (args['text'] === undefined && args['valueRef'] !== undefined) {
        args['text'] = resolveArgValue(args['valueRef'], runInputs, variables)
      }

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

      return {
        terminalState,
        // Verified means: the device accepted the command, said HOW it acted, and
        // reported no manual touch inside the action.
        //
        // It used to also require a `GESTURE_COMPLETED` marker, which the manager
        // can only record from `gestureEndMonoTs` — a field protocol v1 never
        // sends. So `effectVerified` was false for EVERY tap and setText, the
        // executor turned that into `FAILED` with `evidenceInsufficient`, and no
        // BRIDGE_ACTION step could ever pass on a real device. The device had
        // done the tap and answered `ok`; the host was checking for evidence the
        // protocol does not carry.
        effectVerified:
          terminalState === 'SUCCEEDED' && record.method !== null && record.contaminated !== true,
        evidenceRef: describeActionEvidence(record),
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
  applicationId?: string
  controlExecutor?: ControlExecutor
  logger?: (message: string, detail?: unknown) => void
}): GenericStepRuntimePort {
  const { manager, variables, bundle, runId } = options
  const targets = new Map<string, TargetDefinition>(
    bundle.registries.targets.map((target) => [target.targetKey, target]),
  )
  const applicationId = options.applicationId?.trim() || bundle.registries.applications[0]?.packageIdentity
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
      const evidenceRef = describeResolutionEvidence(evidence)
      if (evidence.outcome !== 'RESOLVED_UNIQUE') {
        return { succeeded: false, actionResult: 'FAILED', evidenceRef }
      }

      return {
        succeeded: true,
        actionResult: 'SUCCEEDED',
        outputVariable,
        evidenceRef,
        output: {
          ...fingerprint,
          ...(evidence.treeGen === undefined ? {} : { capturedTreeGen: evidence.treeGen }),
        },
      }
    },
  }
}
