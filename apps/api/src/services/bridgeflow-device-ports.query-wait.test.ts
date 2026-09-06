import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BridgeFlowExecutor, InMemoryExecutionPersistence, createInMemoryMutationAdmission } from '@nesy/bridgeflow-executor'
import type { StepExecutionContext } from '@nesy/bridgeflow-executor'
import type { BridgeFlowPlan } from '@nesy/bridgeflow-compiler'
import type { ControlExecutor } from '@nesy/control-contract'

import { createGenericStepRuntime } from './bridgeflow-device-ports.js'
import { createBridgeFlowCompileService } from './bridgeflow-compile-adapter.js'
import { InMemoryCompiledPlanStore } from './workflow-compile.service.js'
import { listDomainPacks } from './domain-pack-registry.js'
import { BridgeFlowRunContext } from './bridgeflow-run-context.js'
import { SdkObservationStore } from './sdk-observation-store.js'
import type { BridgeDeviceManager } from './bridge-device-manager.js'

const pack = listDomainPacks()[0]!
const store = new InMemoryCompiledPlanStore()
const compiled = createBridgeFlowCompileService(store).compileWorkflow({
  workflowRef: 'nesy.workflow.full-courier-day',
  workflowIr: pack.bundle.registries.macros.find(m => m.macroKey === 'nesy.macro.full-courier-day')!.expansionSnapshot!.genericIr,
  domainPackKey: pack.packKey,
  domainPackVersion: pack.packVersion,
  domainPackDigest: pack.packDigest,
})
if (!compiled.ok) throw new Error(JSON.stringify(compiled.issues))
const plan = store.get({ planRef: compiled.compiledPlanRef, planHash: compiled.compiledPlanHash }) as unknown as BridgeFlowPlan
const context = { requestId: 'read-1', occurrenceId: 'run-1:read:0', iterationKey: 'root' } as StepExecutionContext

function harness(rowsAt: (time: number) => unknown[], stepId = 'load-read-parcel-state') {
  const run = vi.fn(async () => ({ ok: true, data: { rows: rowsAt(Date.now()) } }))
  const variables = new BridgeFlowRunContext()
  const observations = new SdkObservationStore()
  const record = vi.spyOn(observations, 'record')
  const runtime = createGenericStepRuntime({
    manager: { deviceId: 'device-1' } as BridgeDeviceManager,
    variables,
    observations,
    controlExecutor: { run } as unknown as ControlExecutor,
    bundle: pack.bundle,
    runId: 'run-1',
    runInputs: { scanValue: 'requested-parcel' },
  })
  const step = { ...plan.steps.find(s => s.planStepId === stepId)!, timeoutMs: 2_000 }
  return { run, runtime, variables, record, step }
}

describe('loading waits for stored observations', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0) })
  afterEach(() => vi.useRealTimers())

  it('waits for the requested parcel and publishes no transient negative facts', async () => {
    const h = harness(time => time < 1_250 ? [] : [{ barcode: 'requested-parcel' }])
    const pending = h.runtime.execute(h.step, context)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(h.record).not.toHaveBeenCalled()
    expect(h.variables.get('loadItemRows')).toBeUndefined()
    await vi.advanceTimersByTimeAsync(250)
    expect((await pending).succeeded).toBe(true)
    expect(h.record).toHaveBeenCalledWith('run-1', expect.objectContaining({ value: true, correlationValue: 'requested-parcel' }))
    const calls = h.run.mock.calls as unknown as [string, { requestId: string; params: { barcode: string }; op: string }][]
    expect(calls.every(([, op]) => op.op === 'sql_named' && op.params.barcode === 'requested-parcel')).toBe(true)
    expect(new Set(calls.map(([, op]) => op.requestId)).size).toBe(calls.length)
  })

  it('does not accept the earlier empty route schedule as a completed load', async () => {
    const h = harness(time => [{ schedule_body_stored: time < 750 ? 'false' : 'true' }], 'load-read-local-schedule')
    const pending = h.runtime.execute(h.step, context)
    await vi.advanceTimersByTimeAsync(500)
    expect(h.record).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(250)
    expect((await pending).succeeded).toBe(true)
    expect(h.record).toHaveBeenCalledWith('run-1', expect.objectContaining({ factKey: 'LOCAL.SCHEDULE_BODY_STORED', value: true }))
  })

  it('waits for the app stop list independently of the local parcel write', async () => {
    const h = harness(time => time < 1_500 ? [] : [{ stop_id: 'stop-1' }], 'load-read-available-stops')
    const pending = h.runtime.execute(h.step, context)
    await vi.advanceTimersByTimeAsync(1_500)
    expect((await pending).succeeded).toBe(true)
    expect(h.record).toHaveBeenCalledWith('run-1', expect.objectContaining({ factKey: 'APP.AVAILABLE_STOPS_LOADED', value: true }))
  })

  it('times out without publishing a false product verdict or running a reset', async () => {
    const h = harness(() => [])
    const pending = h.runtime.execute(h.step, context)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(await pending).toMatchObject({ succeeded: false, actionResult: 'FAILED', evidenceRef: expect.stringContaining('observation-timeout') })
    expect(h.record).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not treat a missing projected column as true', async () => {
    const h = harness(() => [{}], 'load-read-local-schedule')
    const pending = h.runtime.execute(h.step, context)
    await vi.advanceTimersByTimeAsync(2_000)
    expect((await pending).actionResult).toBe('FAILED')
    expect(h.record).not.toHaveBeenCalled()
  })

  it('preserves one-shot reads that legitimately return an empty result', async () => {
    const h = harness(() => [], 'route-read-available-stops')
    expect((await h.runtime.execute(h.step, context)).succeeded).toBe(true)
    expect(h.run).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('fails immediately on a control error instead of retrying it as missing data', async () => {
    const h = harness(() => [])
    h.run.mockResolvedValueOnce({ ok: false, code: 'UNAVAILABLE' } as never)
    expect((await h.runtime.execute(h.step, context)).actionResult).toBe('FAILED')
    expect(h.run).toHaveBeenCalledOnce()
    expect(h.record).not.toHaveBeenCalled()
  })

  it('does not log out a failed full-day run even after login has executed', async () => {
    const h = harness(() => [])
    const persistence = new InMemoryExecutionPersistence()
    const execute = vi.spyOn(h.runtime, 'execute')
    const executor = new BridgeFlowExecutor({
      persistence,
      mutationAdmission: createInMemoryMutationAdmission(),
      genericSteps: h.runtime,
      bridge: {
        act: async () => ({ terminalState: 'SUCCEEDED', effectVerified: true, evidenceRef: 'test-login' }),
        waitAny: async () => ({ status: 'TIMEOUT', elapsedMs: 0 }),
        cancelWait: async () => ({}), cancelAction: async () => ({}),
      },
      evidence: { factsForOccurrence: () => [] },
      variables: h.variables,
      conditionContext: h.variables.conditionContext(),
      clock: Date.now,
    })
    const login = plan.steps.find(s => s.planStepId === 'auth-tap-submit')!
    const cleanup = plan.steps.find(s => s.planStepId === 'auth-clear-session')!
    const pending = executor.execute({
      runId: 'run-1', deviceId: 'device-1',
      plan: { ...plan, entryStepId: login.planStepId, steps: [
        { ...login, next: h.step.planStepId, continueGate: undefined },
        { ...h.step, next: null }, cleanup,
      ] },
    })
    await vi.advanceTimersByTimeAsync(2_000)
    await pending
    expect(persistence.stepOccurrences.map(s => s.planStepId)).toEqual(['auth-tap-submit', 'load-read-parcel-state'])
    expect(execute.mock.calls.some(([step]) => step.kind === 'CLEANUP')).toBe(false)
  })
})
