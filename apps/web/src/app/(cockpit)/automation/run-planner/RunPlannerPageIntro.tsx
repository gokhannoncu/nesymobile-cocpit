'use client'

import type { LucideIcon } from 'lucide-react'
import { ClipboardList, Layers, Package, Workflow } from 'lucide-react'
import { HeroCallout } from '@/components/product/blocks'

export function RunPlannerPageIntro({
  workflowCount,
  publishedPackCount,
  releaseProfileCount,
}: {
  workflowCount: number
  publishedPackCount: number
  releaseProfileCount: number
}) {
  return (
    <HeroCallout
      icon={ClipboardList}
      eyebrow="Automation / Planning"
      title="Run Planner"
      lead="Pin a workflow, Domain Pack version, test profile, and device into one frozen campaign cell. Review the plan and resolve blockers before anything executes — a skipped run always shows an explicit reason."
      tone="orange"
      chips={['Pre-flight validation', 'Pinned manifest', 'Campaign launch']}
      compact
      layout="stack"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <CatalogMetric
          icon={Workflow}
          label="Workflows"
          value={workflowCount}
          detail={workflowCount ? 'Available in catalog' : 'Nothing to plan yet'}
        />
        <CatalogMetric
          icon={Package}
          label="Published packs"
          value={publishedPackCount}
          detail={publishedPackCount ? 'Pin-ready versions' : 'Publish a pack first'}
        />
        <CatalogMetric
          icon={Layers}
          label="Release profiles"
          value={releaseProfileCount}
          detail={releaseProfileCount ? 'Release-gate enabled' : 'No gate profiles yet'}
        />
      </div>
    </HeroCallout>
  )
}

function CatalogMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon
  label: string
  value: number
  detail: string
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/80 px-4 py-3 shadow-xs backdrop-blur-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5 shrink-0 opacity-70" />
        {label}
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}
