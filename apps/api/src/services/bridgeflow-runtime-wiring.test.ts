import { describe, expect, it } from 'vitest'
import { buildNesyCourierBundle } from '@nesy/nesy-courier-domain-pack'
import type { BridgeFlowPlan } from '@nesy/bridgeflow-compiler'
import {
  BridgeFlowExecutor,
  InMemoryExecutionPersistence,
  createInMemoryMutationAdmission,
} from '@nesy/bridgeflow-executor'

import { createBridgeFlowCompileService } from './bridgeflow-compile-adapter.js'
import { BridgeFlowExecutionQueue, describeError } from './bridgeflow-execution-queue.js'
import { createBridgeRuntimePort, createGenericStepRuntime } from './bridgeflow-device-ports.js'
import { BridgeFlowRunContext } from './bridgeflow-run-context.js'
import { buildTargetFingerprint } from './bridgeflow-target-fingerprint.js'
import { listDomainPacks, resolveDomainPack } from './domain-pack-registry.js'
import { InMemoryCompiledPlanStore } from './workflow-compile.service.js'
import type { BridgeDeviceManager } from './bridge-device-manager.js'
import { BridgeUnavailableError } from './bridge-device-manager.js'
import { Prisma } from '@nesy/db'

const PACK = listDomainPacks()[0]!

describe('BridgeFlow compile adapter', () => {
  it('publishes the first-party nesy.courier pack for compile', () => {
    const packs = listDomainPacks()
    expect(packs.map((pack) => pack.packKey)).toEqual(['nesy.courier'])
    const courier = packs[0]!
    expect(courier.bundle.registries.macros[0]?.expansionSnapshot?.authoredBy).toBe('COMPILER')
    expect(resolveDomainPack({
      packKey: 'nesy.courier',
      packVersion: courier.packVersion,
      packDigest: courier.packDigest,
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

  it('materializes canvas IR for single-macro pack workflows', () => {
    const service = createBridgeFlowCompileService(new InMemoryCompiledPlanStore())
    const result = service.compileWorkflow({
      workflowRef: 'nesy.workflow.login',
      workflowIr: {
        nodes: [
          { id: 'permissions', type: 'GRANT_PERMISSIONS' },
          { id: 'auth', type: 'AUTH_LOGIN' },
        ],
        connections: [],
      },
      domainPackKey: PACK.packKey,
      domainPackVersion: PACK.packVersion,
      domainPackDigest: PACK.packDigest,
    })

    expect(result.ok).toBe(true)
    expect(result.issues.filter((issue) => issue.severity === 'ERROR')).toEqual([])
  })

  it('carries a fast UI choice from the canvas into executable login steps', () => {
    const store = new InMemoryCompiledPlanStore()
    const service = createBridgeFlowCompileService(store)
    const result = service.compileWorkflow({
      workflowRef: 'nesy.workflow.login',
      workflowIr: {
        nodes: [
          { id: 'permissions', type: 'GRANT_PERMISSIONS' },
          { id: 'auth-login', type: 'AUTH_LOGIN', data: { config: { verificationMode: 'UI_CHECK' } } },
        ],
        connections: [],
      },
      domainPackKey: PACK.packKey,
      domainPackVersion: PACK.packVersion,
      domainPackDigest: PACK.packDigest,
    })

    expect(result.ok).toBe(true)
    const plan = store.get({
      planRef: result.compiledPlanRef,
      planHash: result.compiledPlanHash,
    }) as unknown as BridgeFlowPlan
    const authSteps = plan.steps
    expect(authSteps.length).toBeGreaterThan(0)
    expect(authSteps.every((step) => step.verificationMode === 'UI_CHECK')).toBe(true)
    expect(authSteps.some((step) => step.verificationRole === 'BUSINESS_PROOF')).toBe(true)
    expect(authSteps.every((step) => step.finalOraclePolicy === undefined)).toBe(true)
    expect(authSteps.flatMap((step) => step.continueGate?.allOf ?? []).every((fact) => fact.startsWith('UI.'))).toBe(true)
  })

  it('reduces only the selected group inside the full courier workflow', () => {
    const store = new InMemoryCompiledPlanStore()
    const service = createBridgeFlowCompileService(store)
    const result = service.compileWorkflow({
      workflowRef: 'nesy.workflow.full-courier-day',
      workflowIr: {
        nodes: [
          { id: 'permissions', type: 'GRANT_PERMISSIONS' },
          { id: 'auth-login', type: 'AUTH_LOGIN', data: { config: { verificationMode: 'UI_CHECK' } } },
          { id: 'route', type: 'SELECT_ROUTE', data: { config: {} } },
        ],
        connections: [],
      },
      domainPackKey: PACK.packKey,
      domainPackVersion: PACK.packVersion,
      domainPackDigest: PACK.packDigest,
    })

    expect(result.ok).toBe(true)
    const plan = store.get({
      planRef: result.compiledPlanRef,
      planHash: result.compiledPlanHash,
    }) as unknown as BridgeFlowPlan
    const authSteps = plan.steps.filter((step) => step.planStepId.startsWith('auth-'))
    const routeSteps = plan.steps.filter((step) => step.planStepId.startsWith('route-'))
    expect(authSteps.length).toBeGreaterThan(0)
    expect(routeSteps.length).toBeGreaterThan(0)
    expect(authSteps.every(
      (step) => step.verificationMode === 'UI_CHECK',
    )).toBe(true)
    expect(routeSteps.every(
      (step) => step.verificationMode === undefined,
    )).toBe(true)
  })

  it('materializes canvas IR for the login-then-select-route composition', () => {
    const service = createBridgeFlowCompileService(new InMemoryCompiledPlanStore())
    const result = service.compileWorkflow({
      workflowRef: 'nesy.workflow.login-and-select-route',
      workflowIr: {
        nodes: [
          { id: 'permissions', type: 'GRANT_PERMISSIONS' },
          { id: 'auth', type: 'AUTH_LOGIN' },
          { id: 'route', type: 'SELECT_ROUTE' },
        ],
        connections: [],
      },
      domainPackKey: PACK.packKey,
      domainPackVersion: PACK.packVersion,
      domainPackDigest: PACK.packDigest,
    })

    expect(result.ok).toBe(true)
    expect(result.issues.filter((issue) => issue.severity === 'ERROR')).toEqual([])
  })

  it('refuses a login canvas that omits the executable Grant Permissions node', () => {
    const service = createBridgeFlowCompileService(new InMemoryCompiledPlanStore())
    const result = service.compileWorkflow({
      workflowRef: 'nesy.workflow.login',
      workflowIr: {
        nodes: [{ id: 'auth', type: 'AUTH_LOGIN' }],
        connections: [],
      },
      domainPackKey: PACK.packKey,
      domainPackVersion: PACK.packVersion,
      domainPackDigest: PACK.packDigest,
    })

    expect(result.ok).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toContain('MISSING_STARTUP_PERMISSION_STEP')
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

  /**
   * `scroll_to_item` was declared in `BRIDGE_COMMANDS` and implemented on the
   * device, but no host path could issue it: `act()` accepts four commands and
   * no port drove the rest. A virtualized row is absent from the tree, so every
   * selector honestly answers `not_found` — the list has to be positioned first
   * or the row is unreachable at any distance down the list.
   */
  const scrollStep = (args: Record<string, unknown>) => ({
    planStepId: 'scroll-to-row',
    kind: 'BRIDGE_ACTION' as const,
    sourceMapRef: 'src:scroll',
    timeoutMs: 1_000,
    next: null,
    capabilityRequirements: [],
    evidenceRequirements: [],
    params: { action: 'scrollToItem', args },
  })

  it('positions a list by class and a run-supplied row index', async () => {
    const calls: unknown[] = []
    const variables = new BridgeFlowRunContext()
    // Which row holds the requested record is a fact of THIS run: it came from a
    // named query, so it can only arrive through a variable.
    variables.set('routeIndex', 29)
    const port = createBridgeRuntimePort({
      manager: fakeManager({
        scrollToItem: async (selector: unknown) => {
          calls.push(selector)
          return { ok: true, treeGen: 12 }
        },
      } as never),
      variables,
      runId: 'run-1',
    })

    await expect(
      port.act(
        scrollStep({ listClass: 'android.widget.ListView', rowIndex: 'var.routeIndex' }) as never,
        STEP_CONTEXT as never,
      ),
    ).resolves.toMatchObject({ terminalState: 'SUCCEEDED', effectVerified: true })
    expect(calls).toEqual([{ listClass: 'android.widget.ListView', rowIndex: 29 }])
  })

  it('never sends both list forms; listId wins and listClass is dropped', async () => {
    const calls: unknown[] = []
    const port = createBridgeRuntimePort({
      manager: fakeManager({
        scrollToItem: async (selector: unknown) => {
          calls.push(selector)
          return { ok: true }
        },
      } as never),
      variables: new BridgeFlowRunContext(),
      runId: 'run-1',
    })

    await port.act(
      scrollStep({ listId: 'route_list', listClass: 'android.widget.ListView', rowIndex: 2 }) as never,
      STEP_CONTEXT as never,
    )
    expect(calls).toEqual([{ listId: 'route_list', rowIndex: 2 }])
  })

  it('refuses a scroll that names no list rather than picking one', async () => {
    const port = createBridgeRuntimePort({
      manager: fakeManager({
        scrollToItem: async () => {
          throw new Error('no list was named; the host must not choose one')
        },
      } as never),
      variables: new BridgeFlowRunContext(),
      runId: 'run-1',
    })

    await expect(
      port.act(scrollStep({ rowIndex: 3 }) as never, STEP_CONTEXT as never),
    ).resolves.toMatchObject({
      terminalState: 'FAILED',
      evidenceRef: 'bridgeflow:scroll-without-list-selector',
    })
  })

  /**
   * The popup is a window the platform attaches after the tap returns, so the
   * first scroll legitimately finds no list. Retrying only `not_found` is safe:
   * that refusal is decided while planning, before anything is touched.
   */
  it('waits out a list that has not attached yet, within the step budget', async () => {
    let attempts = 0
    const port = createBridgeRuntimePort({
      manager: fakeManager({
        scrollToItem: async () => {
          attempts += 1
          return attempts < 3 ? { ok: false, error: 'not_found' } : { ok: true }
        },
      } as never),
      variables: new BridgeFlowRunContext(),
      runId: 'run-1',
    })

    await expect(
      port.act(
        { ...scrollStep({ listClass: 'android.widget.ListView', rowIndex: 29 }), timeoutMs: 5_000 } as never,
        STEP_CONTEXT as never,
      ),
    ).resolves.toMatchObject({ terminalState: 'SUCCEEDED' })
    expect(attempts).toBe(3)
  })

  it('stops retrying when the budget runs out and reports the last refusal', async () => {
    let attempts = 0
    let now = 0
    const port = createBridgeRuntimePort({
      manager: fakeManager({
        scrollToItem: async () => {
          attempts += 1
          now += 400
          return { ok: false, error: 'not_found' }
        },
      } as never),
      variables: new BridgeFlowRunContext(),
      runId: 'run-1',
      clock: () => now,
    })

    await expect(
      port.act(
        { ...scrollStep({ listClass: 'android.widget.ListView', rowIndex: 29 }), timeoutMs: 1_000 } as never,
        STEP_CONTEXT as never,
      ),
    ).resolves.toMatchObject({
      terminalState: 'FAILED',
      evidenceRef: 'bridge:scroll_to_item:android.widget.ListView:row=29:not_found',
    })
    // Bounded: it does not keep asking forever, and it does not stop after one.
    expect(attempts).toBeGreaterThan(1)
    expect(attempts).toBeLessThan(6)
  })

  /**
   * An interaction the product only shows in some environments — Serbia's
   * delivery time-range picker, a refusal dialog on the happy path — used to be
   * unmodellable. `notFoundPolicy` was declared on every target and read by
   * nobody, and the action contract had no way to say "there was nothing to do":
   * `SUCCEEDED` with `effectVerified: false` became FAILED + evidenceInsufficient.
   * Measured before the fix: a cleanup step aborted a run in which nine steps
   * were green and the parcel had loaded.
   */
  it('skips an action whose target was resolved as declared-absent', async () => {
    const variables = new BridgeFlowRunContext()
    variables.set('target', { absentTarget: true, targetRef: 'nesy.target.time-slot-confirm' })
    const port = createBridgeRuntimePort({
      manager: fakeManager({
        act: async () => {
          throw new Error('an absent target must never reach the device')
        },
      } as never),
      variables,
      runId: 'run-1',
    })

    await expect(port.act(tapStep as never, STEP_CONTEXT as never)).resolves.toMatchObject({
      terminalState: 'SKIPPED',
      // No effect happened, so none is claimed. SKIPPED is read instead.
      effectVerified: false,
      evidenceRef: 'bridge:skipped:target-absent:nesy.target.time-slot-confirm',
    })
  })

  it('still refuses a MISSING target, which is a broken plan rather than an absent one', async () => {
    // The absent marker is a distinct shape for exactly this reason: an empty
    // variable means the resolve step never ran, and that must stay a failure.
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
      evidenceRef: 'bridgeflow:bridge-action-without-resolved-target',
    })
  })

  it('reports the device refusal instead of calling the scroll effective', async () => {
    const port = createBridgeRuntimePort({
      manager: fakeManager({
        scrollToItem: async () => ({ ok: false, error: 'ambiguous', count: 2 }),
      } as never),
      variables: new BridgeFlowRunContext(),
      runId: 'run-1',
    })

    await expect(
      port.act(
        scrollStep({ listClass: 'android.widget.ListView', rowIndex: 29 }) as never,
        STEP_CONTEXT as never,
      ),
    ).resolves.toMatchObject({
      terminalState: 'FAILED',
      effectVerified: false,
      evidenceRef: 'bridge:scroll_to_item:android.widget.ListView:row=29:ambiguous',
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

  /**
   * The pack's `notFoundPolicy`, honoured. It was declared on every target and
   * read by nobody, so an interaction the product only shows in some
   * environments could not be modelled: declaring TREAT_AS_ABSENT bought nothing
   * and the macro had to pretend the target was mandatory.
   */
  it('treats a declared-absent target as absent instead of failing', async () => {
    const absentTolerant = bundle.registries.targets.find(
      (t) => t.resolution.notFoundPolicy === 'TREAT_AS_ABSENT',
    )
    expect(absentTolerant, 'the pack should carry at least one absent-tolerant target').toBeDefined()

    const variables = new BridgeFlowRunContext()
    const runtime = createGenericStepRuntime({
      manager: fakeManager({
        resolve: async (fp) => ({ outcome: 'NOT_FOUND', fingerprint: fp, strength: 'STRONG' }),
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
        params: { targetRef: absentTolerant!.targetKey, outputVariable: 'target' },
      } as never,
      STEP_CONTEXT as never,
    )

    expect(result.succeeded).toBe(true)
    // A MARKER, not an empty variable: the dependent action must be able to tell
    // "declared absent" from "the resolve step never ran".
    expect(result.output).toEqual({ absentTarget: true, targetRef: absentTolerant!.targetKey })
  })

  it('does not treat AMBIGUOUS as absent, even when the policy tolerates absence', async () => {
    // "We could not tell which one" is the opposite of "it is not there", and
    // tolerating it would let the run act on a guess about which node was meant.
    const absentTolerant = bundle.registries.targets.find(
      (t) => t.resolution.notFoundPolicy === 'TREAT_AS_ABSENT',
    )
    const runtime = createGenericStepRuntime({
      manager: fakeManager({
        resolve: async (fp) => ({ outcome: 'AMBIGUOUS', fingerprint: fp, strength: 'STRONG', matchedCount: 2 }),
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
        params: { targetRef: absentTolerant!.targetKey, outputVariable: 'target' },
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
  function queueHarness(
    acquireBridge: () => Promise<BridgeDeviceManager>,
    overrides: Partial<ConstructorParameters<typeof BridgeFlowExecutionQueue>[0]> = {},
    planStepOverrides: Record<string, unknown> = {},
  ) {
    const statuses: string[] = []
    const runRowStatuses: string[] = []
    const runtimeWrites: Record<string, unknown>[] = []
    const { prisma: prismaOverride, ...queueOverrides } = overrides
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
      verdictRunTelemetrySnapshot: {
        create: async () => ({}),
      },
      bridgeFlowRunRuntime: {
        upsert: async (input: { create: Record<string, unknown> }) => {
          runtimeWrites.push(input.create)
          return input.create
        },
        findUnique: async () => null,
        update: async () => ({}),
        updateMany: async () => ({ count: 1 }),
      },
      bridgeFlowStepOccurrence: {
        upsert: async (input: { create?: Record<string, unknown> }) => input.create ?? {},
      },
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
      ...(prismaOverride ?? {}),
    }

    const planStore = new InMemoryCompiledPlanStore()
    const includesPermissionBootstrap = queueOverrides.prepareStartupPermissions !== undefined
    planStore.put({
      planId: 'plan-1',
      schemaVersion: 1,
      workflowRef: 'workflow/demo',
      workflowVersion: 1,
      entryStepId: includesPermissionBootstrap ? 'prepare-startup-permissions' : 'step-1',
      packDigest: PACK.packDigest,
      hash: { algorithm: 'sha256', digest: 'sha256:plan-1' },
      provenance: {
        packKey: PACK.packKey,
        packVersion: PACK.packVersion,
        packDigest: PACK.packDigest,
        compilerVersion: 'test',
      },
      steps: [
        ...(includesPermissionBootstrap
          ? [
              {
                planStepId: 'prepare-startup-permissions',
                sourceMapRef: 'src:permissions',
                kind: 'ANNOTATE' as const,
                next: 'step-1',
                params: { message: 'POST_LAUNCH_ANDROID_PERMISSION_BOOTSTRAP' },
              },
            ]
          : []),
        {
          planStepId: 'step-1',
          sourceMapRef: 'src:1',
          kind: 'RESOLVE_TARGET',
          next: null,
          params: {
            targetRef: 'nesy.target.login-pin-field',
            outputVariable: 'target',
          },
          ...planStepOverrides,
        },
      ],
      evidenceManifest: {
        continueGateRequirements: [],
        finalOracleRequirements: [],
        derivedGraphDigest: 'sha256:graph',
        factDeliveryLanes: [],
      },
    })

    const queue = new BridgeFlowExecutionQueue({
      prisma: prisma as never,
      planStore,
      acquireBridge,
      resolvePack: resolveDomainPack,
      clock: () => 1_000,
      ...queueOverrides,
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

  it('blocks reduced-verification plans from being used as release gates', async () => {
    let acquired = false
    const { queue, statuses, runtimeWrites } = queueHarness(
      async () => {
        acquired = true
        throw new Error('bridge must not be acquired')
      },
      {},
      { verificationMode: 'UI_CHECK', verificationRole: 'ACTION' },
    )

    queue.enqueue({ ...item, releaseGate: true })
    await new Promise((resolve) => setImmediate(resolve))

    expect(acquired).toBe(false)
    expect(statuses).toContain('BLOCKED')
    expect(runtimeWrites[0]?.failureDetail).toContain('release gate cannot run')
  })

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
    // `failureDetail` is where free-text diagnosis lives; without it the only
    // account of why a run died was the API process stdout.
    expect(runtimeWrites[0]?.failureDetail).toContain('enable the Verdict Bridge accessibility service')
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

  it('does not launch when force-stop cannot be confirmed and persists the canonical class', async () => {
    let launched = false
    const { queue, statuses, runtimeWrites } = queueHarness(
      async () => {
        throw new Error('bridge acquisition must not begin before force-stop confirmation')
      },
      {
        admissionGate: async () => ({ ok: true }),
        setRunId: async () => true,
        forceStop: async () => ({
          confirmed: false,
          previousPids: [101],
          remainingPids: [101],
        }),
        launch: async () => {
          launched = true
        },
      },
    )

    queue.enqueue({ ...item, profileKey: 'nesy.launch.cold-real-login' })
    await new Promise((resolve) => setImmediate(resolve))

    expect(launched).toBe(false)
    expect(statuses).toContain('BLOCKED')
    expect(runtimeWrites[0]).toMatchObject({
      productVerdict: 'NOT_EVALUATED',
      evaluationFailureClass: 'AUTOMATION_FAILURE',
      readinessStatus: 'NOT_EVALUATED',
      readinessClass: 'FORCE_STOP_NOT_CONFIRMED',
      readinessTrace: expect.objectContaining({
        firstUnmet: 'PROCESS_TERMINATED',
        pending: expect.arrayContaining(['PROCESS_TERMINATED']),
      }),
    })
  })

  it('gates the executor on SDK_READY and persists the completed pre-action boundaries', async () => {
    let mono = 0
    let launched = false
    const startupOrder: string[] = []
    const actionableNode = {
      depth: 1,
      id: 'pinView',
      text: null,
      contentDescription: null,
      className: 'android.widget.EditText',
      packageName: 'com.arasdigital.nesymobile.rs.stage',
      rowIndex: null,
      columnIndex: null,
      collectionInfo: null,
      clickable: true,
      enabled: true,
      visible: true,
      obscuredBy: [],
      bounds: { left: 10, top: 10, right: 100, bottom: 80 },
    }
    const manager = fakeManager({
      getCapabilities: () => ({ protocolVersion: 1 }),
      resolve: async (fingerprint) => ({
        outcome: 'RESOLVED_UNIQUE',
        fingerprint,
        strength: 'STRONG',
        treeGen: 9,
        node: actionableNode,
      }),
    } as never)
    const { queue, statuses, runtimeWrites } = queueHarness(async () => {
      startupOrder.push('bridge-acquire')
      return manager
    }, {
      admissionGate: async () => ({ ok: true }),
      setRunId: async () => true,
      broadcastRun: async () => true,
      forceStop: async () => ({ confirmed: true, previousPids: [100], remainingPids: [] }),
      launch: async () => {
        launched = true
        startupOrder.push('launch')
      },
      prepareStartupPermissions: async () => {
        startupOrder.push('permissions')
        return {
          ok: true,
          changed: false,
          restarted: false,
          grantedNow: [],
          alreadyGranted: [],
          skippedNotRuntime: [],
          overlay: 'already-granted',
        }
      },
      observeLaunch: async () => ({
        processCreated: true,
        processId: 200,
        processState: 'R',
        cpuTicks: 1,
        appLifecycleReady: true,
        uiVisible: true,
        rawActivity: 'topResumedActivity=com.arasdigital.nesymobile.rs.stage',
        rawWindow: 'mCurrentFocus=com.arasdigital.nesymobile.rs.stage',
      }),
      readDeviceState: async () => ({
        isLoggedIn: false,
        routeSelected: false,
        routeName: '',
        scheduleLoaded: false,
        scheduleId: '',
        currentScreen: 'LoginFragment',
        runId: 'run-1',
        sessionId: 'session-1',
        raw: {},
      }),
      // No WAL/auth evidence: all earlier states pass, SDK_READY must remain red.
      readDeviceHealth: async () => ({}),
      readinessDeadlineMs: 5,
      monoClock: () => {
        mono += 1
        return mono
      },
    })

    queue.enqueue({ ...item, profileKey: 'nesy.launch.cold-real-login' })
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(launched).toBe(true)
    expect(startupOrder.slice(0, 3)).toEqual(['launch', 'permissions', 'bridge-acquire'])
    expect(statuses).toContain('BLOCKED')
    expect(runtimeWrites).toContainEqual(
      expect.objectContaining({
        evaluationFailureClass: 'AUTOMATION_FAILURE',
        readinessStatus: 'INTERACTION_NOT_READY',
        readinessClass: 'SDK_NOT_READY',
        readinessTrace: expect.objectContaining({
          firstUnmet: 'SDK_READY',
          completed: expect.arrayContaining([
            expect.objectContaining({ state: 'UI_ACTIONABLE' }),
          ]),
        }),
      }),
    )
  })

  it('classifies a mid-run Prisma disconnect as ENVIRONMENT_FAILURE and still resets the device', async () => {
    const closed = new Prisma.PrismaClientKnownRequestError('Server has closed the connection.', {
      code: 'P1017',
      clientVersion: 'test',
      meta: { modelName: 'BridgeFlowStepOccurrence' },
    })
    const emergencyResets: { deviceId: string; runId: string; applicationId: string }[] = []
    const manager = fakeManager({
      getCapabilities: () => ({ protocolVersion: 1 }),
      resolve: async (fingerprint) => ({
        outcome: 'RESOLVED_UNIQUE',
        fingerprint,
        strength: 'STRONG',
        treeGen: 9,
        node: {
          depth: 1,
          id: 'pinView',
          text: null,
          contentDescription: null,
          className: 'android.widget.EditText',
          packageName: 'com.arasdigital.nesymobile.rs.stage',
          rowIndex: null,
          columnIndex: null,
          collectionInfo: null,
          clickable: true,
          enabled: true,
          visible: true,
          obscuredBy: [],
          bounds: { left: 10, top: 10, right: 100, bottom: 80 },
        },
      }),
    } as never)
    const { queue, statuses, runRowStatuses, runtimeWrites } = queueHarness(async () => manager, {
      prisma: {
        $transaction: async () => {
          throw closed
        },
        bridgeFlowStepOccurrence: {
          upsert: async () => {
            throw closed
          },
        },
      } as never,
      admissionGate: async () => ({ ok: true }),
      setRunId: async () => true,
      broadcastRun: async () => true,
      forceStop: async () => ({ confirmed: true, previousPids: [100], remainingPids: [] }),
      launch: async () => undefined,
      observeLaunch: async () => ({
        processCreated: true,
        processId: 200,
        processState: 'R',
        cpuTicks: 2,
        appLifecycleReady: true,
        uiVisible: true,
        rawActivity: 'topResumedActivity=com.arasdigital.nesymobile.rs.stage',
        rawWindow: 'mCurrentFocus=com.arasdigital.nesymobile.rs.stage',
      }),
      readDeviceState: async () => ({
        isLoggedIn: false,
        routeSelected: false,
        routeName: '',
        scheduleLoaded: false,
        scheduleId: '',
        currentScreen: 'LoginFragment',
        runId: 'run-1',
        sessionId: 'session-1',
        raw: {},
      }),
      readDeviceHealth: async () => ({
        wal: { generation: 1 },
        wsAuth: { ok: true },
        ws: { connected: true },
      }),
      readinessDeadlineMs: 50,
      monoClock: (() => {
        let mono = 0
        return () => {
          mono += 1
          return mono
        }
      })(),
      emergencyReset: async (input) => {
        emergencyResets.push(input)
        return { ok: true }
      },
    })

    queue.enqueue({ ...item, profileKey: 'nesy.launch.cold-real-login' })
    const deadline = Date.now() + 2_000
    while (Date.now() < deadline && !runtimeWrites.some((row) => row.evaluationFailureClass === 'ENVIRONMENT_FAILURE')) {
      await new Promise((resolve) => setTimeout(resolve, 20))
    }

    expect(emergencyResets).toEqual([
      expect.objectContaining({ deviceId: 'device-1', runId: 'run-1' }),
    ])
    expect(statuses).toContain('FAILED')
    expect(runRowStatuses).toContain('failed')
    expect(runtimeWrites).toContainEqual(
      expect.objectContaining({
        productVerdict: 'NOT_EVALUATED',
        evaluationFailureClass: 'ENVIRONMENT_FAILURE',
        cleanupResult: 'SUCCEEDED',
        terminationReason: 'ABORTED',
        failureDetail: expect.stringContaining('Server has closed the connection'),
      }),
    )
  })
})

describe('execution failure diagnosis', () => {
  it('keeps the cause chain, because the outer message names the wrong culprit', () => {
    const cause = new Error('handshake did not answer within 15000ms')
    const outer = new Error('act failed', { cause })
    outer.name = 'BridgeHostError'

    const described = describeError(outer)

    // "act failed" alone reads as a broken workflow step; the cause is what says
    // the device never answered, which is the only actionable half.
    expect(described).toContain('BridgeHostError: act failed')
    expect(described).toContain('handshake did not answer within 15000ms')
  })

  it('does not loop forever when a cause chain points back at itself', () => {
    const looped = new Error('outer')
    Object.defineProperty(looped, 'cause', { value: looped })

    expect(describeError(looped)).toBe('outer')
  })

  it('renders a thrown non-Error rather than dropping it', () => {
    expect(describeError('adb exited 1')).toBe('adb exited 1')
  })
})
