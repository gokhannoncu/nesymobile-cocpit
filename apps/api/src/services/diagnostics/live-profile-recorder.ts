/**
 * Opt-in, run-scoped wall/monotonic tracing. Never captures arguments, SQL,
 * credentials or response bodies. No extra database writes on the hot path.
 * Arm with /tmp/nesy-live-profile-arm.json; the one-shot arm is consumed at start.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { createWriteStream, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { finished } from 'node:stream/promises'
import { isAbsolute, join } from 'node:path'
import { performance } from 'node:perf_hooks'

export type ProfileAttrs = Record<string, string | number | boolean | undefined>
export interface ProfileEvent {
  id: number; parentId?: number; name: string; startMs: number; durationMs: number
  attrs: ProfileAttrs; status: 'ok' | 'error'
}
interface Session {
  epoch: number; origin: number; nextId: number; events: ProfileEvent[]
  emit: (event: ProfileEvent) => void; closed: boolean; dropped: number
}
const context = new AsyncLocalStorage<{ session: Session; parentId?: number; stepId?: string }>()

export function profileActive(): boolean { return context.getStore()?.session.closed === false }

/** Returns the original value/promise when disabled. Errors are rethrown unchanged. */
export function profileAsync<T>(name: string, attrs: ProfileAttrs, work: () => Promise<T>): Promise<T> {
  const parent = context.getStore()
  if (!parent || parent.session.closed) return work()
  const session = parent.session
  const id = ++session.nextId
  const start = performance.now()
  const stepId = typeof attrs.stepId === 'string' ? attrs.stepId : parent.stepId
  return context.run({ session, parentId: id, stepId }, async () => {
    let status: ProfileEvent['status'] = 'ok'
    try { return await work() }
    catch (error) { status = 'error'; throw error }
    finally {
      const event: ProfileEvent = {
        id, parentId: parent.parentId, name, startMs: start - session.origin,
        durationMs: performance.now() - start, attrs: { ...attrs, stepId }, status,
      }
      if (!session.closed && session.events.length < 100_000) {
        session.events.push(event)
        try { session.emit(event) } catch { session.dropped++ }
      } else session.dropped++
    }
  })
}

export function summarizeProfile(events: ProfileEvent[]) {
  const children = new Map<number, ProfileEvent[]>()
  for (const event of events) if (event.parentId !== undefined) {
    const list = children.get(event.parentId) ?? []
    list.push(event); children.set(event.parentId, list)
  }
  const selfMs = (event: ProfileEvent) => {
    const ranges = (children.get(event.id) ?? []).map(c => [
      Math.max(event.startMs, c.startMs),
      Math.min(event.startMs + event.durationMs, c.startMs + c.durationMs),
    ]).filter(([a, b]) => b! > a!).sort((a, b) => a[0]! - b[0]!)
    let covered = 0, end = event.startMs
    for (const [a, b] of ranges) { covered += Math.max(0, b! - Math.max(end, a!)); end = Math.max(end, b!) }
    return Math.max(0, event.durationMs - covered)
  }
  const groups = new Map<string, { count: number; inclusiveMs: number; selfMs: number; durations: number[] }>()
  for (const event of events) {
    const key = event.name
    const g = groups.get(key) ?? { count: 0, inclusiveMs: 0, selfMs: 0, durations: [] }
    g.count++; g.inclusiveMs += event.durationMs; g.selfMs += selfMs(event); g.durations.push(event.durationMs)
    groups.set(key, g)
  }
  return [...groups].map(([name, g]) => {
    const values = g.durations.sort((a, b) => a - b)
    return { name, count: g.count, inclusiveMs: g.inclusiveMs, selfMs: g.selfMs,
      p50Ms: values[Math.floor((values.length - 1) * .5)], p95Ms: values[Math.ceil((values.length - 1) * .95)] }
  }).sort((a, b) => b.selfMs - a.selfMs)
}

export async function profileRun<T>(
  item: { runId: string; deviceId: string; workflowRef?: string }, work: () => Promise<T>,
): Promise<T> {
  const armPath = process.env.VERDICT_LIVE_PROFILE_ARM ?? '/tmp/nesy-live-profile-arm.json'
  if (!existsSync(armPath)) return work()
  let arm: { outputDir: string; deviceId?: string; workflowRef?: string }
  try { arm = JSON.parse(readFileSync(armPath, 'utf8')) } catch { return work() }
  if (!isAbsolute(arm.outputDir ?? '') || !/^run_[a-zA-Z0-9-]+$/.test(item.runId) ||
      (arm.deviceId && arm.deviceId !== item.deviceId) ||
      (arm.workflowRef && arm.workflowRef !== item.workflowRef)) return work()
  const dir = join(arm.outputDir, item.runId)
  const epoch = Date.now(), origin = performance.now()
  try {
    unlinkSync(armPath)
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({
      schemaVersion: 1, runId: item.runId, deviceId: item.deviceId, epochMs: epoch,
      status: 'RUNNING', clock: 'host performance.now(); epoch anchor Date.now()',
      payloadsCaptured: false,
    }, null, 2), { mode: 0o600 })
  } catch {
    console.warn('[live-profile] diagnostic initialization failed; workflow continues without profiling')
    return work()
  }
  const writer = createWriteStream(join(dir, 'events.jsonl'), { mode: 0o600 })
  let writeError = false
  writer.on('error', () => { writeError = true })
  const session: Session = { epoch, origin, nextId: 0, events: [],
    closed: false, dropped: 0, emit: e => { if (!writeError) writer.write(JSON.stringify(e) + '\n') } }
  try {
    return await context.run({ session }, () => profileAsync('run.total', {}, work))
  } finally {
    session.closed = true
    try {
    writer.end()
    await finished(writer).catch(() => { writeError = true })
    const summary = summarizeProfile(session.events)
    writeFileSync(join(dir, 'summary.json'), JSON.stringify({ runId: item.runId,
      durationMs: performance.now() - session.origin, eventCount: session.events.length,
      dropped: session.dropped, writeError, groups: summary }, null, 2))
    writeFileSync(join(dir, 'trace.json'), JSON.stringify({ traceEvents: session.events.map(e => ({
      name: e.name, cat: e.name.split('.')[0], ph: 'X', ts: e.startMs * 1000, dur: e.durationMs * 1000,
      pid: 1, tid: e.name.startsWith('db.') ? 2 : e.name.startsWith('bridge.') ? 3 :
        e.name.startsWith('sdk.') || e.name.startsWith('adb.') ? 4 : 1,
      args: { ...e.attrs, id: e.id, parentId: e.parentId, status: e.status },
    })) }))
    writeFileSync(join(dir, 'complete.json'), JSON.stringify({ runId: item.runId, eventCount: session.events.length,
      dropped: session.dropped, writeError, completedAt: new Date().toISOString() }))
    } catch {
      // A failed diagnostic export must never replace the workflow's result/error.
      console.warn('[live-profile] diagnostic export failed; workflow result preserved')
    }
  }
}

/** Prisma callback transaction semantics preserved; query args/results never logged. */
export function profilePrisma<T extends object>(client: T): T {
  const delegates = new Map<PropertyKey, unknown>()
  return new Proxy(client, {
    get(target: any, key, receiver) {
      const value = Reflect.get(target, key, receiver)
      if (key === '$transaction') return (first: any, ...rest: any[]) =>
        profileAsync('db.transaction', {}, () => value.call(target,
          typeof first === 'function' ? (tx: object) => first(profilePrisma(tx)) : first, ...rest))
      if (typeof value === 'function') return (...args: any[]) =>
        profileAsync('db.' + String(key), {}, () => value.apply(target, args))
      if (!value || typeof value !== 'object' || String(key).startsWith('_')) return value
      if (!delegates.has(key)) delegates.set(key, new Proxy(value, {
        get(model, action) {
          const method = model[action]
          if (typeof method !== 'function') return method
          return (...args: any[]) => profileAsync('db.' + String(key) + '.' + String(action), {},
            () => method.apply(model, args))
        },
      }))
      return delegates.get(key)
    },
  })
}
