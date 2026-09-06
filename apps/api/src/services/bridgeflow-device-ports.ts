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
import type { SdkQueryOutputFactBinding } from '@nesy/workflow-contract'
import type { BridgeDeviceManager } from './bridge-device-manager.js'
import type { SdkObservationStore } from './sdk-observation-store.js'
import { buildTargetFingerprint, isTargetFingerprint } from './bridgeflow-target-fingerprint.js'
import { dig } from './condition-engine.js'

const NO_TARGET = 'bridgeflow:bridge-action-without-resolved-target'

/** Gap between resolution attempts while a target's own deadline still runs. */
const TARGET_RESOLVE_POLL_MS = 250

function queryPredicateValue(rows: readonly unknown[], predicate: SdkQueryOutputFactBinding['from']) {
  const firstRow = (rows[0] ?? {}) as Record<string, unknown>
  return predicate.kind === 'ROWS_PRESENT'
    ? rows.length > 0
    : predicate.kind === 'COLUMN_NOT_IN'
      ? asColumnNotInValue(firstRow[predicate.column], predicate.values)
      : asFactValue(firstRow[predicate.column])
}

/**
 * How many times the sweep will tap one surface's exit before giving up.
 *
 * Three, because the failure it recovers from is a stale coordinate and one
 * fresh resolution fixes that; a surface that survives three re-resolved taps is
 * not a moved button, and hammering it would only delay the real failure.
 */
const SWEEP_DISMISS_ATTEMPTS = 3

/** Time given to a dismissal before asking whether the surface is gone. */
const SWEEP_SETTLE_MS = 400

/**
 * The login macro's session-reset cleanup, matched by SUFFIX.
 *
 * A COMPOSED journey renames every step it borrows: `full-courier-day` prefixes
 * each leg, so `login`'s `clear-session` arrives as `auth-clear-session`. This
 * used to be compared with `===`, so the cleanup matched nothing in any composed
 * journey, fell through the whole `execute` chain and returned FAILED — with
 * ZERO action transitions, because no branch had run. Measured 2026-09-02/03: it
 * failed at the end of every `full-courier-day` run and passed in the
 * single-macro workflows, which is exactly the shape a prefix bug makes. Worse
 * than the failure itself was what it did to every report: a cleanup that always
 * fails is the only FAILED occurrence in a run whose real stop was a continue
 * gate, so `auth-clear-session` was named as the culprit for problems three legs
 * away from it.
 *
 * `planRequestsStartupPermissionBootstrap` already learned this and matches with
 * `endsWith`; this follows that convention rather than inventing a second one.
 */
const CLEAR_SESSION_PLAN_STEP_ID = 'clear-session'

/**
 * Anchored on the leg separator so a suffix match cannot widen into a
 * namespace: `auth-clear-session` matches, and anything that merely ends in the
 * same letters does not.
 */
function isClearSessionStep(planStepId: string): boolean {
  return (
    planStepId === CLEAR_SESSION_PLAN_STEP_ID ||
    planStepId.endsWith(`-${CLEAR_SESSION_PLAN_STEP_ID}`)
  )
}

/**
 * Shallow enough to stay off the heavy quota, deep enough to name a screen.
 *
 * A `depth` dump is a scoped read — only `full` is charged as heavy — and eight
 * levels reaches the fragment's own container ids on this app without walking
 * every list row.
 */
const SCREEN_FINGERPRINT_DEPTH = 8

/** How many ids the fingerprint names before it just counts the rest. */
const SCREEN_FINGERPRINT_IDS = 8

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

/**
 * Is this raw arg a reference into the run's own state?
 *
 * The two namespaces `resolveArgValue` understands. A literal — including a
 * literal empty string — is not one of them, which is what keeps "clear this
 * field" a legitimate instruction.
 */
function isStateReference(raw: unknown): raw is string {
  return typeof raw === 'string' && (raw.startsWith('run.input.') || raw.startsWith('var.'))
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
      // A REFERENCE THAT RESOLVED TO NOTHING IS A MISSING INPUT — under ANY key.
      //
      // It used to fall through to `String(undefined ?? '')`: an empty string the
      // bridge accepted and reported as typed. The step went SUCCEEDED, the field
      // stayed blank, the following confirm tap addressed an empty dialog, and the
      // run failed several steps later with no mention of the real cause. Measured
      // on run_d5bae2af with `valueRef`, and the guard written for it checked
      // `rawArgs['valueRef']` — so it was blind to the SAME bug under `text`.
      // Measured again on run_3ef0e142: `complete-delivery` writes
      // `args: { text: "run.input.consignmentNumber" }`, the input was never
      // supplied, an empty string went into the delivery scan field, the app never
      // emitted `DELIVERY_PARCEL_SCANNED` at all, and the run died 20s later on a
      // continue gate three steps away from the actual cause.
      //
      // So the check is on the RAW value being a `run.input.*` / `var.*`
      // reference, not on which key it sits under. A literal — including a literal
      // empty string — is not a reference, which keeps "clear this field" a real
      // instruction.
      for (const [key, raw] of Object.entries(rawArgs)) {
        if (!isStateReference(raw)) continue
        const resolved = args[key]
        if (resolved !== undefined && resolved !== null) continue
        return {
          terminalState: 'FAILED',
          effectVerified: false,
          evidenceRef: `bridgeflow:unresolved-value-ref:${raw}`,
        }
      }
      // `valueRef` is mapped into `text` above, so its own resolution is checked
      // there; this catches the case where the mapping produced nothing.
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
  /**
   * WHAT WAS ON SCREEN, recorded WITH the miss that needs explaining.
   *
   * MEASURED 2026-09-03 (run_5b038e00), and twice before it.
   *
   * A mandatory target that ends NOT_FOUND is the most common way a run stops,
   * and the run record could only ever say `not_found`. Everything else had to
   * be reconstructed by hand afterwards — and twice the answer was already gone:
   * the API log had rotated past the run, and the device had moved on to another
   * screen by the time anyone looked. So the same question was re-litigated from
   * treeGen numbers alone: `visit-resolve-search-toggle` reported
   * `close_search_bar:NOT_FOUND:treeGen=12286` and `visit-probe-search-field`
   * reported `tietSearchText:NOT_FOUND:treeGen=12286` fifteen seconds apart, and
   * "the tree is frozen" looked as plausible as "the screen is not the stop
   * list". It was the second — the bridge answers `root_unavailable` as its own
   * error, and neither read got that, so the tree was live and simply did not
   * contain either control. Nothing in the run said which screen it DID contain.
   *
   * One shallow dump, taken only on the failing path, closes that permanently.
   *
   * IDS ONLY, deliberately. A node's text is user data — a consignee, an
   * address, a barcode — and this string lands in a durable run record that
   * feeds reports; ids are structural and name a screen just as well. The
   * bridge's own redaction already runs over dump nodes, and not depending on it
   * here means the guarantee does not rest on a policy in another repo.
   */
  const describeScreenOnMiss = async (): Promise<string> => {
    try {
      const envelope = await manager.dump(
        { kind: 'depth', maxDepth: SCREEN_FINGERPRINT_DEPTH },
        { runId },
      )
      if (envelope.ok !== true) {
        // A refusal is itself the answer — `root_unavailable` here would mean
        // there was no active window at all, which is a different failure from
        // a control being absent.
        const error = typeof envelope.error === 'string' && envelope.error !== '' ? envelope.error : 'unknown'
        return `:screen=unreadable(${error})`
      }
      const nodes = Array.isArray(envelope['nodes']) ? envelope['nodes'] : []
      const ids: string[] = []
      for (const node of nodes) {
        if (node === null || typeof node !== 'object') continue
        const raw = (node as Record<string, unknown>)['id']
        if (typeof raw !== 'string') continue
        // `com.example.app:id/btn_exit` and `btn_exit` are the same control; the
        // package prefix would be repeated on every entry and name nothing.
        const id = (raw.split('/').pop() ?? '').trim()
        if (id === '' || ids.includes(id)) continue
        ids.push(id)
      }
      if (ids.length === 0) return `:screen=no-identified-nodes(${nodes.length})`
      const named = ids.slice(0, SCREEN_FINGERPRINT_IDS).join(',')
      const rest = ids.length - SCREEN_FINGERPRINT_IDS
      return `:screen=${named}${rest > 0 ? `,+${String(rest)}` : ''}`
    } catch (error) {
      // Never the reason a step's outcome changes: this runs only when the step
      // has already failed, and a broken probe must not rewrite that failure.
      options.logger?.('[BridgeFlowGenericSteps] screen fingerprint probe failed', {
        message: error instanceof Error ? error.message : String(error),
      })
      return ':screen=probe-failed'
    }
  }

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
        /**
         * DISMISSAL IS PROVEN BY ABSENCE, NOT BY THE TAP'S OWN REPORT.
         *
         * Measured 2026-09-02 (run_125f3b1d): the sweep tapped the notification
         * list's exit, the bridge answered SUCCEEDED, the evidence recorded
         * `swept=nesy.notification-list-dialog` — and the dialog was still on
         * screen minutes later, with `manuel_input` NOT_FOUND underneath it for a
         * full second deadline. The exit itself was fine: tapping its CURRENT
         * centre by hand closed it immediately. What had moved was the button —
         * as pushes accumulate the list grows and `btn_exit` shifts upward
         * ([940,338] at 19:26, [940,293] at 19:58), so a tap aimed at where it
         * used to be lands on nothing and still reports a completed gesture.
         *
         * So the tap is retried against a FRESH resolution each time, and the
         * surface only counts as dismissed once its own exit target stops
         * resolving. That is the same test the sweep already uses to decide the
         * surface is up, applied in the other direction — presence and absence
         * judged by one measurement rather than presence by measurement and
         * absence by hope.
         */
        let stillUp = true
        for (let attempt = 1; attempt <= SWEEP_DISMISS_ATTEMPTS && stillUp; attempt += 1) {
          const record = await manager.act(
            fingerprint.selector.by === 'id' ? 'tap_id' : 'tap_text',
            fingerprint,
            { runId },
          )
          // A refused gesture is worth another look too: the refusal is often
          // `stale_tree`, which the next resolution fixes by itself.
          await new Promise((resolve) => setTimeout(resolve, SWEEP_SETTLE_MS))
          const after = await manager.resolve(fingerprint, { runId })
          stillUp = after.outcome === 'RESOLVED_UNIQUE'
          if (stillUp) {
            options.logger?.('[BridgeFlowGenericSteps] sweep: the surface is still up after tapping its exit', {
              surfaceRef: surface.surfaceRef,
              targetRef,
              attempt,
              tapResult: record.terminalState,
              ...(record.error === undefined ? {} : { deviceError: record.error }),
            })
          }
        }
        if (!stillUp) {
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
      if (step.kind === 'CLEANUP' && isClearSessionStep(step.planStepId)) {
        // WHY IT FAILED BELONGS ON THE RUN, NOT ONLY IN A LOG.
        //
        // This cleanup has failed at the end of every run measured on
        // 2026-09-02/03 and none of them can say why: the refusal code went to
        // the logger, and by the time anyone read the run the buffer had rotated
        // past it. `evidenceRef` is persisted with the occurrence, so the answer
        // now survives with the thing it explains — the same correction already
        // made for the interrupt sweep in this file.
        if (controlExecutor === undefined) {
          options.logger?.('[BridgeFlowGenericSteps] no SDK control executor for clear-session cleanup', {
            planStepId: step.planStepId,
          })
          return {
            succeeded: false,
            actionResult: 'FAILED',
            evidenceRef: 'cleanup:reset_state:no-control-executor',
          }
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
          return {
            succeeded: false,
            actionResult: 'FAILED',
            evidenceRef: `cleanup:reset_state:refused:${result.code ?? 'no-code'}`,
          }
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

        const waitUntil = step.params['waitUntil'] as SdkQueryOutputFactBinding['from'] | undefined
        const expiresAt = clock() + step.timeoutMs
        let attempt = 0
        let rows: unknown[]
        for (;;) {
          attempt += 1
          const result = await controlExecutor.run(manager.deviceId, {
            op: 'sql_named',
            // A new request id avoids replaying the SDK's cached empty response.
            requestId: attempt === 1 ? context.requestId : `${context.requestId}:poll-${attempt}`,
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
          rows = Array.isArray(result.data.rows) ? result.data.rows.slice(0, maxRows) : []
          if (waitUntil === undefined || queryPredicateValue(rows, waitUntil) === true) break
          const remaining = expiresAt - clock()
          if (remaining <= 0) {
            return {
              succeeded: false,
              actionResult: 'FAILED',
              evidenceRef: `sdk-query:observation-timeout:${queryRef}:attempts=${attempt}`,
            }
          }
          await new Promise((resolve) => setTimeout(resolve, Math.min(250, remaining)))
        }
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
            const value = queryPredicateValue(rows, binding.from)
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
      // NOT_FOUND and a temporarily unavailable root can recover while a dialog
      // opens. TREE_UNAVAILABLE must still fail if it lasts past the deadline;
      // it is never proof of absence. AMBIGUOUS and STALE_TREE are answers
      // — "I found several" and "the tree moved under me" — and retrying them
      // would be waiting for a different reply to the same question.
      // TREAT_AS_ABSENT is an immediate probe. WAIT_THEN_ABSENT gives an optional
      // control time to appear before accepting absence. run_c03e5606 probed a
      // picker before its network response and skipped the confirmation even
      // though the picker appeared about 430 ms later.
      const allowsAbsence =
        target.resolution.notFoundPolicy === 'TREAT_AS_ABSENT' ||
        target.resolution.notFoundPolicy === 'WAIT_THEN_ABSENT'
      const waitsForTarget = target.resolution.notFoundPolicy !== 'TREAT_AS_ABSENT'
      const resolveDeadlineMs = target.resolution.deadlineMs
      const resolveExpiresAt =
        clock() + (waitsForTarget && typeof resolveDeadlineMs === 'number' ? resolveDeadlineMs : 0)
      const pollUntilFound = async (
        start: TargetResolutionEvidence,
        expiresAt: number,
      ): Promise<TargetResolutionEvidence> => {
        let evidence = start
        while (
          (evidence.outcome === 'NOT_FOUND' || evidence.outcome === 'TREE_UNAVAILABLE') &&
          clock() < expiresAt
        ) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(TARGET_RESOLVE_POLL_MS, Math.max(1, expiresAt - clock()))),
          )
          evidence = await manager.resolve(fingerprint, { runId })
        }
        return evidence
      }

      let evidence = await manager.resolve(fingerprint, { runId })
      let sweepNote = ''

      // A known handled surface is cheap to probe and expensive to discover
      // only after the target's full deadline. Run that probe on the first
      // mandatory miss. If no overlay is present, normal event-driven polling
      // continues with the original deadline; if one is dismissed, the target
      // receives a fresh full deadline from the changed screen.
      if (evidence.outcome === 'NOT_FOUND' && !allowsAbsence && dismissibleSurfaces.length > 0) {
        const dismissed = await dismissHandledSurfaces()
        sweepNote = dismissed.length === 0 ? ':swept=nothing' : `:swept=${dismissed.join(',')}`
        if (dismissed.length > 0) {
          evidence = await manager.resolve(fingerprint, { runId })
        }
      }
      evidence = await pollUntilFound(
        evidence,
        sweepNote !== '' && !sweepNote.endsWith('nothing')
          ? clock() + (typeof resolveDeadlineMs === 'number' ? resolveDeadlineMs : 0)
          : resolveExpiresAt,
      )

      // A target the pack says MUST be there, still absent after its deadline, is
      // the exact shape an unbidden overlay makes: everything under it reports
      // NOT_FOUND while the screen is perfectly healthy. So ask the pack whether
      // anything it knows how to close is up, close it, and give the target ONE
      // more look. An optional target has already been answered (immediately or
      // after its deadline), and sweeping on its behalf would dismiss a dialog to prove
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
      //
      // WHAT THE SWEEP DID IS PART OF THE EVIDENCE, MEASURED 2026-09-02.
      //
      // The sweep's outcome was reported to the LOGGER only, and a log is not a
      // channel this can rely on: diagnosing run_cde7f880 meant reading a buffer
      // that had rotated past the run entirely, so "the sweep tapped the exit
      // and it did not close" and "the sweep never considered that surface" were
      // once again indistinguishable — the same ambiguity the logging was added
      // to remove. The step's own `evidenceRef` is persisted with the run, so
      // the answer is recorded there instead of somewhere that scrolls away.
      if (evidence.outcome === 'NOT_FOUND' && !allowsAbsence) {
        const dismissed = sweepNote === '' ? await dismissHandledSurfaces() : []
        if (sweepNote === '') {
          sweepNote = dismissed.length === 0 ? ':swept=nothing' : `:swept=${dismissed.join(',')}`
        }
        if (dismissed.length > 0) {
          evidence = await pollUntilFound(
            await manager.resolve(fingerprint, { runId }),
            clock() + (typeof resolveDeadlineMs === 'number' ? resolveDeadlineMs : 0),
          )
        }
      }

      // Only for a target the pack says MUST be there, and only once it has
      // genuinely failed: an optional target's miss is an ANSWER, and dumping the
      // screen to explain an expected absence would charge every run for it.
      const screenNote =
        evidence.outcome === 'NOT_FOUND' && !allowsAbsence ? await describeScreenOnMiss() : ''
      const evidenceRef = `${describeResolutionEvidence(evidence)}${sweepNote}${screenNote}`
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
        if (evidence.outcome === 'NOT_FOUND' && allowsAbsence) {
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
          // DELIBERATELY NO `absentTarget: false` HERE.
          //
          // Adding it looked symmetrical and broke a documented contract. The
          // absent marker's whole job is to be PRESENT OR NOT: `open-stop`'s
          // `check-search-open` is an existence test over
          // `searchFieldProbe.absentTarget` precisely because the two states are
          // "marker written" and "plain fingerprint", and its own note records
          // that comparing the marker to `true` once stopped a run whose search
          // bar was already open. Writing the key on this side too makes that
          // existence test answer true in both states, so a pack asking "was the
          // absent-tolerant target there?" would always be told yes.
          ...(evidence.treeGen === undefined ? {} : { capturedTreeGen: evidence.treeGen }),
        },
      }
    },
  }
}
