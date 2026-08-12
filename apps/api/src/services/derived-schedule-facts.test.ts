/**
 * ===========================================================================
 *  SCHEDULE DERIVATIONS — the pack's definitions against the real reducer
 *
 *  Route selection is supposed to create today's schedule and store it. When the
 *  create call fails the app shows whatever Room already held — including the
 *  previous day's — and the screen looks entirely normal. The two derivations
 *  under test are what make that state fail a run instead of passing it.
 *
 *  This suite exists because a derivation can be declared and still never fire:
 *  the reducer returns `undefined` for a missing or UNKNOWN input, which is the
 *  honest outcome but an invisible one. Measured on device, both schedule
 *  derivations came back `REQUIRED_TIMEOUT` — never produced — and this is where
 *  "the definition is wrong" gets separated from "the inputs never arrived".
 * ===========================================================================
 */
import { describe, expect, it } from 'vitest'
import type { NormalizedEvidenceFact } from '@nesy/bridge-contract'
import { buildNesyCourierBundle } from '@nesy/nesy-courier-domain-pack'

import { deriveFacts } from './derived-fact-engine.js'

const SCHEDULE_ID = '11-31-20260812-1'
const ROUTE_CODE = '31'

const fact = (
  factKey: string,
  value: boolean | 'UNKNOWN',
  correlationValue?: string,
): NormalizedEvidenceFact => ({
  factKey,
  occurrenceId: 'run-1:assert-selection:0',
  iterationKey: '',
  observedAtMs: 1_000,
  freshnessMaxAgeMs: 30_000,
  plane: factKey.startsWith('LOCAL.') ? 'LOCAL' : 'APP',
  subtype: 'nesy.db.schedule',
  value,
  authority: 'PRIMARY',
  deliveryLane: 'ORDERED_REQUIRED',
  ...(correlationValue === undefined ? {} : { correlationValue }),
})

const derive = (facts: readonly NormalizedEvidenceFact[]) =>
  deriveFacts({
    bundle: buildNesyCourierBundle(),
    facts,
    expectations: { 'macro.input.routeCode': ROUTE_CODE },
  })

const find = (facts: readonly NormalizedEvidenceFact[], factKey: string) =>
  facts.find((f) => f.factKey === factKey)

describe('schedule derivations', () => {
  const inUse = () => fact('APP.SCHEDULE_IN_USE', true, SCHEDULE_ID)
  const persisted = () => fact('LOCAL.SCHEDULE_PERSISTED', true, SCHEDULE_ID)
  const isToday = () => fact('LOCAL.SCHEDULE_IS_TODAY', true, SCHEDULE_ID)
  const routeObserved = () => fact('LOCAL.SCHEDULE_ROUTE_OBSERVED', true, ROUTE_CODE)
  const selected = () => fact('APP.SELECTED_ROUTE_OBSERVED', true, ROUTE_CODE)

  it('concludes the session is using today’s stored schedule', () => {
    const derived = derive([inUse(), persisted(), isToday(), routeObserved(), selected()])
    expect(find(derived, 'APP.SCHEDULE_IN_USE_IS_TODAYS')?.value).toBe(true)
  })

  it('refuses when the schedule on screen is not the stored one', () => {
    // The failure this exists for: create failed, the session kept an older
    // schedule, and Room holds a different id. Every input is individually true.
    const derived = derive([
      fact('APP.SCHEDULE_IN_USE', true, '11-31-20260811-1'),
      persisted(),
      isToday(),
    ])
    expect(find(derived, 'APP.SCHEDULE_IN_USE_IS_TODAYS')?.value).toBe(false)
  })

  it('refuses when the stored schedule is not today’s', () => {
    const derived = derive([inUse(), persisted(), fact('LOCAL.SCHEDULE_IS_TODAY', false, SCHEDULE_ID)])
    expect(find(derived, 'APP.SCHEDULE_IN_USE_IS_TODAYS')?.value).toBe(false)
  })

  /**
   * The measured runtime symptom. `CORRELATED_ALL_OF` returns `undefined` when an
   * input is absent, so the requirement reports `REQUIRED_TIMEOUT` and names a
   * fact nobody can see is missing. Pinned so the silence is a documented
   * property rather than a surprise.
   */
  it('stays silent — not false — when an input never arrived', () => {
    const derived = derive([persisted(), isToday()])
    expect(find(derived, 'APP.SCHEDULE_IN_USE_IS_TODAYS')).toBeUndefined()
  })

  it('matches the stored schedule against the route the run asked for', () => {
    const derived = derive([routeObserved(), selected(), persisted(), isToday(), inUse()])
    expect(find(derived, 'APP.SCHEDULE_MATCHES_SELECTED_ROUTE')?.value).toBe(true)
  })

  it('refuses a schedule created for another route', () => {
    // Freshness is not enough: today's, stored, on screen — and someone else's
    // plan. `ENTITY_STATUS_EQUALS` compares the observation's correlationValue,
    // so the route-carrying fact must correlate on the ROUTE, not the schedule id.
    const derived = derive([
      fact('LOCAL.SCHEDULE_ROUTE_OBSERVED', true, '29'),
      selected(),
      persisted(),
      isToday(),
      inUse(),
    ])
    expect(find(derived, 'APP.SCHEDULE_MATCHES_SELECTED_ROUTE')?.value).toBe(false)
  })
})
