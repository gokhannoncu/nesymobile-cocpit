import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { RunSecretRegistry } from './run-secret-registry.js'

describe('RunSecretRegistry', () => {
  it('verifies app hello signatures and produces the host counter-signature', () => {
    const runId = `run-auth-${Date.now()}`
    const sessionId = 'session-1'
    const nonce = 'nonce-1'
    const ts = 1_700_000_000_000
    const secret = RunSecretRegistry.issue({
      runId,
      deviceId: 'device-1',
      appId: 'com.arasdigital.nesymobile.rstest',
      nowMs: ts,
    })

    const appSig = sign(String(secret), 'app->host', runId, sessionId, nonce, ts)
    expect(RunSecretRegistry.verifyHello({
      runId,
      sessionId,
      nonce,
      timestampMillis: ts,
      signature: appSig,
      nowMs: ts,
    })).toBe(true)

    expect(RunSecretRegistry.hostSignature({
      runId,
      sessionId,
      nonce,
      timestampMillis: ts,
      nowMs: ts,
    })).toBe(sign(String(secret), 'host->app', runId, sessionId, nonce, ts))
    RunSecretRegistry.retire(runId)
  })

  it('rejects stale or wrong-direction signatures', () => {
    const runId = `run-auth-stale-${Date.now()}`
    const sessionId = 'session-1'
    const nonce = 'nonce-1'
    const ts = 1_700_000_000_000
    const secret = RunSecretRegistry.issue({
      runId,
      deviceId: 'device-1',
      appId: 'com.arasdigital.nesymobile.rstest',
      nowMs: ts,
    })

    expect(RunSecretRegistry.verifyHello({
      runId,
      sessionId,
      nonce,
      timestampMillis: ts,
      signature: sign(String(secret), 'host->app', runId, sessionId, nonce, ts),
      nowMs: ts,
    })).toBe(false)
    expect(RunSecretRegistry.verifyHello({
      runId,
      sessionId,
      nonce,
      timestampMillis: ts,
      signature: sign(String(secret), 'app->host', runId, sessionId, nonce, ts),
      nowMs: ts + 61_000,
    })).toBe(false)
    RunSecretRegistry.retire(runId)
  })
})

function sign(
  secret: string,
  direction: 'app->host' | 'host->app',
  runId: string,
  sessionId: string,
  nonce: string,
  timestampMillis: number,
): string {
  return createHmac('sha256', Buffer.from(secret, 'base64url'))
    .update(canonical(direction, runId, sessionId, nonce, timestampMillis))
    .digest('base64url')
}

function canonical(
  direction: 'app->host' | 'host->app',
  runId: string,
  sessionId: string,
  nonce: string,
  timestampMillis: number,
): Buffer {
  return Buffer.concat([
    lp('verdict-hmac-v1'),
    lp(direction),
    lp(runId),
    lp(sessionId),
    lp(nonce),
    lp(String(timestampMillis)),
  ])
}

function lp(value: string): Buffer {
  const bytes = Buffer.from(value, 'utf8')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(bytes.length)
  return Buffer.concat([length, bytes])
}
