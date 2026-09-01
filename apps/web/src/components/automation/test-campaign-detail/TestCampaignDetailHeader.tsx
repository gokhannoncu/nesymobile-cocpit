import Link from 'next/link'
import {
  ArrowLeft,
  CalendarRange,
  ChevronRight,
  Layers,
  Package,
  Play,
  ShieldCheck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@nesy/metronic/components/ui/button'
import { CampaignTypeBadge } from '@/components/automation/test-campaign/CampaignTypeBadge'
import { cn } from '@nesy/metronic/lib/utils'
import { AUTOMATION_RUN_PLANNER_PATH } from '@nesy/metronic/config/layout-21.config'
import {
  campaignGateResultTone,
  campaignStatusTone,
} from '@/lib/verdict-runtime/test-campaign-registry'
import { campaignTypeHint } from '@/lib/verdict-runtime/test-campaign-detail'
import { toneIconBox, toneText } from '@/components/product/tones'
import type { CampaignCellStats } from '@/lib/verdict-runtime/test-campaign-detail'

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

function StatusBadge({ status }: { status: string }) {
  const tone = campaignStatusTone(status)
  return (
    <span
      className={cn(
        'inline-flex rounded-[4px] border border-current/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide',
        toneIconBox[tone],
        toneText[tone],
      )}
    >
      {status}
    </span>
  )
}

function GateResultBadge({ result }: { result: string }) {
  const tone = campaignGateResultTone(result)
  return (
    <span
      className={cn(
        'inline-flex rounded-[4px] border border-current/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide',
        toneIconBox[tone],
        toneText[tone],
      )}
    >
      {result.replace(/_/g, ' ')}
    </span>
  )
}

export function TestCampaignDetailHeader({
  campaignId,
  campaignKey,
  campaignVersion,
  displayName,
  status,
  releaseGateResult,
  contractReleaseGate,
  onProfileFailure,
  packKey,
  packVersion,
  stats,
  partial,
}: {
  campaignId: string
  campaignKey: string
  campaignVersion: number
  displayName: string
  status: string
  releaseGateResult: string
  contractReleaseGate: boolean
  onProfileFailure: string | null
  packKey: string | null
  packVersion: string | null
  stats: CampaignCellStats
  partial: boolean
}) {
  return (
    <article className="overflow-hidden rounded-[8px] border border-border bg-card">
      <div className="relative bg-gradient-to-br from-nesy-soft/25 via-background to-muted/10 px-4 py-4 lg:px-5 lg:py-5">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-nesy" />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-[8px] px-2" asChild>
                <Link href="/automation/test-campaigns">
                  <ArrowLeft className="size-3.5" />
                  Campaigns
                </Link>
              </Button>
            </div>

            <div className="mt-3 flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-nesy-soft text-nesy-ink ring-1 ring-nesy/10">
                <CalendarRange className="size-4" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <CampaignTypeBadge type={campaignKey} />
                  <StatusBadge status={status} />
                  <GateResultBadge result={releaseGateResult} />
                  {contractReleaseGate ? (
                    <span className="inline-flex rounded-[4px] border border-current/10 bg-teal-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-teal-800 dark:bg-teal-950/40 dark:text-teal-300">
                      Release gate
                    </span>
                  ) : null}
                  {partial ? (
                    <span className="inline-flex rounded-[4px] border border-current/10 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                      Partial
                    </span>
                  ) : null}
                </div>
                <h1 className="mt-2 text-lg font-bold leading-tight text-foreground lg:text-xl">
                  {displayName}
                </h1>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{campaignId}</p>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                  {campaignTypeHint(campaignKey)}
                  {onProfileFailure ? (
                    <>
                      {' '}
                      · on profile failure{' '}
                      <span className="font-semibold text-foreground">
                        {onProfileFailure.replace(/_/g, ' ')}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {packKey && packVersion ? (
              <Button variant="outline" size="sm" className="h-9 rounded-[8px]" asChild>
                <Link href={packDetailHref(packKey, packVersion)}>
                  Open pack
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
            ) : null}
            <Button size="sm" className="h-9 rounded-[8px] bg-nesy text-white hover:bg-nesy-hover" asChild>
              <Link href={AUTOMATION_RUN_PLANNER_PATH}>
                <Play className="size-4" />
                Run planner
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MetaCell
            icon={ShieldCheck}
            label="Contract version"
            value={`v${campaignVersion}`}
            mono
          />
          <MetaCell
            icon={Layers}
            label="Cell results"
            value={`${stats.pass} pass · ${stats.fail} fail · ${stats.blocked} blocked · ${stats.pending} pending`}
          />
          <MetaCell icon={Package} label="Matrix size" value={`${stats.total} cell${stats.total === 1 ? '' : 's'}`} />
          {packKey && packVersion ? (
            <MetaCell icon={Package} label="Domain pack" value={`${packKey} · v${packVersion}`} mono />
          ) : (
            <MetaCell icon={Package} label="Domain pack" value="Not resolved from profiles" />
          )}
        </div>
      </div>
    </article>
  )
}
