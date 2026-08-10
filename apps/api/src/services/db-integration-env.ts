import { readFileSync } from 'node:fs'

export function requireDatabaseUrlForIntegration(): void {
  if (process.env.DATABASE_URL?.trim()) return

  try {
    const envPath = new URL('../../.env', import.meta.url)
    const text = readFileSync(envPath, 'utf8')
    const match = /^DATABASE_URL=(.*)$/m.exec(text)
    const raw = match?.[1]?.trim()
    if (raw) {
      process.env.DATABASE_URL = raw.replace(/^["']|["']$/g, '')
      return
    }
  } catch {
    // Fall through to the explicit failure below.
  }

  throw new Error('DATABASE_URL is required for DB-backed Verdict integration tests')
}
