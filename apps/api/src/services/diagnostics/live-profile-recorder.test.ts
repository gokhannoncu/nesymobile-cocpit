import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { profileAsync, profilePrisma, profileRun, summarizeProfile } from './live-profile-recorder.js'

describe('live profiler', () => {
  it('does not wrap the promise while disabled', () => {
    const original = Promise.resolve(5)
    expect(profileAsync('test', {}, () => original)).toBe(original)
  })
  it('subtracts the union of overlapping children, not their sum', () => {
    const events = [
      { id: 1, name: 'root', startMs: 0, durationMs: 100, attrs: {}, status: 'ok' as const },
      { id: 2, parentId: 1, name: 'a', startMs: 10, durationMs: 50, attrs: {}, status: 'ok' as const },
      { id: 3, parentId: 1, name: 'b', startMs: 40, durationMs: 40, attrs: {}, status: 'ok' as const },
    ]
    expect(summarizeProfile(events).find(g => g.name === 'root')?.selfMs).toBe(30)
  })
  it('still executes the workflow when diagnostic output cannot be initialized', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nesy-profile-unwritable-'))
    const arm = join(dir, 'arm.json'), invalidOutput = join(dir, 'regular-file')
    const previous = process.env.VERDICT_LIVE_PROFILE_ARM
    process.env.VERDICT_LIVE_PROFILE_ARM = arm
    try {
      writeFileSync(invalidOutput, 'not a directory')
      writeFileSync(arm, JSON.stringify({ outputDir: invalidOutput }))
      let calls = 0
      const value = await profileRun({ runId: 'run_no_output', deviceId: 'd1' }, async () => ++calls)
      expect(value).toBe(1)
      expect(calls).toBe(1)
    } finally {
      if (previous === undefined) delete process.env.VERDICT_LIVE_PROFILE_ARM
      else process.env.VERDICT_LIVE_PROFILE_ARM = previous
      rmSync(dir, { recursive: true, force: true })
    }
  })
  it('traces nested DB callbacks, preserves rejection identity and consumes the matching arm only', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nesy-profile-test-'))
    const arm = join(dir, 'arm.json')
    const previous = process.env.VERDICT_LIVE_PROFILE_ARM
    process.env.VERDICT_LIVE_PROFILE_ARM = arm
    try {
      writeFileSync(arm, JSON.stringify({ outputDir: dir, deviceId: 'd1' }))
      await profileRun({ runId: 'run_other', deviceId: 'd2' }, async () => 1)
      expect(existsSync(arm)).toBe(true)
      const sentinel = new Error('secret must not be recorded')
      const model = { marker: 7, async findUnique(_args: unknown) { return this.marker } }
      const raw = { model, async $transaction(fn: (tx: { model: typeof model }) => Promise<number>) { return fn({ model }) } }
      const db = profilePrisma(raw)
      await expect(profileRun({ runId: 'run_test', deviceId: 'd1' }, () =>
        profileAsync('executor.step', { stepId: 's1' }, async () => {
          expect(await db.$transaction(tx => tx.model.findUnique({ secret: 'never-captured' }))).toBe(7)
          throw sentinel
        }))).rejects.toBe(sentinel)
      expect(existsSync(arm)).toBe(false)
      const text = readFileSync(join(dir, 'run_test/events.jsonl'), 'utf8')
      expect(text).not.toContain('never-captured')
      expect(text).not.toContain(sentinel.message)
      const events = text.trim().split('\n').map(line => JSON.parse(line))
      const query = events.find(e => e.name === 'db.model.findUnique')
      expect(query.attrs.stepId).toBe('s1')
      expect(events.find(e => e.id === query.parentId).name).toBe('db.transaction')
      expect(events.find(e => e.name === 'executor.step').status).toBe('error')
      expect(existsSync(join(dir, 'run_test/complete.json'))).toBe(true)
    } finally {
      if (previous === undefined) delete process.env.VERDICT_LIVE_PROFILE_ARM
      else process.env.VERDICT_LIVE_PROFILE_ARM = previous
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
