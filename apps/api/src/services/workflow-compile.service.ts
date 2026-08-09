import { createHash } from 'node:crypto'

export const WORKFLOW_COMPILE_API_VERSION = 'verdict-runtime.v1' as const

export interface CompiledPlanSummary {
  planId: string
  entryStepId: string
  packDigest: string
  hash: { algorithm: string; digest: string }
  provenance: {
    packKey: string
    packVersion: string
    packDigest: string
    compilerVersion: string
  }
  steps: readonly { planStepId: string; sourceMapRef: string }[]
}

export type StoredBridgeFlowPlan = CompiledPlanSummary & Record<string, unknown>

export interface CompiledPlanStore {
  put(plan: StoredBridgeFlowPlan): void | Promise<void>
  get(input: { planRef: string; planHash: string }): StoredBridgeFlowPlan | undefined | Promise<StoredBridgeFlowPlan | undefined>
}

export class InMemoryCompiledPlanStore implements CompiledPlanStore {
  private readonly byRef = new Map<string, StoredBridgeFlowPlan>()
  private readonly byHash = new Map<string, StoredBridgeFlowPlan>()

  put(plan: StoredBridgeFlowPlan): void {
    this.byRef.set(plan.planId, plan)
    this.byHash.set(plan.hash.digest, plan)
  }

  get(input: { planRef: string; planHash: string }): StoredBridgeFlowPlan | undefined {
    return this.byHash.get(input.planHash) ?? this.byRef.get(input.planRef)
  }
}

export const defaultCompiledPlanStore = new InMemoryCompiledPlanStore()

export interface WorkflowCompileRequest {
  workflowRef: string
  workflowIr: unknown
  domainPackKey: string
  domainPackVersion: string
  domainPackDigest: string
}

export type WorkflowCompilerKind = 'STUB' | 'BRIDGEFLOW'

export interface WorkflowCompileResult {
  apiVersion: typeof WORKFLOW_COMPILE_API_VERSION
  ok: boolean
  /** Which compiler produced this result — never silent about stubs. */
  compilerKind: WorkflowCompilerKind
  compiledPlanRef: string
  compiledPlanHash: string
  sourceMap: Readonly<Record<string, string>>
  provenance: {
    packKey: string
    packVersion: string
    packDigest: string
    compilerVersion: string
  }
  issues: readonly { severity: 'ERROR' | 'WARNING' | 'INFO'; code: string; message: string; nodeId?: string }[]
  plan?: Pick<CompiledPlanSummary, 'planId' | 'entryStepId' | 'hash'>
}

/**
 * Versioned compile BFF. Does not embed a local fallback compiler algorithm —
 * callers supply a compile function (normally @nesy/bridgeflow-compiler).
 */
export class WorkflowCompileService {
  constructor(
    private readonly compile: (request: WorkflowCompileRequest) => {
      ok: boolean
      plan?: StoredBridgeFlowPlan
      issues?: WorkflowCompileResult['issues']
    },
    private readonly compilerKind: WorkflowCompilerKind = 'BRIDGEFLOW',
    private readonly planStore?: CompiledPlanStore,
  ) {}

  compileWorkflow(request: WorkflowCompileRequest): WorkflowCompileResult {
    // Provenance pinning is validated before the compile function runs: a plan
    // whose domain pack is not pinned cannot be attributed to a published pack,
    // so it must never reach the UI as a successful compile.
    const unpinned = (
      [
        ['workflowRef', request.workflowRef],
        ['domainPackKey', request.domainPackKey],
        ['domainPackVersion', request.domainPackVersion],
        ['domainPackDigest', request.domainPackDigest],
      ] as const
    ).filter(([, value]) => value.trim() === '')

    if (unpinned.length > 0) {
      return {
        apiVersion: WORKFLOW_COMPILE_API_VERSION,
        ok: false,
        compilerKind: this.compilerKind,
        compiledPlanRef: '',
        compiledPlanHash: '',
        sourceMap: {},
        provenance: {
          packKey: request.domainPackKey,
          packVersion: request.domainPackVersion,
          packDigest: request.domainPackDigest,
          compilerVersion: 'bridgeflow-compiler',
        },
        issues: unpinned.map(([field]) => ({
          severity: 'ERROR' as const,
          code: 'UNPINNED_COMPILE_REQUEST',
          message: `${field} is required to pin a compiled plan to a domain pack`,
        })),
      }
    }

    const compiled = this.compile(request)
    if (!compiled.ok || compiled.plan === undefined) {
      return {
        apiVersion: WORKFLOW_COMPILE_API_VERSION,
        ok: false,
        compilerKind: this.compilerKind,
        compiledPlanRef: '',
        compiledPlanHash: '',
        sourceMap: {},
        provenance: {
          packKey: request.domainPackKey,
          packVersion: request.domainPackVersion,
          packDigest: request.domainPackDigest,
          compilerVersion: 'bridgeflow-compiler',
        },
        issues: compiled.issues ?? [
          {
            severity: 'ERROR',
            code: 'COMPILE_FAILED',
            message: 'workflow compilation failed',
          },
        ],
      }
    }

    const plan = compiled.plan
    void this.planStore?.put(plan)
    const sourceMap: Record<string, string> = {}
    for (const step of plan.steps) {
      sourceMap[step.planStepId] = step.sourceMapRef
    }

    return {
      apiVersion: WORKFLOW_COMPILE_API_VERSION,
      ok: true,
      compilerKind: this.compilerKind,
      compiledPlanRef: plan.planId,
      compiledPlanHash: plan.hash.digest,
      sourceMap,
      provenance: {
        packKey: plan.provenance.packKey,
        packVersion: plan.provenance.packVersion,
        packDigest: plan.packDigest,
        compilerVersion: plan.provenance.compilerVersion,
      },
      issues: compiled.issues ?? [],
      plan: {
        planId: plan.planId,
        entryStepId: plan.entryStepId,
        hash: plan.hash,
      },
    }
  }
}

/**
 * Deterministic stub compile used by local Phase 5/6 contract tests and the
 * production route until the real BridgeFlowCompiler adapter is wired.
 * Responses always carry `compilerKind: "STUB"` so the UI can warn.
 */
export function createHashPinnedCompileStub(
  planStore: CompiledPlanStore = defaultCompiledPlanStore,
): WorkflowCompileService {
  return new WorkflowCompileService((request) => {
    const digest = createHash('sha256')
      .update(JSON.stringify(request.workflowIr))
      .update(request.domainPackDigest)
      .digest('hex')
    const planId = `plan:${request.workflowRef}`
    const ir = request.workflowIr as { entryStepId?: string; steps?: { planStepId: string; sourceMapRef?: string }[] }
    const rawSteps =
      Array.isArray(ir.steps) && ir.steps.length > 0
        ? ir.steps
        : [{ planStepId: ir.entryStepId ?? 'step-1' }]
    const entryStepId = ir.entryStepId ?? rawSteps[0]?.planStepId ?? 'step-1'
    const sourceMap = rawSteps.map((step) => ({
      planStepId: step.planStepId,
      irStepId: step.planStepId,
      note: 'hash-pinned compile stub',
    }))
    return {
      ok: true,
      plan: {
        schemaVersion: 1,
        planId,
        workflowRef: request.workflowRef,
        workflowVersion: 1,
        entryStepId,
        packDigest: request.domainPackDigest,
        hash: { algorithm: 'sha256', digest: `sha256:${digest}` },
        provenance: {
          compiledAt: new Date(0).toISOString(),
          packKey: request.domainPackKey,
          packVersion: request.domainPackVersion,
          packDigest: request.domainPackDigest,
          compilerVersion: 'bridgeflow-compiler-stub',
          workflowRef: request.workflowRef,
          workflowVersion: 1,
          irHash: `sha256:${digest}`,
          derivedGraphDigest: `sha256:${digest}`,
        },
        packVersion: request.domainPackVersion as never,
        appCompatibilityRefs: [],
        adapterCompatibilityRefs: [],
        steps: rawSteps.map((step, index) => ({
          planStepId: step.planStepId,
          kind: 'NOOP' as const,
          sourceMapRef: step.sourceMapRef ?? `src:${step.planStepId}`,
          timeoutMs: 1_000,
          next: rawSteps[index + 1]?.planStepId ?? null,
          capabilityRequirements: [],
          evidenceRequirements: [],
          params: { reason: 'hash-pinned compile stub' },
        })),
        waitPlans: [],
        capabilityManifest: { required: [], optional: [], gaps: [] },
        evidenceManifest: {
          continueGateRequirements: [],
          finalOracleRequirements: [],
          derivedGraphDigest: `sha256:${digest}`,
          factDeliveryLanes: [],
        },
        resourceRequirements: [],
        domainDependencies: [],
        sourceMap,
      },
      issues: [
        {
          severity: 'WARNING',
          code: 'STUB_COMPILER',
          message:
            'Compile used the hash-pinned stub; CHECKPOINT 6 canvas error binding requires the real BridgeFlowCompiler',
        },
      ],
    }
  }, 'STUB', planStore)
}
