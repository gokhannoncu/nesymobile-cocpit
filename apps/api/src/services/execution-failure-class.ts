/**
 * Map a thrown execution error onto the evaluation-failure axis.
 *
 * A Prisma disconnect mid-run is not a product defect and must not persist as
 * `NONE`. The D30 histogram name is `ENV_FAILURE`; the persisted evaluation
 * axis already has `ENVIRONMENT_FAILURE` for that family. Specific Prisma
 * codes/messages stay on `failureDetail` and the diagnostic payload — they are
 * not new histogram classes.
 */
import { Prisma } from '@nesy/db'
import type { EvaluationFailureClass } from '@nesy/workflow-contract'

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
