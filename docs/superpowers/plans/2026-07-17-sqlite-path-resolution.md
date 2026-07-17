# SQLite PATH Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve an installed `sqlite3` executable from the host `PATH` when no configured or known fixed path exists.

**Architecture:** Extend the existing server-only SQLite resolver with the same platform-aware command lookup pattern already used by the shared ADB resolver. Keep environment variables and fixed paths ahead of `PATH`, cache the final result, and treat command failures as a normal not-found result.

**Tech Stack:** TypeScript 5.8, Node.js `child_process`, Vitest 3

## Global Constraints

- Resolution order is `SQLITE3_PATH` → platform-specific environment variable → known fixed locations → host `PATH`.
- Windows uses `where.exe sqlite3`; macOS and Linux use `which sqlite3`.
- Only paths that exist are accepted.
- No dependency, SQLite installation, or user-level environment change is introduced.
- Do not create a git commit unless the user explicitly requests one.

---

### Task 1: Add Cross-Platform SQLite PATH Resolution

**Files:**
- Create: `apps/web/src/lib/server/adb-path.test.ts`
- Modify: `apps/web/src/lib/server/adb-path.ts`

**Interfaces:**
- Consumes: Node.js `execFileSync(command, args, options)` and the existing `resolveSqlitePath(): string | null`.
- Produces: unchanged public `resolveSqlitePath(): string | null`; only its final fallback behavior changes.

- [ ] **Step 1: Write the failing resolver tests**

Create `apps/web/src/lib/server/adb-path.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  execFileSync: vi.fn(),
  existsSync: vi.fn(),
  homedir: vi.fn(() => '/home/tester'),
  platform: vi.fn(),
}))

vi.mock('node:child_process', () => ({ execFileSync: mocks.execFileSync }))
vi.mock('node:fs', () => ({ existsSync: mocks.existsSync }))
vi.mock('node:os', () => ({ homedir: mocks.homedir, platform: mocks.platform }))

const ORIGINAL_ENV = { ...process.env }

async function loadResolver() {
  vi.resetModules()
  return import('./adb-path')
}

describe('resolveSqlitePath', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...ORIGINAL_ENV }
    delete process.env.SQLITE3_PATH
    delete process.env.SQLITE3_PATH_WINDOWS
    delete process.env.SQLITE3_PATH_WIN32
    delete process.env.SQLITE3_PATH_DARWIN
    delete process.env.SQLITE3_PATH_MACOS
    delete process.env.SQLITE3_PATH_LINUX
    mocks.existsSync.mockReturnValue(false)
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('uses where.exe to resolve sqlite3 on Windows', async () => {
    const resolved = 'C:\\tools\\sqlite3.exe'
    mocks.platform.mockReturnValue('win32')
    mocks.execFileSync.mockReturnValue(`${resolved}\r\n`)
    mocks.existsSync.mockImplementation((candidate) => candidate === resolved)

    const { resolveSqlitePath } = await loadResolver()

    expect(resolveSqlitePath()).toBe(resolved)
    expect(mocks.execFileSync).toHaveBeenCalledWith(
      'where.exe',
      ['sqlite3'],
      expect.objectContaining({ encoding: 'utf8', windowsHide: true }),
    )
  })

  it('uses which to resolve sqlite3 on macOS', async () => {
    const resolved = '/custom/bin/sqlite3'
    mocks.platform.mockReturnValue('darwin')
    mocks.execFileSync.mockReturnValue(`${resolved}\n`)
    mocks.existsSync.mockImplementation((candidate) => candidate === resolved)

    const { resolveSqlitePath } = await loadResolver()

    expect(resolveSqlitePath()).toBe(resolved)
    expect(mocks.execFileSync).toHaveBeenCalledWith(
      'which',
      ['sqlite3'],
      expect.objectContaining({ encoding: 'utf8' }),
    )
  })

  it('keeps configured paths ahead of PATH lookup', async () => {
    const configured = 'C:\\configured\\sqlite3.exe'
    process.env.SQLITE3_PATH = configured
    mocks.platform.mockReturnValue('win32')
    mocks.existsSync.mockImplementation((candidate) => candidate === configured)

    const { resolveSqlitePath } = await loadResolver()

    expect(resolveSqlitePath()).toBe(configured)
    expect(mocks.execFileSync).not.toHaveBeenCalled()
  })

  it('returns null when sqlite3 is unavailable', async () => {
    mocks.platform.mockReturnValue('linux')
    mocks.execFileSync.mockImplementation(() => {
      throw new Error('not found')
    })

    const { resolveSqlitePath } = await loadResolver()

    expect(resolveSqlitePath()).toBeNull()
  })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
pnpm --filter @nesy/web test -- src/lib/server/adb-path.test.ts
```

Expected: the Windows and macOS tests fail because `resolveSqlitePath()` currently returns `null` after checking only environment and fixed-path candidates.

- [ ] **Step 3: Implement the minimal PATH fallback**

Update `apps/web/src/lib/server/adb-path.ts`:

```typescript
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'
import { getAdbPathHint, resolveAdbPath } from '@nesy/platform-paths'

export { resolveAdbPath } from '@nesy/platform-paths'

function envPath(name: string): string | null {
  const value = process.env[name]?.trim()
  return value || null
}

function platformSqliteEnvPath(): string | null {
  const os = platform()
  if (os === 'win32') return envPath('SQLITE3_PATH_WINDOWS') ?? envPath('SQLITE3_PATH_WIN32')
  if (os === 'darwin') return envPath('SQLITE3_PATH_DARWIN') ?? envPath('SQLITE3_PATH_MACOS')
  return envPath('SQLITE3_PATH_LINUX')
}

function defaultSqliteCandidates(): string[] {
  const home = homedir()
  const os = platform()
  if (os === 'win32') {
    return [
      'C:\\Program Files\\SQLite\\sqlite3.exe',
      join(home, 'scoop', 'shims', 'sqlite3.exe'),
    ]
  }
  if (os === 'darwin') {
    return ['/opt/homebrew/bin/sqlite3', '/usr/local/bin/sqlite3', '/usr/bin/sqlite3']
  }
  return ['/usr/bin/sqlite3', '/usr/local/bin/sqlite3']
}

function resolveSqliteFromPath(): string | null {
  try {
    const os = platform()
    const output = execFileSync(os === 'win32' ? 'where.exe' : 'which', ['sqlite3'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: os === 'win32',
    })
    const first = output.split(/\r?\n/).map((line) => line.trim()).find(Boolean)
    return first && existsSync(first) ? first : null
  } catch {
    return null
  }
}

let cachedSqlitePath: string | null | undefined

export function resolveSqlitePath(): string | null {
  if (cachedSqlitePath !== undefined) return cachedSqlitePath
  const candidates = [
    envPath('SQLITE3_PATH'),
    platformSqliteEnvPath(),
    ...defaultSqliteCandidates(),
  ].filter((p): p is string => Boolean(p))
  cachedSqlitePath = candidates.find((p) => existsSync(p)) ?? resolveSqliteFromPath()
  return cachedSqlitePath
}

export function getAdbResolutionHint(): string {
  return getAdbPathHint()
}
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
pnpm --filter @nesy/web test -- src/lib/server/adb-path.test.ts
```

Expected: four tests pass.

- [ ] **Step 5: Run package verification**

Run:

```powershell
pnpm --filter @nesy/web test
pnpm --filter @nesy/web typecheck
pnpm --filter @nesy/web lint
```

Expected: all commands exit with code 0 and no new warning or error is introduced.

- [ ] **Step 6: Rebuild the local knowledge graph**

Run:

```powershell
graphify update .
```

Expected: the graph update completes. If `graphify-out/needs_update` exists because of the design/plan documentation, report that semantic re-extraction remains pending.

- [ ] **Step 7: Verify the live resolver result**

Restart the web development process so the module cache is cleared, then reload the database page.

Expected on the current Windows host: the resolver finds the `sqlite3.exe` returned by `where.exe sqlite3`, and the database snapshot proceeds past the previous `sqlite3 binary not found` error.
