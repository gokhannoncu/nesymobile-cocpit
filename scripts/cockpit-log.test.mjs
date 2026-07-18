import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  createCockpitState,
  applyLogLine,
  applyHealthProbe,
  formatStatusPanel,
  isAllReady,
  parseTurboLine,
  rewriteTurboLine,
} from './cockpit-log.mjs'

describe('parseTurboLine', () => {
  it('parses turbo stream lines', () => {
    assert.deepEqual(parseTurboLine('@nesy/api:dev: hello'), {
      pkg: 'api',
      task: 'dev',
      message: 'hello',
    })
  })

  it('parses bracket prefixes', () => {
    assert.deepEqual(parseTurboLine('[web] Ready in 1s'), {
      pkg: 'web',
      task: null,
      message: 'Ready in 1s',
    })
  })
})

describe('applyLogLine', () => {
  it('marks db ready on prisma generate', () => {
    const state = createCockpitState('prod')
    applyLogLine(state, '@nesy/db:build: ✔ Generated Prisma Client (v6.19.3)')
    assert.equal(state.db.status, 'ready')
  })

  it('marks web building during next build', () => {
    const state = createCockpitState('prod')
    applyLogLine(state, '@nesy/web:build: Creating an optimized production build ...')
    assert.equal(state.web.status, 'building')
  })

  it('marks web ready on Ready line', () => {
    const state = createCockpitState('dev')
    applyLogLine(state, '@nesy/web:dev: ✓ Ready in 694ms')
    assert.equal(state.web.status, 'ready')
    assert.match(state.web.detail, /4002/)
  })

  it('marks api ready on NESY API banner', () => {
    const state = createCockpitState('dev')
    applyLogLine(state, '@nesy/api:dev: NESY API')
    assert.equal(state.api.status, 'ready')
  })

  it('ignores eslint noise as failures', () => {
    const state = createCockpitState('prod')
    applyLogLine(
      state,
      '@nesy/web:build: Warning: Unexpected any. @typescript-eslint/no-explicit-any',
    )
    assert.notEqual(state.web.status, 'failed')
    assert.equal(state.error, null)
  })
})

describe('applyHealthProbe', () => {
  it('promotes api to ready when health ok', () => {
    const state = createCockpitState('dev')
    state.api.status = 'starting'
    assert.equal(applyHealthProbe(state, 'api', true), true)
    assert.equal(state.api.status, 'ready')
  })
})

describe('formatStatusPanel', () => {
  it('renders service rows and mode', () => {
    const state = createCockpitState('prod')
    state.db.status = 'ready'
    state.db.detail = 'built'
    const panel = formatStatusPanel(state)
    assert.match(panel, /NESY Cockpit/)
    assert.match(panel, /prod/)
    assert.match(panel, /DB/)
    assert.match(panel, /API/)
    assert.match(panel, /Web/)
  })

  it('shows all systems go when ready', () => {
    const state = createCockpitState('dev')
    state.db.status = 'ready'
    state.api.status = 'ready'
    state.web.status = 'ready'
    assert.equal(isAllReady(state), true)
    assert.match(formatStatusPanel(state), /All systems go/)
  })
})

describe('rewriteTurboLine', () => {
  it('still maps prefixes for verbose mode', () => {
    assert.equal(
      rewriteTurboLine('@nesy/api:dev: checking port 4001...'),
      '[api] checking port 4001...',
    )
  })
})
