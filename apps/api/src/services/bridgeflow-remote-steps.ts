/**
 * REMOTE_ACTION / EXTERNAL_ACTION step runtime.
 *
 * Three things happen here, in this order, and the order is the safety property:
 *
 *   1. `RemoteActionRuntime` applies the pack's allowlist, the idempotency-key
 *      requirement, the resource-lease requirement and the non-idempotent
 *      no-auto-retry rule. A call that fails any of them never reaches the wire.
 *   2. The adapter performs the call and returns a NORMALIZED response, so the
 *      pack's `responsePath` bindings never address backend field names.
 *   3. A VALIDATION operation's output facts are published into the run's
 *      evidence scope. This is what makes a backend check settle a final oracle
 *      instead of the oracle waiting out its deadline.
 *
 * Step 3 is why a remote read is worth running at all: without publication the
 * call happens, succeeds, and proves nothing to the verdict.
 */

import type { BridgeFlowPlanStep } from '@nesy/bridgeflow-compiler'
import type {
  GenericStepResult,
  StepExecutionContext,
  VariableRuntimePort,
} from '@nesy/bridgeflow-executor'
import type { DomainPackBundle } from '@nesy/domain-pack-contracts'
import type { NormalizedEvidenceFact } from '@nesy/oracle-engine'
import type { ExternalActionSpec } from '@nesy/workflow-contract'

import type { BackofficeAdapter } from './nesy-backoffice-adapter.js'
import type { BridgeFlowEvidenceRuntime } from './bridgeflow-evidence-runtime.js'
import type { SdkObservationStore } from './sdk-observation-store.js'
import {
  RemoteActionRuntime,
  InMemoryRemoteActionAttemptStore,
  type AllowlistedRemoteOperation,
  type RemoteActionAttemptStore,
} from './remote-action-runtime.js'

/** Facts observed remotely stay usable this long; the requirement's own deadline governs waiting. */
const REMOTE_FACT_MAX_AGE_MS = 30_000

export interface RemoteStepRuntimeOptions {
  runId: string
  bundle: DomainPackBundle
  adapter: BackofficeAdapter
  variables: VariableRuntimePort
  evidence: BridgeFlowEvidenceRuntime
  /** Cross-step sink so a later step's oracle can see this observation. */
  observations?: SdkObservationStore
  /** Run inputs addressed by `runInput` bindings. */
  runInputs?: Readonly<Record<string, unknown>>
  attemptStore?: RemoteActionAttemptStore
  clock?: () => number
  logger?: (message: string, detail?: unknown) => void
}

export function createPackRemoteStepRuntime(options: RemoteStepRuntimeOptions): {
  execute(step: BridgeFlowPlanStep, context: StepExecutionContext): Promise<GenericStepResult>
} {
  const clock = options.clock ?? Date.now
  const attemptStore = options.attemptStore ?? new InMemoryRemoteActionAttemptStore()
  const allowlist = buildAllowlist(options.bundle)
  let revision = 0

  return {
    async execute(step, context): Promise<GenericStepResult> {
      const spec = step.params['spec'] as ExternalActionSpec | undefined
      if (spec === undefined) {
        options.logger?.('[BridgeFlowRemoteSteps] step carries no external action spec', {
          planStepId: step.planStepId,
        })
        return { succeeded: false, actionResult: 'FAILED' }
      }

      /**
       * Publish one bound fact into BOTH the cross-step store and this step's own
       * scope.
       *
       * The store is what a LATER step's oracle can see — evidence is scoped per
       * occurrence, so publishing only locally made a backend check invisible to
       * the Final Oracle it exists to settle. The local publish still matters for
       * a continue gate on THIS step, which reads its own scope.
       */
      const publishFact = (factKey: string, value: boolean | 'UNKNOWN'): void => {
        const observedAtMs = clock()
        options.observations?.record(options.runId, {
          factKey,
          value,
          observedAtMs,
          queryRef: spec.operationRef,
        })
        revision += 1
        options.evidence.publish({
          runId: options.runId,
          revision,
          lane: 'ORDERED_REQUIRED',
          correlationStatus: 'CORRELATED',
          trust: 'RESOLVER_ACCEPTED',
          fact: {
            factKey,
            occurrenceId: context.occurrenceId,
            iterationKey: context.iterationKey,
            observedAtMs,
            freshnessMaxAgeMs: REMOTE_FACT_MAX_AGE_MS,
            plane: 'REMOTE',
            subtype: spec.operationRef,
            value,
            authority: 'PRIMARY',
            deliveryLane: 'ORDERED_REQUIRED',
          } satisfies NormalizedEvidenceFact,
        })
      }

      const inputs = resolveInputs(spec, options.variables, options.runInputs ?? {})
      const auditPolicy = {
        recordRequest: spec.auditPolicy.recordRequest,
        recordResponse: spec.auditPolicy.recordResponse,
        redactFields: spec.auditPolicy.redactFields ?? [],
      }

      // The adapter is wrapped so `RemoteActionRuntime` keeps owning the safety
      // rules while the normalized response — which it has no field for — is
      // captured alongside.
      let captured: Record<string, unknown> = {}
      const runtime = new RemoteActionRuntime(
        allowlist,
        {
          execute: async ({ request }) => {
            const result = await options.adapter.call(
              {
                operationRef: request.operationRef,
                inputs,
                timeoutMs: request.timeoutMs,
                ...(request.idempotencyKey === '' ? {} : { idempotencyKey: request.idempotencyKey }),
              },
              auditPolicy,
            )
            captured = result.normalizedResponse
            return result.terminal
          },
        },
        attemptStore,
      )

      const result = await runtime.execute({
        runId: options.runId,
        spec,
        request: {
          operationRef: spec.operationRef,
          allowlisted: true,
          idempotencyKey: resolveIdempotencyKey(spec, inputs, context),
          effectClass: toRuntimeEffectClass(spec.effectClass),
          timeoutMs: spec.timeoutPolicy.timeoutMs,
          occurrenceId: context.occurrenceId,
          ...(spec.entityBinding === undefined ? {} : { entityRef: spec.entityBinding.type }),
        },
      })

      if (!result.ok) {
        options.logger?.('[BridgeFlowRemoteSteps] remote action did not succeed', {
          planStepId: step.planStepId,
          operationRef: spec.operationRef,
          status: result.terminal.status,
          reason: result.blockedReason,
        })

        // A read-only validation the pack marked continuable: record that the
        // observation could not be made and let the run judge itself on the
        // planes it DID observe. Without this an unreachable back office aborted
        // a login run whose backend requirement was OPTIONAL anyway — reporting
        // an infrastructure outage as if the product were untestable.
        //
        // UNKNOWN_EFFECT is excluded on purpose. "The call may or may not have
        // landed" is exactly the state no run may walk past, and the contract
        // already restricts this policy to READ_ONLY, so reaching it here would
        // mean two guards disagreed.
        if (spec.onUnavailable === 'RECORD_UNMEASURED' && result.terminal.status === 'FAILED') {
          for (const binding of spec.outputFactBindings) {
            publishFact(binding.factKey, 'UNKNOWN')
          }
          // FAILED is still what the step row says: the call did fail, and a
          // green step for a call that never answered would be a lie told to
          // whoever reads the run later.
          return { succeeded: true, actionResult: 'FAILED' }
        }

        // UNKNOWN_EFFECT is surfaced as itself: the executor treats it as an
        // unknown-effect stop, which is what stops a duplicate mutation.
        return {
          succeeded: false,
          actionResult: result.terminal.status === 'UNKNOWN_EFFECT' ? 'UNKNOWN_EFFECT' : 'FAILED',
        }
      }

      for (const binding of spec.outputFactBindings) {
        const value = readPath(captured, binding.responsePath)
        // A path the response did not carry is UNKNOWN, never false: an invented
        // `false` would read as a proven negative.
        publishFact(binding.factKey, typeof value === 'boolean' ? value : 'UNKNOWN')
      }

      return { succeeded: true, actionResult: 'SUCCEEDED' }
    },
  }
}

/**
 * Pack effect class → runtime effect class.
 *
 * The runtime axis is only "may this be replayed safely?", so a READ_ONLY
 * operation belongs with IDEMPOTENT. Folding it into NON_IDEMPOTENT instead
 * would demand an idempotency key from every backend *read* and fail the check
 * before it ever runs. `UNKNOWN` stays on the unsafe side by design.
 */
function toRuntimeEffectClass(effectClass: string): 'IDEMPOTENT' | 'NON_IDEMPOTENT' {
  return effectClass === 'READ_ONLY' || effectClass === 'IDEMPOTENT_MUTATION'
    ? 'IDEMPOTENT'
    : 'NON_IDEMPOTENT'
}

function buildAllowlist(bundle: DomainPackBundle): AllowlistedRemoteOperation[] {
  return bundle.registries.remoteAdapters.flatMap((adapter) =>
    adapter.operations.map((operation) => ({
      adapterRef: adapter.adapterRef,
      operationRef: operation.operationRef,
      effectClass: toRuntimeEffectClass(operation.effectClass),
      // Only a real mutation can require exclusive access; a read never does.
      requiresResourceLease: operation.effectClass === 'NON_IDEMPOTENT_MUTATION',
    })),
  )
}

function resolveInputs(
  spec: ExternalActionSpec,
  variables: VariableRuntimePort,
  runInputs: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const inputs: Record<string, unknown> = {}
  for (const binding of spec.inputBindings) {
    const source = binding.source
    if (source.kind === 'literal') inputs[binding.name] = source.value
    else if (source.kind === 'runInput') inputs[binding.name] = readPath(runInputs, source.path)
    else if (source.kind === 'stepOutput') {
      inputs[binding.name] = readPath(variables.get(source.stepId), source.path)
    } else if (source.kind === 'loopItem') {
      const item = variables.get('loop.item')
      inputs[binding.name] = source.path === undefined ? item : readPath(item, source.path)
    } else if (source.kind === 'entityRef') {
      // The entity's runtime identity is published by an earlier step under the
      // binding name; the spec's entityBinding only names its type.
      inputs[binding.name] = variables.get(binding.name)
    }
  }
  return inputs
}

function resolveIdempotencyKey(
  spec: ExternalActionSpec,
  inputs: Readonly<Record<string, unknown>>,
  context: StepExecutionContext,
): string {
  if (spec.idempotencyClass !== 'KEYED') return ''
  const declared = spec.idempotencyKey
  if (declared === undefined) return context.occurrenceId
  // The declared key is a path (`run.input.approvalRequestCode`); its resolved
  // value is what de-duplicates, not the path itself.
  const resolved = readPath(inputs, declared.split('.').at(-1) ?? declared)
  return resolved === undefined || resolved === null ? context.occurrenceId : String(resolved)
}

function readPath(source: unknown, path: string): unknown {
  let current = source
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}
