import Link from 'next/link'
import {
  ArrowLeft,
  ChevronRight,
  FlaskConical,
  Layers,
  Package,
  Play,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@nesy/metronic/components/ui/button'
import { TestProfileKindBadge } from '@/components/automation/test-profile/TestProfileKindBadge'
import { cn } from '@nesy/metronic/lib/utils'
import { AUTOMATION_RUN_PLANNER_PATH } from '@nesy/metronic/config/layout-21.config'
import {
  testProfileIsBlocked,
  testProfileResultBadgeClass,
  testProfileBadgePrimary,
} from '@/lib/verdict-runtime/test-profile-registry'
import { profileKindHint } from '@/lib/verdict-runtime/test-profile-detail'

function packDetailHref(packKey: string, version: string): string {
  return `/automation/domain-packs/${encodeURIComponent(packKey)}?version=${encodeURIComponent(version)}`
}

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

function ResultBadge({
  lastResult,
  blockedReason,
}: {
  lastResult: string
  blockedReason: string | null
}) {
  const blocked = testProfileIsBlocked({ blockedReason })

  return (
    <span className={testProfileResultBadgeClass(lastResult, blocked)}>
      {blocked ? 'Blocked' : lastResult}
    </span>
  )
}

export function TestProfileDetailHeader({
  profileKey,
  displayName,
  catalogKind,
  contractKind,
  packKey,
  packVersion,
  owner,
  lastResult,
  blockedReason,
  releaseGate,
  launchProfileRef,
  launchProfileLabel,
  workflowCount,
  capabilityCount,
  faultCount,
  campaignCount,
}: {
  profileKey: string
  displayName: string
  catalogKind: string
  contractKind: string
  packKey: string
  packVersion: string
  owner: string
  lastResult: string
  blockedReason: string | null
  releaseGate: boolean
  launchProfileRef: string
  launchProfileLabel: string
  workflowCount: number
  capabilityCount: number
  faultCount: number
  campaignCount: number
}) {
  const blocked = testProfileIsBlocked({ blockedReason })

  return (
    <article className="overflow-hidden rounded-[8px] border border-border bg-card">
      <div className="relative bg-gradient-to-br from-nesy-soft/25 via-background to-muted/10 px-4 py-4 lg:px-5 lg:py-5">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-nesy" />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-[8px] px-2" asChild>
                <Link href="/automation/test-profiles">
                  <ArrowLeft className="size-3.5" />
                  Profiles
                </Link>
              </Button>
            </div>

            <div className="mt-3 flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-nesy-soft text-nesy-ink ring-1 ring-nesy/10">
                <FlaskConical className="size-4" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-mono text-lg font-bold leading-tight text-foreground lg:text-xl">
                    {profileKey}
                  </h1>
                  <TestProfileKindBadge kind={catalogKind} />
                  <ResultBadge lastResult={lastResult} blockedReason={blockedReason} />
                  {releaseGate ? (
                    <span className={testProfileBadgePrimary}>Release gate</span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm font-medium text-foreground">{displayName}</p>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                  {profileKindHint(contractKind)} · contract kind{' '}
                  <span className="font-mono font-semibold text-foreground">{contractKind}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 rounded-[8px]" asChild>
              <Link href={packDetailHref(packKey, packVersion)}>
                Open pack
                <ChevronRight className="size-4" />
              </Link>
            </Button>
            <Button size="sm" className="h-9 rounded-[8px] bg-nesy text-white hover:bg-nesy-hover" asChild>
              <Link href={AUTOMATION_RUN_PLANNER_PATH}>
                <Play className="size-4" />
                Run planner
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MetaCell icon={Package} label="Domain pack" value={`${packKey} · v${packVersion}`} mono />
          <MetaCell icon={Zap} label="Launch profile" value={launchProfileLabel} mono />
          <MetaCell icon={ShieldCheck} label="Owner" value={owner || '—'} />
          <MetaCell
            icon={Layers}
            label="Scope"
            value={`${workflowCount} workflow${workflowCount === 1 ? '' : 's'} · ${capabilityCount} cap · ${faultCount} fault${faultCount === 1 ? '' : 's'} · ${campaignCount} campaign${campaignCount === 1 ? '' : 's'}`}
          />
        </div>

        {blocked && blockedReason ? (
          <div className="mt-4 rounded-[8px] border border-amber-200/80 bg-amber-50/70 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <span className="font-semibold">Catalog blocker:</span> {blockedReason}
          </div>
        ) : null}
      </div>
    </article>
  )
}
