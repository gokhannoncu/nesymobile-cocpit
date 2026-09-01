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
import type { WorkflowIrV2 } from '@nesy/workflow-contract'

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
    return { ok: true, ir: workflowIr }
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
    return { ok: true, ir }
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
