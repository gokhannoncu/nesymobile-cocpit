import type {
  RemoteActionEffectClass,
  RemoteActionRuntimeRequest,
  RemoteActionTerminalResult,
} from '@nesy/execution-contract'
import type { ExternalActionSpec } from '@nesy/workflow-contract'
import { validateExternalAction } from '@nesy/workflow-contract'

export interface AllowlistedRemoteOperation {
  adapterRef: string
  operationRef: string
  effectClass: RemoteActionEffectClass
  requiresResourceLease: boolean
}

export interface RemoteActionAttemptRecord {
  runId: string
  occurrenceId: string
  operationRef: string
  idempotencyKey: string
  effectClass: RemoteActionEffectClass
  status: RemoteActionTerminalResult['status'] | 'PENDING'
  resourceLeaseId?: string
  errorMessage?: string
  responseRef?: string
  reconciliationRef?: string
}

export interface RemoteActionAdapter {
  execute(input: {
    request: RemoteActionRuntimeRequest
    spec: ExternalActionSpec
  }): Promise<RemoteActionTerminalResult>
}

export interface RemoteActionAttemptStore {
  findByIdempotencyKey(input: {
    runId: string
    occurrenceId: string
    operationRef: string
    idempotencyKey: string
  }): Promise<RemoteActionAttemptRecord | undefined> | RemoteActionAttemptRecord | undefined
  upsert(record: RemoteActionAttemptRecord): Promise<void> | void
}

export class InMemoryRemoteActionAttemptStore implements RemoteActionAttemptStore {
  readonly records: RemoteActionAttemptRecord[] = []

  findByIdempotencyKey(input: {
    runId: string
    occurrenceId: string
    operationRef: string
    idempotencyKey: string
  }): RemoteActionAttemptRecord | undefined {
    return this.records.find(
      (record) =>
        record.runId === input.runId &&
        record.occurrenceId === input.occurrenceId &&
        record.operationRef === input.operationRef &&
        record.idempotencyKey === input.idempotencyKey,
    )
  }

  upsert(record: RemoteActionAttemptRecord): void {
    const index = this.records.findIndex(
      (existing) =>
        existing.runId === record.runId &&
        existing.occurrenceId === record.occurrenceId &&
        existing.operationRef === record.operationRef &&
        existing.idempotencyKey === record.idempotencyKey,
    )
    if (index === -1) this.records.push({ ...record })
    else this.records[index] = { ...record }
  }
}

export type RemoteActionRuntimeResult =
  | {
      ok: true
      terminal: Extract<RemoteActionTerminalResult, { status: 'SUCCEEDED' }>
      operationalDisposition: 'OK'
      productVerdictHint: 'NOT_EVALUATED'
    }
  | {
      ok: false
      terminal: Exclude<RemoteActionTerminalResult, { status: 'SUCCEEDED' }> | { status: 'FAILED'; error: string }
      operationalDisposition: 'OK' | 'NEEDS_ATTENTION'
      productVerdictHint: 'NOT_EVALUATED'
      blockedReason: string
    }

export class RemoteActionRuntime {
  constructor(
    private readonly allowlist: readonly AllowlistedRemoteOperation[],
    private readonly adapter: RemoteActionAdapter,
    private readonly store: RemoteActionAttemptStore = new InMemoryRemoteActionAttemptStore(),
  ) {}

  async execute(input: {
    runId: string
    request: RemoteActionRuntimeRequest
    spec: ExternalActionSpec
  }): Promise<RemoteActionRuntimeResult> {
    const violations = validateExternalAction(input.spec)
    if (violations.length > 0) {
      return failClosed(`external action invalid: ${violations[0]?.code}`)
    }

    const allowed = this.allowlist.find(
      (entry) =>
        entry.adapterRef === input.spec.adapterRef &&
        entry.operationRef === input.spec.operationRef,
    )
    if (!allowed || !input.request.allowlisted) {
      return failClosed(`operation ${input.spec.operationRef} is not allowlisted`)
    }

    if (
      input.request.effectClass === 'NON_IDEMPOTENT' &&
      input.spec.timeoutPolicy.maxAttempts > 1 &&
      input.spec.idempotencyClass !== 'KEYED'
    ) {
      return failClosed('non-idempotent remote mutation cannot auto-retry')
    }

    if (
      (input.spec.idempotencyClass === 'KEYED' || input.request.effectClass !== 'IDEMPOTENT') &&
      input.request.idempotencyKey.trim() === ''
    ) {
      return failClosed('idempotency key required')
    }

    if (allowed.requiresResourceLease && !input.request.resourceLeaseId) {
      return failClosed('resource lease required for remote mutation')
    }

    const existing = await this.store.findByIdempotencyKey({
      runId: input.runId,
      occurrenceId: input.request.occurrenceId,
      operationRef: input.request.operationRef,
      idempotencyKey: input.request.idempotencyKey,
    })
    if (existing && existing.status !== 'PENDING') {
      return terminalFromRecord(existing)
    }
    // A PENDING record under the same idempotency key is an attempt that never
    // reached a terminal status (in-flight or crashed mid-flight). Replaying it
    // is only safe when the remote effect is idempotent; otherwise the effect is
    // unknown and must be reconciled instead of duplicated.
    if (existing && input.request.effectClass !== 'IDEMPOTENT') {
      const error = `remote action ${input.request.operationRef} has an unterminated attempt; effect unknown`
      await this.store.upsert({
        ...existing,
        status: 'UNKNOWN_EFFECT',
        errorMessage: error,
      })
      return {
        ok: false,
        terminal: { status: 'UNKNOWN_EFFECT', error },
        operationalDisposition: 'NEEDS_ATTENTION',
        productVerdictHint: 'NOT_EVALUATED',
        blockedReason: error,
      }
    }

    await this.store.upsert({
      runId: input.runId,
      occurrenceId: input.request.occurrenceId,
      operationRef: input.request.operationRef,
      idempotencyKey: input.request.idempotencyKey,
      effectClass: input.request.effectClass,
      status: 'PENDING',
      resourceLeaseId: input.request.resourceLeaseId,
    })

    const terminal = await this.adapter.execute({
      request: input.request,
      spec: input.spec,
    })

    await this.store.upsert({
      runId: input.runId,
      occurrenceId: input.request.occurrenceId,
      operationRef: input.request.operationRef,
      idempotencyKey: input.request.idempotencyKey,
      effectClass: input.request.effectClass,
      status: terminal.status,
      resourceLeaseId: input.request.resourceLeaseId,
      ...('error' in terminal ? { errorMessage: terminal.error } : {}),
      ...('responseRef' in terminal ? { responseRef: terminal.responseRef } : {}),
      ...('reconciliationRef' in terminal
        ? { reconciliationRef: terminal.reconciliationRef }
        : {}),
    })

    return terminalFromResult(terminal)
  }
}

export function createStubRemoteAdapter(
  handlers: Readonly<Record<string, () => RemoteActionTerminalResult | Promise<RemoteActionTerminalResult>>>,
): RemoteActionAdapter {
  return {
    async execute({ request }) {
      const handler = handlers[request.operationRef]
      if (handler === undefined) {
        return { status: 'FAILED', error: `no stub handler for ${request.operationRef}` }
      }
      return handler()
    },
  }
}

function failClosed(blockedReason: string): RemoteActionRuntimeResult {
  return {
    ok: false,
    terminal: { status: 'FAILED', error: blockedReason },
    operationalDisposition: 'OK',
    productVerdictHint: 'NOT_EVALUATED',
    blockedReason,
  }
}

function terminalFromResult(terminal: RemoteActionTerminalResult): RemoteActionRuntimeResult {
  if (terminal.status === 'SUCCEEDED') {
    return {
      ok: true,
      terminal,
      operationalDisposition: 'OK',
      productVerdictHint: 'NOT_EVALUATED',
    }
  }
  if (terminal.status === 'FAILED') {
    return {
      ok: false,
      terminal,
      operationalDisposition: 'OK',
      productVerdictHint: 'NOT_EVALUATED',
      blockedReason: terminal.error,
    }
  }
  if (terminal.status === 'UNKNOWN_EFFECT') {
    return {
      ok: false,
      terminal,
      operationalDisposition: 'NEEDS_ATTENTION',
      productVerdictHint: 'NOT_EVALUATED',
      blockedReason: terminal.error,
    }
  }
  return {
    ok: false,
    terminal,
    operationalDisposition: 'NEEDS_ATTENTION',
    productVerdictHint: 'NOT_EVALUATED',
    blockedReason: 'remote partial failure requires reconciliation',
  }
}

function terminalFromRecord(record: RemoteActionAttemptRecord): RemoteActionRuntimeResult {
  if (record.status === 'SUCCEEDED') {
    return {
      ok: true,
      terminal: { status: 'SUCCEEDED', responseRef: record.responseRef },
      operationalDisposition: 'OK',
      productVerdictHint: 'NOT_EVALUATED',
    }
  }
  if (record.status === 'PENDING') {
    return failClosed('remote action still pending')
  }
  if (record.status === 'RECONCILIATION_REQUIRED') {
    return {
      ok: false,
      terminal: {
        status: 'RECONCILIATION_REQUIRED',
        reconciliationRef: record.reconciliationRef,
      },
      operationalDisposition: 'NEEDS_ATTENTION',
      productVerdictHint: 'NOT_EVALUATED',
      blockedReason: 'remote partial failure requires reconciliation',
    }
  }
  if (record.status === 'UNKNOWN_EFFECT') {
    return {
      ok: false,
      terminal: {
        status: 'UNKNOWN_EFFECT',
        error: record.errorMessage ?? 'unknown remote effect',
      },
      operationalDisposition: 'NEEDS_ATTENTION',
      productVerdictHint: 'NOT_EVALUATED',
      blockedReason: record.errorMessage ?? 'unknown remote effect',
    }
  }
  return {
    ok: false,
    terminal: { status: 'FAILED', error: record.errorMessage ?? 'remote action failed' },
    operationalDisposition: 'OK',
    productVerdictHint: 'NOT_EVALUATED',
    blockedReason: record.errorMessage ?? 'remote action failed',
  }
}
