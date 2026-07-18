# Cockpit Dev Terminal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Turborepo’s laggy TUI for `pnpm dev` / `pnpm prod` with a NESY Cockpit banner plus clean streamed logs using short `[api]` / `[web]` prefixes.

**Architecture:** Extract pure log/banner helpers into `scripts/cockpit-log.mjs`. Root entry `scripts/cockpit-runner.mjs` prints the banner, spawns `turbo run dev|start --ui=stream`, pipes stdout/stderr through a line buffer that rewrites `@nesy/<pkg>:<task>:` prefixes, and shuts down the process tree like `scripts/dev-runner.mjs`. Global `turbo.json` UI becomes `stream`.

**Tech Stack:** Node.js ≥20 ESM (`.mjs`), Turborepo 2.x, `node:test` for pure helpers

**Spec:** `docs/superpowers/specs/2026-07-18-cockpit-dev-terminal-design.md`

## Global Constraints

- Banner + prefix rewrite only for root `pnpm dev` and `pnpm prod` (not build/lint/test).
- Keep Turbo orchestration (`dependsOn`, cache); do not spawn api/web bypassing Turbo.
- Prefix map: `@nesy/api` → `[api]`, `@nesy/web` → `[web]`, other `@nesy/<name>` → `[<name>]`.
- Strip Turbo task suffix so output is `[api] message`, not `[api]:dev: message`.
- Ports in banner are fixed defaults: API `4001`, Web `4002`.
- Windows shutdown must use `taskkill /PID … /F /T` (same pattern as `dev-runner.mjs`).
- Do not create a git commit unless the user explicitly requests one.

## File structure

| File | Responsibility |
| --- | --- |
| `scripts/cockpit-log.mjs` | Pure helpers: rewrite line prefixes, format banner, line buffer |
| `scripts/cockpit-log.test.mjs` | `node:test` coverage for helpers |
| `scripts/cockpit-runner.mjs` | CLI: parse `--mode`, print banner, spawn Turbo, pipe + signals |
| `package.json` | Point `dev` / `prod` at cockpit runner |
| `turbo.json` | `"ui": "stream"` |
| `README.md` | One-line note about cockpit stream UX |

---

### Task 1: Cockpit log helpers + unit tests

**Files:**
- Create: `scripts/cockpit-log.mjs`
- Create: `scripts/cockpit-log.test.mjs`

**Interfaces:**
- Consumes: nothing from other new modules
- Produces:
  - `rewriteTurboLine(line: string): string`
  - `formatCockpitBanner(mode: 'dev' | 'prod', ports?: { api: number, web: number }): string`
  - `createLineRewriter(write: (chunk: string) => void): (chunk: string | Buffer) => void`

- [ ] **Step 1: Write the failing tests**

Create `scripts/cockpit-log.test.mjs`:

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  rewriteTurboLine,
  formatCockpitBanner,
  createLineRewriter,
} from './cockpit-log.mjs'

describe('rewriteTurboLine', () => {
  it('maps @nesy/api task lines to [api]', () => {
    assert.equal(
      rewriteTurboLine('@nesy/api:dev: checking port 4001...'),
      '[api] checking port 4001...',
    )
  })

  it('maps @nesy/web start lines to [web]', () => {
    assert.equal(
      rewriteTurboLine('@nesy/web:start: ✓ Ready in 694ms'),
      '[web] ✓ Ready in 694ms',
    )
  })

  it('maps other @nesy packages to [name]', () => {
    assert.equal(
      rewriteTurboLine('@nesy/db:build: prisma generate'),
      '[db] prisma generate',
    )
  })

  it('leaves non-turbo lines unchanged', () => {
    assert.equal(rewriteTurboLine('>>> TURBO'), '>>> TURBO')
  })

  it('handles missing message body', () => {
    assert.equal(rewriteTurboLine('@nesy/api:dev:'), '[api]')
  })
})

describe('formatCockpitBanner', () => {
  it('includes title, mode, ports, and stop hint', () => {
    const banner = formatCockpitBanner('dev')
    assert.match(banner, /NESY Cockpit/)
    assert.match(banner, /dev/)
    assert.match(banner, /http:\/\/localhost:4001/)
    assert.match(banner, /http:\/\/localhost:4002/)
    assert.match(banner, /Ctrl\+C/)
  })

  it('labels prod mode', () => {
    assert.match(formatCockpitBanner('prod'), /prod/)
  })
})

describe('createLineRewriter', () => {
  it('buffers partial lines until newline', () => {
    const out = []
    const push = createLineRewriter((s) => out.push(s))
    push('@nesy/api:dev: hel')
    assert.deepEqual(out, [])
    push('lo\n')
    assert.deepEqual(out, ['[api] hello\n'])
  })

  it('rewrites multiple complete lines in one chunk', () => {
    const out = []
    const push = createLineRewriter((s) => out.push(s))
    push('@nesy/api:dev: a\n@nesy/web:dev: b\n')
    assert.deepEqual(out, ['[api] a\n', '[web] b\n'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/cockpit-log.test.mjs`

Expected: FAIL (cannot find module `./cockpit-log.mjs` or exports missing)

- [ ] **Step 3: Implement helpers**

Create `scripts/cockpit-log.mjs`:

```js
/**
 * Pure helpers for NESY Cockpit terminal UX (banner + Turbo stream prefixes).
 */

const DEFAULT_PORTS = { api: 4001, web: 4002 }

/** Turbo stream: `@nesy/<pkg>:<task>: <message>` */
const TURBO_LINE_RE = /^(@nesy\/([^:]+)):([^:]*):\s?(.*)$/

/**
 * @param {string} line
 * @returns {string}
 */
export function rewriteTurboLine(line) {
  const match = TURBO_LINE_RE.exec(line)
  if (!match) return line
  const pkgName = match[2]
  const message = match[4]
  const tag = `[${pkgName}]`
  return message.length > 0 ? `${tag} ${message}` : tag
}

/**
 * @param {'dev' | 'prod'} mode
 * @param {{ api?: number, web?: number }} [ports]
 * @returns {string}
 */
export function formatCockpitBanner(mode, ports = {}) {
  const apiPort = ports.api ?? DEFAULT_PORTS.api
  const webPort = ports.web ?? DEFAULT_PORTS.web
  const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
    white: '\x1b[37m',
  }
  const W = 48
  const ANSI_RE = /\x1b\[[0-9;]*m/g
  const visibleLength = (text) => text.replace(ANSI_RE, '').length
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
  const row = (label, value) => {
    const labelCol = `${c.dim}${label.padEnd(8)}${c.reset}`
    const valueStart = visibleLength(` ${label.padEnd(8)}`)
    const valueCol = padVisible(value, W - valueStart)
    return boxLine(` ${labelCol}${valueCol}`)
  }

  return [
    '',
    border('┌', '─', '┐'),
    boxLine(''),
    boxLine(`  ${c.bold}${c.green}NESY${c.reset} ${c.dim}Cockpit${c.reset}`),
    boxLine(''),
    border('├', '─', '┤'),
    row('Mode', `${c.white}${mode}${c.reset}`),
    row('API', `${c.cyan}http://localhost:${apiPort}${c.reset}`),
    row('Web', `${c.cyan}http://localhost:${webPort}${c.reset}`),
    border('├', '─', '┤'),
    boxLine(`  ${c.dim}Ctrl+C to stop${c.reset}`),
    border('└', '─', '┘'),
    '',
  ].join('\n')
}

/**
 * Buffer chunks into lines, rewrite each complete line, forward with newline.
 * @param {(chunk: string) => void} write
 * @returns {(chunk: string | Buffer) => void}
 */
export function createLineRewriter(write) {
  let buffer = ''
  return (chunk) => {
    buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
    let idx
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 1)
      const endedWithCr = line.endsWith('\r')
      const bare = endedWithCr ? line.slice(0, -1) : line
      const rewritten = rewriteTurboLine(bare)
      write(`${rewritten}${endedWithCr ? '\r' : ''}\n`)
    }
  }
}

export { DEFAULT_PORTS }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/cockpit-log.test.mjs`

Expected: all tests PASS

- [ ] **Step 5: Stop for review** (commit only if the user asks)

---

### Task 2: Cockpit runner (Turbo spawn + signals)

**Files:**
- Create: `scripts/cockpit-runner.mjs`
- Reference: `scripts/dev-runner.mjs` (shutdown pattern)

**Interfaces:**
- Consumes: `formatCockpitBanner`, `createLineRewriter`, `DEFAULT_PORTS` from `./cockpit-log.mjs`
- Produces: CLI `node scripts/cockpit-runner.mjs --mode dev|prod` (exit code = Turbo’s)

- [ ] **Step 1: Implement runner**

Create `scripts/cockpit-runner.mjs`:

```js
#!/usr/bin/env node
/**
 * Root cockpit entry for `pnpm dev` / `pnpm prod`.
 * Banner + Turbo stream with short [api]/[web] prefixes.
 *
 * Usage: node scripts/cockpit-runner.mjs --mode dev|prod
 */
import { spawn, execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createLineRewriter,
  DEFAULT_PORTS,
  formatCockpitBanner,
} from './cockpit-log.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

function parseMode(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--mode') {
      const mode = argv[i + 1]
      if (mode === 'dev' || mode === 'prod') return mode
    }
  }
  return null
}

const mode = parseMode(process.argv.slice(2))
if (!mode) {
  console.error('Usage: node scripts/cockpit-runner.mjs --mode dev|prod')
  process.exit(1)
}

const turboTask = mode === 'dev' ? 'dev' : 'start'
let turboBin
try {
  turboBin = require.resolve('turbo/bin/turbo', { paths: [repoRoot] })
} catch (error) {
  console.error('[cockpit] turbo not found — run pnpm install at repo root')
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

process.stdout.write(formatCockpitBanner(mode, DEFAULT_PORTS))

const child = spawn(
  process.execPath,
  [turboBin, 'run', turboTask, '--ui=stream'],
  {
    cwd: repoRoot,
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
    windowsHide: true,
  },
)

const rewriteStdout = createLineRewriter((s) => process.stdout.write(s))
const rewriteStderr = createLineRewriter((s) => process.stderr.write(s))
child.stdout.on('data', rewriteStdout)
child.stderr.on('data', rewriteStderr)

let forceExitTimer = null

function shutdown(force = false) {
  if (child.exitCode != null || child.signalCode != null) {
    process.exit(0)
    return
  }
  if (force || process.platform === 'win32') {
    if (child.pid) {
      try {
        execFileSync('taskkill.exe', ['/PID', String(child.pid), '/F', '/T'], {
          stdio: 'ignore',
          windowsHide: true,
        })
      } catch {
        child.kill('SIGKILL')
      }
    }
    process.exit(0)
    return
  }
  child.kill('SIGTERM')
  forceExitTimer = setTimeout(() => {
    child.kill('SIGKILL')
    process.exit(1)
  }, 2500)
  forceExitTimer.unref?.()
}

process.on('SIGINT', () => shutdown(false))
process.on('SIGTERM', () => shutdown(false))

child.on('exit', (code) => {
  if (forceExitTimer) clearTimeout(forceExitTimer)
  process.exit(code ?? 0)
})

child.on('error', (error) => {
  console.error('[cockpit] failed to start turbo:', error.message)
  process.exit(1)
})
```

- [ ] **Step 2: Smoke-check CLI usage error**

Run: `node scripts/cockpit-runner.mjs`

Expected: exit 1, prints `Usage: node scripts/cockpit-runner.mjs --mode dev|prod`

- [ ] **Step 3: Re-run unit tests**

Run: `node --test scripts/cockpit-log.test.mjs`

Expected: all PASS

- [ ] **Step 4: Stop for review** (commit only if the user asks)

---

### Task 3: Wire root scripts, Turbo UI, README

**Files:**
- Modify: `package.json` (scripts `dev`, `prod`)
- Modify: `turbo.json` (`ui`)
- Modify: `README.md` (dev note near `pnpm dev`)

**Interfaces:**
- Consumes: `scripts/cockpit-runner.mjs --mode dev|prod`
- Produces: `pnpm dev` / `pnpm prod` entrypoints used by operators

- [ ] **Step 1: Update root `package.json` scripts**

Change only `dev` and `prod` (keep `predev` / `preprod`):

```json
"dev": "node scripts/cockpit-runner.mjs --mode dev",
"prod": "node scripts/cockpit-runner.mjs --mode prod",
```

- [ ] **Step 2: Set Turbo UI to stream**

In `turbo.json`, change:

```json
"ui": "stream"
```

- [ ] **Step 3: Document in README**

In `README.md`, replace the sentence after the `pnpm dev` block:

From:

```markdown
`pnpm dev` Turbo ile web + API’yi birlikte başlatır. `predev` dolu portları temizler.
```

To:

```markdown
`pnpm dev` Turbo ile web + API’yi birlikte başlatır (`stream` log + kısa NESY Cockpit banner; `predev` dolu portları temizler). `pnpm prod` aynı UX ile production start çalıştırır.
```

- [ ] **Step 4: Manual verification (Windows)**

1. Run `pnpm build` — completes with stream UI (no interactive Tasks sidebar).
2. Run `pnpm dev` — banner shows `NESY Cockpit`, mode `dev`, ports 4001/4002; logs use `[api]` / `[web]`; no left-hand Tasks list.
3. Press Ctrl+C — process exits without `Terminate batch job (Y/N)?`.
4. (Optional) `pnpm prod` after a successful build — banner mode `prod`, same prefix style.

- [ ] **Step 5: Stop for review** (commit only if the user asks)

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Stream UI (no TUI lag) | Task 3 (`turbo.json` + `--ui=stream`) |
| Banner on dev/prod only | Task 2 + Task 3 |
| `[api]` / `[web]` prefixes | Task 1 + Task 2 |
| Ctrl+C / Windows taskkill | Task 2 |
| Keep Turbo dependsOn | Task 2 (still `turbo run`) |
| README note | Task 3 |
| Line buffering | Task 1 (`createLineRewriter`) |
| Manual Windows checks | Task 3 Step 4 |
