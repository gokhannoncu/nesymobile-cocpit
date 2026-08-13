'use client'

import { CircleDot, Gavel, Timer } from 'lucide-react'
import { Timeline, type TimelineItem } from '@/components/product/timeline'
import type { RunTimelineItem } from '@/lib/verdict-runtime/run-detail-view-model'

export function GateOracleTimeline({ items }: { items: RunTimelineItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 p-5 text-sm text-muted-foreground">
        <span className="font-mono text-xs font-semibold">NOT_MEASURED</span>
        <p className="mt-1">No persisted steps, waits, or oracle evaluations are available.</p>
      </div>
    )
  }

  const timelineItems: TimelineItem[] = items.map((item) => ({
    period: item.period,
    title: item.title,
    desc: item.description,
    icon: item.kind === 'oracle' ? Gavel : item.kind === 'wait' ? Timer : CircleDot,
    tone: item.tone,
    status: item.status,
    badges: [item.kind.toUpperCase(), item.result],
  }))

  return <Timeline items={timelineItems} />
}
