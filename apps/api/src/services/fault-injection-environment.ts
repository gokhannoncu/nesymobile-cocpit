/**
 * Where fault injection is allowed to run.
 *
 * The injectors live inside the production back-office adapter, and
 * `injectedFault` arrives from an API body. Without this gate a caller could
 * ask a live environment to abort a real dispatcher mutation, which is a real
 * mutation with an unknown effect — the exact thing the D60 lab is designed
 * to produce on purpose and nowhere else.
 *
 * The environment is the same one the adapter resolves its base URL from
 * (`NESY_REMOTE_ACTION_ENV`), so an operator cannot point the run at
 * production and still keep the injector armed.
 */

const DEFAULT_REMOTE_ACTION_ENV = 'stage'

const INJECTABLE_ENVIRONMENTS = new Set(['qa', 'stage', 'staging', 'test', 'local', 'dev'])
const DASHBOARD_COUNTRIES = ['HR', 'SI', 'RS', 'BA', 'ME', 'AZ'] as const

export interface FaultInjectionTargetDecision {
  allowed: boolean
  declaredEnvironment: string
  targetOrigin: string | null
  reason: string
}

export function resolveRemoteActionEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = env.NESY_REMOTE_ACTION_ENV?.trim()
  return configured === undefined || configured === '' ? DEFAULT_REMOTE_ACTION_ENV : configured
}

function originOf(value: string | undefined): string | null {
  if (value === undefined || value.trim() === '') return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (url.username !== '' || url.password !== '') return null
    return url.origin.toLowerCase()
  } catch {
    return null
  }
}

function configuredBaseUrl(
  env: NodeJS.ProcessEnv,
  country: string,
  environment: 'stage' | 'prod',
): string | undefined {
  return env[`NESY_${country}_${environment.toUpperCase()}_BASE_URL`]
}

function explicitLabOrigins(env: NodeJS.ProcessEnv): ReadonlySet<string> {
  return new Set(
    (env.NESY_FAULT_INJECTION_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((value) => originOf(value))
      .filter((value): value is string => value !== null),
  )
}

function isLoopbackOrigin(origin: string): boolean {
  const hostname = new URL(origin).hostname.toLowerCase()
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

/**
 * Decide from the URL the adapter will actually call, not only its environment
 * label. An override that points at prod while the label says stage is a
 * mismatch and must leave every injector inert.
 */
export function resolveFaultInjectionTarget(
  env: NodeJS.ProcessEnv = process.env,
): FaultInjectionTargetDecision {
  const declaredEnvironment = resolveRemoteActionEnvironment(env).toLowerCase()
  if (!INJECTABLE_ENVIRONMENTS.has(declaredEnvironment)) {
    return {
      allowed: false,
      declaredEnvironment,
      targetOrigin: originOf(env.NESY_BACKOFFICE_BASE_URL),
      reason: `environment "${declaredEnvironment}" is not injectable`,
    }
  }

  const country = (env.NESY_REMOTE_ACTION_COUNTRY?.trim() || 'RS').toUpperCase()
  if (!DASHBOARD_COUNTRIES.includes(country as (typeof DASHBOARD_COUNTRIES)[number])) {
    return {
      allowed: false,
      declaredEnvironment,
      targetOrigin: originOf(env.NESY_BACKOFFICE_BASE_URL),
      reason: `unknown remote-action country "${country}"`,
    }
  }

  const normalizedEnvironment = declaredEnvironment === 'staging' ? 'stage' : declaredEnvironment
  const expectedStageOrigin = originOf(configuredBaseUrl(env, country, 'stage'))
  const targetOrigin = originOf(
    env.NESY_BACKOFFICE_BASE_URL ??
      (normalizedEnvironment === 'stage' ? configuredBaseUrl(env, country, 'stage') : undefined),
  )
  if (targetOrigin === null) {
    return {
      allowed: false,
      declaredEnvironment,
      targetOrigin: null,
      reason: 'resolved back-office target URL is missing or invalid',
    }
  }

  const productionOrigins = new Set(
    DASHBOARD_COUNTRIES
      .map((candidate) => originOf(configuredBaseUrl(env, candidate, 'prod')))
      .filter((value): value is string => value !== null),
  )
  if (productionOrigins.has(targetOrigin)) {
    return {
      allowed: false,
      declaredEnvironment,
      targetOrigin,
      reason: `resolved target ${targetOrigin} is a configured production origin`,
    }
  }

  if (normalizedEnvironment === 'stage') {
    if (expectedStageOrigin === null || targetOrigin !== expectedStageOrigin) {
      return {
        allowed: false,
        declaredEnvironment,
        targetOrigin,
        reason: `stage label does not match configured stage origin ${expectedStageOrigin ?? '<missing>'}`,
      }
    }
    return { allowed: true, declaredEnvironment, targetOrigin, reason: 'configured stage origin matched' }
  }

  if (isLoopbackOrigin(targetOrigin) || explicitLabOrigins(env).has(targetOrigin)) {
    return { allowed: true, declaredEnvironment, targetOrigin, reason: 'explicit lab origin matched' }
  }
  return {
    allowed: false,
    declaredEnvironment,
    targetOrigin,
    reason: `unknown target ${targetOrigin} is not an explicit lab origin`,
  }
}

export function isFaultInjectionAllowedEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveFaultInjectionTarget(env).allowed
}

export function assertFaultInjectionAllowed(env: NodeJS.ProcessEnv = process.env): void {
  const decision = resolveFaultInjectionTarget(env)
  if (decision.allowed) return
  throw new Error(
    `fault injection is not allowed: ${decision.reason}; ` +
      `environment=${decision.declaredEnvironment}, target=${decision.targetOrigin ?? '<none>'}`,
  )
}
