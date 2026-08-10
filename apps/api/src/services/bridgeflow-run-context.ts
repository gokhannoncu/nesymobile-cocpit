/**
 * Per-run variable store and condition operand resolver.
 *
 * The executor evaluates CONDITION/SWITCH through a `ConditionEvaluationContext`
 * and refuses to branch at all when none is supplied — `evaluateConditionStep`
 * returns `{ ok: false }`, which fails the step. So an execution wired without
 * this file cannot take a branch; it can only stop at the first one.
 *
 * Every namespace resolves from a real source or reports why it could not:
 * `MISSING` and `NOT_OBSERVED` are answers the Kleene evaluator can use,
 * `CAPABILITY_UNAVAILABLE` says the lane does not exist in this process. What
 * must never happen is a fabricated value — an invented `false` reads as a
 * decided branch, and the run then reports success on the wrong path.
 */

import type { BridgeCapabilityManifest } from '@nesy/bridge-contract'
import type { NormalizedEvidenceFact } from '@nesy/oracle-engine'
import type { VariableRuntimePort } from '@nesy/bridgeflow-executor'
import type { ConditionEvaluationContext } from '@nesy/workflow-contract'
import { createRuntimeConditionContext } from './condition-engine.js'

export interface BridgeFlowRunContextOptions {
  /** Run inputs, addressed by `run.input.<path>`. */
  runInputs?: Readonly<Record<string, unknown>>
  /** Live device capabilities, addressed by `device.capability.<path>`. */
  capabilities?: BridgeCapabilityManifest | null
  /** Value behind the pathless `environment` operand. */
  environment?: string
  /** Value behind the pathless `country` operand. */
  country?: string
  /** Allowlisted regexes for `matchesAllowlistedPattern`. */
  allowlistedPatterns?: Readonly<Record<string, RegExp>>
  clock?: () => number
}

export class BridgeFlowRunContext implements VariableRuntimePort {
  private readonly variables = new Map<string, unknown>()
  private facts: readonly NormalizedEvidenceFact[] = []

  constructor(private readonly options: BridgeFlowRunContextOptions = {}) {}

  get(name: string): unknown {
    return this.variables.get(name)
  }

  set(name: string, value: unknown): void {
    this.variables.set(name, value)
  }

  /**
   * Record the facts the executor is currently correlating.
   *
   * Condition operands read the most recent set rather than a per-occurrence
   * one: the executor's condition hook carries no step context, so pretending
   * to scope the read would be a scope claim the call cannot support.
   */
  observeFacts(facts: readonly NormalizedEvidenceFact[]): void {
    if (facts.length > 0) this.facts = facts
  }

  observedFacts(): readonly NormalizedEvidenceFact[] {
    return this.facts
  }

  conditionContext(): ConditionEvaluationContext {
    return createRuntimeConditionContext({
      ...this.options,
      getVariable: (name) => this.variables.get(name),
      getFacts: () => this.facts,
    })
  }
}
