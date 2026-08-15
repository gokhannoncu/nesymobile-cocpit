import { describe, expect, it } from 'vitest'
import { Prisma } from '@nesy/db'

import {
  classifyExecutionFailure,
  describePrismaFailure,
  evaluationFailureClassForBlockedRun,
  isPersistenceUnavailable,
} from './execution-failure-class.js'

function known(message: string, code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: 'test',
    meta: { modelName: 'BridgeFlowRunRuntime' },
  })
}

describe('classifyExecutionFailure', () => {
  it('maps a physically closed Prisma connection to ENVIRONMENT_FAILURE', () => {
    const error = known('Server has closed the connection.', 'P1017')
    expect(isPersistenceUnavailable(error)).toBe(true)
    expect(classifyExecutionFailure(error)).toEqual({
      kind: 'PERSISTENCE_UNAVAILABLE',
      evaluationFailureClass: 'ENVIRONMENT_FAILURE',
    })
  })

  it('maps an expired interactive transaction to ENVIRONMENT_FAILURE', () => {
    const error = known(
      'Transaction already closed: A query cannot be executed on an expired transaction. The timeout for this transaction was 5000 ms.',
      'P2028',
    )
    expect(classifyExecutionFailure(error).evaluationFailureClass).toBe('ENVIRONMENT_FAILURE')
  })

  it('follows the cause chain so a wrapped driver error is still persistence', () => {
    const cause = known('Server has closed the connection.', 'P1017')
    const outer = new Error('persistStepOccurrence failed', { cause })
    expect(classifyExecutionFailure(outer).kind).toBe('PERSISTENCE_UNAVAILABLE')
  })

  it('keeps an unknown executor crash on AUTOMATION_FAILURE, not NONE', () => {
    expect(classifyExecutionFailure(new Error('act failed'))).toEqual({
      kind: 'AUTOMATION_CRASH',
      evaluationFailureClass: 'AUTOMATION_FAILURE',
    })
  })

  it('records Prisma code and process identity for the close-moment log', () => {
    const diagnostic = describePrismaFailure(known('Server has closed the connection.', 'P1017'))
    expect(diagnostic.prismaCode).toBe('P1017')
    expect(diagnostic.persistenceUnavailable).toBe(true)
    expect(diagnostic.processPid).toBe(process.pid)
    expect(typeof diagnostic.processUptimeSec).toBe('number')
  })
})

describe('evaluationFailureClassForBlockedRun', () => {
  it('does not leave a readiness block as NONE', () => {
    expect(evaluationFailureClassForBlockedRun('APP_NOT_READY')).toBe('AUTOMATION_FAILURE')
    expect(evaluationFailureClassForBlockedRun('SDK_NOT_READY')).toBe('AUTOMATION_FAILURE')
    expect(evaluationFailureClassForBlockedRun('FORCE_STOP_NOT_CONFIRMED')).toBe('AUTOMATION_FAILURE')
  })

  it('keeps OS-park on the environment axis', () => {
    expect(evaluationFailureClassForBlockedRun('COLD_START_OS_SUSPEND')).toBe('ENVIRONMENT_FAILURE')
  })
})
