import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const automationLayoutUrl = new URL(
  '../app/(cockpit)/automation/layout.tsx',
  import.meta.url,
)
const automationLayoutPath = fileURLToPath(automationLayoutUrl)

describe('automation route auth provider', () => {
  it('wraps automation pages with NesyAuthProvider', () => {
    expect(existsSync(automationLayoutPath)).toBe(true)
    if (!existsSync(automationLayoutPath)) return

    const source = readFileSync(automationLayoutPath, 'utf8')
    expect(source).toContain('<NesyAuthProvider>{children}</NesyAuthProvider>')
  })
})
