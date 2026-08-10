import { describe, expect, it } from 'vitest'
import { buildNesyCourierBundle } from '@nesy/nesy-courier-domain-pack'
import type { BridgeFlowPlan } from '@nesy/bridgeflow-compiler'
import {
  BridgeFlowExecutor,
  InMemoryExecutionPersistence,
  createInMemoryMutationAdmission,
} from '@nesy/bridgeflow-executor'

import { createBridgeFlowCompileService } from './bridgeflow-compile-adapter.js'
import { BridgeFlowExecutionQueue } from './bridgeflow-execution-queue.js'
import { createBridgeRuntimePort, createGenericStepRuntime } from './bridgeflow-device-ports.js'
import { BridgeFlowRunContext } from './bridgeflow-run-context.js'
import { buildTargetFingerprint } from './bridgeflow-target-fingerprint.js'
import { listDomainPacks, resolveDomainPack } from './domain-pack-registry.js'
import { InMemoryCompiledPlanStore } from './workflow-compile.service.js'
import type { BridgeDeviceManager } from './bridge-device-manager.js'
import { BridgeUnavailableError } from './bridge-device-manager.js'

const PACK = listDomainPacks()[0]!

describe('BridgeFlow compile adapter', () => {
  it('publishes more than one first-party pack so core stays app-agnostic', () => {
    const packs = listDomainPacks()
    expect(packs.map((pack) => pack.packKey)).toEqual(
      expect.arrayContaining(['nesy.courier', 'match.reaction']),
    )
    const second = packs.find((pack) => pack.packKey === 'match.reaction')
    expect(second?.bundle.registries.macros[0]?.expansionSnapshot?.authoredBy).toBe('COMPILER')
    expect(resolveDomainPack({
      packKey: 'match.reaction',
      packVersion: second!.packVersion,
      packDigest: second!.packDigest,
    }).ok).toBe(true)
  })

  it('compiles every pack macro into real plan steps, not the stub NOOP plan', () => {
    const store = new InMemoryCompiledPlanStore()
    const service = createBridgeFlowCompileService(store)
    const bundle = buildNesyCourierBundle()
    const snapshots = bundle.registries.macros.flatMap((macro) =>
      macro.expansionSnapshot === undefined ? [] : [macro.expansionSnapshot],
    )
    expect(snapshots.length).toBeGreaterThan(0)

    const kinds = new Set<string>()
    for (const snapshot of snapshots) {
      const ir = snapshot.genericIr
      const result = service.compileWorkflow({
        workflowRef: ir.workflowId,
        workflowIr: ir,
        domainPackKey: PACK.packKey,
        domainPackVersion: PACK.packVersion,
        domainPackDigest: PACK.packDigest,
      })

      expect(result.issues.filter((issue) => issue.severity === 'ERROR')).toEqual([])
      expect(result.ok).toBe(true)
      expect(result.compilerKind).toBe('BRIDGEFLOW')
      expect(result.provenance.compilerVersion).not.toContain('stub')

      const plan = store.get({
        planRef: result.compiledPlanRef,
        planHash: result.compiledPlanHash,
      }) as unknown as BridgeFlowPlan | undefined
      expect(plan).toBeDefined()
      for (const step of plan!.steps) kinds.add(step.kind)
    }

    // The stub compiled every step to NOOP, so control flow could never reach
    // the executor. These are the kinds that proves it now does.
    expect(kinds.has('CONDITION')).toBe(true)
    expect(kinds.has('SWITCH')).toBe(true)
    expect(kinds.has('BRIDGE_ACTION')).toBe(true)
    expect(kinds.has('RESOLVE_TARGET')).toBe(true)
  })

  it('refuses a compile whose pinned pack digest this process cannot reproduce', () => {
    const service = createBridgeFlowCompileService(new InMemoryCompiledPlanStore())
    const result = service.compileWorkflow({
      workflowRef: 'wf',
      workflowIr: { schemaVersion: 2, steps: [] },
      domainPackKey: PACK.packKey,
      domainPackVersion: PACK.packVersion,
      domainPackDigest: 'sha256:not-the-published-digest',
    })

    expect(result.ok).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toContain('DOMAIN_PACK_DIGEST_MISMATCH')
  })

  it('reports an unknown pack instead of compiling against a substitute', () => {
    const service = createBridgeFlowCompileService(new InMemoryCompiledPlanStore())
    const result = service.compileWorkflow({
      workflowRef: 'wf',
      workflowIr: { schemaVersion: 2, steps: [] },
      domainPackKey: 'nesy.absent',
      domainPackVersion: '9.9.9',
      domainPackDigest: 'sha256:whatever',
    })

    expect(result.ok).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toContain('UNKNOWN_DOMAIN_PACK')
  })
})

describe('run condition context', () => {
  it('resolves variables, run inputs and observed facts, and reports the rest unresolved', () => {
    const context = new BridgeFlowRunContext({ runInputs: { courier: { id: 'c-1' } }, country: 'TR' })
    context.set('routeCount', 3)
    context.observeFacts([
      {
        factKey: 'ui.login.visible',
        value: true,
        occurrenceId: 'occ-1',
        iterationKey: '',
        observedAtMs: 1,
        freshnessMaxAgeMs: 30_000,
      } as never,
    ])

    const resolve = context.conditionContext().resolveOperand
    expect(resolve({ kind: 'operand', source: 'run.input', path: 'courier.id' })).toMatchObject({
      resolved: true,
      value: 'c-1',
    })
    expect(resolve({ kind: 'operand', source: 'step.output', path: 'routeCount' })).toMatchObject({
      resolved: true,
      value: 3,
    })
    expect(resolve({ kind: 'operand', source: 'sdk.state', path: 'ui.login.visible' })).toMatchObject({
      resolved: true,
      value: true,
    })
    expect(resolve({ kind: 'operand', source: 'country' })).toMatchObject({ resolved: true, value: 'TR' })
    expect(resolve({ kind: 'operand', source: 'sdk.event', path: 'never.seen' })).toMatchObject({
      resolved: false,
      reason: 'NOT_OBSERVED',
    })
    // No handshake happened, so no capability claim may be made either way.
    expect(resolve({ kind: 'operand', source: 'device.capability', path: 'supportsWaitAny' })).toMatchObject({
      resolved: false,
      reason: 'CAPABILITY_UNAVAILABLE',
    })
  })
})

function conditionPlan(): BridgeFlowPlan {
  const step = (planStepId: string, extra: Record<string, unknown>) => ({
    planStepId,
    sourceMapRef: `src:${planStepId}`,
    timeoutMs: 1_000,
    capabilityRequirements: [],
    evidenceRequirements: [],
    ...extra,
  })

  return {
    schemaVersion: 1,
    planId: 'plan-condition',
    hash: { algorithm: 'sha256', digest: 'sha256:plan-condition' },
    provenance: {
      compiledAt: '2026-08-09T00:00:00.000Z',
      compilerVersion: 'test',
      packKey: PACK.packKey,
      packVersion: PACK.packVersion,
      packDigest: PACK.packDigest,
      workflowRef: 'workflow/condition',
      workflowVersion: 1,
      irHash: 'sha256:ir',
      derivedGraphDigest: 'sha256:graph',
    },
    packVersion: PACK.packVersion,
    packDigest: PACK.packDigest,
    workflowRef: 'workflow/condition',
    workflowVersion: 1,
    appCompatibilityRefs: [],
    adapterCompatibilityRefs: [],
    entryStepId: 'cond',
    steps: [
      step('cond', {
        kind: 'CONDITION',
        next: null,
        params: {
          condition: {
            kind: 'comparison',
            operator: 'equals',
            left: { kind: 'operand', source: 'run.input', path: 'mode' },
            right: { kind: 'literal', value: 'fast' },
          },
          onTrue: 'took-true',
          onFalse: 'took-false',
          unknownPolicy: 'FAIL',
        },
      }),
      step('took-true', { kind: 'NOOP', next: null, params: { reason: 'true branch' } }),
      step('took-false', { kind: 'NOOP', next: null, params: { reason: 'false branch' } }),
    ],
    waitPlans: [],
    capabilityManifest: { required: [], optional: [], gaps: [] },
    evidenceManifest: {
      continueGateRequirements: [],
      finalOracleRequirements: [],
      derivedGraphDigest: 'sha256:graph',
      factDeliveryLanes: [],
    },
    resourceRequirements: [],
    domainDependencies: [],
    sourceMap: [],
  } as unknown as BridgeFlowPlan
}

async function runConditionPlan(runInputs: Record<string, unknown>) {
  const persistence = new InMemoryExecutionPersistence()
  const context = new BridgeFlowRunContext({ runInputs })
  const executor = new BridgeFlowExecutor({
    persistence,
    mutationAdmission: createInMemoryMutationAdmission(),
    bridge: {
      act: async () => ({ terminalState: 'FAILED', effectVerified: false, evidenceRef: 'unused' }),
      waitAny: async () => ({ status: 'TIMEOUT', elapsedMs: 0 }),
      cancelWait: async () => ({ status: 'CANCELLED' }),
      cancelAction: async () => ({ status: 'CANCELLED' }),
    },
    evidence: { factsForOccurrence: () => [] },
    conditionContext: context.conditionContext(),
    variables: context,
    clock: () => 1_000,
  })

  await executor.execute({ runId: 'run-1', deviceId: 'device-1', plan: conditionPlan() })
  return persistence.stepOccurrences.map((occurrence) => occurrence.planStepId)
}

describe('executor branching with the wired condition context', () => {
  it('takes the true branch when the operand resolves TRUE', async () => {
    const visited = await runConditionPlan({ mode: 'fast' })
    expect(visited).toContain('took-true')
    expect(visited).not.toContain('took-false')
  })

  it('takes the false branch when the operand resolves FALSE', async () => {
    const visited = await runConditionPlan({ mode: 'slow' })
    expect(visited).toContain('took-false')
    expect(visited).not.toContain('took-true')
  })

  it('stops at the condition under unknownPolicy=FAIL when the operand is unresolvable', async () => {
    const visited = await runConditionPlan({})
    expect(visited).toContain('cond')
    expect(visited).not.toContain('took-true')
    expect(visited).not.toContain('took-false')
  })
})

function fakeManager(overrides: Partial<BridgeDeviceManager>): BridgeDeviceManager {
  return overrides as BridgeDeviceManager
}

const STEP_CONTEXT = {
  runId: 'run-1',
  deviceId: 'device-1',
  occurrenceId: 'occ-1',
  occurrenceIndex: 0,
  iterationKey: '',
  requestId: 'req-1',
  startedAtMs: 0,
}

describe('bridge runtime port', () => {
  const tapStep = {
    planStepId: 'tap',
    kind: 'BRIDGE_ACTION' as const,
    sourceMapRef: 'src:tap',
    timeoutMs: 1_000,
    next: null,
    capabilityRequirements: [],
    evidenceRequirements: [],
    params: { action: 'tap', targetVariable: 'target' },
  }

  const fingerprint = { version: 1, selector: { by: 'id', value: 'login_submit' } }

  it('verifies the effect only when the device reported a completed gesture', async () => {
    const variables = new BridgeFlowRunContext()
    variables.set('target', fingerprint)
    const port = createBridgeRuntimePort({
      manager: fakeManager({
        act: async () => ({
          requestId: 'r1',
          command: 'tap_id',
          method: 'ACCESSIBILITY_ACTION',
          fingerprint,
          resolution: null,
          origin: 'BRIDGE_INJECTED',
          markers: [{ phase: 'GESTURE_COMPLETED', monoTs: 5 }],
          terminalState: 'SUCCEEDED',
        }),
      } as never),
      variables,
      runId: 'run-1',
    })

    await expect(port.act(tapStep as never, STEP_CONTEXT as never)).resolves.toMatchObject({
      terminalState: 'SUCCEEDED',
      effectVerified: true,
    })
  })

  it('does not call an ok transport with no completed gesture a verified effect', async () => {
    const variables = new BridgeFlowRunContext()
    variables.set('target', fingerprint)
    const port = createBridgeRuntimePort({
      manager: fakeManager({
        act: async () => ({
          requestId: 'r2',
          command: 'tap_id',
          method: null,
          fingerprint,
          resolution: null,
          origin: 'BRIDGE_INJECTED',
          markers: [],
          terminalState: 'SUCCEEDED',
        }),
      } as never),
      variables,
      runId: 'run-1',
    })

    await expect(port.act(tapStep as never, STEP_CONTEXT as never)).resolves.toMatchObject({
      effectVerified: false,
    })
  })

  it('passes UNKNOWN_EFFECT through instead of collapsing it into FAILED', async () => {
    const variables = new BridgeFlowRunContext()
    variables.set('target', fingerprint)
    const port = createBridgeRuntimePort({
      manager: fakeManager({
        act: async () => ({
          requestId: 'r3',
          command: 'tap_id',
          method: null,
          fingerprint,
          resolution: null,
          origin: 'BRIDGE_INJECTED',
          markers: [],
          terminalState: 'UNKNOWN_EFFECT',
        }),
      } as never),
      variables,
      runId: 'run-1',
    })

    await expect(port.act(tapStep as never, STEP_CONTEXT as never)).resolves.toMatchObject({
      terminalState: 'UNKNOWN_EFFECT',
    })
  })

  it('refuses to act when no target was resolved rather than guessing one', async () => {
    const port = createBridgeRuntimePort({
      manager: fakeManager({
        act: async () => {
          throw new Error('the device must not be touched without a resolved target')
        },
      } as never),
      variables: new BridgeFlowRunContext(),
      runId: 'run-1',
    })

    await expect(port.act(tapStep as never, STEP_CONTEXT as never)).resolves.toMatchObject({
      terminalState: 'FAILED',
      effectVerified: false,
      evidenceRef: 'bridgeflow:bridge-action-without-resolved-target',
    })
  })
})

describe('generic step runtime', () => {
  const bundle = buildNesyCourierBundle()
  const targetRef = bundle.registries.targets[0]!.targetKey

  it('publishes the resolved fingerprint into the variable BRIDGE_ACTION reads', async () => {
    const variables = new BridgeFlowRunContext()
    const runtime = createGenericStepRuntime({
      manager: fakeManager({
        resolve: async (fp) => ({ outcome: 'RESOLVED_UNIQUE', fingerprint: fp, strength: 'STRONG', treeGen: 7 }),
      } as never),
      variables,
      bundle,
      runId: 'run-1',
    })

    const result = await runtime.execute(
      {
        planStepId: 'resolve',
        kind: 'RESOLVE_TARGET',
        sourceMapRef: 'src:resolve',
        timeoutMs: 1_000,
        next: null,
        capabilityRequirements: [],
        evidenceRequirements: [],
        params: { targetRef, outputVariable: 'target' },
      } as never,
      STEP_CONTEXT as never,
    )

    expect(result.succeeded).toBe(true)
    expect(result.outputVariable).toBe('target')
    expect(result.output).toMatchObject({ version: 1, capturedTreeGen: 7 })
  })

  it('fails the step when the device cannot resolve the target uniquely', async () => {
    const runtime = createGenericStepRuntime({
      manager: fakeManager({
        resolve: async (fp) => ({ outcome: 'AMBIGUOUS', fingerprint: fp, strength: 'STRONG' }),
      } as never),
      variables: new BridgeFlowRunContext(),
      bundle,
      runId: 'run-1',
    })

    const result = await runtime.execute(
      {
        planStepId: 'resolve',
        kind: 'RESOLVE_TARGET',
        sourceMapRef: 'src:resolve',
        timeoutMs: 1_000,
        next: null,
        capabilityRequirements: [],
        evidenceRequirements: [],
        params: { targetRef, outputVariable: 'target' },
      } as never,
      STEP_CONTEXT as never,
    )

    expect(result.succeeded).toBe(false)
  })

  it('never builds a fingerprint whose identity is a row index', () => {
    for (const target of bundle.registries.targets) {
      const fingerprint = buildTargetFingerprint(target)
      if (fingerprint === undefined) continue
      expect(fingerprint.selector.value).not.toBe('')
      expect(fingerprint.expectedId ?? fingerprint.expectedText).toBeDefined()
    }
  })
})

describe('execution queue device gating', () => {
  function queueHarness(acquireBridge: () => Promise<BridgeDeviceManager>) {
    const statuses: string[] = []
    const runRowStatuses: string[] = []
    const runtimeWrites: Record<string, unknown>[] = []
    const prisma = {
      workflowRun: {
        updateMany: async (input: { data: { status: string } }) => {
          runRowStatuses.push(input.data.status)
          return { count: 1 }
        },
      },
      verdictRunStart: {
        updateMany: async (input: { data: { status: string } }) => {
          statuses.push(input.data.status)
          return { count: 1 }
        },
      },
      bridgeFlowRunRuntime: {
        upsert: async (input: { create: Record<string, unknown> }) => {
          runtimeWrites.push(input.create)
          return input.create
        },
      },
    }

    const planStore = new InMemoryCompiledPlanStore()
    planStore.put({
      planId: 'plan-1',
      entryStepId: 'step-1',
      packDigest: PACK.packDigest,
      hash: { algorithm: 'sha256', digest: 'sha256:plan-1' },
      provenance: {
        packKey: PACK.packKey,
        packVersion: PACK.packVersion,
        packDigest: PACK.packDigest,
        compilerVersion: 'test',
      },
      steps: [{ planStepId: 'step-1', sourceMapRef: 'src:1' }],
    })

    const queue = new BridgeFlowExecutionQueue({
      prisma: prisma as never,
      planStore,
      acquireBridge,
      resolvePack: resolveDomainPack,
      clock: () => 1_000,
    })

    return { queue, statuses, runRowStatuses, runtimeWrites }
  }

  const item = {
    executionId: 'exec-1',
    runId: 'run-1',
    workflowRef: 'workflow/demo',
    deviceId: 'device-1',
    compiledPlanRef: 'plan-1',
    compiledPlanHash: 'sha256:plan-1',
    domainPackKey: PACK.packKey,
    domainPackVersion: PACK.packVersion,
    domainPackDigest: PACK.packDigest,
    dependencyKind: 'INDEPENDENT' as const,
  }

  it('blocks the run with the preflight remediation when the device Bridge is unavailable', async () => {
    const { queue, statuses, runRowStatuses, runtimeWrites } = queueHarness(async () => {
      throw new BridgeUnavailableError({
        check: 'ACCESSIBILITY_ENABLED',
        detail: 'bridge accessibility service is off',
        remediation: 'enable the Verdict Bridge accessibility service on device-1',
        fatal: true,
      })
    })

    queue.enqueue(item)
    await new Promise((resolve) => setImmediate(resolve))

    // A device that was never driven must not be recorded as a product failure.
    expect(statuses).toContain('BLOCKED')
    expect(statuses).not.toContain('FAILED')
    expect(runtimeWrites[0]?.terminationReason).toContain('enable the Verdict Bridge accessibility service')
    // The cockpit list reads the run row, so the block has to be visible there too.
    expect(runRowStatuses).toContain('blocked')
  })

  it('blocks instead of executing when the pinned pack is not in this process', async () => {
    const { queue, statuses } = queueHarness(async () => {
      throw new Error('bridge must not be acquired for an unresolvable pack')
    })

    queue.enqueue({ ...item, domainPackKey: 'nesy.absent', domainPackVersion: '9.9.9' })
    await new Promise((resolve) => setImmediate(resolve))

    expect(statuses).toContain('BLOCKED')
  })
})
