'use client'

import Link from 'next/link'
import { ChevronRight, Fingerprint, GitBranch, Layers, Package, PanelTop } from 'lucide-react'
import { Button } from '@nesy/metronic/components/ui/button'
import type { DomainPackState, DomainPackSummary } from '@/lib/verdict-runtime/types'
import {
  formatPackPublishedAt,
  truncateDigest,
} from '@/lib/verdict-runtime/domain-pack-catalog'
import { DomainPackStateBadge } from '@/components/automation/domain-pack/DomainPackStateBadge'
import { cn } from '@nesy/metronic/lib/utils'

function packDetailHref(pack: Pick<DomainPackSummary, 'packKey' | 'version'>): string {
  return `/automation/domain-packs/${encodeURIComponent(pack.packKey)}?version=${encodeURIComponent(pack.version)}`
}

function packSurfacesHref(pack: Pick<DomainPackSummary, 'packKey' | 'version'>): string {
  return `/automation/domain-packs/${encodeURIComponent(pack.packKey)}/surfaces?version=${encodeURIComponent(pack.version)}`
}

function packFamilyLabel(packKey: string): string {
  const leaf = packKey.split('.').pop() ?? packKey
  return `${leaf.charAt(0).toUpperCase()}${leaf.slice(1)} product family`
}

function countByState(versions: readonly DomainPackSummary[], state: DomainPackState): number {
  return versions.filter((item) => item.publicationState === state).length
}

function StatPill({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="inline-flex min-w-0 items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          'truncate text-xs font-semibold text-foreground',
          mono && 'font-mono text-[11px]',
        )}
      >
        {value}
      </span>
    </div>
  )
}

function MetricCell({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: typeof Layers
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border/60 bg-background/70 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3 shrink-0" aria-hidden />
        {label}
      </div>
      <p
        className={cn(
          'mt-1 truncate text-sm font-semibold text-foreground',
          mono && 'font-mono text-[13px]',
        )}
      >
        {value}
      </p>
    </div>
  )
}

export function DomainPackFamilyStrip({
  packKey,
  versions,
  latestPublished,
  variant = 'card',
  className,
}: {
  packKey: string
  versions: DomainPackSummary[]
  latestPublished?: DomainPackSummary
  variant?: 'card' | 'command' | 'compact'
  className?: string
}) {
  const publishedCount = countByState(versions, 'PUBLISHED')
  const draftCount = countByState(versions, 'DRAFT')
  const publishedLabel = latestPublished
    ? formatPackPublishedAt(latestPublished.publishedAt)
    : null
  const primary = latestPublished ?? versions[0]

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'flex flex-col gap-2 border-b border-border bg-muted/15 px-3 py-2 sm:flex-row sm:items-center sm:justify-between',
          className,
        )}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Version history</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {versions.length} row{versions.length === 1 ? '' : 's'}
            {publishedCount > 0 ? ` · ${publishedCount} published` : ''}
            {draftCount > 0 ? ` · ${draftCount} draft` : ''}
            {publishedLabel ? ` · ${publishedLabel}` : ''}
          </p>
        </div>
        {latestPublished ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-lg bg-background/80 px-2 py-1 font-mono text-[11px] text-muted-foreground">
              v{latestPublished.version}
            </code>
            <Link
              href={packDetailHref(latestPublished)}
              className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-nesy-ink transition hover:underline"
            >
              Open latest
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        ) : null}
      </div>
    )
  }

  const isCommand = variant === 'command'

  if (isCommand) {
    return (
      <div className={cn('mt-3 border-t border-border/70 pt-3', className)}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-nesy-soft text-nesy-ink ring-1 ring-nesy/10">
              <Package className="size-4" strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">{packKey}</p>
                {latestPublished ? (
                  <DomainPackStateBadge state={latestPublished.publicationState} />
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">{packFamilyLabel(packKey)}</p>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:justify-center">
            <StatPill label="Catalog" value={`${versions.length} versions`} />
            {latestPublished ? (
              <>
                <StatPill label="Latest" value={`v${latestPublished.version}`} mono />
                <StatPill
                  label="Digest"
                  value={truncateDigest(latestPublished.bundleDigest, 8, 6)}
                  mono
                />
              </>
            ) : null}
            {publishedCount > 0 ? (
              <StatPill label="Live" value={`${publishedCount} published`} />
            ) : null}
            {publishedLabel ? <StatPill label="Published" value={publishedLabel} /> : null}
          </div>

          {primary ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button size="sm" className="bg-nesy text-white hover:bg-nesy-hover" asChild>
                <Link href={packDetailHref(primary)}>
                  Open latest
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
              {latestPublished ? (
                <Button size="sm" variant="outline" className="gap-1.5" asChild>
                  <Link href={packSurfacesHref(latestPublished)}>
                    <PanelTop className="size-3.5" />
                    Surfaces
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden border-b border-border/80 bg-gradient-to-br from-nesy-soft/25 via-background to-muted/15 px-4 py-4',
        className,
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-nesy" />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-nesy-soft text-nesy-ink shadow-xs ring-1 ring-nesy/10">
              <Package className="size-4.5" strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-base font-semibold tracking-[-0.02em] text-foreground sm:text-lg">
                  {packKey}
                </h2>
                {latestPublished ? (
                  <DomainPackStateBadge state={latestPublished.publicationState} />
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                {packFamilyLabel(packKey)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCell
              icon={Layers}
              label="Catalog"
              value={`${versions.length} version${versions.length === 1 ? '' : 's'}`}
            />
            <MetricCell
              icon={GitBranch}
              label="Published"
              value={
                publishedCount > 0
                  ? `${publishedCount} live · ${draftCount} draft`
                  : `${draftCount} draft only`
              }
            />
            {latestPublished ? (
              <MetricCell
                icon={Package}
                label="Latest pin"
                value={`v${latestPublished.version}`}
                mono
              />
            ) : (
              <MetricCell icon={Package} label="Latest pin" value="None published" />
            )}
            <MetricCell
              icon={Fingerprint}
              label="Published"
              value={publishedLabel ?? 'Not recorded'}
            />
          </div>

          {latestPublished ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Bundle digest
              </span>
              <code
                className="rounded-lg border border-border/60 bg-background/80 px-2 py-1 font-mono text-[11px] text-muted-foreground"
                title={latestPublished.bundleDigest}
              >
                {truncateDigest(latestPublished.bundleDigest, 12, 10)}
              </code>
              <span className="text-xs text-muted-foreground">
                rev {latestPublished.revision}
              </span>
            </div>
          ) : null}
        </div>

        {primary ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 xl:flex-col xl:items-stretch xl:pt-1">
            <Button size="sm" className="bg-nesy text-white hover:bg-nesy-hover" asChild>
              <Link href={packDetailHref(primary)}>
                Open latest
                <ChevronRight className="size-4" />
              </Link>
            </Button>
            {latestPublished ? (
              <Button size="sm" variant="outline" className="gap-1.5" asChild>
                <Link href={packSurfacesHref(latestPublished)}>
                  <PanelTop className="size-3.5" />
                  Surfaces
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
