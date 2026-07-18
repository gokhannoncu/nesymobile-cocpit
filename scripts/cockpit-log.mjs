/**
 * Quiet NESY Cockpit status panel — no log flood, service health only.
 */

const DEFAULT_PORTS = { api: 4001, web: 4002 }

const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]/g
const TURBO_LINE_RE = /^@nesy\/([^:]+):([^:]*):\s?(.*)$/
const BRACKET_LINE_RE = /^\[([^\]]+)\]\s?(.*)$/

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
}

/**
 * @typedef {'idle' | 'waiting' | 'building' | 'starting' | 'ready' | 'failed'} ServiceStatus
 * @typedef {{ status: ServiceStatus, detail: string }} ServiceState
 * @typedef {{
 *   mode: 'dev' | 'prod',
 *   ports: { api: number, web: number },
 *   db: ServiceState,
 *   api: ServiceState,
 *   web: ServiceState,
 *   error: string | null,
 * }} CockpitState
 */

/** @returns {CockpitState} */
export function createCockpitState(mode, ports = {}) {
  return {
    mode,
    ports: {
      api: ports.api ?? DEFAULT_PORTS.api,
      web: ports.web ?? DEFAULT_PORTS.web,
    },
    db: { status: 'waiting', detail: 'pending' },
    api: { status: 'waiting', detail: 'pending' },
    web: { status: 'waiting', detail: 'pending' },
    error: null,
  }
}

export function stripAnsi(text) {
  return text.replace(ANSI_RE, '')
}

/**
 * @param {string} line
 * @returns {{ pkg: string | null, task: string | null, message: string }}
 */
export function parseTurboLine(line) {
  const bare = stripAnsi(line).trimEnd()
  const turbo = TURBO_LINE_RE.exec(bare)
  if (turbo) {
    return { pkg: turbo[1], task: turbo[2], message: turbo[3] ?? '' }
  }
  const bracket = BRACKET_LINE_RE.exec(bare)
  if (bracket) {
    return { pkg: bracket[1], task: null, message: bracket[2] ?? '' }
  }
  return { pkg: null, task: null, message: bare }
}

/**
 * @param {ServiceState} service
 * @param {ServiceStatus} status
 * @param {string} [detail]
 */
function setStatus(service, status, detail) {
  if (service.status === 'failed' && status !== 'failed') return
  if (service.status === 'ready' && (status === 'waiting' || status === 'building' || status === 'starting')) {
    return
  }
  service.status = status
  if (detail != null) service.detail = detail
}

/**
 * Apply one log line into cockpit state. Returns true if UI should redraw.
 * @param {CockpitState} state
 * @param {string} line
 */
export function applyLogLine(state, line) {
  const { pkg, message } = parseTurboLine(line)
  const msg = message.toLowerCase()
  let changed = false

  const failMatch =
    /\berror\b|\bfailed\b|elifecycle|cannot find|enoent|eaddrinuse|module not found/i.test(
      message,
    ) && !/no-unused-vars|no-explicit-any|exhaustive-deps|no-img-element|ban-ts-comment|no-unescaped|useless-escape|jsx-no-comment|jsx-key|react\/|@typescript-eslint|@next\//i.test(
      message,
    )

  if (failMatch && pkg && (pkg === 'api' || pkg === 'web' || pkg === 'db')) {
    const prev = state[pkg].status
    setStatus(state[pkg], 'failed', message.slice(0, 60))
    state.error = stripAnsi(message).slice(0, 120)
    return prev !== 'failed' || state.error != null
  }

  if (pkg === 'db') {
    if (/cache hit|generated prisma|build success|dts\s+⚡️|dts.*build success/i.test(message)) {
      const prev = state.db.status
      setStatus(state.db, 'ready', /cache hit/i.test(message) ? 'cache hit' : 'built')
      changed = prev !== state.db.status || state.db.detail !== 'built'
    } else if (
      /prisma|tsup|building|cache bypass|prebuild|> @nesy\/db/i.test(message) &&
      state.db.status !== 'ready'
    ) {
      const prev = state.db.status
      setStatus(state.db, 'building', 'building…')
      changed = prev !== 'building'
    }
  }

  if (pkg === 'api') {
    if (/nesy\s*api|http:\/\/localhost:\d+|\/health|socket\.io/i.test(message)) {
      const prev = state.api.status
      setStatus(state.api, 'ready', `http://localhost:${state.ports.api}`)
      changed = prev !== 'ready' || changed
    } else if (
      /checking port|tsx watch|node dist|cache bypass|> @nesy\/api/i.test(message) &&
      state.api.status !== 'ready'
    ) {
      const prev = state.api.status
      setStatus(state.api, 'starting', 'starting…')
      changed = prev !== 'starting' || changed
    }
  }

  if (pkg === 'web') {
    if (/✓\s*ready|ready in|local:\s*http/i.test(message)) {
      const prev = state.web.status
      setStatus(state.web, 'ready', `http://localhost:${state.ports.web}`)
      changed = prev !== 'ready' || changed
    } else if (
      /next build|creating an optimized|collecting page|linting and checking|generating static/i.test(
        message,
      ) &&
      state.web.status !== 'ready'
    ) {
      const prev = state.web.status
      setStatus(state.web, 'building', 'building…')
      changed = prev !== 'building' || changed
    } else if (
      /checking port|next (dev|start)|cache bypass|> @nesy\/web/i.test(message) &&
      state.web.status !== 'ready'
    ) {
      const prev = state.web.status
      setStatus(state.web, 'starting', 'starting…')
      changed = prev !== 'starting' || changed
    }
  }

  // Cache-hit deps imply db already built when turbo skips work
  if (pkg === 'db' && /cache hit/i.test(message)) {
    setStatus(state.db, 'ready', 'cache hit')
    changed = true
  }

  return changed
}

/**
 * @param {CockpitState} state
 * @param {'api' | 'web'} which
 * @param {boolean} ok
 */
export function applyHealthProbe(state, which, ok) {
  const service = state[which]
  if (ok) {
    if (service.status === 'ready') return false
    setStatus(service, 'ready', `http://localhost:${state.ports[which]}`)
    return true
  }
  if (service.status === 'ready') {
    // Stay ready once seen — transient probe blips shouldn't flip UI
    return false
  }
  if (service.status === 'waiting' || service.status === 'idle') {
    return false
  }
  return false
}

/**
 * @param {ServiceStatus} status
 */
function statusGlyph(status) {
  switch (status) {
    case 'ready':
      return `${c.green}●${c.reset}`
    case 'failed':
      return `${c.red}●${c.reset}`
    case 'building':
    case 'starting':
      return `${c.yellow}◐${c.reset}`
    default:
      return `${c.gray}○${c.reset}`
  }
}

/**
 * @param {ServiceStatus} status
 */
function statusLabel(status) {
  switch (status) {
    case 'ready':
      return `${c.green}ready${c.reset}`
    case 'failed':
      return `${c.red}failed${c.reset}`
    case 'building':
      return `${c.yellow}building${c.reset}`
    case 'starting':
      return `${c.yellow}starting${c.reset}`
    default:
      return `${c.dim}waiting${c.reset}`
  }
}

/**
 * @param {CockpitState} state
 */
export function isAllReady(state) {
  return (
    state.db.status === 'ready' &&
    state.api.status === 'ready' &&
    state.web.status === 'ready'
  )
}

/**
 * Fixed-height status panel (API-banner style).
 * @param {CockpitState} state
 */
export function formatStatusPanel(state) {
  const W = 52
  const visibleLength = (text) => stripAnsi(text).length
  const padVisible = (text, width) => {
    const pad = Math.max(0, width - visibleLength(text))
    return text + ' '.repeat(pad)
  }
  const border = (left, fill, right) =>
    `${c.gray}${left}${fill.repeat(W)}${right}${c.reset}`
  const boxLine = (content) => {
    const inner = padVisible(content, W)
    return `${c.gray}│${c.reset}${inner}${c.gray}│${c.reset}`
  }
  const serviceRow = (name, service) => {
    const left = ` ${statusGlyph(service.status)} ${c.bold}${name.padEnd(4)}${c.reset} ${statusLabel(service.status)}`
    const detail = `${c.dim}${service.detail}${c.reset}`
    const gap = Math.max(1, W - visibleLength(left) - visibleLength(` ${detail}`) - 1)
    return boxLine(`${left}${' '.repeat(gap)}${detail}`)
  }

  const footer = state.error
    ? `${c.red}${state.error.slice(0, W - 4)}${c.reset}`
    : isAllReady(state)
      ? `${c.green}All systems go${c.reset}  ${c.dim}Ctrl+C to stop${c.reset}`
      : `${c.dim}Booting services…  Ctrl+C to stop${c.reset}`

  return [
    border('┌', '─', '┐'),
    boxLine(''),
    boxLine(`  ${c.bold}${c.green}NESY Cockpit${c.reset}  ${c.dim}${state.mode}${c.reset}`),
    boxLine(''),
    border('├', '─', '┤'),
    serviceRow('DB', state.db),
    serviceRow('API', state.api),
    serviceRow('Web', state.web),
    border('├', '─', '┤'),
    boxLine(`  ${footer}`),
    border('└', '─', '┘'),
  ].join('\n')
}

/**
 * Line buffer that feeds applyLogLine; does not emit log text.
 * @param {(line: string) => void} onLine
 */
export function createLineFeed(onLine) {
  let buffer = ''
  return (chunk) => {
    buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
    let idx
    while ((idx = buffer.indexOf('\n')) !== -1) {
      let line = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 1)
      if (line.endsWith('\r')) line = line.slice(0, -1)
      onLine(line)
    }
  }
}

/** Verbose-mode prefix rewrite: `@nesy/api:dev: msg` → `[api] msg` */
export function rewriteTurboLine(line) {
  const match = TURBO_LINE_RE.exec(stripAnsi(line))
  if (!match) return line
  const pkgName = match[1]
  const message = match[3]
  const tag = `[${pkgName}]`
  return message.length > 0 ? `${tag} ${message}` : tag
}

/** @deprecated use formatStatusPanel */
export function formatCockpitBanner(mode, ports = {}) {
  return formatStatusPanel(createCockpitState(mode, ports)) + '\n'
}

export function createLineRewriter(write) {
  return createLineFeed((line) => {
    write(`${rewriteTurboLine(line)}\n`)
  })
}

export { DEFAULT_PORTS }
