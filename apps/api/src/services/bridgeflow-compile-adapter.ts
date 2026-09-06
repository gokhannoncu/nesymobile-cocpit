/**
 * Real BridgeFlowCompiler adapter for the Verdict compile BFF.
 *
 * Before this adapter the production route ran `createHashPinnedCompileStub`,
 * which compiled every step to `NOOP`. That is the difference between a plan
 * that *hashes* like a workflow and a plan that *is* one: CONDITION, SWITCH and
 * FOR_EACH never reached the executor, so no branch could ever be taken and no
 * control-flow safety rule (bounded loops, bounded waits, unsafe retry) could
 * ever fire. The stub stays exported for the contract tests that assert on
 * `compilerKind: "STUB"`; nothing in the running API selects it.
 *
 * Device capabilities are an input, not a constant: capability gaps are part of
 * the compiled plan. With no attached device the caller gets the protocol
 * baseline manifest, and the resulting `capabilityManifest.gaps` describe the
 * baseline — never a device that was not consulted.
 */

import { deriveCapabilityManifest, BRIDGE_PROTOCOL_VERSION, type BridgeCapabilityManifest } from '@nesy/bridge-contract'
import { compileDomainWorkflow } from '@nesy/bridgeflow-compiler'
import type { CompileIssue } from '@nesy/bridgeflow-compiler'
import type { DomainPackBundle, MacroExpansionSnapshot } from '@nesy/domain-pack-contracts'
import type {
  StepVerificationMode,
  StepVerificationRole,
  WorkflowIrV2,
  WorkflowStepV2,
} from '@nesy/workflow-contract'

import { STARTUP_PERMISSION_PLAN_STEP_ID } from './android-startup-permissions.js'
import { resolveDomainPack, type DomainPackResolution } from './domain-pack-registry.js'
import {
  WorkflowCompileService,
  defaultCompiledPlanStore,
  type CompiledPlanStore,
  type StoredBridgeFlowPlan,
  type WorkflowCompileResult,
} from './workflow-compile.service.js'

type CompileIssues = WorkflowCompileResult['issues']

export interface BridgeFlowCompileAdapterOptions {
  /** Test seam: resolve the pinned pack. Defaults to the process pack registry. */
  resolvePack?: (input: {
    packKey: string
    packVersion: string
    packDigest?: string
  }) => DomainPackResolution
  /** Capability manifest to compile against. Defaults to the protocol baseline. */
  deviceCapabilities?: BridgeCapabilityManifest
}

function toCompileIssues(issues: readonly CompileIssue[]): CompileIssues {
  return issues.map((issue) => ({
    severity: issue.severity,
    code: issue.code,
    message: issue.message,
    ...(issue.sourceRef === undefined ? {} : { nodeId: issue.sourceRef }),
  }))
}

/**
 * The macros involved in one compilation.
 *
 * Scoped rather than "every macro in the pack": macro validation is part of the
 * compile, so passing the whole registry makes an unrelated macro's defect fail
 * a workflow that never touches it. An IR authored in the editor matches no
 * pack workflow key — those compile against the full registry, since there is
 * nothing narrower to scope to.
 */
function macrosForWorkflow(bundle: DomainPackBundle, workflowRef: string) {
  const workflow =
    bundle.registries.independentWorkflows.find((entry) => entry.workflowKey === workflowRef) ??
    bundle.registries.fragments.find((entry) => entry.fragmentKey === workflowRef)
  if (workflow === undefined) return bundle.registries.macros
  const refs = new Set(workflow.macroRefs)
  return bundle.registries.macros.filter((macro) => refs.has(macro.macroKey))
}

function isWorkflowIrV2(value: unknown): value is WorkflowIrV2 {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return Array.isArray(record.steps) && typeof record.entryStepId === 'string'
}

function canvasHasNodeType(value: unknown, type: string): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const nodes = (value as { nodes?: unknown }).nodes
  return Array.isArray(nodes) && nodes.some(
    (node) =>
      node !== null &&
      typeof node === 'object' &&
      (node as { type?: unknown }).type === type,
  )
}

function irRequiresStartupPermissions(ir: WorkflowIrV2): boolean {
  return ir.steps.some((step) => step.planStepId.endsWith(STARTUP_PERMISSION_PLAN_STEP_ID))
}

const STRICT_VERIFICATION_MODE: StepVerificationMode = 'BUSINESS_PROOF'

const NODE_STEP_PREFIXES: Readonly<Record<string, string>> = {
  AUTH_LOGIN: 'auth',
  SELECT_ROUTE: 'route',
  LOAD_TO_VEHICLE: 'load',
  REQUEST_TOUR_START: 'permit',
  OPEN_STOP: 'visit',
  SCAN_BARCODE: 'item',
  DELIVERY_OPERATION: 'deliver',
}

const NODE_MACRO_REFS: Readonly<Record<string, string>> = {
  AUTH_LOGIN: 'nesy.macro.login',
  SELECT_ROUTE: 'nesy.macro.select-route',
  LOAD_TO_VEHICLE: 'nesy.macro.load-to-vehicle',
  REQUEST_TOUR_START: 'nesy.macro.tour-approval-lifecycle',
  OPEN_STOP: 'nesy.macro.open-stop',
  SCAN_BARCODE: 'nesy.macro.process-parcel',
  DELIVERY_OPERATION: 'nesy.macro.complete-delivery',
}

function asVerificationMode(value: unknown): StepVerificationMode | undefined {
  return value === 'BUSINESS_PROOF' || value === 'UI_CHECK' || value === 'ACTION_ONLY'
    ? value
    : undefined
}

function isUiFact(factKey: string): boolean {
  return factKey.toUpperCase().startsWith('UI.')
}

function valueReferencesVariable(value: unknown, variable: string): boolean {
  if (typeof value === 'string') {
    return value === variable || value === `var.${variable}` || value.includes(`var.${variable}.`)
  }
  if (Array.isArray(value)) return value.some((entry) => valueReferencesVariable(entry, variable))
  if (value === null || typeof value !== 'object') return false
  return Object.values(value as Record<string, unknown>).some((entry) => valueReferencesVariable(entry, variable))
}

function verificationRoleFor(step: WorkflowStepV2, ir: WorkflowIrV2): StepVerificationRole {
  if (step.kind === 'ASSERT_FACT') return 'BUSINESS_PROOF'
  if ((step.kind === 'REMOTE_ACTION' || step.kind === 'EXTERNAL_ACTION') && step.spec.role === 'VALIDATION') {
    return 'BUSINESS_PROOF'
  }
  if (step.kind === 'SDK_QUERY' && (step.outputFactBindings?.length ?? 0) > 0) {
    const feedsControlFlow = ir.steps.some(
      (candidate) => candidate.planStepId !== step.planStepId && valueReferencesVariable(candidate, step.outputVariable),
    )
    if (!feedsControlFlow) return 'BUSINESS_PROOF'
  }
  if (step.kind === 'WAIT_EVENT') return isUiFact(step.factKey) ? 'UI_CHECK' : 'BUSINESS_PROOF'
  if (step.kind === 'WAIT_ANY') {
    return step.legs.every((leg) => isUiFact(leg.factKey)) ? 'UI_CHECK' : 'BUSINESS_PROOF'
  }
  return 'ACTION'
}

function uiOnlyGate(gate: WorkflowStepV2['continueGate']): WorkflowStepV2['continueGate'] {
  if (gate === undefined) return undefined
  const allOf = (gate.allOf ?? []).filter(isUiFact)
  const anyOf = (gate.anyOf ?? []).filter(isUiFact)
  const noneOf = (gate.noneOf ?? []).filter(isUiFact)
  if (allOf.length + anyOf.length + noneOf.length === 0) return undefined
  return {
    ...gate,
    ...(allOf.length === 0 ? { allOf: undefined } : { allOf }),
    ...(anyOf.length === 0 ? { anyOf: undefined } : { anyOf }),
    ...(noneOf.length === 0 ? { noneOf: undefined } : { noneOf }),
  }
}

/**
 * Applies editor verification choices to the pack-authored generic IR.
 *
 * The canvas node owns the choice, while the macro expansion owns executable
 * steps. This is the deliberate join between them. Unknown node types are left
 * strict instead of guessing a domain mapping.
 */
export function applyCanvasVerificationModes(ir: WorkflowIrV2, canvas: unknown): WorkflowIrV2 {
  const modeByPrefix = new Map<string, StepVerificationMode>()
  const modeByMacroRef = new Map<string, StepVerificationMode>()
  const nodes = canvas !== null && typeof canvas === 'object' && !Array.isArray(canvas)
    ? (canvas as { nodes?: unknown }).nodes
    : undefined
  for (const candidate of Array.isArray(nodes) ? nodes : []) {
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) continue
    const node = candidate as { id?: unknown; type?: unknown; data?: { config?: Record<string, unknown> }; config?: Record<string, unknown> }
    const mode = asVerificationMode(node.data?.config?.verificationMode ?? node.config?.verificationMode)
    if (mode === undefined || mode === STRICT_VERIFICATION_MODE) continue
    const typePrefix = typeof node.type === 'string' ? NODE_STEP_PREFIXES[node.type] : undefined
    const configuredMacroRef = node.data?.config?.macroRef ?? node.config?.macroRef
    const macroRef = typeof configuredMacroRef === 'string'
      ? configuredMacroRef
      : typeof node.type === 'string' ? NODE_MACRO_REFS[node.type] : undefined
    const idPrefix = typeof node.id === 'string' ? node.id.replace(/-login$/, '') : undefined
    const prefix = typePrefix ?? idPrefix
    if (prefix) modeByPrefix.set(prefix, mode)
    if (macroRef) modeByMacroRef.set(macroRef, mode)
  }
  const hasReducedIrStep = ir.steps.some(
    (step) => step.verificationMode !== undefined && step.verificationMode !== STRICT_VERIFICATION_MODE,
  )
  if (modeByPrefix.size === 0 && modeByMacroRef.size === 0 && !hasReducedIrStep) return ir
  const anyPrefixMatches = ir.steps.some((step) =>
    [...modeByPrefix.keys()].some((prefix) => step.planStepId.startsWith(`${prefix}-`)),
  )
  const sourceMacros = new Set(
    ir.sourceMap.flatMap((entry) => entry.domainSourceRef === undefined ? [] : [entry.domainSourceRef]),
  )
  const singleCanvasMode = modeByPrefix.size === 1 && !anyPrefixMatches && sourceMacros.size <= 1
    ? [...modeByPrefix.values()][0]
    : undefined

  return {
    ...ir,
    steps: ir.steps.map((step) => {
      const prefix = [...modeByPrefix.keys()].find((candidate) => step.planStepId.startsWith(`${candidate}-`))
      const domainSourceRef = ir.sourceMap.find((entry) => entry.planStepId === step.planStepId)?.domainSourceRef
      const verificationMode =
        step.verificationMode ??
        (domainSourceRef === undefined ? undefined : modeByMacroRef.get(domainSourceRef)) ??
        (prefix === undefined ? singleCanvasMode : modeByPrefix.get(prefix))
      if (verificationMode === undefined || verificationMode === STRICT_VERIFICATION_MODE) return step
      return {
        ...step,
        verificationMode,
        verificationRole: verificationRoleFor(step, ir),
        continueGate: verificationMode === 'UI_CHECK' ? uiOnlyGate(step.continueGate) : undefined,
        finalOraclePolicy: undefined,
      } as WorkflowStepV2
    }),
  }
}

/**
 * Editor canvas graphs (`nodes`/`connections`) are not BridgeFlow IR. When the
 * workflowRef matches a pack independent workflow/fragment with exactly one
 * macro expansion, compile that macro's generic IR instead of failing on the
 * canvas shape.
 */
function materializeWorkflowIr(
  bundle: DomainPackBundle,
  workflowRef: string,
  workflowIr: unknown,
): { ok: true; ir: WorkflowIrV2 } | { ok: false; issue: CompileIssues[number] } {
  if (isWorkflowIrV2(workflowIr)) {
    return { ok: true, ir: applyCanvasVerificationModes(workflowIr, workflowIr) }
  }

  const workflow =
    bundle.registries.independentWorkflows.find((entry) => entry.workflowKey === workflowRef) ??
    bundle.registries.fragments.find((entry) => entry.fragmentKey === workflowRef)

  if (workflow === undefined) {
    return {
      ok: false,
      issue: {
        severity: 'ERROR',
        code: 'INVALID_WORKFLOW_IR',
        message:
          `workflowIr is not WorkflowIrV2 and "${workflowRef}" is not a pack independent ` +
          `workflow/fragment that can supply a macro expansion`,
      },
    }
  }

  const macros = macrosForWorkflow(bundle, workflowRef)
  const snapshots = macros
    .map((macro) => macro.expansionSnapshot)
    .filter((snapshot): snapshot is MacroExpansionSnapshot => snapshot !== undefined)

  if (snapshots.length === 1) {
    const ir = snapshots[0]!.genericIr
    if (
      Array.isArray((workflowIr as { nodes?: unknown })?.nodes) &&
      irRequiresStartupPermissions(ir) &&
      !canvasHasNodeType(workflowIr, 'GRANT_PERMISSIONS')
    ) {
      return {
        ok: false,
        issue: {
          severity: 'ERROR',
          code: 'MISSING_STARTUP_PERMISSION_STEP',
          message: 'Grant Permissions must be present between Launch App and Auth / Login.',
        },
      }
    }
    return { ok: true, ir: applyCanvasVerificationModes(ir, workflowIr) }
  }

  return {
    ok: false,
    issue: {
      severity: 'ERROR',
      code: 'INVALID_WORKFLOW_IR',
      message:
        `workflow "${workflowRef}" has ${snapshots.length} macro expansion snapshot(s); ` +
        `canvas/empty IR can only auto-materialize when exactly one snapshot exists`,
    },
  }
}

export function createBridgeFlowCompileService(
  planStore: CompiledPlanStore = defaultCompiledPlanStore,
  options: BridgeFlowCompileAdapterOptions = {},
): WorkflowCompileService {
  const resolvePack = options.resolvePack ?? resolveDomainPack
  const deviceCapabilities =
    options.deviceCapabilities ?? deriveCapabilityManifest(BRIDGE_PROTOCOL_VERSION)

  return new WorkflowCompileService(
    (request) => {
      const resolution = resolvePack({
        packKey: request.domainPackKey,
        packVersion: request.domainPackVersion,
        packDigest: request.domainPackDigest,
      })

      if (!resolution.ok) {
        return {
          ok: false,
          issues: [{ severity: 'ERROR', code: resolution.code, message: resolution.message }],
        }
      }

      const bundle = resolution.pack.bundle
      const macros = macrosForWorkflow(bundle, request.workflowRef)
      const expansionSnapshots = macros
        .map((macro) => macro.expansionSnapshot)
        .filter((snapshot): snapshot is MacroExpansionSnapshot => snapshot !== undefined)

      const materialized = materializeWorkflowIr(bundle, request.workflowRef, request.workflowIr)
      if (!materialized.ok) {
        return { ok: false, issues: [materialized.issue] }
      }

      const result = compileDomainWorkflow({
        bundle,
        workflowIr: materialized.ir,
        macros,
        expansionSnapshots,
        deviceCapabilities,
      })

      if (!result.ok || result.plan === undefined) {
        return { ok: false, issues: toCompileIssues(result.issues) }
      }

      return {
        ok: true,
        plan: result.plan as unknown as StoredBridgeFlowPlan,
        issues: toCompileIssues(result.issues),
      }
    },
    'BRIDGEFLOW',
    planStore,
  )
}
