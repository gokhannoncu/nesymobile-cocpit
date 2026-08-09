/**
 * Domain Pack target definition → Bridge target fingerprint.
 *
 * The pack declares a provider chain ordered by identity strength, and that
 * order is the pack author's trust declaration — so this walks it in order and
 * takes the first provider it can turn into a selector. `ROW_INDEX_HINT` is
 * never one of them: it may narrow a search, never decide a target. A row-index
 * "identity" survives a background re-sort by silently addressing a different
 * record, which is the failure mode where every oracle passes and the data is
 * still wrong.
 */

import type { TargetFingerprint } from '@nesy/bridge-contract'
import type { TargetDefinition, TargetResolutionStrategy } from '@nesy/domain-pack-contracts'

function selectorString(
  strategy: TargetResolutionStrategy,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = strategy.selector[key]
    if (typeof value === 'string' && value !== '') return value
  }
  return undefined
}

export function buildTargetFingerprint(target: TargetDefinition): TargetFingerprint | undefined {
  const rowIndexHint = target.resolution.chain
    .filter((strategy) => strategy.kind === 'ROW_INDEX_HINT')
    .map((strategy) => strategy.selector['rowIndex'])
    .find((value): value is number => typeof value === 'number')

  for (const strategy of target.resolution.chain) {
    if (!strategy.establishesIdentity) continue

    if (strategy.kind === 'ACCESSIBILITY_ID' || strategy.kind === 'INSPECTOR_MAPPING') {
      const id = selectorString(strategy, ['id', 'viewId', 'accessibilityId', 'resourceId'])
      if (id === undefined) continue
      return {
        version: 1,
        selector: { by: 'id', value: id, ...(rowIndexHint === undefined ? {} : { rowIndexHint }) },
        expectedId: id,
        ...(rowIndexHint === undefined ? {} : { rowIndexHint }),
      }
    }

    if (strategy.kind === 'ENTITY_BINDING' || strategy.kind === 'TEXT_MATCH') {
      const text = selectorString(strategy, ['text', 'value', 'label', 'entityKey'])
      if (text === undefined) continue
      const exact = strategy.selector['exact']
      return {
        version: 1,
        selector: {
          by: 'text',
          value: text,
          ...(typeof exact === 'boolean' ? { exact } : {}),
          ...(rowIndexHint === undefined ? {} : { rowIndexHint }),
        },
        expectedText: text,
        ...(strategy.kind === 'ENTITY_BINDING' ? { rowKey: text } : {}),
        ...(rowIndexHint === undefined ? {} : { rowIndexHint }),
      }
    }
  }

  // STRUCTURAL_FINGERPRINT has no Bridge v1 selector form; a target that offers
  // only that cannot be addressed by this host, and saying so beats guessing.
  return undefined
}

export function isTargetFingerprint(value: unknown): value is TargetFingerprint {
  if (value === null || typeof value !== 'object') return false
  const candidate = value as Partial<TargetFingerprint>
  if (candidate.version !== 1 || candidate.selector === undefined) return false
  const selector = candidate.selector
  return (
    (selector.by === 'id' || selector.by === 'text') &&
    typeof selector.value === 'string' &&
    selector.value !== ''
  )
}
