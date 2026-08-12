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
 *
 * ### Per-occurrence identity (`entityKey`)
 *
 * A pack is authored before any run exists, so it can only ever declare WHERE
 * an identity comes from — never which record this run wants. Without that
 * substitution the host could address nothing but constants: a target for "the
 * row of the requested route" produced NO selector at all, because the pack
 * declares `idPrefix` / `keyPath` (a rule) and this builder only read literals
 * (a value). The chain was walked to the end and the target came back
 * unaddressable, which is what a resolve step reports as a bare failure.
 *
 * `entityKey` is that missing half: the step's `entityBinding.id` resolved for
 * this occurrence. Two composition rules, both DECLARED by the pack rather than
 * inferred here:
 *
 *   - `ACCESSIBILITY_ID` + `idPrefix` → id is `idPrefix + entityKey`.
 *   - `ENTITY_BINDING` → the entity key IS the addressable text.
 *
 * A declared literal still wins for `TEXT_MATCH`, which exists precisely to
 * name a constant. And a chain link whose rule needs an entity key it did not
 * get is SKIPPED, not guessed at — the next provider gets its turn, and a chain
 * that runs out still returns `undefined`. Substituting an empty string would
 * address the first row that happens to match nothing in particular.
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

export function buildTargetFingerprint(
  target: TargetDefinition,
  /** Identity for THIS occurrence — the step's `entityBinding.id`, resolved. */
  entityKey?: string,
): TargetFingerprint | undefined {
  const key = entityKey !== undefined && entityKey !== '' ? entityKey : undefined
  const rowIndexHint = target.resolution.chain
    .filter((strategy) => strategy.kind === 'ROW_INDEX_HINT')
    .map((strategy) => strategy.selector['rowIndex'])
    .find((value): value is number => typeof value === 'number')

  for (const strategy of target.resolution.chain) {
    if (!strategy.establishesIdentity) continue

    if (strategy.kind === 'ACCESSIBILITY_ID' || strategy.kind === 'INSPECTOR_MAPPING') {
      const literal = selectorString(strategy, ['id', 'viewId', 'accessibilityId', 'resourceId'])
      const prefix = selectorString(strategy, ['idPrefix'])
      // A prefix is a RULE for building an id, so it is only usable with the
      // key it is a prefix of. `route_row_` alone matches every row.
      const id = literal ?? (prefix !== undefined && key !== undefined ? `${prefix}${key}` : undefined)
      if (id === undefined) continue
      return {
        version: 1,
        selector: { by: 'id', value: id, ...(rowIndexHint === undefined ? {} : { rowIndexHint }) },
        expectedId: id,
        ...(rowIndexHint === undefined ? {} : { rowIndexHint }),
      }
    }

    if (strategy.kind === 'ENTITY_BINDING' || strategy.kind === 'TEXT_MATCH') {
      // ENTITY_BINDING means "identity is the entity key", so the run's key
      // outranks anything the pack could have written down. TEXT_MATCH means
      // "identity is this constant", so the literal is the answer.
      const literal = selectorString(strategy, ['text', 'value', 'label', 'entityKey'])
      const text = strategy.kind === 'ENTITY_BINDING' ? (key ?? literal) : (literal ?? key)
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
