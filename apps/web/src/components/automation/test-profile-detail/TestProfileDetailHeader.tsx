import Link from 'next/link'
import {
  ArrowLeft,
  ChevronRight,
  FlaskConical,
  GitBranch,
  Info,
  Layers,
  Play,
  Workflow,
  Zap,
} from 'lucide-react'
import { Button } from '@nesy/metronic/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@nesy/metronic/components/ui/popover'
import { TestProfileKindBadge } from '@/components/automation/test-profile/TestProfileKindBadge'
import { StatCard, StatGrid } from '@/components/product/stats'
import { cn } from '@nesy/metronic/lib/utils'
import { AUTOMATION_RUN_PLANNER_PATH } from '@nesy/metronic/config/layout-21.config'
import {
  testProfileGateBadgeClass,
  testProfileIsBlocked,
  testProfileResultBadgeClass,
} from '@/lib/verdict-runtime/test-profile-registry'
import { profileKindHint } from '@/lib/verdict-runtime/test-profile-detail'

function packDetailHref(packKey: string, version: string): string {
  return `/automation/domain-packs/${encodeURIComponent(packKey)}?version=${encodeURIComponent(version)}`
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
      {blocked ? 'Blocked' : lastResult.replace(/_/g, ' ')}
    </span>
  )
}

function ProfileMetaStrip({
  packKey,
  packVersion,
  launchProfileLabel,
  owner,
  contractKind,
}: {
  packKey: string
  packVersion: string
  launchProfileLabel: string
  owner: string
  contractKind: string
}) {
  return (
    <dl className="inline-flex max-w-full flex-wrap overflow-hidden rounded-lg border border-border/80 bg-muted/25 text-xs shadow-sm">
      <MetaSegment label="Pack" value={`${packKey} · v${packVersion}`} title={`${packKey} v${packVersion}`} mono />
      <MetaSegment label="Launch" value={launchProfileLabel} title={launchProfileLabel} mono />
      <MetaSegment label="Owner" value={owner || '—'} />
      <MetaSegment label="Contract" value={contractKind} mono />
    </dl>
  )
}

function MetaSegment({
  label,
  value,
  title,
  mono = false,
}: {
  label: string
  value: string
  title?: string
  mono?: boolean
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 border-r border-border/80 px-2.5 py-1.5 last:border-r-0">
      <dt className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          'min-w-0 truncate font-semibold text-foreground',
          mono && 'font-mono text-[11px] font-medium',
        )}
        title={title ?? value}
      >
        {value}
      </dd>
    </div>
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
  const gateBadgeClass = testProfileGateBadgeClass(releaseGate)

  return (
    <header className="rounded-[8px] border border-slate-200/90 bg-white dark:border-border dark:bg-card">
      <div className="border-b border-slate-200/80 px-4 py-2 sm:px-5 dark:border-border">
        <Link
          href="/automation/test-profiles"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-muted-foreground dark:hover:text-foreground"
        >
          <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
          Profiles
        </Link>
      </div>

      <div className="space-y-3 px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-300">
                <FlaskConical className="size-3.5" strokeWidth={2.2} />
              </span>
              <h1 className="min-w-0 text-lg font-semibold leading-snug tracking-tight text-slate-950 sm:text-xl dark:text-foreground">
                {displayName}
              </h1>
              <TestProfileKindBadge kind={catalogKind} />
              <ResultBadge lastResult={lastResult} blockedReason={blockedReason} />
              {gateBadgeClass ? <span className={gateBadgeClass}>Release gate</span> : null}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0 rounded-[6px] text-slate-400 hover:text-slate-700"
                    aria-label="About this profile kind"
                  >
                    <Info className="size-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="max-w-sm text-sm leading-relaxed text-slate-600">
                  {profileKindHint(contractKind)}
                </PopoverContent>
              </Popover>
            </div>

            <p className="font-mono text-[11px] text-muted-foreground">{profileKey}</p>

            <ProfileMetaStrip
              packKey={packKey}
              packVersion={packVersion}
              launchProfileLabel={launchProfileLabel}
              owner={owner}
              contractKind={contractKind}
            />
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 rounded-[8px]" asChild>
              <Link href={packDetailHref(packKey, packVersion)}>
                Open pack
                <ChevronRight className="size-4" />
              </Link>
            </Button>
            <Button size="sm" className="h-9 rounded-[8px]" asChild>
              <Link href={AUTOMATION_RUN_PLANNER_PATH}>
                <Play className="size-4" />
                Run planner
              </Link>
            </Button>
          </div>
        </div>

        <StatGrid cols={4} dense>
          <StatCard
            variant="compact"
            icon={Workflow}
            label="Workflows"
            value={workflowCount}
            hint="Macros and journeys in scope"
            tone="indigo"
          />
          <StatCard
            variant="compact"
            icon={Layers}
            label="Capabilities"
            value={capabilityCount}
            hint="Required capability contracts"
            tone="purple"
          />
          <StatCard
            variant="compact"
            icon={Zap}
            label="Fault injections"
            value={faultCount}
            hint="Declared fault plan entries"
            tone="amber"
          />
          <StatCard
            variant="compact"
            icon={GitBranch}
            label="Campaigns"
            value={campaignCount}
            hint="Pack campaigns referencing this profile"
            tone="teal"
          />
        </StatGrid>

        {blocked && blockedReason ? (
          <div className="rounded-[8px] border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <span className="font-semibold">Catalog blocker:</span> {blockedReason}
          </div>
        ) : null}
      </div>
    </header>
  )
}
