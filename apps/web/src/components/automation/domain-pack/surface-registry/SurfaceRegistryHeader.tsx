import Link from 'next/link'
import { ArrowLeft, ChevronRight, Layers, MonitorSmartphone, RefreshCw, ShieldAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@nesy/metronic/components/ui/button'
import { DomainPackStateBadge } from '@/components/automation/domain-pack/DomainPackStateBadge'
import { cn } from '@nesy/metronic/lib/utils'
import { packDetailHref } from '@/lib/verdict-runtime/surface-registry'
import type { DomainPackState } from '@/lib/verdict-runtime/types'

function MetaCell({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: LucideIcon
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="min-w-0 rounded-[8px] border border-border/60 bg-background/70 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3 shrink-0" aria-hidden />
        {label}
      </div>
      <p
        className={cn(
          'mt-1 text-sm font-semibold leading-snug text-foreground',
          mono && 'font-mono text-xs',
        )}
      >
        {value}
      </p>
    </div>
  )
}

export function SurfaceRegistryHeader({
  packKey,
  packVersion,
  publicationState,
  revision,
  platform,
  applicationCount,
  screenCount,
  surfaceCount,
  verdictBlocking,
  readOnly,
  immutableReason,
  onRefresh,
  refreshing,
}: {
  packKey: string
  packVersion: string
  publicationState: DomainPackState
  revision: number
  platform: string | null
  applicationCount: number
  screenCount: number
  surfaceCount: number
  verdictBlocking: number
  readOnly: boolean
  immutableReason: string | null
  onRefresh: () => void
  refreshing: boolean
}) {
  return (
    <article className="overflow-hidden rounded-[8px] border border-border bg-card">
      <div className="relative bg-gradient-to-br from-nesy-soft/25 via-background to-muted/10 px-4 py-4 lg:px-5 lg:py-5">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-nesy" />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-[8px] px-2" asChild>
                <Link href={packDetailHref(packKey, packVersion)}>
                  <ArrowLeft className="size-3.5" />
                  Domain pack
                </Link>
              </Button>
            </div>

            <div className="mt-3 flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-nesy-soft text-nesy-ink ring-1 ring-nesy/10">
                <Layers className="size-4" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-bold leading-tight text-foreground lg:text-xl">
                    Surface registry
                  </h1>
                  <DomainPackStateBadge state={publicationState} />
                  {readOnly ? (
                    <span className="inline-flex rounded-[4px] border border-current/10 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                      Read-only
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {packKey} · v{packVersion}
                </p>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                  Application → screen → surface hierarchy for overlay detection, handler macros, and
                  verdict policy.
                </p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-[8px]"
              onClick={onRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" className="h-9 rounded-[8px]" asChild>
              <Link href={packDetailHref(packKey, packVersion)}>
                Open pack
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MetaCell
            icon={MonitorSmartphone}
            label="Applications"
            value={`${applicationCount} app${applicationCount === 1 ? '' : 's'}${platform ? ` · ${platform}` : ''}`}
          />
          <MetaCell icon={Layers} label="Screens" value={`${screenCount} screen${screenCount === 1 ? '' : 's'}`} />
          <MetaCell icon={Layers} label="Surfaces" value={`${surfaceCount} surface${surfaceCount === 1 ? '' : 's'}`} />
          <MetaCell
            icon={ShieldAlert}
            label="Verdict blockers"
            value={`${verdictBlocking} surface${verdictBlocking === 1 ? '' : 's'} block verdict`}
          />
        </div>

        {readOnly && immutableReason ? (
          <div className="mt-4 rounded-[8px] border border-amber-200/80 bg-amber-50/70 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <span className="font-semibold">Immutable registry:</span> {immutableReason}
          </div>
        ) : null}

        <p className="mt-3 text-[10px] text-muted-foreground">Revision {revision}</p>
      </div>
    </article>
  )
}
