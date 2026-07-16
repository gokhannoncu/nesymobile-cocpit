// IndexedDB persistence for Device Log Explorer.
//
// Stores (v1):
//   sessions     keyPath 'id'                     — session metadata
//   eventChunks  keyPath ['sessionId','chunkIndex'] — 500-event blocks
//   bundles      keyPath 'id', index 'bySession'  — generated diagnostic packages
//
// Raw captured logs live only in the user's browser profile; nothing here is
// sent anywhere automatically.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type {
  LogEvent,
  StoredEventChunk,
  StoredLogBundle,
  StoredLogSession,
} from '@/data/engineering/device-lab/device-lab-types'

export const CHUNK_SIZE = 500
export const RETENTION_DAYS = 30
export const QUOTA_WARN_RATIO = 0.8

interface LogExplorerDB extends DBSchema {
  sessions: {
    key: string
    value: StoredLogSession
    indexes: { byStartedAt: string }
  }
  eventChunks: {
    key: [string, number]
    value: StoredEventChunk
  }
  bundles: {
    key: string
    value: StoredLogBundle
    indexes: { bySession: string }
  }
}

let dbPromise: Promise<IDBPDatabase<LogExplorerDB>> | null = null

export function getLogDb(): Promise<IDBPDatabase<LogExplorerDB>> {
  if (!dbPromise) {
    dbPromise = openDB<LogExplorerDB>('nesy-log-explorer', 1, {
      upgrade(db) {
        const sessions = db.createObjectStore('sessions', { keyPath: 'id' })
        sessions.createIndex('byStartedAt', 'startedAt')
        db.createObjectStore('eventChunks', { keyPath: ['sessionId', 'chunkIndex'] })
        const bundles = db.createObjectStore('bundles', { keyPath: 'id' })
        bundles.createIndex('bySession', 'sessionId')
      },
    })
  }
  return dbPromise
}

// ── Sessions ────────────────────────────────────────────────────────

export async function putSession(session: StoredLogSession): Promise<void> {
  const db = await getLogDb()
  await db.put('sessions', session)
}

export async function getSession(id: string): Promise<StoredLogSession | undefined> {
  const db = await getLogDb()
  return db.get('sessions', id)
}

export async function getAllSessions(): Promise<StoredLogSession[]> {
  const db = await getLogDb()
  const all = await db.getAll('sessions')
  return all.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

export async function patchSession(
  id: string,
  patch: Partial<StoredLogSession>,
): Promise<void> {
  const db = await getLogDb()
  const existing = await db.get('sessions', id)
  if (!existing) return
  await db.put('sessions', { ...existing, ...patch })
}

/** Cascade delete: session + its event chunks + its bundles. */
export async function deleteSession(id: string): Promise<void> {
  const db = await getLogDb()
  const tx = db.transaction(['sessions', 'eventChunks', 'bundles'], 'readwrite')
  await tx.objectStore('sessions').delete(id)
  const chunkRange = IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER])
  let cursor = await tx.objectStore('eventChunks').openCursor(chunkRange)
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  const bundleKeys = await tx.objectStore('bundles').index('bySession').getAllKeys(id)
  for (const key of bundleKeys) await tx.objectStore('bundles').delete(key)
  await tx.done
}

/**
 * Marks any session left in `capturing` (e.g. a reload mid-capture) as
 * `interrupted`. Call once on app load.
 */
export async function reconcileInterruptedSessions(): Promise<number> {
  const db = await getLogDb()
  const all = await db.getAll('sessions')
  const stuck = all.filter((s) => s.status === 'capturing')
  const tx = db.transaction('sessions', 'readwrite')
  for (const s of stuck) await tx.store.put({ ...s, status: 'interrupted', stoppedAt: s.stoppedAt ?? new Date().toISOString() })
  await tx.done
  return stuck.length
}

// ── Event chunks ────────────────────────────────────────────────────

export async function putChunk(chunk: StoredEventChunk): Promise<void> {
  const db = await getLogDb()
  await db.put('eventChunks', chunk)
}

export async function getSessionEvents(sessionId: string): Promise<LogEvent[]> {
  const db = await getLogDb()
  const range = IDBKeyRange.bound([sessionId, 0], [sessionId, Number.MAX_SAFE_INTEGER])
  const chunks = await db.getAll('eventChunks', range)
  chunks.sort((a, b) => a.chunkIndex - b.chunkIndex)
  return chunks.flatMap((c) => c.events ?? [])
}

// ── Bundles ─────────────────────────────────────────────────────────

export async function putBundle(bundle: StoredLogBundle): Promise<void> {
  const db = await getLogDb()
  await db.put('bundles', bundle)
}

export async function getAllBundles(): Promise<StoredLogBundle[]> {
  const db = await getLogDb()
  const all = await db.getAll('bundles')
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getBundle(id: string): Promise<StoredLogBundle | undefined> {
  const db = await getLogDb()
  return db.get('bundles', id)
}

export async function deleteBundle(id: string): Promise<void> {
  const db = await getLogDb()
  await db.delete('bundles', id)
}

// ── Retention & quota ───────────────────────────────────────────────

/** Cascade-deletes sessions and bundles older than `days`. Returns count removed. */
export async function pruneOlderThan(days = RETENTION_DAYS): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
  const sessions = await getAllSessions()
  const stale = sessions.filter((s) => s.startedAt < cutoff)
  for (const s of stale) await deleteSession(s.id)

  // Bundles from an already-removed session are cascade-deleted above; also
  // drop orphan/older standalone bundles by createdAt.
  const bundles = await getAllBundles()
  let removed = stale.length
  for (const b of bundles) {
    if (b.createdAt < cutoff) {
      await deleteBundle(b.id)
      removed += 1
    }
  }
  return removed
}

export interface StorageEstimateResult {
  usage: number
  quota: number
  ratio: number
  overWarnThreshold: boolean
}

export async function estimateStorage(): Promise<StorageEstimateResult | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null
  const { usage = 0, quota = 0 } = await navigator.storage.estimate()
  const ratio = quota > 0 ? usage / quota : 0
  return { usage, quota, ratio, overWarnThreshold: ratio >= QUOTA_WARN_RATIO }
}

/** Deletes the N oldest sessions (cascade). Used by the quota-pressure action. */
export async function pruneOldestSessions(count: number): Promise<number> {
  const sessions = await getAllSessions()
  const oldest = sessions.slice(-Math.max(0, count))
  for (const s of oldest) await deleteSession(s.id)
  return oldest.length
}
