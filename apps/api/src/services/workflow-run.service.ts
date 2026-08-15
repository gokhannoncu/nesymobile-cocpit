import { randomUUID } from 'node:crypto'
import {
  isInjectedFaultHost,
  isInjectedFaultId,
  planInjectedFault,
  type InjectedFaultHost,
  type InjectedFaultId,
  type InjectedFaultPlan,
} from '@nesy/workflow-contract'

import type { WorkflowCompileResult } from './workflow-compile.service.js'

export const WORKFLOW_RUN_API_VERSION = 'verdict-runtime.v1' as const

export interface WorkflowRunStartRequest {
  workflowRef: string
  deviceId: string
  /** Runtime application package selected by the panel/env (e.g. com.arasdigital.nesymobile.rstest). */
  appId?: string
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
  /** G90.9 input axis. Omit or null on every uninjected run. */
  injectedFault?: InjectedFaultId | null
  injectedFaultHost?: InjectedFaultHost | null
}

export interface WorkflowRunStartResult {
  apiVersion: typeof WORKFLOW_RUN_API_VERSION
  runId: string
  executionId: string
  compiledPlanHash: string
  status: 'QUEUED'
  engineType: 'BRIDGEFLOW'
  injectedFault: InjectedFaultId | null
  expectedClass: InjectedFaultPlan['expectedClass']
  injectedFaultHost: InjectedFaultHost | null
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
    appId?: string
    inputs?: Readonly<Record<string, unknown>>
    injectedFault?: InjectedFaultId | null
    injectedFaultHost?: InjectedFaultHost | null
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
    request.appId?.trim() ?? 'pack-default',
    request.compiledPlanHash,
    request.profileKey ?? 'default',
    request.profileVersion ?? 'unversioned',
    inputFingerprint,
    request.injectedFault ?? 'null',
    request.injectedFaultHost ?? 'none',
  ].join('|')
}

export function resolveStartInjectedFault(request: Pick<WorkflowRunStartRequest, 'injectedFault' | 'injectedFaultHost'>): InjectedFaultPlan {
  return planInjectedFault({
    injectedFault: request.injectedFault ?? null,
    injectedFaultHost: request.injectedFaultHost ?? null,
  })
}

export function parseInjectedFaultBody(body: Record<string, unknown>): Pick<WorkflowRunStartRequest, 'injectedFault' | 'injectedFaultHost'> {
  if (body.observedClass !== undefined && body.observedClass !== null) {
    throw new Error('observedClass is an output axis and cannot be set at run start')
  }
  if (body.expectedClass !== undefined && body.expectedClass !== null) {
    throw new Error('expectedClass is derived from injectedFault and cannot be set at run start')
  }
  if (body.deathProvenance !== undefined && body.deathProvenance !== null) {
    throw new Error('deathProvenance is an observation and cannot be set at run start')
  }

  const rawFault = body.injectedFault
  if (rawFault === undefined || rawFault === null || rawFault === '') {
    if (body.injectedFaultHost !== undefined && body.injectedFaultHost !== null && body.injectedFaultHost !== '') {
      throw new Error('injectedFaultHost requires injectedFault')
    }
    return { injectedFault: null, injectedFaultHost: null }
  }
  if (!isInjectedFaultId(rawFault)) {
    throw new Error(`unknown injectedFault "${String(rawFault)}"`)
  }
  const rawHost = body.injectedFaultHost
  if (!isInjectedFaultHost(rawHost)) {
    throw new Error(`injectedFault ${rawFault} requires injectedFaultHost A|B`)
  }
  return { injectedFault: rawFault, injectedFaultHost: rawHost }
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

    const faultPlan = resolveStartInjectedFault(request)
    const runId = `run_${randomUUID()}`
    const executionId = `exec_${randomUUID()}`
    const result: WorkflowRunStartResult = {
      apiVersion: WORKFLOW_RUN_API_VERSION,
      runId,
      executionId,
      compiledPlanHash: request.compiledPlanHash,
      status: 'QUEUED',
      engineType: 'BRIDGEFLOW',
      injectedFault: faultPlan.injectedFault,
      expectedClass: faultPlan.expectedClass,
      injectedFaultHost: faultPlan.injectedFaultHost,
    }
    await this.store.insert({ idempotencyKey, request, result })
    void this.queue?.enqueue({
      executionId,
      runId,
      workflowRef: request.workflowRef,
      deviceId: request.deviceId,
      ...(request.appId === undefined ? {} : { appId: request.appId }),
      compiledPlanRef: request.compiledPlanRef,
      compiledPlanHash: request.compiledPlanHash,
      domainPackKey: request.domainPackKey,
      domainPackVersion: request.domainPackVersion,
      domainPackDigest: request.domainPackDigest,
      ...(request.profileKey === undefined ? {} : { profileKey: request.profileKey }),
      ...(request.profileVersion === undefined ? {} : { profileVersion: request.profileVersion }),
      ...(request.releaseGate === undefined ? {} : { releaseGate: request.releaseGate }),
      ...(request.inputs === undefined ? {} : { inputs: request.inputs }),
      injectedFault: faultPlan.injectedFault,
      injectedFaultHost: faultPlan.injectedFaultHost,
      dependencyKind: 'INDEPENDENT',
    })
    return result
  }
}
