/**
 * Map a thrown execution error onto the evaluation-failure axis.
 *
 * A Prisma disconnect mid-run is not a product defect and must not persist as
 * `NONE`. Two vocabularies stay distinct:
 *
 *   evaluationFailureClass  ENVIRONMENT_FAILURE   persisted eval axis
 *   d30Class                ENV_FAILURE           RUN_PLAY §5 histogram
 *
 * Specific Prisma codes/messages stay on `failureDetail` — they are not new
 * histogram classes. `toD30HistogramClass` is the only allowed remap.
 */
import { Prisma } from '@nesy/db'
import type { EvaluationFailureClass } from '@nesy/workflow-contract'

export const D30_HISTOGRAM_CLASSES = [
  'PRODUCT_PASS',
  'PRODUCT_FAIL',
  'ENV_FAILURE',
  'FORCE_STOP_NOT_CONFIRMED',
  'PROCESS_NOT_STARTED',
  'COLD_START_OS_SUSPEND',
  'APP_NOT_READY',
  'A11Y_SYNC_PENDING',
  'UI_NOT_ACTIONABLE',
  'SDK_NOT_READY',
  'AUTH_PENDING',
  'BACKEND_BOOTSTRAP_PENDING',
  'EVIDENCE_TIMEOUT',
  'TEST_DATA_CONTAMINATION',
  'UNCLASSIFIED',
] as const

export type D30HistogramClass = (typeof D30_HISTOGRAM_CLASSES)[number]

const D30_READINESS_CLASSES = new Set<D30HistogramClass>([
  'FORCE_STOP_NOT_CONFIRMED',
  'PROCESS_NOT_STARTED',
  'COLD_START_OS_SUSPEND',
  'APP_NOT_READY',
  'A11Y_SYNC_PENDING',
  'UI_NOT_ACTIONABLE',
  'SDK_NOT_READY',
  'AUTH_PENDING',
  'BACKEND_BOOTSTRAP_PENDING',
])

const PERSISTENCE_CODES = new Set([
  'P1001', // can't reach database server
  'P1002', // database server timed out
  'P1008', // operations timed out
  'P1017', // server has closed the connection
  'P2024', // timed out fetching a connection from the pool
  'P2028', // transaction API error (includes expired interactive transactions)
])

const PERSISTENCE_MESSAGE =
  /server has closed the connection|can't reach database server|timed out fetching a new connection|transaction already closed|expired transaction|the database system is shutting down|connection reset|econnreset|econnrefused|too many clients/i

export type ExecutionFailureKind = 'PERSISTENCE_UNAVAILABLE' | 'AUTOMATION_CRASH'

export function classifyExecutionFailure(error: unknown): {
  kind: ExecutionFailureKind
  evaluationFailureClass: EvaluationFailureClass
} {
  if (isPersistenceUnavailable(error)) {
    return { kind: 'PERSISTENCE_UNAVAILABLE', evaluationFailureClass: 'ENVIRONMENT_FAILURE' }
  }
  return { kind: 'AUTOMATION_CRASH', evaluationFailureClass: 'AUTOMATION_FAILURE' }
}

/**
 * A blocked pre-action run already has a readiness class. The evaluation axis
 * must not stay `NONE` — the workflow was never evaluated. The specific
 * readiness class (`APP_NOT_READY`, …) remains on `readinessClass`.
 */
export function evaluationFailureClassForBlockedRun(
  readinessClass: string | null | undefined,
): EvaluationFailureClass {
  if (readinessClass === 'COLD_START_OS_SUSPEND') return 'ENVIRONMENT_FAILURE'
  return 'AUTOMATION_FAILURE'
}

/**
 * Project persisted run fields onto the locked D30 histogram vocabulary.
 * Product verdict wins. Eval-axis `ENVIRONMENT_FAILURE` becomes `ENV_FAILURE`.
 * A readiness class is the histogram class only when the product was not
 * evaluated. Unknown leftovers are `UNCLASSIFIED`.
 */
export function toD30HistogramClass(input: {
  productVerdict?: string | null
  evaluationFailureClass?: string | null
  readinessClass?: string | null
}): D30HistogramClass {
  const verdict = input.productVerdict ?? null
  const evaluationFailureClass = input.evaluationFailureClass ?? null
  const readinessClass = input.readinessClass ?? null

  if (verdict === 'PASS_ONLINE' || verdict === 'PASS_QUEUED_OFFLINE') {
    return 'PRODUCT_PASS'
  }
  if (typeof verdict === 'string' && verdict.startsWith('FAIL_')) {
    return 'PRODUCT_FAIL'
  }
  if (evaluationFailureClass === 'ENVIRONMENT_FAILURE' || evaluationFailureClass === 'ENV_FAILURE') {
    return 'ENV_FAILURE'
  }
  if (evaluationFailureClass === 'EVIDENCE_INSUFFICIENT' || evaluationFailureClass === 'EVIDENCE_TIMEOUT') {
    return 'EVIDENCE_TIMEOUT'
  }
  if (readinessClass && D30_READINESS_CLASSES.has(readinessClass as D30HistogramClass)) {
    return readinessClass as D30HistogramClass
  }
  return 'UNCLASSIFIED'
}

export function isPersistenceUnavailable(error: unknown): boolean {
  for (const current of errorChain(error)) {
    if (hasPrismaCode(current, PERSISTENCE_CODES)) return true
    if (current instanceof Prisma.PrismaClientInitializationError) return true
    if (current instanceof Prisma.PrismaClientRustPanicError) return true
    if (PERSISTENCE_MESSAGE.test(current instanceof Error ? current.message : String(current))) {
      return true
    }
  }
  return false
}

export function describePrismaFailure(error: unknown): Record<string, unknown> {
  const prisma = firstPrismaError(error)
  return {
    processPid: process.pid,
    processUptimeSec: Math.round(process.uptime()),
    nodeEnv: process.env.NODE_ENV ?? null,
    errorName: error instanceof Error ? error.name : typeof error,
    errorMessage: error instanceof Error ? error.message : String(error),
    prismaName: prisma?.name ?? null,
    prismaCode: prisma && 'code' in prisma ? prisma.code : null,
    prismaMeta: prisma && 'meta' in prisma ? prisma.meta : null,
    prismaClientVersion: prisma && 'clientVersion' in prisma ? prisma.clientVersion : null,
    persistenceUnavailable: isPersistenceUnavailable(error),
  }
}

function hasPrismaCode(error: unknown, codes: ReadonlySet<string>): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    codes.has((error as { code: string }).code)
  )
}

function firstPrismaError(error: unknown): (Error & { code?: string; meta?: unknown; clientVersion?: string }) | null {
  for (const current of errorChain(error)) {
    if (
      current instanceof Prisma.PrismaClientKnownRequestError ||
      current instanceof Prisma.PrismaClientUnknownRequestError ||
      current instanceof Prisma.PrismaClientInitializationError ||
      current instanceof Prisma.PrismaClientRustPanicError ||
      current instanceof Prisma.PrismaClientValidationError
    ) {
      return current
    }
  }
  return null
}

function errorChain(error: unknown): unknown[] {
  const chain: unknown[] = []
  const seen = new Set<unknown>()
  let current: unknown = error
  while (current !== undefined && current !== null && !seen.has(current)) {
    seen.add(current)
    chain.push(current)
    current = current instanceof Error ? current.cause : undefined
  }
  return chain
}
