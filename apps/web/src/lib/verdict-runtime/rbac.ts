import type { ReadonlyHeaders } from 'next/dist/server/web/spec-extension/adapters/headers'

export function canReadRawEvidence(headers: ReadonlyHeaders): boolean {
  const permissions = new Set(
    (headers.get('x-verdict-permissions') ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )
  const roles = new Set(
    (headers.get('x-verdict-roles') ?? headers.get('x-verdict-role') ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )
  return permissions.has('*') ||
    permissions.has('verdict:evidence:raw') ||
    roles.has('verdict-admin') ||
    roles.has('security-reviewer')
}
