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

export function resolveRemoteActionEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = env.NESY_REMOTE_ACTION_ENV?.trim()
  return configured === undefined || configured === '' ? DEFAULT_REMOTE_ACTION_ENV : configured
}

export function isFaultInjectionAllowedEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return INJECTABLE_ENVIRONMENTS.has(resolveRemoteActionEnvironment(env).toLowerCase())
}

export function assertFaultInjectionAllowed(env: NodeJS.ProcessEnv = process.env): void {
  if (isFaultInjectionAllowedEnvironment(env)) return
  throw new Error(
    `fault injection is not allowed against NESY_REMOTE_ACTION_ENV "${resolveRemoteActionEnvironment(env)}"; ` +
      `allowed: ${[...INJECTABLE_ENVIRONMENTS].sort().join(', ')}`,
  )
}
