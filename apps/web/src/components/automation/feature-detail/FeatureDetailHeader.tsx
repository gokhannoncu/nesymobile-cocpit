'use client'

import Link from 'next/link'
import {
  ArrowLeft,
  ChevronRight,
  Layers,
  Monitor,
  Package,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@nesy/metronic/components/ui/button'
import { cn } from '@nesy/metronic/lib/utils'

function packDetailHref(packKey: string, version: string): string {
  return `/automation/domain-packs/${encodeURIComponent(packKey)}?version=${encodeURIComponent(version)}`
}

function MetaCell({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: LucideIcon
  label: string
  value: string
  tone?: 'default' | 'success' | 'warning'
}) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-[8px] border px-3 py-2.5',
        tone === 'success' && 'border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20',
        tone === 'warning' && 'border-amber-200/80 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20',
        tone === 'default' && 'border-border/60 bg-background/70',
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3 shrink-0" aria-hidden />
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold tabular-nums leading-snug text-foreground">{value}</p>
    </div>
  )
}

export function FeatureDetailHeader({
  packKey,
  packVersion,
  featureKey,
  title,
  description,
  tags,
  owner,
  invariantCount,
  gatingInvariantCount,
  screenCount,
  workflowCount,
}: {
  packKey: string
  packVersion: string
  featureKey: string
  title: string
  description: string | null
  tags: string[]
  owner: string | null
  invariantCount: number
  gatingInvariantCount: number
  screenCount: number
  workflowCount: number
}) {
  return (
    <article className="overflow-hidden rounded-[8px] border border-border bg-card">
      <div className="relative bg-gradient-to-br from-nesy-soft/25 via-background to-muted/10 px-4 py-4 lg:px-5 lg:py-5">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-nesy" />

        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Link
              href="/automation/features"
              className="mt-0.5 rounded-full p-2 transition-colors hover:bg-muted"
              aria-label="Back to feature registry"
            >
              <ArrowLeft className="size-5 text-muted-foreground" />
            </Link>

            <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-nesy-soft text-nesy-ink ring-1 ring-nesy/10">
              <Sparkles className="size-4.5" strokeWidth={2.2} />
            </span>

            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                {title}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <code className="inline-block max-w-full rounded-[4px] border border-nesy-muted/70 bg-nesy-soft/80 px-1.5 py-0.5 font-mono text-[11px] font-medium text-nesy-ink">
                  {featureKey}
                </code>
                <span className="text-xs text-muted-foreground">
                  {packKey} · v{packVersion}
                </span>
              </div>
              {description ? (
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              ) : null}
              {tags.length > 0 || owner ? (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {owner ? (
                    <span className="rounded-[4px] border border-border/70 bg-background/80 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      Owner · {owner}
                    </span>
                  ) : null}
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-[4px] border border-border/70 bg-background/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
            <Button size="sm" variant="outline" className="h-9 rounded-[8px]" asChild>
              <Link href={packDetailHref(packKey, packVersion)}>
                <Package className="size-3.5" />
                Open pack
              </Link>
            </Button>
            <Button size="sm" className="h-9 rounded-[8px] bg-nesy text-white hover:bg-nesy-hover" asChild>
              <Link href="/automation/features">
                All features
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MetaCell icon={ShieldCheck} label="Invariants" value={String(invariantCount)} />
          <MetaCell
            icon={Layers}
            label="Release gates"
            value={String(gatingInvariantCount)}
            tone={gatingInvariantCount > 0 ? 'warning' : 'default'}
          />
          <MetaCell icon={Monitor} label="Screens" value={String(screenCount)} />
          <MetaCell icon={Workflow} label="Workflows" value={String(workflowCount)} />
        </div>
      </div>
    </article>
  )
}
