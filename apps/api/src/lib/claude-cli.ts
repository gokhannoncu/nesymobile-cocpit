import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { platform } from 'node:os'

const execFileAsync = promisify(execFile)

export type ClaudeCliOptions = {
  model?: string
  timeoutMs?: number
  cliPath?: string
  maxTurns?: number
  /** Use --bare (API key only; skips OAuth/keychain). Default false so `claude login` works. */
  bare?: boolean
}

export class ClaudeCliError extends Error {
  constructor(
    message: string,
    public readonly details?: string,
  ) {
    super(message)
    this.name = 'ClaudeCliError'
  }
}

async function resolveClaudeBinary(explicit?: string): Promise<string> {
  if (explicit?.trim()) return explicit.trim()

  const fromEnv = process.env.CLAUDE_CLI_PATH?.trim()
  if (fromEnv) return fromEnv

  const isWin = platform() === 'win32'
  try {
    if (isWin) {
      const { stdout } = await execFileAsync('where.exe', ['claude'], {
        timeout: 10_000,
        windowsHide: true,
      })
      const first = stdout
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find(Boolean)
      if (first) return first
    } else {
      const { stdout } = await execFileAsync('which', ['claude'], { timeout: 10_000 })
      const first = stdout.trim().split(/\r?\n/)[0]
      if (first) return first
    }
  } catch {
    // fall through
  }

  throw new ClaudeCliError(
    'Claude Code CLI not found. Install Claude Code, ensure `claude` is on PATH, or set CLAUDE_CLI_PATH.',
  )
}

type ClaudeJsonResult = {
  type?: string
  result?: string
  subtype?: string
  is_error?: boolean
}

function shouldUseBare(optsBare?: boolean): boolean {
  if (typeof optsBare === 'boolean') return optsBare
  if (process.env.CLAUDE_MONGO_QUERY_BARE === '1') return true
  if (process.env.CLAUDE_MONGO_QUERY_BARE === '0') return false
  // API key present → bare is fine; otherwise prefer OAuth/keychain login
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim())
}

function runSpawn(
  binary: string,
  args: string[],
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      env: process.env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGTERM')
      const err = new Error(`Claude CLI timed out after ${timeoutMs}ms.`) as Error & {
        killed: boolean
      }
      err.killed = true
      reject(err)
    }, timeoutMs)

    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk
    })

    child.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(error)
    })

    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ stdout, stderr, code })
    })
  })
}

export async function runClaudePrompt(
  prompt: string,
  opts: ClaudeCliOptions = {},
): Promise<{ resultText: string; model: string; raw: unknown }> {
  const model = opts.model ?? process.env.CLAUDE_MONGO_QUERY_MODEL ?? 'haiku'
  const timeoutMs =
    opts.timeoutMs ??
    Number(process.env.CLAUDE_MONGO_QUERY_TIMEOUT_MS ?? 90_000)
  const maxTurns = opts.maxTurns ?? 1
  const bare = shouldUseBare(opts.bare)
  const binary = await resolveClaudeBinary(opts.cliPath)

  const args = ['-p', '--output-format', 'json', '--model', model, '--max-turns', String(maxTurns)]
  if (bare) args.push('--bare')
  args.push(prompt)

  let stdout: string
  let stderr: string
  let code: number | null
  try {
    ;({ stdout, stderr, code } = await runSpawn(binary, args, timeoutMs))
  } catch (error) {
    const err = error as Error & { killed?: boolean }
    if (err.killed) {
      throw new ClaudeCliError(`Claude CLI timed out after ${timeoutMs}ms.`)
    }
    throw new ClaudeCliError('Claude CLI failed to start.', err.message)
  }

  const combined = [stdout, stderr].filter(Boolean).join('\n')
  if (code !== 0) {
    const fromJson = tryParseClaudeError(combined)
    if (fromJson) throw fromJson
    throw new ClaudeCliError('Claude CLI failed.', combined.slice(0, 2000))
  }

  let parsed: ClaudeJsonResult
  try {
    parsed = JSON.parse(stdout) as ClaudeJsonResult
  } catch {
    throw new ClaudeCliError(
      'Claude CLI returned non-JSON output.',
      (stdout || stderr).slice(0, 2000),
    )
  }

  if (parsed.is_error || parsed.subtype === 'error') {
    throw claudeResultError(parsed, stderr, stdout)
  }

  const resultText = typeof parsed.result === 'string' ? parsed.result.trim() : ''
  if (!resultText) {
    throw new ClaudeCliError(
      'Claude CLI returned an empty result.',
      stdout.slice(0, 2000),
    )
  }

  return { resultText, model, raw: parsed }
}

function tryParseClaudeError(text: string): ClaudeCliError | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as ClaudeJsonResult
    if (parsed.is_error || parsed.subtype === 'error') {
      return claudeResultError(parsed, '', text)
    }
  } catch {
    return null
  }
  return null
}

function claudeResultError(
  parsed: ClaudeJsonResult,
  stderr: string,
  stdout: string,
): ClaudeCliError {
  const result = String(parsed.result ?? '')
  if (/not logged in|oauth access token has expired|re-authenticate/i.test(result)) {
    return new ClaudeCliError(
      'Claude CLI auth failed. Run `claude login` in a terminal, or set ANTHROPIC_API_KEY.',
      result.slice(0, 500),
    )
  }
  return new ClaudeCliError(
    'Claude CLI reported an error.',
    (result || stderr || stdout).slice(0, 2000),
  )
}

/** Extract JSON object from model text (handles optional markdown fences). */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    // continue
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    return JSON.parse(fenced[1].trim())
  }

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1))
  }

  throw new ClaudeCliError('Could not parse JSON object from Claude result.', trimmed.slice(0, 2000))
}
