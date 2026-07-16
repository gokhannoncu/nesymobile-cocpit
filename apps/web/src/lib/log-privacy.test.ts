import { describe, it, expect } from 'vitest'
import {
  compilePrivacyRules,
  createMaskAccumulator,
  maskText,
  buildMaskManifest,
} from './log-privacy'
import type { PrivacyRule } from '@/data/engineering/device-lab/device-lab-types'

const rules: PrivacyRule[] = [
  { id: 'token', label: 'Access Token', pattern: 'Bearer [A-Za-z0-9\\-._~+/]+=*', replacement: 'Bearer ***', enabled: true },
  { id: 'pin', label: 'PIN', pattern: '"pin"\\s*:\\s*"\\d{4,6}"', replacement: '"pin": "***"', enabled: true },
  { id: 'phone', label: 'Phone', pattern: '\\+?90\\s?\\d{3}\\s?\\d{3}\\s?\\d{2}\\s?\\d{2}', replacement: '+90 *** *** ** **', enabled: false },
]

describe('compilePrivacyRules', () => {
  it('compiles only enabled rules', () => {
    const { compiled, errors } = compilePrivacyRules(rules)
    expect(errors).toHaveLength(0)
    expect(compiled.map((c) => c.rule.id)).toEqual(['token', 'pin'])
  })

  it('reports rules that fail to compile', () => {
    const bad: PrivacyRule[] = [{ id: 'bad', label: 'Bad', pattern: '([', replacement: 'x', enabled: true }]
    const { compiled, errors } = compilePrivacyRules(bad)
    expect(compiled).toHaveLength(0)
    expect(errors[0]!.id).toBe('bad')
  })
})

describe('maskText', () => {
  it('masks matches and counts hits per rule', () => {
    const { compiled } = compilePrivacyRules(rules)
    const acc = createMaskAccumulator()
    const masked = maskText(
      'auth=Bearer abc123.def and {"pin":"1234"} and Bearer zzz999',
      compiled,
      acc,
    )
    expect(masked).not.toContain('abc123')
    expect(masked).toContain('Bearer ***')
    expect(masked).toContain('"pin": "***"')
    expect(acc.hits.get('token')).toBe(2)
    expect(acc.hits.get('pin')).toBe(1)
  })

  it('does not apply disabled rules', () => {
    const { compiled } = compilePrivacyRules(rules)
    const acc = createMaskAccumulator()
    const masked = maskText('call +90 555 123 45 67', compiled, acc)
    expect(masked).toContain('+90 555 123 45 67')
    expect(acc.hits.get('phone')).toBeUndefined()
  })

  it('builds a manifest with zero-hit entries', () => {
    const { compiled } = compilePrivacyRules(rules)
    const acc = createMaskAccumulator()
    maskText('nothing sensitive here', compiled, acc)
    const manifest = buildMaskManifest(compiled, acc)
    expect(manifest).toEqual([
      { ruleId: 'token', label: 'Access Token', hits: 0 },
      { ruleId: 'pin', label: 'PIN', hits: 0 },
    ])
  })
})
