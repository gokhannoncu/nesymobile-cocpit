'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Clock,
  Smartphone,
  Hash,
  ArrowUpDown,
  FolderOpen,
  Download,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { ScrollArea } from '@nesy/metronic/components/ui/scroll-area'
import { EASE, PageSection } from '@/components/product'
import { RunIdBadge } from '@/components/engineering/device-lab/device-lab-shared'
import type { StoredLogSession } from '@/data/engineering/device-lab/device-lab-types'

interface SavedSessionsProps {
  sessions: StoredLogSession[]
  onOpen: (id: string) => void
  onExport: (id: string) => void
  onDelete: (id: string) => void
  busyId?: string | null
}

const STATUS_TONE: Record<StoredLogSession['status'], string> = {
  capturing: 'text-green-700 dark:text-green-400',
  stopped: 'text-foreground/70',
  saved: 'text-blue-700 dark:text-blue-400',
  interrupted: 'text-amber-700 dark:text-amber-400',
}

function durationLabel(session: StoredLogSession): string {
  if (!session.stoppedAt) return 'live'
  const ms = new Date(session.stoppedAt).getTime() - new Date(session.startedAt).getTime()
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}m ${String(rem).padStart(2, '0')}s`
}

function eventCountLabel(count: number): string {
  return count >= 1000 ? `${(count / 1000).toFixed(1)}K` : String(count)
}

export function SavedSessions({ sessions, onOpen, onExport, onDelete, busyId }: SavedSessionsProps) {
  const [sortAsc, setSortAsc] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const sorted = useMemo(() => {
    const list = [...sessions]
    list.sort((a, b) => {
      const cmp = a.startedAt.localeCompare(b.startedAt)
      return sortAsc ? cmp : -cmp
    })
    return list
  }, [sessions, sortAsc])

  return (
    <PageSection
      title="Saved Sessions"
      description="Capture sessions stored locally in this browser (IndexedDB). Open one to review its events, re-export a bundle, or delete it and its data."
    >
      <motion.div
        className="rounded-xl border bg-card overflow-hidden"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
      >
        <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <button
            onClick={() => setSortAsc(!sortAsc)}
            className="flex w-52 items-center gap-1 hover:text-foreground transition-colors"
          >
            Session <ArrowUpDown className="size-3" />
          </button>
          <span className="w-44">Device</span>
          <span className="w-28">Preset</span>
          <span className="w-20">Status</span>
          <span className="w-16">Duration</span>
          <span className="w-16">Events</span>
          <span className="flex-1 text-right">Actions</span>
        </div>

        <ScrollArea className="max-h-[60vh]">
          <div className="divide-y divide-border/50">
            {sorted.map((session, idx) => (
              <motion.div
                key={session.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3), ease: EASE }}
              >
                <span className="w-52 shrink-0">
                  <RunIdBadge id={session.id.slice(0, 21)} type="session" />
                </span>
                <span className="w-44 shrink-0 flex items-center gap-1.5 text-xs text-foreground/80 truncate">
                  <Smartphone className="size-3 text-muted-foreground shrink-0" />
                  <span className="truncate">{session.device.name}</span>
                </span>
                <span className="w-28 shrink-0">
                  {session.presetLabel ? (
                    <Badge variant="secondary" appearance="outline" size="xs" className="truncate max-w-full">
                      {session.presetLabel}
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </span>
                <span className={cn('w-20 shrink-0 flex items-center gap-1 text-[11px] font-medium', STATUS_TONE[session.status])}>
                  {session.status === 'interrupted' && <AlertTriangle className="size-3" />}
                  {session.status}
                </span>
                <span className="w-16 shrink-0 flex items-center gap-1 text-[11px] font-mono text-foreground/70">
                  <Clock className="size-3 text-muted-foreground" />
                  {durationLabel(session)}
                </span>
                <span className="w-16 shrink-0 flex items-center gap-1 text-[11px] font-mono text-foreground/70">
                  <Hash className="size-3 text-muted-foreground" />
                  {eventCountLabel(session.eventCount)}
                </span>
                <span className="flex-1 flex items-center justify-end gap-1">
                  {confirmId === session.id ? (
                    <>
                      <span className="text-[10px] text-muted-foreground">Delete?</span>
                      <Button size="xs" variant="ghost" className="h-6 px-2 text-[10px] text-red-600" onClick={() => { onDelete(session.id); setConfirmId(null) }}>
                        Yes
                      </Button>
                      <Button size="xs" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setConfirmId(null)}>
                        No
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="xs" variant="ghost" className="h-6 gap-1 px-1.5 text-[10px]" onClick={() => onOpen(session.id)}>
                        <FolderOpen className="size-3" /> Open
                      </Button>
                      <Button size="xs" variant="ghost" className="h-6 gap-1 px-1.5 text-[10px]" disabled={busyId === session.id} onClick={() => onExport(session.id)}>
                        <Download className="size-3" /> Export
                      </Button>
                      <Button size="xs" variant="ghost" className="h-6 gap-1 px-1.5 text-[10px] text-red-600 hover:text-red-700" onClick={() => setConfirmId(session.id)}>
                        <Trash2 className="size-3" />
                      </Button>
                    </>
                  )}
                </span>
              </motion.div>
            ))}
          </div>

          {sorted.length === 0 && (
            <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
              No saved sessions yet. Start a live capture to create one.
            </div>
          )}
        </ScrollArea>

        <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-2 text-[10px] text-muted-foreground">
          <span>Total {sorted.length} sessions</span>
          <span>{sortAsc ? 'Old → New' : 'New → Old'}</span>
        </div>
      </motion.div>
    </PageSection>
  )
}
