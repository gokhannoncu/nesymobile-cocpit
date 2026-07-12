import type { Env } from '../env.js'

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  emerald: '\x1b[38;5;42m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
}

/** İçerik genişliği (│ kenarlıklar hariç) */
const W = 52

const ANSI_RE = /\x1b\[[0-9;]*m/g

function visibleLength(text: string): number {
  return text.replace(ANSI_RE, '').length
}

function padVisible(text: string, width: number): string {
  const pad = Math.max(0, width - visibleLength(text))
  return text + ' '.repeat(pad)
}

function border(left: string, fill: string, right: string): string {
  return `${c.gray}${left}${fill.repeat(W)}${right}${c.reset}`
}

function boxLine(content: string): string {
  const inner = padVisible(content, W)
  return `${c.gray}│${c.reset}${inner}${c.gray}│${c.reset}`
}

function row(label: string, value: string): string {
  const labelCol = `${c.dim}${label.padEnd(11)}${c.reset}`
  const valueStart = visibleLength(` ${label.padEnd(11)}`)
  const valueWidth = W - valueStart
  const valueCol = padVisible(value, valueWidth)
  return boxLine(` ${labelCol}${valueCol}`)
}

function route(method: string, path: string, desc: string): string {
  const methodColor = method === 'GET' ? c.emerald : method === 'WS' ? c.cyan : c.yellow
  const body =
    `${methodColor}${method.padEnd(4)}${c.reset}` +
    `${c.white}${path.padEnd(16)}${c.reset}` +
    `${c.dim}${desc}${c.reset}`
  return boxLine(` ${padVisible(body, W - 1)}`)
}

export function printStartupBanner(env: Env) {
  const baseUrl = `http://localhost:${env.PORT}`
  const envLabel =
    env.NODE_ENV === 'production'
      ? `${c.yellow}${env.NODE_ENV}${c.reset}`
      : `${c.emerald}${env.NODE_ENV}${c.reset}`

  const lines = [
    '',
    border('┌', '─', '┐'),
    boxLine(''),
    boxLine(`  ${c.bold}${c.green}NESY${c.reset} ${c.dim}API${c.reset}`),
    boxLine(`  ${c.dim}Fastify · Socket.io · Zod${c.reset}`),
    boxLine(''),
    border('├', '─', '┤'),
    row('Ortam', envLabel),
    row('PID', `${c.white}${process.pid}${c.reset}`),
    row('HTTP', `${c.cyan}${baseUrl}${c.reset}`),
    row('Health', `${c.cyan}${baseUrl}/health${c.reset}`),
    row('Socket.io', `${c.emerald}aktif${c.reset} ${c.dim}· CORS ${env.CORS_ORIGIN}${c.reset}`),
    border('├', '─', '┤'),
    route('GET', '/', 'API bilgisi'),
    route('GET', '/health', 'Sağlık kontrolü'),
    route('WS', 'ping → pong', 'Heartbeat'),
    border('└', '─', '┘'),
    '',
  ]

  for (const line of lines) {
    console.log(line)
  }
}
