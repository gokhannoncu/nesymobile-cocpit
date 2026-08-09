/**
 * Nesy back-office adapter — the thing that actually calls the dispatch backend.
 *
 * The transport convention is the one the rest of this API already speaks to
 * Nesy: POST `{baseUrl}/{Service}/{Topic}`, portal headers with a bearer token,
 * and a `{ resultCode, resultMessage, payload }` envelope.
 *
 * The envelope is why `response.ok` is not the answer: Nesy returns HTTP 200
 * with a non-200 `resultCode` for business failures. Treating the 200 as success
 * is precisely the "HTTP 2xx as business success" mistake the Domain Pack
 * contract calls out, so a bad `resultCode` is a FAILED terminal here.
 *
 * A lost response is `UNKNOWN_EFFECT`, never FAILED: the mutation may well have
 * landed, and reporting it as failed invites a retry that approves a tour twice.
 */

import type { RemoteActionTerminalResult } from '@nesy/execution-contract'

import { resolveBackofficeEndpoint, type BackofficeEndpoint } from './nesy-backoffice-endpoints.js'

export interface BackofficeCallInput {
  operationRef: string
  inputs: Readonly<Record<string, unknown>>
  timeoutMs: number
  /** Idempotency key, forwarded so the backend can de-duplicate keyed mutations. */
  idempotencyKey?: string
}

export interface BackofficeCallResult {
  terminal: RemoteActionTerminalResult
  /** Normalized response the pack's `responsePath` bindings address. */
  normalizedResponse: Record<string, unknown>
}

export interface BackofficeCredentials {
  baseUrl: string
  token: string
}

export interface NesyBackofficeAdapterOptions {
  /**
   * Resolve base URL + bearer token for the run. Absent or throwing means the
   * environment is not configured, and every operation fails closed with that
   * reason rather than calling an unknown host.
   */
  credentials: () => BackofficeCredentials | Promise<BackofficeCredentials>
  /** Test seam. Defaults to global fetch. */
  fetchImpl?: typeof fetch
  /** Audit sink. Redaction is applied before anything reaches it. */
  audit?: (record: BackofficeAuditRecord) => void
  clock?: () => number
}

export interface BackofficeAuditRecord {
  operationRef: string
  path: string
  atMs: number
  durationMs: number
  resultCode: number | null
  status: RemoteActionTerminalResult['status']
  /** Redacted request body. Never the raw one. */
  request?: unknown
  /** Redacted response payload. Never the raw one. */
  response?: unknown
}

export interface BackofficeAuditPolicy {
  recordRequest: boolean
  recordResponse: boolean
  redactFields: readonly string[]
}

export interface BackofficeAdapter {
  call(input: BackofficeCallInput, audit: BackofficeAuditPolicy): Promise<BackofficeCallResult>
}

function failed(error: string): BackofficeCallResult {
  return { terminal: { status: 'FAILED', error }, normalizedResponse: {} }
}

export function createNesyBackofficeAdapter(
  options: NesyBackofficeAdapterOptions,
): BackofficeAdapter {
  const doFetch = options.fetchImpl ?? fetch
  const clock = options.clock ?? Date.now

  return {
    async call(input, auditPolicy): Promise<BackofficeCallResult> {
      const endpoint = resolveBackofficeEndpoint(input.operationRef)
      if (endpoint === undefined) {
        return failed(`no back-office endpoint is mapped for operation "${input.operationRef}"`)
      }

      let credentials: BackofficeCredentials
      try {
        credentials = await options.credentials()
      } catch (error) {
        return failed(
          `back-office credentials unavailable: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
      if (credentials.baseUrl.trim() === '' || credentials.token.trim() === '') {
        return failed('back-office base URL or token is not configured for this run')
      }

      const body = endpoint.body(input.inputs)
      const startedAtMs = clock()
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), input.timeoutMs)

      try {
        const response = await doFetch(`${credentials.baseUrl.replace(/\/$/, '')}/${endpoint.path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${credentials.token}`,
            'X-Channel': 'Portal',
            'X-Client-Request-Time': new Date(startedAtMs).toISOString(),
            'X-Error-Handling': 'inactive',
            ...(input.idempotencyKey === undefined ? {} : { 'X-Idempotency-Key': input.idempotencyKey }),
          },
          body: JSON.stringify(body ?? {}),
          signal: controller.signal,
        })

        const text = await response.text()
        let envelope: Record<string, unknown> = {}
        try {
          envelope = text === '' ? {} : (JSON.parse(text) as Record<string, unknown>)
        } catch {
          return record(failed('back-office returned a non-JSON body'), null)
        }

        const resultCode = numberOrNull(envelope['resultCode'] ?? envelope['ResultCode'])
        const payload = envelope['payload'] ?? envelope['Payload'] ?? null

        if (!response.ok) {
          return record(
            failed(`back-office HTTP ${response.status}: ${resultMessage(envelope) ?? response.statusText}`),
            resultCode,
            payload,
          )
        }
        // 200 with a business failure code. The envelope, not the status line,
        // is the business answer.
        if (resultCode !== null && resultCode !== 200) {
          return record(
            failed(`back-office resultCode ${resultCode}: ${resultMessage(envelope) ?? 'no message'}`),
            resultCode,
            payload,
          )
        }

        const normalizedResponse =
          endpoint.normalize === undefined
            ? { payload }
            : endpoint.normalize(payload, input.inputs)

        return record(
          { terminal: { status: 'SUCCEEDED' }, normalizedResponse },
          resultCode,
          payload,
        )
      } catch (error) {
        const aborted = error instanceof Error && error.name === 'AbortError'
        // Timed out or transport-lost: the call may have been applied. Saying
        // FAILED here would license a retry of a mutation that already ran.
        return record(
          {
            terminal: {
              status: 'UNKNOWN_EFFECT',
              error: aborted
                ? `back-office call timed out after ${input.timeoutMs}ms; effect unknown`
                : `back-office transport error: ${error instanceof Error ? error.message : String(error)}`,
            },
            normalizedResponse: {},
          },
          null,
        )
      } finally {
        clearTimeout(timer)
      }

      function record(
        result: BackofficeCallResult,
        resultCode: number | null,
        payload?: unknown,
      ): BackofficeCallResult {
        options.audit?.({
          operationRef: input.operationRef,
          path: endpoint!.path,
          atMs: startedAtMs,
          durationMs: clock() - startedAtMs,
          resultCode,
          status: result.terminal.status,
          ...(auditPolicy.recordRequest ? { request: redact(body, auditPolicy.redactFields) } : {}),
          ...(auditPolicy.recordResponse && payload !== undefined
            ? { response: redact(payload, auditPolicy.redactFields) }
            : {}),
        })
        return result
      }
    },
  }
}

function resultMessage(envelope: Record<string, unknown>): string | undefined {
  const message = envelope['resultMessage'] ?? envelope['ResultMessage']
  return typeof message === 'string' ? message : undefined
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Drop the operation's declared sensitive fields before anything is recorded.
 *
 * Paths are dotted and matched against the leaf name as well, because the pack
 * declares them against its own normalized shape (`request.requesterName`) while
 * the backend body uses its own (`RequesterName`).
 */
export function redact(value: unknown, redactFields: readonly string[]): unknown {
  if (redactFields.length === 0) return value
  const leaves = new Set(
    redactFields.flatMap((field) => {
      const leaf = field.split('.').at(-1) ?? field
      return [field.toLowerCase(), leaf.toLowerCase()]
    }),
  )

  const walk = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(walk)
    if (input === null || typeof input !== 'object') return input
    const output: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(input as Record<string, unknown>)) {
      output[key] = leaves.has(key.toLowerCase()) ? '[redacted]' : walk(child)
    }
    return output
  }

  return walk(value)
}
