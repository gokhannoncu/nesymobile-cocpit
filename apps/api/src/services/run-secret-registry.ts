import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { asSecret, type Secret } from '@nesy/control-contract'

type Direction = 'app->host' | 'host->app'

export interface RunSecretRecord {
  runId: string
  deviceId: string
  appId: string
  expiresAtMs: number
}

const PROTOCOL = 'verdict-hmac-v1'
const SECRET_TTL_MS = 60 * 60 * 1000

class RunSecretRegistryImpl {
  private readonly secrets = new Map<string, { record: RunSecretRecord; secret: Buffer }>()

  issue(input: { runId: string; deviceId: string; appId: string; nowMs?: number }): Secret {
    const secret = randomBytes(32)
    this.replace(input.runId, {
      record: {
        runId: input.runId,
        deviceId: input.deviceId,
        appId: input.appId,
        expiresAtMs: (input.nowMs ?? Date.now()) + SECRET_TTL_MS,
      },
      secret,
    })
    return asSecret(secret.toString('base64url'))
  }

  retire(runId: string): void {
    const existing = this.secrets.get(runId)
    existing?.secret.fill(0)
    this.secrets.delete(runId)
  }

  metadata(runId: string): RunSecretRecord | undefined {
    const existing = this.current(runId)
    return existing === undefined ? undefined : { ...existing.record }
  }

  verifyHello(input: {
    runId: string
    sessionId: string
    nonce: string
    timestampMillis: number
    signature: string
    nowMs?: number
  }): boolean {
    const existing = this.current(input.runId, input.nowMs)
    if (existing === undefined) return false
    if (!withinWindow(input.nowMs ?? Date.now(), input.timestampMillis, 60_000)) return false
    const supplied = Buffer.from(input.signature, 'base64url')
    const expected = hmac(existing.secret, 'app->host', input)
    try {
      return supplied.length === expected.length && timingSafeEqual(supplied, expected)
    } finally {
      expected.fill(0)
    }
  }

  hostSignature(input: {
    runId: string
    sessionId: string
    nonce: string
    timestampMillis: number
    nowMs?: number
  }): string | undefined {
    const existing = this.current(input.runId, input.nowMs)
    if (existing === undefined) return undefined
    const signature = hmac(existing.secret, 'host->app', input)
    try {
      return signature.toString('base64url')
    } finally {
      signature.fill(0)
    }
  }

  private replace(runId: string, entry: { record: RunSecretRecord; secret: Buffer }): void {
    this.retire(runId)
    this.secrets.set(runId, entry)
  }

  private current(runId: string, nowMs = Date.now()): { record: RunSecretRecord; secret: Buffer } | undefined {
    const existing = this.secrets.get(runId)
    if (existing === undefined) return undefined
    if (existing.record.expiresAtMs <= nowMs) {
      this.retire(runId)
      return undefined
    }
    return existing
  }
}

export const RunSecretRegistry = new RunSecretRegistryImpl()

function hmac(
  secret: Buffer,
  direction: Direction,
  input: { runId: string; sessionId: string; nonce: string; timestampMillis: number },
): Buffer {
  return createHmac('sha256', secret)
    .update(canonicalMessage(direction, input))
    .digest()
}

function canonicalMessage(
  direction: Direction,
  input: { runId: string; sessionId: string; nonce: string; timestampMillis: number },
): Buffer {
  return Buffer.concat([
    lp(PROTOCOL),
    lp(direction),
    lp(input.runId),
    lp(input.sessionId),
    lp(input.nonce),
    lp(String(input.timestampMillis)),
  ])
}

function lp(value: string): Buffer {
  const bytes = Buffer.from(value, 'utf8')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(bytes.length)
  return Buffer.concat([length, bytes])
}

function withinWindow(now: number, then: number, window: number): boolean {
  const diff = Math.abs(now - then)
  return Number.isFinite(diff) && diff <= window
}
