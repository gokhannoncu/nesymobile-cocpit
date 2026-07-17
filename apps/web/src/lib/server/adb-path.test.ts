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
    for (const name of [
      'SQLITE3_PATH',
      'SQLITE3_PATH_WINDOWS',
      'SQLITE3_PATH_WIN32',
      'SQLITE3_PATH_DARWIN',
      'SQLITE3_PATH_MACOS',
      'SQLITE3_PATH_LINUX',
    ]) {
      delete process.env[name]
    }
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
