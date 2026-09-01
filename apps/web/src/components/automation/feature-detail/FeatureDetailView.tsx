'use client'

import { useState } from 'react'
import {
  featureContractDescription,
  featureContractKey,
  featureContractOwner,
  featureContractTags,
  featureContractTitle,
  featureExecutableSummary,
} from '@/lib/verdict-runtime/domain-pack-detail'
import { FeatureDetailHeader } from '@/components/automation/feature-detail/FeatureDetailHeader'
import { FeatureContractJsonPanel } from '@/components/automation/feature-detail/FeatureContractJsonPanel'
import { FeatureContractSchematic } from '@/components/automation/feature-detail/FeatureContractSchematic'
import { cn } from '@nesy/metronic/lib/utils'

type WorkbenchMode = 'split' | 'preview' | 'code'

const MODE_OPTIONS: Array<{ id: WorkbenchMode; label: string }> = [
  { id: 'split', label: 'Split' },
  { id: 'preview', label: 'Preview' },
  { id: 'code', label: 'JSON' },
]

export function FeatureDetailView({
  packKey,
  packVersion,
  feature,
}: {
  packKey: string
  packVersion: string
  feature: Record<string, unknown>
}) {
  const [mode, setMode] = useState<WorkbenchMode>('split')

  const featureKey = featureContractKey(feature)
  const title = featureContractTitle(feature)
  const description = featureContractDescription(feature)
  const tags = featureContractTags(feature)
  const owner = featureContractOwner(feature)
  const summary = featureExecutableSummary(feature)

  return (
    <div className="space-y-5">
      <FeatureDetailHeader
        packKey={packKey}
        packVersion={packVersion}
        featureKey={featureKey}
        title={title}
        description={description}
        tags={tags}
        owner={owner}
        invariantCount={summary.invariantCount}
        gatingInvariantCount={summary.gatingInvariantCount}
        screenCount={summary.screenCount}
        workflowCount={summary.workflowCount}
      />

      <article className="overflow-hidden rounded-[8px] border border-border bg-card">
        <div className="flex flex-col gap-2 border-b border-border bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-foreground">Contract workbench</p>
            <p className="text-[11px] text-muted-foreground">
              Schematic preview and JSON source side by side
            </p>
          </div>
          <div className="flex shrink-0 gap-1 rounded-[8px] border border-border/70 bg-background/80 p-1">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setMode(option.id)}
                aria-pressed={mode === option.id}
                className={cn(
                  'rounded-[6px] px-2.5 py-1 text-[11px] font-semibold transition',
                  mode === option.id
                    ? 'bg-nesy text-white shadow-xs'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div
          className={cn(
            'grid min-h-[480px]',
            mode === 'split' && 'lg:grid-cols-2',
            mode !== 'split' && 'grid-cols-1',
          )}
        >
          {mode !== 'code' ? (
            <section className="min-h-0 border-b border-border p-4 lg:border-b-0 lg:border-r lg:p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Schematic preview
                </p>
              </div>
              <FeatureContractSchematic featureKey={featureKey} feature={feature} />
            </section>
          ) : null}

          {mode !== 'preview' ? (
            <section className="min-h-0 p-4 lg:p-5">
              <div className="mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  JSON editor
                </p>
              </div>
              <FeatureContractJsonPanel feature={feature} className="h-[min(640px,calc(100vh-18rem))]" />
            </section>
          ) : null}
        </div>
      </article>
    </div>
  )
}
