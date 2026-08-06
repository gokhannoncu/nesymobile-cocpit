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

export interface WorkflowCompileRequest {
  workflowRef: string
  workflowIr: unknown
  domainPackKey: string
  domainPackVersion: string
  domainPackDigest: string
}

export interface WorkflowCompileResult {
  apiVersion: typeof WORKFLOW_COMPILE_API_VERSION
  ok: boolean
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
      plan?: CompiledPlanSummary
      issues?: WorkflowCompileResult['issues']
    },
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
    const sourceMap: Record<string, string> = {}
    for (const step of plan.steps) {
      sourceMap[step.planStepId] = step.sourceMapRef
    }

    return {
      apiVersion: WORKFLOW_COMPILE_API_VERSION,
      ok: true,
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

/** Deterministic stub compile used by local Phase 5/6 contract tests. */
export function createHashPinnedCompileStub(): WorkflowCompileService {
  return new WorkflowCompileService((request) => {
    const digest = createHash('sha256')
      .update(JSON.stringify(request.workflowIr))
      .update(request.domainPackDigest)
      .digest('hex')
    const planId = `plan:${request.workflowRef}`
    const ir = request.workflowIr as { entryStepId?: string; steps?: { planStepId: string }[] }
    const entryStepId = ir.entryStepId ?? 'step-1'
    return {
      ok: true,
      plan: {
        planId,
        entryStepId,
        packDigest: request.domainPackDigest,
        hash: { algorithm: 'sha256', digest: `sha256:${digest}` },
        provenance: {
          packKey: request.domainPackKey,
          packVersion: request.domainPackVersion,
          packDigest: request.domainPackDigest,
          compilerVersion: 'bridgeflow-compiler',
        },
        steps: [{ planStepId: entryStepId, sourceMapRef: `src:${entryStepId}` }],
      },
      issues: [],
    }
  })
}
