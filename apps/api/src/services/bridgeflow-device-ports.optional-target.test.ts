import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildNesyCourierBundle } from '@nesy/nesy-courier-domain-pack'
import type { BridgeFlowPlanStep } from '@nesy/bridgeflow-compiler'
import type { TargetResolutionEvidence } from '@nesy/bridge-contract'
import type { StepExecutionContext } from '@nesy/bridgeflow-executor'

import { createBridgeRuntimePort, createGenericStepRuntime } from './bridgeflow-device-ports.js'
import { BridgeFlowRunContext } from './bridgeflow-run-context.js'
import type { BridgeDeviceManager } from './bridge-device-manager.js'

const PICKER = 'nesy.target.time-slot-confirm'
const PROBE = 'nesy.target.dialog-acknowledge'
const context = { requestId: 'req-1' } as StepExecutionContext

function harness(appearsAtMs: number, targetRef = PICKER, outcome?: TargetResolutionEvidence['outcome']) {
  const bundle = buildNesyCourierBundle()
  const target = bundle.registries.targets.find((entry) => entry.targetKey === targetRef)!
  const variables = new BridgeFlowRunContext()
  const resolve = vi.fn(async (fingerprint: TargetResolutionEvidence['fingerprint']) => ({
    fingerprint,
    outcome: outcome ?? (Date.now() >= appearsAtMs ? 'RESOLVED_UNIQUE' : 'NOT_FOUND'),
    strength: 'STRONG',
    treeGen: 7,
  } as TargetResolutionEvidence))
  const act = vi.fn(async () => ({
    requestId: 'req-tap',
    terminalState: 'SUCCEEDED',
    method: 'ACCESSIBILITY',
    contaminated: false,
  }))
  const dump = vi.fn()
  const manager = { resolve, act, dump } as unknown as BridgeDeviceManager
  const runtime = createGenericStepRuntime({ manager, variables, bundle, runId: 'run-1' })
  const bridge = createBridgeRuntimePort({ manager, variables, runId: 'run-1' })
  const step = {
    planStepId: 'load-resolve-time-slot',
    kind: 'RESOLVE_TARGET',
    timeoutMs: 10_000,
    params: { targetRef, outputVariable: 'target' },
  } as BridgeFlowPlanStep
  const tap = () => bridge.act({
    planStepId: 'load-tap-time-slot',
    kind: 'BRIDGE_ACTION',
    timeoutMs: 10_000,
    params: { action: 'tap', targetVariable: 'target' },
  } as BridgeFlowPlanStep, context)
  return { runtime, step, target, variables, resolve, act, dump, tap }
}

describe('optional targets that appear after an asynchronous action', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })
  afterEach(() => vi.useRealTimers())

  it('finds and taps the delayed picker instead of skipping it', async () => {
    // run_c03e5606: the first probe preceded the shipment response; the picker
    // appeared about 430 ms later, after the absent marker had already won.
    const h = harness(430)
    let settled = false
    const pending = h.runtime.execute(h.step, context).then((result) => {
      settled = true
      return result
    })
    await vi.advanceTimersByTimeAsync(499)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    const result = await pending
    expect(result.succeeded).toBe(true)
    expect(result.output).not.toHaveProperty('absentTarget')
    h.variables.set('target', result.output)
    await expect(h.tap()).resolves.toMatchObject({ terminalState: 'SUCCEEDED', effectVerified: true })
    expect(h.act).toHaveBeenCalledOnce()
    expect(h.resolve).toHaveBeenCalledTimes(3)
    expect(h.dump).not.toHaveBeenCalled()
  })

  it('declares absence only at the deadline, then skips without touching the device', async () => {
    const h = harness(Infinity)
    let settled = false
    const pending = h.runtime.execute(h.step, context).then((result) => {
      settled = true
      return result
    })
    await vi.advanceTimersByTimeAsync(h.target.resolution.deadlineMs - 1)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    const result = await pending
    expect(result.output).toEqual({ absentTarget: true, targetRef: PICKER })
    h.variables.set('target', result.output)
    await expect(h.tap()).resolves.toMatchObject({ terminalState: 'SKIPPED', effectVerified: false })
    expect(h.act).not.toHaveBeenCalled()
    expect(h.dump).not.toHaveBeenCalled()
    // Absence is expected: do not sweep other surfaces to make it disappear.
    expect(h.resolve.mock.calls.every(([fp]) => fp.selector.value === 'btnSave')).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('accepts a picker that appears on the final deadline probe', async () => {
    const h = harness(8_000)
    const pending = h.runtime.execute(h.step, context)
    await vi.advanceTimersByTimeAsync(8_000)
    expect((await pending).output).not.toHaveProperty('absentTarget')
    expect(h.act).not.toHaveBeenCalled()
  })

  it('returns immediately when the picker is already present', async () => {
    const h = harness(0)
    const result = await h.runtime.execute(h.step, context)
    expect(result.succeeded).toBe(true)
    expect(result.output).not.toHaveProperty('absentTarget')
    expect(h.resolve).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['AMBIGUOUS', 'STALE_TREE'] as const)('fails on %s without tolerating or retrying it', async (outcome) => {
    const h = harness(Infinity, PICKER, outcome)
    const result = await h.runtime.execute(h.step, context)
    expect(result.succeeded).toBe(false)
    expect(result.output).toBeUndefined()
    expect(h.resolve).toHaveBeenCalledOnce()
    expect(h.act).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps immediate absence probes immediate', async () => {
    const h = harness(Infinity, PROBE)
    const result = await h.runtime.execute(h.step, context)
    expect(result.output).toEqual({ absentTarget: true, targetRef: PROBE })
    expect(h.resolve).toHaveBeenCalledOnce()
    expect(h.act).not.toHaveBeenCalled()
    expect(h.dump).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('waits through a transient unavailable root while the picker opens', async () => {
    const h = harness(0)
    h.resolve.mockImplementationOnce(async fingerprint => ({
      fingerprint, outcome: 'TREE_UNAVAILABLE', strength: 'STRONG', treeGen: 7,
    } as TargetResolutionEvidence))
    const pending = h.runtime.execute(h.step, context)
    await vi.advanceTimersByTimeAsync(250)
    const result = await pending
    expect(result.succeeded).toBe(true)
    expect(result.output).not.toHaveProperty('absentTarget')
    expect(h.resolve).toHaveBeenCalledTimes(2)
    expect(h.act).not.toHaveBeenCalled()
  })

  it('does not mistake an unavailable root at the deadline for optional absence', async () => {
    const h = harness(Infinity, PICKER, 'TREE_UNAVAILABLE')
    const pending = h.runtime.execute(h.step, context)
    await vi.advanceTimersByTimeAsync(h.target.resolution.deadlineMs)
    const result = await pending
    expect(result.succeeded).toBe(false)
    expect(result.output).toBeUndefined()
    expect(h.act).not.toHaveBeenCalled()
    expect(h.dump).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
