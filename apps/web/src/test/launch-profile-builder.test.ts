import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(
  resolve(__dirname, '../components/automation/editor/LaunchProfileBuilder.tsx'),
  'utf8',
)
const CLIENT = readFileSync(
  resolve(__dirname, '../lib/verdict-runtime/client.ts'),
  'utf8',
)

describe('LaunchProfileBuilder — runtime binding (6D.1c)', () => {
  it('calls the verdict-runtime client instead of unbound form fields', () => {
    expect(SRC).toMatch(/verdict-runtime\/client/)
    expect(SRC).toMatch(/fetchVerdictLaunchProfiles/)
    expect(SRC).toMatch(/validateVerdictLaunchProfile/)
    expect(SRC).not.toMatch(/App Package \(e\.g\. com\.example\.app\)/)
    expect(SRC).not.toMatch(/Deep Link URI \(optional\)/)
  })

  it('separates loading, empty, and error states', () => {
    expect(SRC).toMatch(/status: 'loading'/)
    expect(SRC).toMatch(/status: 'empty'/)
    expect(SRC).toMatch(/status: 'error'/)
    expect(SRC).toMatch(/No launch profiles/)
    expect(SRC).toMatch(/Launch profiles unavailable/)
  })

  it('blocks DIRECT_STATE in release builds', () => {
    expect(SRC).toMatch(/releaseBuild/)
    expect(SRC).toMatch(/DIRECT_STATE/)
    expect(SRC).toMatch(/blocked in release/)
    expect(SRC).toMatch(/disabled=\{releaseBuild && m === 'DIRECT_STATE'\}/)
  })

  it('shows validation violations field-by-field', () => {
    expect(SRC).toMatch(/groupViolationsByField/)
    expect(SRC).toMatch(/fieldErrors/)
    expect(CLIENT).toMatch(/launch-profiles\/validate/)
    expect(CLIENT).toMatch(/response\.ok \|\| response\.status === 422/)
  })
})
