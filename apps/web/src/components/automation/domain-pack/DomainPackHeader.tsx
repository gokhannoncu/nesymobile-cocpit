'use client'

import React from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowLeft,
  Fingerprint,
  GitBranch,
  Package,
  Save,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { DomainPackDetailApi } from '@/lib/verdict-runtime/types'
import { DomainPackStateBadge } from './DomainPackStateBadge'
import { DomainPackDigestDisplay } from './DomainPackDigestDisplay'
import { Button } from '@nesy/metronic/components/ui/button'
import { cn } from '@nesy/metronic/lib/utils'

interface DomainPackHeaderProps {
  pack: DomainPackDetailApi
  isSaving?: boolean
  isPublishing?: boolean
  onSaveDraft?: () => void
  onPublish?: () => void
  hasValidationErrors?: boolean
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
      <p className="mt-1 text-sm font-medium leading-snug text-foreground">{value}</p>
    </div>
  )
}

export function DomainPackHeader({
  pack,
  isSaving,
  isPublishing,
  onSaveDraft,
  onPublish,
  hasValidationErrors,
}: DomainPackHeaderProps) {
  const isDraft = pack.state === 'DRAFT'
  const sourceCommit = String(
    (pack.manifest?.provenance as Record<string, unknown> | undefined)?.sourceCommit ?? 'workspace',
  )
  const canonicalSource =
    pack.state === 'PUBLISHED' ? 'Published immutable snapshot' : 'Draft registry snapshot'

  const digests = [
    pack.publishedBundleHash ? { label: 'Bundle hash', digest: pack.publishedBundleHash } : null,
    pack.derivedGraphDigest ? { label: 'Graph digest', digest: pack.derivedGraphDigest } : null,
    pack.derivedReducerDigest ? { label: 'Reducer digest', digest: pack.derivedReducerDigest } : null,
    pack.derivedTestProfileDigest
      ? { label: 'Profile digest', digest: pack.derivedTestProfileDigest }
      : null,
  ].filter(Boolean) as Array<{ label: string; digest: string }>

  return (
    <article className="overflow-hidden rounded-[8px] border border-border bg-card">
      <div className="relative bg-gradient-to-br from-nesy-soft/25 via-background to-muted/10 px-4 py-4 lg:px-5 lg:py-5">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-nesy" />

        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Link
              href="/automation/domain-packs"
              className="mt-0.5 rounded-full p-2 transition-colors hover:bg-muted"
              aria-label="Back to domain packs"
            >
              <ArrowLeft className="size-5 text-muted-foreground" />
            </Link>

            <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-nesy-soft text-nesy-ink ring-1 ring-nesy/10">
              <Package className="size-4.5" strokeWidth={2.2} />
            </span>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                  {pack.displayName}
                </h1>
                <DomainPackStateBadge state={pack.state} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-mono text-[13px]">{pack.packKey}</span>
                <span className="mx-1.5 text-border">·</span>
                <span>Version {pack.version}</span>
                {!isDraft ? (
                  <span className="ml-2 font-medium text-nesy-ink">Read-only</span>
                ) : null}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
            {isDraft ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSaveDraft}
                  disabled={isSaving || isPublishing}
                  className="h-9 gap-2 rounded-[8px]"
                >
                  <Save className="size-4" />
                  {isSaving ? 'Saving…' : 'Save draft'}
                </Button>
                <div
                  className={cn('inline-flex', hasValidationErrors && 'cursor-not-allowed')}
                  title={hasValidationErrors ? 'Cannot publish with validation errors' : undefined}
                >
                  <Button
                    size="sm"
                    onClick={onPublish}
                    disabled={isSaving || isPublishing || hasValidationErrors}
                    className="h-9 gap-2 rounded-[8px] bg-nesy text-white hover:bg-nesy-hover"
                  >
                    <UploadCloud className="size-4" />
                    {isPublishing ? 'Publishing…' : 'Publish'}
                  </Button>
                </div>
              </>
            ) : (
              <div className="inline-flex max-w-sm items-start gap-2 rounded-[8px] border border-border/70 bg-background/80 px-3 py-2 text-sm text-muted-foreground">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-nesy" />
                <span>This version is published and cannot be modified.</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <MetaCell
            icon={GitBranch}
            label="SSOT"
            value={`${canonicalSource} · source ${sourceCommit}`}
          />
          <MetaCell
            icon={ShieldCheck}
            label="Review gate"
            value={hasValidationErrors ? 'Blocked by validation' : 'Validation clear'}
            tone={hasValidationErrors ? 'warning' : 'success'}
          />
          <MetaCell
            icon={Fingerprint}
            label="Migration"
            value="Publish creates a new immutable version"
          />
        </div>

        {digests.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 pt-3">
            {digests.map((item) => (
              <DomainPackDigestDisplay
                key={item.label}
                label={item.label}
                digest={item.digest}
                className="text-xs"
              />
            ))}
          </div>
        ) : null}

        {pack.activePinnedRunVersions?.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Active pinned runs
            </span>
            {pack.activePinnedRunVersions.map((version) => (
              <span
                key={version}
                className="rounded-[4px] border border-blue-200/80 bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300"
              >
                {version}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
}
