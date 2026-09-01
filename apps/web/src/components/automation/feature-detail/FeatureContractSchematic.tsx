'use client'

import type { ReactNode } from 'react'
import {
  featureContractOwner,
  featureContractTags,
  featureExecutableRefs,
} from '@/lib/verdict-runtime/domain-pack-detail'
import { cn } from '@nesy/metronic/lib/utils'
import { Layers, Monitor, ShieldCheck, Sparkles, Tags, Workflow } from 'lucide-react'

function SchematicNode({
  icon: Icon,
  title,
  subtitle,
  tone = 'default',
  children,
}: {
  icon: typeof Sparkles
  title: string
  subtitle?: string
  tone?: 'default' | 'nesy' | 'amber' | 'blue'
  children?: ReactNode
}) {
  return (
    <div className="relative pl-6">
      <span
        className={cn(
          'absolute left-0 top-3 size-2.5 rounded-full ring-2 ring-background',
          tone === 'nesy' && 'bg-nesy',
          tone === 'amber' && 'bg-amber-500',
          tone === 'blue' && 'bg-blue-500',
          tone === 'default' && 'bg-muted-foreground/50',
        )}
        aria-hidden
      />
      <div className="rounded-[8px] border border-border bg-background/80 p-3 shadow-xs">
        <div className="flex items-start gap-2">
          <span
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-[6px]',
              tone === 'nesy' && 'bg-nesy-soft text-nesy-ink',
              tone === 'amber' && 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300',
              tone === 'blue' && 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300',
              tone === 'default' && 'bg-muted text-muted-foreground',
            )}
          >
            <Icon className="size-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            {subtitle ? (
              <p className="mt-0.5 text-sm font-medium leading-snug text-foreground">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {children ? <div className="mt-3 space-y-2 border-t border-border/60 pt-3">{children}</div> : null}
      </div>
    </div>
  )
}

function RefPills({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {label}: <span className="italic">none</span>
      </p>
    )
  }

  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <code
            key={item}
            className="rounded-[4px] border border-nesy-muted/60 bg-nesy-soft/70 px-1.5 py-0.5 font-mono text-[10px] text-nesy-ink"
          >
            {item}
          </code>
        ))}
      </div>
    </div>
  )
}

export function FeatureContractSchematic({
  featureKey,
  feature,
}: {
  featureKey: string
  feature: Record<string, unknown>
}) {
  const executable = featureExecutableRefs(feature)
  const tags = featureContractTags(feature)
  const owner = featureContractOwner(feature)
  const authoring =
    feature.authoring && typeof feature.authoring === 'object' && !Array.isArray(feature.authoring)
      ? (feature.authoring as Record<string, unknown>)
      : null

  return (
    <div className="relative space-y-4">
      <div
        className="absolute bottom-3 left-[4px] top-3 w-px bg-border"
        aria-hidden
      />

      <SchematicNode icon={Sparkles} title="Feature contract" subtitle={featureKey} tone="nesy">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Executable feature contract pinned to the latest published domain pack.
        </p>
      </SchematicNode>

      {authoring || owner || tags.length > 0 ? (
        <SchematicNode
          icon={Tags}
          title="Authoring"
          subtitle={owner ?? 'Metadata'}
          tone="blue"
        >
          {owner ? (
            <p className="text-xs text-muted-foreground">
              Owner · <span className="font-medium text-foreground">{owner}</span>
            </p>
          ) : null}
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-[4px] border border-border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </SchematicNode>
      ) : null}

      <SchematicNode
        icon={Layers}
        title="Executable surface"
        subtitle={`${executable.invariants.length} invariant${executable.invariants.length === 1 ? '' : 's'}`}
        tone="default"
      >
        {executable.invariants.length > 0 ? (
          <div className="space-y-1.5">
            {executable.invariants.map((invariant, index) => {
              const key = String(invariant.invariantKey ?? invariant.key ?? invariant.id ?? index)
              const gating = invariant.bindsReleaseGate === true
              return (
                <div
                  key={`${key}:${index}`}
                  className="flex flex-wrap items-center gap-1.5 rounded-[6px] border border-border/70 bg-muted/20 px-2 py-1.5"
                >
                  <ShieldCheck className="size-3 shrink-0 text-muted-foreground" />
                  <code className="font-mono text-[10px] text-foreground">{key}</code>
                  {gating ? (
                    <span className="rounded-[4px] bg-amber-100 px-1 py-px text-[9px] font-bold uppercase text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                      Gate
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-xs italic text-muted-foreground">No invariants</p>
        )}

        <RefPills label="Screen refs" items={executable.screenRefs} />
        <RefPills label="Workflow refs" items={executable.workflowRefs} />
      </SchematicNode>

      <div className="grid grid-cols-2 gap-2 pl-6">
        <div className="rounded-[8px] border border-dashed border-border/80 bg-muted/15 px-2.5 py-2 text-center">
          <Monitor className="mx-auto size-3.5 text-muted-foreground" />
          <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
            {executable.screenRefs.length}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Screens</p>
        </div>
        <div className="rounded-[8px] border border-dashed border-border/80 bg-muted/15 px-2.5 py-2 text-center">
          <Workflow className="mx-auto size-3.5 text-muted-foreground" />
          <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
            {executable.workflowRefs.length}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Workflows</p>
        </div>
      </div>
    </div>
  )
}
