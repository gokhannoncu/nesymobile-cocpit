/**
 * BridgeFlow condition engine boundary.
 *
 * `@nesy/workflow-contract` owns the typed AST evaluator. This module owns the
 * Cockpit/API runtime side: where operands are read from and how unresolved
 * reads are explained. Keeping this outside `bridgeflow-run-context` prevents
 * condition behavior from being spread across the variable store and executor
 * wiring.
 */

import type { BridgeCapabilityManifest, BridgeCommand } from '@nesy/bridge-contract'
import type { NormalizedEvidenceFact } from '@nesy/oracle-engine'
import type {
  ConditionEvaluationContext,
  ConditionLiteralValue,
  ConditionOperandRef,
  OperandResolution,
} from '@nesy/workflow-contract'

const VARIABLE_SOURCES = new Set(['step.output', 'local.result', 'remote.result', 'loop.item'])
const EVIDENCE_SOURCES = new Set([
  'sdk.state',
  'sdk.event',
  'bridge.node',
  'bridge.visible',
  'bridge.obscuredBy',
])

export interface RuntimeConditionEngineOptions {
  runInputs?: Readonly<Record<string, unknown>>
  capabilities?: BridgeCapabilityManifest | null
  environment?: string
  country?: string
  allowlistedPatterns?: Readonly<Record<string, RegExp>>
  clock?: () => number
  getVariable(name: string): unknown
  getFacts(): readonly NormalizedEvidenceFact[]
}

export function createRuntimeConditionContext(
  options: RuntimeConditionEngineOptions,
): ConditionEvaluationContext {
  return {
    resolveOperand: (ref) => resolveRuntimeOperand(ref, options),
    ...(options.allowlistedPatterns === undefined
      ? {}
      : { allowlistedPatterns: options.allowlistedPatterns }),
    ...(options.clock === undefined ? {} : { nowMs: options.clock }),
  }
}

export function resolveRuntimeOperand(
  ref: ConditionOperandRef,
  options: RuntimeConditionEngineOptions,
): OperandResolution {
  if (ref.source === 'environment') return literal(options.environment, 'run.environment')
  if (ref.source === 'country') return literal(options.country, 'run.country')
  if (ref.source === 'run.input') return fromRecord(options.runInputs, ref.path, 'run.input')
  if (ref.source === 'device.capability') return resolveCapability(ref.path, options.capabilities)

  if (VARIABLE_SOURCES.has(ref.source)) {
    if (ref.path === undefined) return { resolved: false, reason: 'MISSING', origin: ref.source }
    const [head, ...rest] = ref.path.split('.')
    if (head === undefined) return { resolved: false, reason: 'MISSING', origin: ref.source }
    const value = options.getVariable(head)
    if (value === undefined) return { resolved: false, reason: 'MISSING', origin: ref.source }
    return toLiteral(dig(value, rest), ref.source)
  }

  if (EVIDENCE_SOURCES.has(ref.source)) {
    const factKey = ref.path ?? ref.source
    const fact = options.getFacts().find((candidate) => candidate.factKey === factKey)
    if (fact === undefined) {
      return { resolved: false, reason: 'NOT_OBSERVED', origin: `evidence:${factKey}` }
    }
    return toLiteral(fact.value, `evidence:${factKey}`)
  }

  return { resolved: false, reason: 'CAPABILITY_UNAVAILABLE', origin: ref.source }
}

function resolveCapability(
  path: string | undefined,
  capabilities: BridgeCapabilityManifest | null | undefined,
): OperandResolution {
  if (capabilities === undefined || capabilities === null) {
    return { resolved: false, reason: 'CAPABILITY_UNAVAILABLE', origin: 'device.capability' }
  }
  if (path === undefined) return { resolved: false, reason: 'MISSING', origin: 'device.capability' }
  if (path.startsWith('commands.')) {
    const command = path.slice('commands.'.length) as BridgeCommand
    return { resolved: true, value: capabilities.commands.includes(command), origin: 'device.capability' }
  }
  return toLiteral(dig(capabilities as unknown, path.split('.')), 'device.capability')
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

/**
 * Walk a dotted path, PLUCKING a column when the value is a row set.
 *
 * A named query answers with rows, and the question a condition asks of it is
 * almost always about one column across all of them — "is the requested route
 * among the offered ones". Without plucking, the only expressible questions are
 * about row zero, and a macro wanting the list had to invent a field the
 * projection never carried.
 *
 * An array of rows + a segment therefore yields the array of that column's
 * values, which is exactly what `in` compares against. Rows missing the column
 * contribute nothing rather than `undefined`: a partial projection should narrow
 * the answer, not poison it.
 */
function dig(value: unknown, segments: readonly string[]): unknown {
  let current = value
  for (const segment of segments) {
    if (Array.isArray(current)) {
      current = current
        .map((row) => (row !== null && typeof row === 'object' ? (row as Record<string, unknown>)[segment] : undefined))
        .filter((entry) => entry !== undefined)
      continue
    }
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
