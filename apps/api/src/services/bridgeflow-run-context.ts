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

import type { BridgeCapabilityManifest, BridgeCommand } from '@nesy/bridge-contract'
import type { NormalizedEvidenceFact } from '@nesy/oracle-engine'
import type { VariableRuntimePort } from '@nesy/bridgeflow-executor'
import type {
  ConditionEvaluationContext,
  ConditionLiteralValue,
  ConditionOperandRef,
  OperandResolution,
} from '@nesy/workflow-contract'

/** Namespaces served out of the run variable store. */
const VARIABLE_SOURCES = new Set(['step.output', 'local.result', 'remote.result', 'loop.item'])

/** Namespaces served out of observed evidence facts, keyed by `path` = factKey. */
const EVIDENCE_SOURCES = new Set([
  'sdk.state',
  'sdk.event',
  'bridge.node',
  'bridge.visible',
  'bridge.obscuredBy',
])

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
    return {
      resolveOperand: (ref) => this.resolveOperand(ref),
      ...(this.options.allowlistedPatterns === undefined
        ? {}
        : { allowlistedPatterns: this.options.allowlistedPatterns }),
      ...(this.options.clock === undefined ? {} : { nowMs: this.options.clock }),
    }
  }

  private resolveOperand(ref: ConditionOperandRef): OperandResolution {
    if (ref.source === 'environment') {
      return literal(this.options.environment, 'run.environment')
    }
    if (ref.source === 'country') {
      return literal(this.options.country, 'run.country')
    }
    if (ref.source === 'run.input') {
      return fromRecord(this.options.runInputs, ref.path, 'run.input')
    }
    if (ref.source === 'device.capability') {
      return this.resolveCapability(ref.path)
    }
    if (VARIABLE_SOURCES.has(ref.source)) {
      if (ref.path === undefined) return { resolved: false, reason: 'MISSING', origin: ref.source }
      const [head, ...rest] = ref.path.split('.')
      if (head === undefined || !this.variables.has(head)) {
        return { resolved: false, reason: 'MISSING', origin: ref.source }
      }
      return toLiteral(dig(this.variables.get(head), rest), ref.source)
    }
    if (EVIDENCE_SOURCES.has(ref.source)) {
      const factKey = ref.path ?? ref.source
      const fact = this.facts.find((candidate) => candidate.factKey === factKey)
      if (fact === undefined) {
        return { resolved: false, reason: 'NOT_OBSERVED', origin: `evidence:${factKey}` }
      }
      return toLiteral(fact.value, `evidence:${factKey}`)
    }
    return { resolved: false, reason: 'CAPABILITY_UNAVAILABLE', origin: ref.source }
  }

  private resolveCapability(path: string | undefined): OperandResolution {
    const capabilities = this.options.capabilities
    if (capabilities === undefined || capabilities === null) {
      // No handshake happened, so no capability claim can be made either way.
      return { resolved: false, reason: 'CAPABILITY_UNAVAILABLE', origin: 'device.capability' }
    }
    if (path === undefined) return { resolved: false, reason: 'MISSING', origin: 'device.capability' }

    if (path.startsWith('commands.')) {
      const command = path.slice('commands.'.length) as BridgeCommand
      return { resolved: true, value: capabilities.commands.includes(command), origin: 'device.capability' }
    }
    return toLiteral(dig(capabilities as unknown, path.split('.')), 'device.capability')
  }
}

function literal(value: string | undefined, origin: string): OperandResolution {
  return value === undefined
    ? { resolved: false, reason: 'MISSING', origin }
    : { resolved: true, value, origin }
}

function fromRecord(
  record: Readonly<Record<string, unknown>> | undefined,
  path: string | undefined,
  origin: string,
): OperandResolution {
  if (record === undefined || path === undefined) {
    return { resolved: false, reason: 'MISSING', origin }
  }
  const segments = path.split('.')
  const head = segments[0]
  if (head === undefined || !(head in record)) {
    return { resolved: false, reason: 'MISSING', origin }
  }
  return toLiteral(dig(record[head], segments.slice(1)), origin)
}

function dig(value: unknown, segments: readonly string[]): unknown {
  let current = value
  for (const segment of segments) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function toLiteral(value: unknown, origin: string): OperandResolution {
  if (value === undefined) return { resolved: false, reason: 'MISSING', origin }
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return { resolved: true, value: value as ConditionLiteralValue, origin }
  }
  if (Array.isArray(value) && value.every(isLiteral)) {
    return { resolved: true, value: value as readonly ConditionLiteralValue[], origin }
  }
  // An object cannot be compared by the three-valued evaluator; saying so beats
  // stringifying it into an accidental match.
  return { resolved: false, reason: 'INVALID_TYPE', origin }
}

function isLiteral(value: unknown): value is ConditionLiteralValue {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}
