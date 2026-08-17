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

import {
  isWaitingForApproval,
  resolveBackofficeEndpoint,
  type BackofficeEndpoint,
} from './nesy-backoffice-endpoints.js'

export interface BackofficeCallInput {
  operationRef: string
  inputs: Readonly<Record<string, unknown>>
  timeoutMs: number
  /** Optional run-scoped cancellation, linked to the adapter deadline. */
  signal?: AbortSignal
  /** Idempotency key, forwarded so the backend can de-duplicate keyed mutations. */
  idempotencyKey?: string
  /**
   * Which plan step is making the call. An injector arms one step, and the
   * same `operationRef` can appear at several — without this the effect could
   * land on a step nobody armed.
   */
  planStepId?: string
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

export interface BackofficeTimeoutInjection {
  timeoutMs: number
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
  /**
   * G90.10 BD.3 — controlled adapter-deadline injection representing
   * BACKEND_TIMEOUT. When this returns a plan, the adapter still resolves the
   * operation and credentials, then hangs until the existing AbortController
   * deadline fires. The mutation is not dispatched: this is not an in-flight
   * “backend received the request and timed out” claim. The observed terminal
   * is still `UNKNOWN_EFFECT` from `AbortError`, not a synthesized class, and
   * is not remapped to NO_EFFECT just because the injector withheld the wire.
   */
  timeoutInjection?: (input: BackofficeCallInput) => BackofficeTimeoutInjection | null
  onTimeoutInjected?: (event: {
    kind: 'TRIGGERED' | 'EFFECT_OBSERVED'
    operationRef: string
    timeoutMs: number
  }) => void
  /**
   * G90.10 BD.2 — controlled host-side transport cut representing
   * NETWORK_DISCONNECT. When this returns a cut, the adapter still resolves
   * the operation and credentials, then withholds the wire and returns
   * `UNKNOWN_EFFECT`. This is not an airplane/USB claim and is not remapped
   * to NO_EFFECT or PRODUCT_FAIL just because the injector withheld the call.
   */
  transportInjection?: (input: BackofficeCallInput) => { cut: true } | null
  onTransportInjected?: (event: {
    kind: 'TRIGGERED' | 'EFFECT_OBSERVED'
    operationRef: string
  }) => void
  /** Delay between reject and the waiting-list re-read. Tests set 0. */
  reconcileDelayMs?: number
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

const TOUR_APPROVAL_OPERATIONS = new Set([
  'nesy.backoffice.approve-tour-request',
  'nesy.backoffice.read-tour-approval-request',
  'nesy.backoffice.read-tour-approval-status',
  'nesy.backoffice.reject-tour-request',
])

function isTourApprovalOperation(operationRef: string): boolean {
  return TOUR_APPROVAL_OPERATIONS.has(operationRef)
}

function pinnedApprovalScheduleId(inputs: Record<string, unknown>): string | null {
  const scheduleId = typeof inputs['approvalRequest'] === 'string' ? inputs['approvalRequest'].trim() : ''
  return scheduleId === '' ? null : scheduleId
}

function abortError(): Error {
  const error = new Error('The operation was aborted')
  error.name = 'AbortError'
  return error
}

function hangUntilAbort(_url: string, init?: RequestInit): Promise<Response> {
  return new Promise((_, reject) => {
    const signal = init?.signal
    if (signal?.aborted) {
      reject(abortError())
      return
    }
    signal?.addEventListener('abort', () => reject(abortError()), { once: true })
  })
}

function delayUntil(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(abortError())
  return new Promise((resolve, reject) => {
    const timer = setTimeout(done, ms)
    const onAbort = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      reject(abortError())
    }
    function done() {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

function hasWaitingListShape(payload: unknown): boolean {
  if (Array.isArray(payload)) return true
  if (payload === null || typeof payload !== 'object') return false
  return Object.values(payload as Record<string, unknown>).some(Array.isArray)
}

async function confirmRejectReleased(input: {
  scheduleId: string
  credentials: BackofficeCredentials
  doFetch: typeof fetch
  delayMs: number
  signal: AbortSignal
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const read = resolveBackofficeEndpoint('nesy.backoffice.read-tour-approval-request')
  if (read === undefined) {
    return { ok: false, error: 'reject-tour-request cannot reconcile: waiting-list read is not mapped' }
  }
  const url = `${input.credentials.baseUrl.replace(/\/$/, '')}/${read.path}`
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0 && input.delayMs > 0) {
      await delayUntil(input.delayMs, input.signal)
    }
    try {
      const response = await input.doFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${input.credentials.token}`,
          'X-Channel': 'Portal',
          'X-Error-Handling': 'inactive',
        },
        body: JSON.stringify(read.body({})),
        signal: input.signal,
      } as RequestInit)
      const text = await response.text()
      if (!response.ok) {
        return {
          ok: false,
          error: `reject-tour-request reconciliation HTTP ${response.status}`,
        }
      }
      let envelope: Record<string, unknown>
      try {
        const parsed = text === '' ? null : JSON.parse(text)
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return { ok: false, error: 'reject-tour-request reconciliation returned a malformed envelope' }
        }
        envelope = parsed as Record<string, unknown>
      } catch {
        return { ok: false, error: 'reject-tour-request reconciliation returned invalid JSON' }
      }
      const outerPayload = envelope['payload'] ?? envelope['Payload'] ?? null
      const nested = isEnvelope(outerPayload)
      const resultCode =
        numberOrNull(nested?.['resultCode'] ?? nested?.['ResultCode']) ??
        numberOrNull(envelope['resultCode'] ?? envelope['ResultCode'])
      if (resultCode !== 200) {
        return {
          ok: false,
          error: `reject-tour-request reconciliation resultCode ${String(resultCode)}`,
        }
      }
      const payload = nested === undefined ? outerPayload : (nested['payload'] ?? nested['Payload'] ?? null)
      if (!hasWaitingListShape(payload)) {
        return { ok: false, error: 'reject-tour-request reconciliation payload is not a waiting-list collection' }
      }
      if (!isWaitingForApproval(payload, input.scheduleId)) return { ok: true }
    } catch (error) {
      return {
        ok: false,
        error: `reject-tour-request could not re-read waiting list: ${
          error instanceof Error ? error.message : String(error)
        }`,
      }
    }
  }
  return {
    ok: false,
    error: `reject-tour-request left ${input.scheduleId} WaitingForApproval`,
  }
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
      if (isTourApprovalOperation(input.operationRef)) {
        const scheduleId = pinnedApprovalScheduleId(input.inputs)
        if (scheduleId === null) {
          return failed(
            `${input.operationRef} requires approvalRequest (scheduleId); refusing unbound tour call`,
          )
        }
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
      const transport = options.transportInjection?.(input) ?? null
      const injection = options.timeoutInjection?.(input) ?? null
      if (transport !== null && injection !== null) {
        return failed('conflicting timeout and transport injectors armed for the same call')
      }
      if (transport !== null) {
        options.onTransportInjected?.({ kind: 'TRIGGERED', operationRef: input.operationRef })
        options.onTransportInjected?.({ kind: 'EFFECT_OBSERVED', operationRef: input.operationRef })
        const cut: BackofficeCallResult = {
          terminal: {
            status: 'UNKNOWN_EFFECT',
            error: 'injected host transport cut; effect unknown',
          },
          normalizedResponse: {},
        }
        options.audit?.({
          operationRef: input.operationRef,
          path: endpoint.path,
          atMs: startedAtMs,
          durationMs: clock() - startedAtMs,
          resultCode: null,
          status: cut.terminal.status,
          ...(auditPolicy.recordRequest ? { request: redact(body, auditPolicy.redactFields) } : {}),
        })
        return cut
      }
      const timeoutMs = injection?.timeoutMs ?? input.timeoutMs
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      const abortFromCaller = () => controller.abort()
      if (input.signal?.aborted) controller.abort()
      else input.signal?.addEventListener('abort', abortFromCaller, { once: true })
      if (injection !== null) {
        options.onTimeoutInjected?.({
          kind: 'TRIGGERED',
          operationRef: input.operationRef,
          timeoutMs,
        })
      }

      try {
        const response = await (injection === null ? doFetch : hangUntilAbort)(
          `${credentials.baseUrl.replace(/\/$/, '')}/${endpoint.path}`,
          {
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
          } as RequestInit,
        )

        const text = await response.text()
        let envelope: Record<string, unknown> = {}
        try {
          envelope = text === '' ? {} : (JSON.parse(text) as Record<string, unknown>)
        } catch {
          return record(failed('back-office returned a non-JSON body'), null)
        }

        const outerResultCode = numberOrNull(envelope['resultCode'] ?? envelope['ResultCode'])
        const outerPayload = envelope['payload'] ?? envelope['Payload'] ?? null
        // Some topics answer with an envelope nested inside the envelope, so the
        // payload a normalizer would read is one level further down. Measured
        // against RS staging: `User/GetMyInfo` nests, while `GetBranchSchedules`,
        // `CheckHasCourierTodaySchedule` and `GetWaitingLeavingRequests` do not —
        // so this unwraps ON DETECTION rather than always, and a topic that stops
        // nesting keeps working without a change here.
        const nested = isEnvelope(outerPayload)
        const payload = nested === undefined ? outerPayload : (nested['payload'] ?? nested['Payload'] ?? null)
        // An inner failure code under an outer 200 is the same "2xx as business
        // success" trap one level deeper: GetMyInfo answers BAD_REQUEST/"No such
        // user" inside a 200 envelope. The innermost code is the business answer.
        const innerResultCode =
          nested === undefined ? null : numberOrNull(nested['resultCode'] ?? nested['ResultCode'])
        const resultCode = innerResultCode ?? outerResultCode

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
          // Report the message from whichever envelope carried the failing code:
          // the outer one says "OK" while the inner one says why.
          return record(
            failed(
              `back-office resultCode ${resultCode}: ${resultMessage(nested ?? envelope) ?? 'no message'}`,
            ),
            resultCode,
            payload,
          )
        }

        const normalizedResponse =
          endpoint.normalize === undefined
            ? { payload }
            : endpoint.normalize(payload, input.inputs)

        if (input.operationRef === 'nesy.backoffice.reject-tour-request') {
          const scheduleId = String(input.inputs['approvalRequest'] ?? '').trim()
          const confirmed = await confirmRejectReleased({
            scheduleId,
            credentials,
            doFetch,
            delayMs: options.reconcileDelayMs ?? 1_000,
            signal: controller.signal,
          })
          if (!confirmed.ok) {
            return record(failed(confirmed.error), resultCode, payload)
          }
        }

        // `responseRef` is what reaches `verdict_remote_action_attempt.responsePayload`.
        // Leaving it unset is why a remote step that succeeded but published
        // nothing could only be diagnosed by re-running the call by hand.
        return record(
          {
            terminal: {
              status: 'SUCCEEDED',
              ...(auditPolicy.recordResponse
                ? { responseRef: summarize(redact(payload, auditPolicy.redactFields)) }
                : {}),
            },
            normalizedResponse,
          },
          resultCode,
          payload,
        )
      } catch (error) {
        const aborted = error instanceof Error && error.name === 'AbortError'
        if (aborted && injection !== null) {
          options.onTimeoutInjected?.({
            kind: 'EFFECT_OBSERVED',
            operationRef: input.operationRef,
            timeoutMs,
          })
        }
        // Timed out or transport-lost: the call may have been applied. Saying
        // FAILED here would license a retry of a mutation that already ran.
        return record(
          {
            terminal: {
              status: 'UNKNOWN_EFFECT',
              error: aborted
                ? injection !== null
                  ? `injected adapter deadline fired after ${timeoutMs}ms; effect unknown`
                  : `back-office call timed out after ${timeoutMs}ms; effect unknown`
                : `back-office transport error: ${error instanceof Error ? error.message : String(error)}`,
            },
            normalizedResponse: {},
          },
          null,
        )
      } finally {
        clearTimeout(timer)
        input.signal?.removeEventListener('abort', abortFromCaller)
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

/** Attempt rows are for diagnosis, not archival: a huge body helps nobody. */
const RESPONSE_REF_MAX_CHARS = 4_000

function summarize(value: unknown): string {
  const json = JSON.stringify(value ?? null)
  return json.length <= RESPONSE_REF_MAX_CHARS
    ? json
    : `${json.slice(0, RESPONSE_REF_MAX_CHARS)}…[truncated ${json.length - RESPONSE_REF_MAX_CHARS} chars]`
}

/**
 * A `{ resultCode, payload }` envelope, as opposed to a business object that
 * merely happens to be a record. Both keys are required so an ordinary payload
 * carrying one of them is never mistaken for a wrapper.
 */
function isEnvelope(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const hasCode = 'resultCode' in record || 'ResultCode' in record
  const hasPayload = 'payload' in record || 'Payload' in record
  return hasCode && hasPayload ? record : undefined
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
