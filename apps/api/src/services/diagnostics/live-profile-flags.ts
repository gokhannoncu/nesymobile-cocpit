/**
 * Opt-in switches for the live-profiling campaign. Both default to the safe
 * production behaviour so a measurement run is always something someone asked
 * for, never something the API does because a file happened to be imported.
 */

function enabled(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw.trim() === '') return fallback
  return raw === '1' || raw.toLowerCase() === 'true'
}

/**
 * `live-run-profiler` monkey-patches runtime prototypes at import time and
 * throws when a hook name no longer exists, so importing it unconditionally
 * turns any future method rename into an API that cannot boot. It is loaded
 * only when a profiling run is being set up.
 */
export function liveProfilingEnabled(): boolean {
  return enabled(process.env.NESY_LIVE_PROFILE, false)
}

/**
 * The A and B campaign arms have to run the pre-batch serial persistence path
 * against otherwise identical code; only C/D measure the merged atomic
 * boundaries. Batch stays on by default because it is the shipped behaviour.
 */
export function batchPersistenceEnabled(): boolean {
  return enabled(process.env.NESY_PERSISTENCE_BATCH, true)
}
