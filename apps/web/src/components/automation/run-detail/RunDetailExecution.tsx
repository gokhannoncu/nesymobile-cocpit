'use client'

import { Activity, GitBranch, ListTree, Radio } from 'lucide-react'
import type { RunDetailViewModel } from '@/lib/verdict-runtime/run-detail-view-model'
import type { RunDetailResult } from '@/lib/verdict-runtime/types'
import type { RunLiveEvent } from '@/lib/verdict-runtime/run-live-stream'
import { DiagnosticWaterfall } from './DiagnosticWaterfall'
import { GateOracleTimeline } from './GateOracleTimeline'
import { OccurrenceTree } from './OccurrenceTree'
import { RunLiveFeed } from './RunLiveFeed'
import { WorkflowPathTimeline } from './WorkflowPathTimeline'

export function RunDetailExecution({
  detail,
  view,
  events,
  liveError,
}: {
  detail: RunDetailResult
  view: RunDetailViewModel
  events: readonly RunLiveEvent[]
  liveError: string | null
}) {
  return (
    <div className="space-y-6">
      <Section
        title="Execution timeline"
        description="Persisted steps, waits, and oracle evaluations in observed order."
        icon={Activity}
      >
        <GateOracleTimeline items={view.timeline} />
      </Section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Section
          title="Workflow flow"
          description="Each step shows its measured duration and Oracle validation across Bridge, SDK, Local DB and Backend."
          icon={GitBranch}
        >
          {view.workflowPath.length === 0 ? (
            <Unavailable message="No persisted workflow path is available." />
          ) : (
            <WorkflowPathTimeline elements={view.diagram} />
          )}
        </Section>

        <Section
          title="Occurrence hierarchy"
          description="Persisted step occurrences for this run."
          icon={ListTree}
        >
          <OccurrenceTree run={detail} />
        </Section>
      </div>

      <Section
        title="Live event stream"
        description="Socket events are transient context; durable panels remain the source of current state."
        icon={Radio}
        accessory={
          liveError ? <span className="max-w-sm text-xs text-destructive">{liveError}</span> : null
        }
      >
        <RunLiveFeed events={events} />
      </Section>

      <Section
        title="Diagnostic waterfall"
        description="Persisted action transitions with explicit clock uncertainty."
        icon={Activity}
      >
        <DiagnosticWaterfall run={detail} />
      </Section>
    </div>
  )
}

function Section({
  title,
  description,
  icon: Icon,
  accessory,
  children,
}: {
  title: string
  description: string
  icon: typeof Activity
  accessory?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="min-w-0 rounded-xl border bg-card p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="size-4" /></span>
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        {accessory}
      </div>
      {children}
    </section>
  )
}

function Unavailable({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-5 text-sm text-muted-foreground">
      <span className="font-mono text-xs font-semibold">NOT_MEASURED</span>
      <p className="mt-1">{message}</p>
    </div>
  )
}
