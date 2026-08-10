import { randomUUID } from 'node:crypto'
import type { WorkflowCompileResult } from './workflow-compile.service.js'

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
  /** Business inputs addressed by `run.input.<path>` (e.g. pin, sessionCorrelationId). */
  inputs?: Readonly<Record<string, unknown>>
}

export interface WorkflowRunStartResult {
  apiVersion: typeof WORKFLOW_RUN_API_VERSION
  runId: string
  executionId: string
  compiledPlanHash: string
  status: 'QUEUED'
  engineType: 'BRIDGEFLOW'
}

export interface WorkflowRunExecutionQueue {
  enqueue(input: {
    executionId: string
    runId: string
    workflowRef: string
    deviceId: string
    compiledPlanRef: string
    compiledPlanHash: string
    domainPackKey: string
    domainPackVersion: string
    domainPackDigest: string
    profileKey?: string
    profileVersion?: string
    releaseGate?: boolean
    inputs?: Readonly<Record<string, unknown>>
    dependencyKind: 'SETUP' | 'DEPENDENT' | 'INDEPENDENT'
  }): Promise<unknown> | unknown
}

/**
 * Persists accepted run starts so a retry after an API restart returns the
 * original run instead of queueing a second execution.
 */
export interface WorkflowRunStartStore {
  findByIdempotencyKey(idempotencyKey: string): Promise<WorkflowRunStartResult | undefined>
  insert(input: {
    idempotencyKey: string
    request: WorkflowRunStartRequest
    result: WorkflowRunStartResult
  }): Promise<void>
}

export class InMemoryWorkflowRunStartStore implements WorkflowRunStartStore {
  private readonly started = new Map<string, WorkflowRunStartResult>()

  async findByIdempotencyKey(idempotencyKey: string): Promise<WorkflowRunStartResult | undefined> {
    return this.started.get(idempotencyKey)
  }

  async insert(input: {
    idempotencyKey: string
    request: WorkflowRunStartRequest
    result: WorkflowRunStartResult
  }): Promise<void> {
    this.started.set(input.idempotencyKey, input.result)
  }
}

export function runStartIdempotencyKey(request: WorkflowRunStartRequest): string {
  const inputFingerprint = request.inputs === undefined ? '' : JSON.stringify(request.inputs)
  return [
    request.workflowRef,
    request.deviceId,
    request.compiledPlanHash,
    request.profileKey ?? 'default',
    request.profileVersion ?? 'unversioned',
    inputFingerprint,
  ].join('|')
}

export class WorkflowRunService {
  constructor(
    private readonly queue?: WorkflowRunExecutionQueue,
    private readonly store: WorkflowRunStartStore = new InMemoryWorkflowRunStartStore(),
  ) {}

  async startFromCompile(
    compile: WorkflowCompileResult,
    request: Omit<WorkflowRunStartRequest, 'compiledPlanRef' | 'compiledPlanHash'>,
  ): Promise<WorkflowRunStartResult> {
    if (!compile.ok || compile.compiledPlanHash === '') {
      throw new Error('cannot start run from failed compile')
    }
    return this.start({
      ...request,
      compiledPlanRef: compile.compiledPlanRef,
      compiledPlanHash: compile.compiledPlanHash,
    })
  }

  async start(request: WorkflowRunStartRequest): Promise<WorkflowRunStartResult> {
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

    const idempotencyKey = runStartIdempotencyKey(request)
    const existing = await this.store.findByIdempotencyKey(idempotencyKey)
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
    await this.store.insert({ idempotencyKey, request, result })
    void this.queue?.enqueue({
      executionId,
      runId,
      workflowRef: request.workflowRef,
      deviceId: request.deviceId,
      compiledPlanRef: request.compiledPlanRef,
      compiledPlanHash: request.compiledPlanHash,
      domainPackKey: request.domainPackKey,
      domainPackVersion: request.domainPackVersion,
      domainPackDigest: request.domainPackDigest,
      ...(request.profileKey === undefined ? {} : { profileKey: request.profileKey }),
      ...(request.profileVersion === undefined ? {} : { profileVersion: request.profileVersion }),
      ...(request.releaseGate === undefined ? {} : { releaseGate: request.releaseGate }),
      ...(request.inputs === undefined ? {} : { inputs: request.inputs }),
      dependencyKind: 'INDEPENDENT',
    })
    return result
  }
}
