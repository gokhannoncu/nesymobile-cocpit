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
import type { SdkObservationStore } from './sdk-observation-store.js'
import { buildTargetFingerprint, isTargetFingerprint } from './bridgeflow-target-fingerprint.js'
import { dig } from './condition-engine.js'

const NO_TARGET = 'bridgeflow:bridge-action-without-resolved-target'

/** Gap between resolution attempts while a target's own deadline still runs. */
const TARGET_RESOLVE_POLL_MS = 250

/**
 * Device rows arrive as strings — the named-query projection is a
 * `Map<String, String?>` on the Android side. `"true"`/`"false"` are the only
 * things treated as a proven boolean; anything else, including a missing column
 * and a null, is UNKNOWN rather than false. Reading an absent column as `false`
 * would turn "we could not observe" into "we observed a negative", which is the
 * one conversion an oracle must never make on its own.
 */
/** A blank column is no identity at all, and must not read as one. */
function asOptionalString(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  return trimmed === '' ? undefined : trimmed
}

function asFactValue(raw: unknown): boolean | 'UNKNOWN' {
  if (typeof raw === 'boolean') return raw
  if (raw === 'true') return true
  if (raw === 'false') return false
  return 'UNKNOWN'
}

function asColumnNotInValue(raw: unknown, values: readonly string[]): boolean | 'UNKNOWN' {
  if (raw === undefined || raw === null) return 'UNKNOWN'
  return !values.includes(String(raw))
}

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

/**
 * A target the pack declared absent-tolerant, resolved and found absent.
 *
 * Written by the RESOLVE_TARGET runtime and read by `act`. It is a distinct
 * SHAPE rather than a missing variable on purpose: "the pack says this may not
 * be here" and "the resolve step never ran" must not look alike, or a broken
 * plan would silently behave like an optional one.
 */
interface AbsentTarget {
  absentTarget: true
  targetRef: string
}

function isAbsentTarget(value: unknown): value is AbsentTarget {
  return (
    value !== null &&
    typeof value === 'object' &&
    (value as Partial<AbsentTarget>).absentTarget === true &&
    typeof (value as Partial<AbsentTarget>).targetRef === 'string'
  )
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
    const [name, ...path] = value.slice('var.'.length).split('.')
    if (name === undefined || name === '') return undefined
    const base = variables.get(name)
    if (path.length === 0) return base
    // Same plucking rule the condition language uses, from the same
    // implementation — two copies of "what does a path mean over rows" would
    // drift, and a macro would read differently in a condition than in an arg.
    const dug = dig(base, path)
    // A scalar argument needs exactly ONE value. Plucking a column from a row
    // set yields an array, and taking `[0]` would be a guess about WHICH record
    // the run meant — precisely the wrong-row bug this codebase refuses
    // elsewhere. One row answers; several mean the query was not narrow enough.
    if (Array.isArray(dug)) return dug.length === 1 ? dug[0] : undefined
    return dug
  }
  return value
}

export function createBridgeRuntimePort(options: {
  manager: BridgeDeviceManager
  variables: VariableRuntimePort
  runId: string
  runInputs?: Readonly<Record<string, unknown>>
  /**
   * Used to tell the app WHICH plan occurrence its own emits belong to. Absent
   * means the device keeps emitting uncorrelated frames, which the host files as
   * `LEGACY_NO_CONTEXT` — received and then invisible to every oracle.
   */
  controlExecutor?: ControlExecutor
  /** Injectable so a test can prove the scroll wait is bounded, not slept. */
  clock?: () => number
  /**
   * G90.10 BD.6 — fire the device WAN cut immediately before the armed
   * confirm tap. Absent on every uninjected run.
   */
  beforeAct?: (step: BridgeFlowPlanStep, context: StepExecutionContext) => Promise<void>
  logger?: (message: string, detail?: unknown) => void
}): BridgeRuntimePort {
  const { manager, variables, runId } = options
  const runInputs = options.runInputs ?? {}
  const clock = options.clock ?? Date.now

  /**
   * Push the correlation tuple to the app before it can emit about this action.
   *
   * The app cannot know which occurrence is asking — it only knows a login was
   * refused. Correlation can therefore only be established from this side, and
   * only just before the action that provokes the emit. Sent before EVERY bridge
   * action rather than only gated ones: an action without a gate can still be the
   * one whose emit a later oracle reads, and a wrong occurrence is worse than a
   * missing one because it looks correlated.
   *
   * A failure here is logged and swallowed. Correlation is what makes an emit
   * usable as evidence; it is not what makes the tap valid, and refusing to tap
   * because a best-effort hint did not land would turn a diagnostic gap into a
   * failed run.
   */
  async function pushCorrelation(context: StepExecutionContext): Promise<void> {
    if (options.controlExecutor === undefined) return
    try {
      const result = await options.controlExecutor.run(manager.deviceId, {
        op: 'seed',
        verb: 'nesy.binding.correlation',
        requestId: `${context.requestId}-corr`,
        scope: runId,
        params: {
          occurrenceId: context.occurrenceId,
          iterationPath: context.iterationKey,
        },
      })
      if (!result.ok) {
        options.logger?.('[BridgeFlowBridgePort] correlation push refused', {
          occurrenceId: context.occurrenceId,
          code: result.code,
        })
      }
    } catch (error) {
      options.logger?.('[BridgeFlowBridgePort] correlation push failed', {
        occurrenceId: context.occurrenceId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    async act(step: BridgeFlowPlanStep, context: StepExecutionContext): Promise<BridgeActionResult> {
      if (options.beforeAct !== undefined) {
        await options.beforeAct(step, context)
      }
      await pushCorrelation(context)
      const action = asString(step.params['action']) ?? ''
      const rawArgs = (step.params['args'] ?? {}) as Record<string, unknown>
      const args: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(rawArgs)) {
        args[key] = resolveArgValue(value, runInputs, variables)
      }
      // Macro IR uses `valueRef: "run.input.pin"`; Bridge input_text needs `text`.
      //
      // Read from `rawArgs`, not `args`: the loop above already put every arg
      // through `resolveArgValue`, so `args['valueRef']` is the RESOLVED value
      // (and `undefined` whenever the run input is missing) rather than the
      // reference string. Reading it back from `args` therefore skipped this
      // whole branch exactly when the input was absent — which is how a missing
      // barcode reached the device as `String(undefined ?? '')`.
      const rawValueRef = rawArgs['valueRef']
      if (args['text'] === undefined && rawValueRef !== undefined) {
        args['text'] = resolveArgValue(rawValueRef, runInputs, variables)
      }
      // A `valueRef` that resolved to nothing is a MISSING RUN INPUT, and it used
      // to fall through to `String(undefined ?? '')` — an empty string the bridge
      // accepted and reported as typed. The step went SUCCEEDED, the field stayed
      // blank, the following confirm tap addressed an empty dialog, and the run
      // failed several steps later with no mention of the real cause. Measured on
      // run_d5bae2af: the pack asks for `run.input.scanValue`, the run was started
      // with `{pin, routeCode}` only, and `enter-barcode` reported success.
      //
      // An explicitly authored empty `text` is still allowed — clearing a field is
      // a real instruction. Only an UNRESOLVED reference fails here.
      if (
        (action === 'setText' || action === 'input_text') &&
        rawValueRef !== undefined &&
        rawArgs['text'] === undefined &&
        (args['text'] === undefined || args['text'] === null)
      ) {
        return {
          terminalState: 'FAILED',
          effectVerified: false,
          evidenceRef: `bridgeflow:unresolved-value-ref:${String(rawValueRef)}`,
        }
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

      // Positions a list; addresses nothing. It therefore takes no
      // `targetVariable` and sits with `back`/`swipe` above the target lookup —
      // a later tap still has to establish identity and still fails closed on
      // ambiguity. `rowIndex` arrives through `resolveArgValue`, so it can come
      // from a query result (`var.…`): which row holds the requested record is a
      // fact of THIS run, not something a pack could have written down.
      if (action === 'scrollToItem' || action === 'scroll_to_item') {
        const rawRowIndex = args['rowIndex']
        const rowIndex = typeof rawRowIndex === 'number' ? rawRowIndex : Number(rawRowIndex)
        const listId = asString(args['listId'])
        const listClass = asString(args['listClass'])
        if (listId === undefined && listClass === undefined) {
          return {
            terminalState: 'FAILED',
            effectVerified: false,
            evidenceRef: 'bridgeflow:scroll-without-list-selector',
          }
        }
        const selector = {
          ...(listId === undefined ? {} : { listId }),
          ...(listId === undefined && listClass !== undefined ? { listClass } : {}),
          ...(Number.isSafeInteger(rowIndex) && rowIndex >= 0 ? { rowIndex } : {}),
          ...(asString(args['text']) === undefined ? {} : { text: asString(args['text']) }),
        }
        // A list that was just opened is not in the tree yet. Measured: tapping
        // the route spinner and scrolling in the same breath answers `not_found`,
        // while the same scroll succeeds a second later — the popup is a window
        // the platform still has to attach.
        //
        // Retrying THIS error is safe and only this one: `not_found` is decided
        // while planning the scroll, so the device refused before touching
        // anything — the same "went to the device and did not act" property that
        // makes `stale_tree` retryable. Any other refusal is returned as-is.
        //
        // The budget is the step's declared timeout, so how long a surface may
        // take to appear stays a statement in the pack rather than a constant
        // buried in the host.
        const deadline = clock() + (step.timeoutMs > 0 ? step.timeoutMs : 10_000)
        let envelope = await manager.scrollToItem(selector, { runId })
        while (!envelope.ok && envelope.error === 'not_found' && clock() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 250))
          envelope = await manager.scrollToItem(selector, { runId })
        }
        return {
          terminalState: envelope.ok ? 'SUCCEEDED' : 'FAILED',
          effectVerified: envelope.ok,
          evidenceRef:
            `bridge:scroll_to_item:${listId ?? listClass}:row=${
              Number.isSafeInteger(rowIndex) ? rowIndex : '-'
            }` + (envelope.ok ? '' : `:${String(envelope.error ?? 'unknown')}`),
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

      // The target was resolved and declared ABSENT by its own pack policy, so
      // there is nothing to act on. `SKIPPED` says exactly that: no effect was
      // produced and none was expected. Returning SUCCEEDED here would claim a
      // verified effect that never happened, and FAILED would blame the run for
      // the product being correct in a country that has no such dialog.
      if (isAbsentTarget(fingerprint)) {
        return {
          terminalState: 'SKIPPED',
          effectVerified: false,
          evidenceRef: `bridge:skipped:target-absent:${fingerprint.targetRef}`,
        }
      }
      if (!isTargetFingerprint(fingerprint)) {
        // The compiler already rejects a BRIDGE_ACTION whose target variable has
        // no prior RESOLVE_TARGET, so reaching here means the resolve step did
        // not produce one at runtime. Acting on a guess is the wrong-row bug.
        return { terminalState: 'FAILED', effectVerified: false, evidenceRef: NO_TARGET }
      }

      const byId = fingerprint.selector.by === 'id'

      // `reveal` POSITIONS, it does not address. It sits below the target lookup
      // (unlike `scrollToItem`) because the node to bring on screen is exactly
      // the node the next step will tap — the same fingerprint, so the two
      // cannot drift onto different nodes.
      //
      // The tap that follows keeps its `not_visible` gate. That gate is the
      // point: a run that clicks a control the courier can never see proves
      // nothing. Revealing asks the APP to scroll — the product does the same
      // thing to the same button when the signature pad opens — instead of
      // replaying a pixel band that survives only until a font scale changes.
      if (action === 'reveal' || action === 'reveal_id') {
        if (!byId) {
          // The device matches `reveal_id` by id only. Sending a text selector
          // as an id would silently position some other node.
          return {
            terminalState: 'FAILED',
            effectVerified: false,
            evidenceRef: `bridgeflow:reveal-requires-id-selector:by=${fingerprint.selector.by}`,
          }
        }
        const record = await manager.act('reveal_id', fingerprint, {
          runId,
          timeoutMs: step.timeoutMs,
        })
        const revealState = record.terminalState ?? 'FAILED'
        return {
          terminalState: revealState,
          // Positioning claims no product effect — only that the device accepted
          // the request and said how it acted. Whether the node is actually on
          // screen now is the following step's question, asked by resolving it
          // again; the scroll can still be animating when this returns.
          effectVerified: revealState === 'SUCCEEDED' && record.method !== null,
          evidenceRef: describeActionEvidence(record),
        }
      }

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
  /** Resolves `run.input.*` in a query's declared params. */
  runInputs?: Readonly<Record<string, unknown>>
  applicationId?: string
  controlExecutor?: ControlExecutor
  /**
   * Sink for `SDK_QUERY` fact bindings. Absent means the step still runs and
   * still fills its variable — it just proves nothing to the oracle.
   */
  observations?: SdkObservationStore
  clock?: () => number
  logger?: (message: string, detail?: unknown) => void
}): GenericStepRuntimePort {
  const { manager, variables, bundle, runId } = options
  const clock = options.clock ?? Date.now
  const targets = new Map<string, TargetDefinition>(
    bundle.registries.targets.map((target) => [target.targetKey, target]),
  )
  const applicationId = options.applicationId?.trim() || bundle.registries.applications[0]?.packageIdentity

  /**
   * Surfaces the pack says to dismiss on sight, paired with the target its own
   * handler macro drives.
   *
   * Built once from the bundle, and entirely from the pack's own declarations:
   * a surface with `defaultPolicy: "HANDLE"` names a `handlerMacroRef`, and that
   * macro declares the target it taps. No surface, macro or target name appears
   * in this file — the host stays domain-neutral and the pack keeps deciding
   * what an unbidden thing is and how it closes.
   */
  const dismissibleSurfaces = bundle.registries.surfaces
    .filter((surface) => surface.defaultPolicy === 'HANDLE' && surface.handlerMacroRef !== undefined)
    .map((surface) => {
      const handler = bundle.registries.macros.find((macro) => macro.macroKey === surface.handlerMacroRef)
      const targetRefs = handler?.allowedRegistryRefs.targetRefs ?? []
      return { surfaceRef: surface.surfaceKey, handlerRef: surface.handlerMacroRef, targetRefs }
    })
    .filter((entry) => entry.targetRefs.length > 0)

  /**
   * Close whatever handled surface is currently on top, and say whether anything
   * was closed.
   *
   * WHY THIS EXISTS IN THE HOST, MEASURED 2026-09-01 (run_a1f5bbdd)
   *
   * The pack had the whole answer already: the notification list a push puts over
   * the stop list is a registered surface, its policy is HANDLE, and a handler
   * macro exists whose single job is to tap the dialog's exit. None of it ran.
   * Interrupts were compiled into WAIT plans only, and even there
   * `onInterrupt: "HANDLE"` merely let the executor continue — no code path ever
   * invoked the handler macro. So the approval push landed, the list covered the
   * stop list, and every target under it resolved NOT_FOUND until a human sent
   * `tap_id btn_exit` by hand. That manual tap is what a handler macro IS.
   *
   * Deliberately narrow, because a full interrupt engine is a bigger contract
   * than this: presence is established by the handler's own target resolving
   * UNIQUELY, and the sweep only ever taps that target. A surface that is not up
   * resolves to nothing and costs one probe.
   */
  const dismissHandledSurfaces = async (): Promise<string[]> => {
    const dismissed: string[] = []
    // The sweep used to be silent, and a silent sweep is indistinguishable from
    // one that never ran. Measured on run_e8967885: the pack had already
    // declared everything needed — `UI.NOTIFICATION_LIST_PRESENT` was true and
    // fresh, the surface is HANDLE, the handler names `btn_exit` — the run still
    // died on a target under the list, and nothing anywhere said whether this
    // function was reached, which surface it considered, or what the probe
    // answered. Diagnosing it took a hand-driven `uiautomator dump`. So every
    // outcome is now stated, including the boring ones.
    if (dismissibleSurfaces.length === 0) {
      options.logger?.('[BridgeFlowGenericSteps] sweep: the pack declares no dismissible surface')
      return dismissed
    }
    for (const surface of dismissibleSurfaces) {
      for (const targetRef of surface.targetRefs) {
        const exit = targets.get(targetRef)
        if (exit === undefined) {
          options.logger?.('[BridgeFlowGenericSteps] sweep: handler target is not in the registry', {
            surfaceRef: surface.surfaceRef,
            targetRef,
          })
          continue
        }
        const fingerprint = buildTargetFingerprint(exit)
        if (fingerprint === undefined) {
          options.logger?.('[BridgeFlowGenericSteps] sweep: handler target has no usable selector', {
            surfaceRef: surface.surfaceRef,
            targetRef,
          })
          continue
        }
        const probe = await manager.resolve(fingerprint, { runId })
        if (probe.outcome !== 'RESOLVED_UNIQUE') {
          // Not necessarily wrong — a surface that is not up answers exactly
          // this. It is logged because the SAME answer arrives when the surface
          // IS up and the bridge cannot see it, and those two need telling apart.
          options.logger?.('[BridgeFlowGenericSteps] sweep: nothing to dismiss for this surface', {
            surfaceRef: surface.surfaceRef,
            targetRef,
            outcome: probe.outcome,
          })
          continue
        }
        const record = await manager.act(
          fingerprint.selector.by === 'id' ? 'tap_id' : 'tap_text',
          fingerprint,
          { runId },
        )
        if (record.terminalState === 'SUCCEEDED') {
          dismissed.push(surface.surfaceRef)
          options.logger?.('[BridgeFlowGenericSteps] dismissed a handled surface', {
            surfaceRef: surface.surfaceRef,
            handlerRef: surface.handlerRef,
            targetRef,
          })
        }
        break
      }
    }
    return dismissed
  }
  const controlExecutor = options.controlExecutor ?? (
    applicationId === undefined ? undefined : createControlExecutor({ applicationId })
  )

  return {
    async execute(step: BridgeFlowPlanStep, context: StepExecutionContext): Promise<GenericStepResult> {
      if (step.kind === 'CLEANUP' && step.planStepId === 'clear-session') {
        if (controlExecutor === undefined) {
          options.logger?.('[BridgeFlowGenericSteps] no SDK control executor for clear-session cleanup', {
            planStepId: step.planStepId,
          })
          return { succeeded: false, actionResult: 'FAILED' }
        }
        const result = await controlExecutor.run(manager.deviceId, {
          op: 'reset_state',
          requestId: context.requestId,
          scope: runId,
        })
        if (!result.ok) {
          options.logger?.('[BridgeFlowGenericSteps] clear-session cleanup failed', {
            planStepId: step.planStepId,
            code: result.code,
          })
          return { succeeded: false, actionResult: 'FAILED' }
        }
        return {
          succeeded: true,
          actionResult: 'SUCCEEDED',
          evidenceRef: 'cleanup:reset_state:accepted',
        }
      }

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

        // Resolved the same way BRIDGE_ACTION args are, so a query can be narrowed
        // by what THIS run asked for. `sql_named` has always carried `params`; the
        // host simply never filled them, so every projection came back whole and
        // any narrowing had to happen in the condition language — which cannot
        // pick a row by one column and read another.
        const declaredParams = step.params['queryParams']
        const queryParams: Record<string, string | number | boolean | null> = {}
        if (declaredParams !== null && typeof declaredParams === 'object') {
          for (const [name, ref] of Object.entries(declaredParams as Record<string, string>)) {
            const resolved = resolveArgValue(ref, options.runInputs ?? {}, variables)
            if (typeof resolved === 'string' || typeof resolved === 'number' || typeof resolved === 'boolean') {
              queryParams[name] = resolved
            }
          }
        }

        const result = await controlExecutor.run(manager.deviceId, {
          op: 'sql_named',
          requestId: context.requestId,
          scope: runId,
          name: queryRef,
          ...(Object.keys(queryParams).length === 0 ? {} : { params: queryParams }),
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
        // Also under the STEP ID, because that is the name a `step.output` operand
        // uses: `step.output` + path `read-offered-routes.route_code` reads as "the
        // route codes that step produced". Storing only under `outputVariable` left
        // every such condition resolving MISSING — and with `unknownPolicy: FAIL`,
        // failing the step rather than reporting the mismatch.
        variables.set(step.planStepId, rows)

        // Bound facts are read from the FIRST row. Every query that binds facts
        // is a `maxRows: 1` state projection; a multi-row query answers "which
        // items exist", which is a question for a later step, not for a fact.
        //
        // RECORDED, not published: evidence is scoped by occurrence, so a fact
        // published here would be visible only to this step and never to the
        // Final Oracle three steps later. The evidence port republishes these
        // into the asking occurrence's scope. See `sdk-observation-store`.
        const bindings = step.params['outputFactBindings']
        if (Array.isArray(bindings) && options.observations !== undefined) {
          const firstRow = (rows[0] ?? {}) as Record<string, unknown>
          type Binding = {
            factKey: string
            from:
              | { kind: 'COLUMN'; column: string }
              | { kind: 'ROWS_PRESENT' }
              | { kind: 'COLUMN_NOT_IN'; column: string; values: readonly string[] }
            correlationColumn?: string
          }
          for (const binding of bindings as readonly Binding[]) {
            // An empty result set is a PROVEN negative, not an unknown: the query
            // ran and the app had nothing to show. A missing column is not — that
            // is a projection that never carried the answer.
            const value =
              binding.from.kind === 'ROWS_PRESENT'
                ? rows.length > 0
                : binding.from.kind === 'COLUMN_NOT_IN'
                  ? asColumnNotInValue(firstRow[binding.from.column], binding.from.values)
                  : asFactValue(firstRow[binding.from.column])
            // WHICH entity this observation is about, when the pack asked for it.
            // A derivation that has to prove the observed stop is the requested
            // one needs the identity, not only that some stop was observed.
            const correlationValue =
              binding.correlationColumn === undefined
                ? undefined
                : asOptionalString(firstRow[binding.correlationColumn])
            options.observations.record(runId, {
              factKey: binding.factKey,
              value,
              observedAtMs: clock(),
              queryRef,
              ...(correlationValue === undefined ? {} : { correlationValue }),
            })
          }
        }

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

      // The step says WHICH record this occurrence is about; the target says how
      // a record of that kind is addressed. Neither half addresses anything
      // alone, and this binding was the missing half: a target keyed on the
      // requested entity produced no selector at all, so the resolve step failed
      // before the device was ever asked.
      const entityKey = resolveArgValue(step.entityBinding?.id, options.runInputs ?? {}, variables)
      const fingerprint = buildTargetFingerprint(
        target,
        typeof entityKey === 'string' || typeof entityKey === 'number'
          ? String(entityKey)
          : undefined,
      )
      if (fingerprint === undefined) {
        // The chain declares no strategy this host can turn into a selector.
        return {
          succeeded: false,
          actionResult: 'FAILED',
          evidenceRef: `resolve:no-selector:target=${targetRef}:entityKey=${
            entityKey === undefined ? 'unresolved' : 'present'
          }`,
        }
      }

      // KEEP LOOKING UNTIL THE DEADLINE THE PACK DECLARED.
      //
      // `TargetResolutionPolicy.deadlineMs` has always been in the contract and
      // this runtime asked the device exactly once, so the deadline bought
      // nothing: a control that appears 300ms later — a search bar animating
      // open, a dialog still inflating — came back NOT_FOUND on the first frame.
      // Measured on device 2026-08-13: `open-stop` tapped the search toggle and
      // resolved the field in the same breath; the field was reported absent and
      // the run stopped, while a manual repeat of the same two calls with a
      // pause between them found it every time.
      //
      // Only NOT_FOUND is worth waiting out. AMBIGUOUS and STALE_TREE are answers
      // — "I found several" and "the tree moved under me" — and retrying them
      // would be waiting for a different reply to the same question.
      // ...but only for a target the pack says MUST be there. `TREAT_AS_ABSENT`
      // means absence is a legitimate answer, so the first NOT_FOUND IS the
      // answer — waiting it out would charge every run the full deadline for a
      // control it was told might not exist, and would turn a fast "is this open
      // right now?" probe into a ten-second stall.
      const waitsForTarget = target.resolution.notFoundPolicy !== 'TREAT_AS_ABSENT'
      const resolveDeadlineMs = target.resolution.deadlineMs
      const resolveExpiresAt =
        clock() + (waitsForTarget && typeof resolveDeadlineMs === 'number' ? resolveDeadlineMs : 0)
      const pollUntilFound = async (
        start: TargetResolutionEvidence,
        expiresAt: number,
      ): Promise<TargetResolutionEvidence> => {
        let evidence = start
        while (evidence.outcome === 'NOT_FOUND' && clock() < expiresAt) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(TARGET_RESOLVE_POLL_MS, Math.max(1, expiresAt - clock()))),
          )
          evidence = await manager.resolve(fingerprint, { runId })
        }
        return evidence
      }

      let evidence = await pollUntilFound(await manager.resolve(fingerprint, { runId }), resolveExpiresAt)

      // A target the pack says MUST be there, still absent after its deadline, is
      // the exact shape an unbidden overlay makes: everything under it reports
      // NOT_FOUND while the screen is perfectly healthy. So ask the pack whether
      // anything it knows how to close is up, close it, and give the target ONE
      // more look. Only here — a target declared TREAT_AS_ABSENT has already been
      // answered, and sweeping on its behalf would dismiss a dialog to prove
      // something is missing.
      //
      // AND THEN WAIT AGAIN, MEASURED 2026-09-02 (run_2749145c).
      //
      // The re-look used to be a single immediate resolve, which is the very
      // mistake the deadline loop above was written to correct — only worse,
      // because a dismissal GUARANTEES the screen is mid-change. The sweep
      // tapped the notification list's exit, reported it, and the one re-resolve
      // landed while the dialog was still animating out: `close_search_bar`
      // came back NOT_FOUND two tree generations later and the run stopped on a
      // control that was about to be there. So the target gets its full deadline
      // a second time, from the dismissal onwards.
      if (evidence.outcome === 'NOT_FOUND' && waitsForTarget) {
        const dismissed = await dismissHandledSurfaces()
        if (dismissed.length > 0) {
          evidence = await pollUntilFound(
            await manager.resolve(fingerprint, { runId }),
            clock() + (typeof resolveDeadlineMs === 'number' ? resolveDeadlineMs : 0),
          )
        }
      }

      const evidenceRef = describeResolutionEvidence(evidence)
      if (evidence.outcome !== 'RESOLVED_UNIQUE') {
        // The pack's `notFoundPolicy`, finally read. It has always been part of
        // `TargetResolutionPolicy` and this runtime ignored it, so a target that
        // is SUPPOSED to be absent sometimes — Serbia's delivery time-range
        // picker, a refusal dialog on the happy path — could not be modelled at
        // all. Declaring the policy bought nothing and the pack had to pretend
        // the target was mandatory.
        //
        // Only NOT_FOUND is tolerated, and only when the pack says so. AMBIGUOUS,
        // STALE_TREE and a rejected weak target stay failures: those are "we
        // could not tell", which is the opposite of "it is not there".
        if (evidence.outcome === 'NOT_FOUND' && target.resolution.notFoundPolicy === 'TREAT_AS_ABSENT') {
          return {
            succeeded: true,
            actionResult: 'SUCCEEDED',
            outputVariable,
            // An explicit marker, not an empty variable. A later BRIDGE_ACTION
            // must be able to tell "declared absent" from "the resolve step never
            // ran", and an absent value cannot carry that difference.
            output: { absentTarget: true, targetRef },
            evidenceRef,
          }
        }
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
