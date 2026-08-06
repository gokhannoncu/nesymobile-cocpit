import { randomUUID } from 'node:crypto'
import type { WorkflowCompileResult } from './workflow-compile.service.js'
import type { TestExecutionQueue } from './test-execution-queue.js'

export const WORKFLOW_RUN_API_VERSION = 'verdict-runtime.v1' as const

export interface WorkflowRunStartRequest {
  workflowRef: string
  deviceId: string
  compiledPlanRef: string
  compiledPlanHash: string
  domainPackKey: string
  domainPackVersion: string
  domainPackDigest: string
  releaseGate?: boolean
  profileKey?: string
  profileVersion?: string
}

export interface WorkflowRunStartResult {
  apiVersion: typeof WORKFLOW_RUN_API_VERSION
  runId: string
  executionId: string
  compiledPlanHash: string
  status: 'QUEUED'
  engineType: 'BRIDGEFLOW'
}

export class WorkflowRunService {
  private readonly started = new Map<string, WorkflowRunStartResult>()

  constructor(private readonly queue?: TestExecutionQueue) {}

  startFromCompile(
    compile: WorkflowCompileResult,
    request: Omit<WorkflowRunStartRequest, 'compiledPlanRef' | 'compiledPlanHash'>,
  ): WorkflowRunStartResult {
    if (!compile.ok || compile.compiledPlanHash === '') {
      throw new Error('cannot start run from failed compile')
    }
    return this.start({
      ...request,
      compiledPlanRef: compile.compiledPlanRef,
      compiledPlanHash: compile.compiledPlanHash,
    })
  }

  start(request: WorkflowRunStartRequest): WorkflowRunStartResult {
    // The run surface is reachable directly (HTTP route), not only through
    // startFromCompile, so the pinning guard has to live here: a run that is
    // not bound to a compiled plan and a domain pack cannot be attributed to
    // any previewed plan, and its verdict would be unattributable.
    for (const [field, value] of [
      ['workflowRef', request.workflowRef],
      ['deviceId', request.deviceId],
      ['compiledPlanRef', request.compiledPlanRef],
      ['compiledPlanHash', request.compiledPlanHash],
      ['domainPackKey', request.domainPackKey],
      ['domainPackVersion', request.domainPackVersion],
      ['domainPackDigest', request.domainPackDigest],
    ] as const) {
      if (value.trim() === '') {
        throw new Error(`cannot start run: ${field} is required to pin the executed plan`)
      }
    }

    const idempotencyKey = [
      request.workflowRef,
      request.deviceId,
      request.compiledPlanHash,
      request.profileKey ?? 'default',
      request.profileVersion ?? 'unversioned',
    ].join('|')
    const existing = this.started.get(idempotencyKey)
    if (existing) return existing

    const runId = `run_${randomUUID()}`
    const executionId = `exec_${randomUUID()}`
    const result: WorkflowRunStartResult = {
      apiVersion: WORKFLOW_RUN_API_VERSION,
      runId,
      executionId,
      compiledPlanHash: request.compiledPlanHash,
      status: 'QUEUED',
      engineType: 'BRIDGEFLOW',
    }
    this.started.set(idempotencyKey, result)
    void this.queue?.enqueue({
      executionId,
      runId,
      workflowRef: request.workflowRef,
      dependencyKind: 'INDEPENDENT',
    })
    return result
  }
}
