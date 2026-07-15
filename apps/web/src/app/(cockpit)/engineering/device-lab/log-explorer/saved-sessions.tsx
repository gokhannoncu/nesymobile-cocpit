'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Clock,
  Hash,
  Smartphone,
  User,
  ExternalLink,
  ArrowUpDown,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { ScrollArea } from '@nesy/metronic/components/ui/scroll-area'
import { EASE } from '@/components/product'
import { PageSection } from '@/components/product'
import { RunIdBadge } from '@/components/engineering/device-lab/device-lab-shared'

/* ──────────────────────────── Types ──────────────────────────────── */

interface SessionRow {
  id: string
  deviceName: string
  presetLabel?: string
  presetId?: string | null
  contextNote?: string
  startedAt: string
  durationMin: number
  eventCount: number
  owner: string
  sharedTo?: string | null
  sources: string[]
}

/* ──────────────────────── Helpers ────────────────────────────────── */

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function fmtDuration(min: number) {
  return `${min} dk`
}

function fmtEventCount(count: number) {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`
  }
  return String(count)
}

/* ──────────────────────── Props ──────────────────────────────────── */

interface SavedSessionsProps {
  sessions: SessionRow[]
}

/* ──────────────────── Column definitions ─────────────────────────── */

const COLUMNS = [
  { key: 'id', label: 'Session ID', width: 'w-44' },
  { key: 'device', label: 'Device', width: 'w-48' },
  { key: 'preset', label: 'Preset', width: 'w-28' },
  { key: 'context', label: 'Context', width: 'flex-1 min-w-0' },
  { key: 'duration', label: 'Duration', width: 'w-16' },
  { key: 'events', label: 'Events', width: 'w-16' },
  { key: 'owner', label: 'Owner', width: 'w-20' },
  { key: 'shared', label: 'Share', width: 'w-32' },
]

/* ──────────────────── Main Component ─────────────────────────────── */

export function SavedSessions({ sessions }: SavedSessionsProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(false)

  const sorted = useMemo(() => {
    const list = [...sessions]
    list.sort((a, b) => {
      const cmp = a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : 0
      return sortAsc ? cmp : -cmp
    })
    return list
  }, [sessions, sortAsc])

  return (
    <PageSection
      title="Saved Sessions"
      description="Previously saved log capture sessions. Click a row to view details."
    >
      <motion.div
        className="rounded-xl border bg-card overflow-hidden"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
      >
        {/* ── Table header ───────────────────────────────────────── */}
        <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-2">
          {COLUMNS.map((col) => (
            <span
              key={col.key}
              className={cn(
                'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground',
                col.width,
              )}
            >
              {col.key === 'id' ? (
                <button
                  onClick={() => setSortAsc(!sortAsc)}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  {col.label}
                  <ArrowUpDown className="size-3" />
                </button>
              ) : (
                col.label
              )}
            </span>
          ))}
        </div>

        {/* ── Table body ─────────────────────────────────────────── */}
        <ScrollArea className="max-h-[60vh]">
          <div className="divide-y divide-border/50">
            {sorted.map((session, idx) => {
              const isSelected = selectedId === session.id
              return (
                <motion.div
                  key={session.id}
                  onClick={() =>
                    setSelectedId(isSelected ? null : session.id)
                  }
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all hover:bg-muted/30',
                    isSelected &&
                      'bg-purple-50/40 ring-1 ring-purple-300 ring-inset dark:bg-purple-950/20 dark:ring-purple-800',
                  )}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.2,
                    delay: Math.min(idx * 0.03, 0.3),
                    ease: EASE,
                  }}
                >
                  {/* Session ID */}
                  <span className="w-44 shrink-0">
                    <RunIdBadge id={session.id} type="session" />
                  </span>

                  {/* Device */}
                  <span className="w-48 shrink-0 flex items-center gap-1.5 text-xs text-foreground/80 truncate">
                    <Smartphone className="size-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{session.deviceName}</span>
                  </span>

                  {/* Preset */}
                  <span className="w-28 shrink-0">
                    {session.presetLabel ? (
                      <Badge
                        variant="secondary"
                        appearance="outline"
                        size="xs"
                        className="truncate max-w-full"
                      >
                        {session.presetLabel}
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        —
                      </span>
                    )}
                  </span>

                  {/* Context */}
                  <span className="flex-1 min-w-0 text-[11px] text-muted-foreground truncate">
                    {session.contextNote ?? '—'}
                  </span>

                  {/* Duration */}
                  <span className="w-16 shrink-0 flex items-center gap-1 text-[11px] font-mono text-foreground/70">
                    <Clock className="size-3 text-muted-foreground" />
                    {fmtDuration(session.durationMin)}
                  </span>

                  {/* Events */}
                  <span className="w-16 shrink-0 flex items-center gap-1 text-[11px] font-mono text-foreground/70">
                    <Hash className="size-3 text-muted-foreground" />
                    {fmtEventCount(session.eventCount)}
                  </span>

                  {/* Owner */}
                  <span className="w-20 shrink-0 flex items-center gap-1 text-[11px] text-foreground/70 truncate">
                    <User className="size-3 text-muted-foreground shrink-0" />
                    {session.owner}
                  </span>

                  {/* Shared */}
                  <span className="w-32 shrink-0">
                    {session.sharedTo ? (
                      <Badge
                        variant="secondary"
                        appearance="outline"
                        size="xs"
                        className="gap-1 text-blue-700 dark:text-blue-400"
                      >
                        <ExternalLink className="size-3" />
                        <span className="truncate max-w-[100px]">
                          {session.sharedTo}
                        </span>
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        Not Shared
                      </span>
                    )}
                  </span>
                </motion.div>
              )
            })}
          </div>

          {sorted.length === 0 && (
            <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
              No saved sessions found.
            </div>
          )}
        </ScrollArea>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-2">
          <span className="text-[10px] text-muted-foreground">
            Total {sorted.length} sessions
          </span>
          <span className="text-[10px] text-muted-foreground">
            {sortAsc ? 'Old → New' : 'New → Old'}
          </span>
        </div>
      </motion.div>
    </PageSection>
  )
}
