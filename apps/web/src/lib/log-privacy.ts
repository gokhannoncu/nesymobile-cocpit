// Privacy redaction for diagnostic exports.
//
// Compiles PrivacyRule patterns into RegExps and applies the enabled ones to
// text (event messages, raw lines, stack traces, context, metadata) during
// bundle export. Original captured data in IndexedDB is never modified — masking
// happens only on the copy written into a bundle.

import type { PrivacyRule, MaskManifestEntry } from '@/data/engineering/device-lab/device-lab-types'

export interface CompiledPrivacyRule {
  rule: PrivacyRule
  regex: RegExp
}

export interface CompileResult {
  compiled: CompiledPrivacyRule[]
  /** Enabled rules whose pattern failed to compile. If non-empty, do not export. */
  errors: { id: string; label: string; message: string }[]
}

/** Compiles only the enabled rules. Global + case-insensitive matching. */
export function compilePrivacyRules(rules: PrivacyRule[]): CompileResult {
  const compiled: CompiledPrivacyRule[] = []
  const errors: CompileResult['errors'] = []
  for (const rule of rules) {
    if (!rule.enabled) continue
    try {
      compiled.push({ rule, regex: new RegExp(rule.pattern, 'gi') })
    } catch (e) {
      errors.push({
        id: rule.id,
        label: rule.label,
        message: e instanceof Error ? e.message : String(e),
      })
    }
  }
  return { compiled, errors }
}

export interface MaskAccumulator {
  hits: Map<string, number>
}

export function createMaskAccumulator(): MaskAccumulator {
  return { hits: new Map() }
}

/**
 * Applies every compiled rule to `text`, accumulating per-rule hit counts.
 * Returns the masked text.
 */
export function maskText(
  text: string,
  compiled: CompiledPrivacyRule[],
  acc: MaskAccumulator,
): string {
  if (!text) return text
  let result = text
  for (const { rule, regex } of compiled) {
    // Fresh lastIndex per call — the regex is reused across many strings.
    regex.lastIndex = 0
    let count = 0
    result = result.replace(regex, () => {
      count += 1
      return rule.replacement
    })
    if (count > 0) acc.hits.set(rule.id, (acc.hits.get(rule.id) ?? 0) + count)
  }
  return result
}

/** Builds the export manifest from accumulated hit counts. */
export function buildMaskManifest(
  compiled: CompiledPrivacyRule[],
  acc: MaskAccumulator,
): MaskManifestEntry[] {
  return compiled.map(({ rule }) => ({
    ruleId: rule.id,
    label: rule.label,
    hits: acc.hits.get(rule.id) ?? 0,
  }))
}
