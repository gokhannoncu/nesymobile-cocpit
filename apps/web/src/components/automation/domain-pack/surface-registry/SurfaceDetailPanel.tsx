'use client'

import type { ReactNode } from 'react'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@nesy/metronic/components/ui/button'
import { cn } from '@nesy/metronic/lib/utils'
import { formatFactKeys } from '@/lib/verdict-runtime/surface-registry'
import type { SurfaceRegistryItemApi } from '@/lib/verdict-runtime/types'

export const SURFACE_KINDS = [
  'DIALOG',
  'BOTTOM_SHEET',
  'SYSTEM_OVERLAY',
  'SCANNER',
  'WEBVIEW_OVERLAY',
  'POPUP',
] as const

export const SURFACE_POLICIES = ['HANDLE', 'IGNORE', 'FAIL', 'OPERATOR_ATTENTION'] as const

export type SurfaceDraft = {
  surfaceKey: string
  applicationRef: string
  kind: string
  displayName: string
  parentScreenRefsText: string
  detectionRequiredText: string
  detectionAnyOfText: string
  detectionNoneOfText: string
  detectionDeadlineMs: string
  detectionStableForMs: string
  defaultPolicy: string
  priority: string
  handlerMacroRef: string
  blocksProductVerdict: boolean
}

export function draftFromSurface(surface: SurfaceRegistryItemApi): SurfaceDraft {
  return {
    surfaceKey: surface.surfaceKey,
    applicationRef: surface.applicationRef,
    kind: surface.kind,
    displayName: surface.displayName,
    parentScreenRefsText: surface.parentScreenRefs.join(', '),
    detectionRequiredText: surface.detection.requiredFactKeys.join(', '),
    detectionAnyOfText: surface.detection.anyOfFactKeys.join(', '),
    detectionNoneOfText: surface.detection.noneOfFactKeys.join(', '),
    detectionDeadlineMs: String(surface.detection.deadlineMs),
    detectionStableForMs:
      surface.detection.stableForMs === null ? '' : String(surface.detection.stableForMs),
    defaultPolicy: surface.defaultPolicy,
    priority: String(surface.priority),
    handlerMacroRef: surface.handlerMacroRef ?? '',
    blocksProductVerdict: surface.blocksProductVerdict,
  }
}

function DetailSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <article className="overflow-hidden rounded-[8px] border border-border bg-card">
      <div className="border-b border-border bg-muted/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </article>
  )
}

function RefChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex max-w-full truncate rounded-[4px] border border-border/70 bg-muted/30 px-2 py-1 font-mono text-[10px] font-medium text-muted-foreground">
      {children}
    </span>
  )
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}

const inputClass =
  'w-full rounded-[8px] border border-border bg-background px-2.5 py-2 text-xs text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60'

export function SurfaceDetailPanel({
  surface,
  draft,
  readOnly,
  dirty,
  saving,
  saveError,
  saveOk,
  onDraftChange,
  onSave,
}: {
  surface: SurfaceRegistryItemApi | null
  draft: SurfaceDraft | null
  readOnly: boolean
  dirty: boolean
  saving: boolean
  saveError: string | null
  saveOk: string | null
  onDraftChange: <K extends keyof SurfaceDraft>(key: K, value: SurfaceDraft[K]) => void
  onSave: () => void
}) {
  if (!surface || !draft) {
    return (
      <DetailSection title="Surface detail" description="Select a surface from the registry table.">
        <p className="text-sm text-muted-foreground">
          Pick a row to inspect detection facts, handler macro, and policy fields.
        </p>
      </DetailSection>
    )
  }

  return (
    <div className="space-y-4">
      <DetailSection
        title={surface.displayName}
        description={`${surface.surfaceKey} · ${surface.applicationRef}`}
      >
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Kind', value: surface.kind.replace(/_/g, ' ') },
            { label: 'Policy', value: surface.defaultPolicy.replace(/_/g, ' ') },
            { label: 'Priority', value: String(surface.priority) },
            {
              label: 'Blocks verdict',
              value: surface.blocksProductVerdict ? 'Yes' : 'No',
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-[8px] border border-border/60 bg-muted/15 px-3 py-2.5"
            >
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {item.label}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-foreground">{item.value}</dd>
            </div>
          ))}
        </dl>
      </DetailSection>

      <DetailSection
        title="Detection contract"
        description="Facts and timing used to recognize this surface during a run."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[8px] border border-border/60 bg-muted/15 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Required facts
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {surface.detection.requiredFactKeys.length > 0 ? (
                surface.detection.requiredFactKeys.map((fact) => <RefChip key={fact}>{fact}</RefChip>)
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
          </div>
          <div className="rounded-[8px] border border-border/60 bg-muted/15 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Any-of facts
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {surface.detection.anyOfFactKeys.length > 0 ? (
                surface.detection.anyOfFactKeys.map((fact) => <RefChip key={fact}>{fact}</RefChip>)
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
          </div>
          <div className="rounded-[8px] border border-border/60 bg-muted/15 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              None-of facts
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {surface.detection.noneOfFactKeys.length > 0 ? (
                surface.detection.noneOfFactKeys.map((fact) => <RefChip key={fact}>{fact}</RefChip>)
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
          </div>
          <div className="rounded-[8px] border border-border/60 bg-muted/15 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Timing
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              deadline {surface.detection.deadlineMs}ms
              {surface.detection.stableForMs !== null
                ? ` · stable ${surface.detection.stableForMs}ms`
                : ' · stable n/a'}
            </p>
          </div>
        </div>
        {surface.handlerMacroRef ? (
          <div className="mt-3 rounded-[8px] border border-border/60 bg-muted/15 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Handler macro
            </p>
            <p className="mt-1 font-mono text-xs text-foreground">{surface.handlerMacroRef}</p>
          </div>
        ) : null}
      </DetailSection>

      <DetailSection
        title={readOnly ? 'Contract fields' : 'Edit surface draft'}
        description={
          readOnly
            ? 'Published packs are immutable — switch to a DRAFT version to edit registry fields.'
            : 'Changes are saved to the pack draft bundle.'
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Display name">
            <input
              className={inputClass}
              value={draft.displayName}
              disabled={readOnly}
              onChange={(event) => onDraftChange('displayName', event.target.value)}
            />
          </Field>
          <Field label="Kind">
            <select
              className={inputClass}
              value={draft.kind}
              disabled={readOnly}
              onChange={(event) => onDraftChange('kind', event.target.value)}
            >
              {SURFACE_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Parent screen refs" className="sm:col-span-2">
            <input
              className={cn(inputClass, 'font-mono')}
              value={draft.parentScreenRefsText}
              disabled={readOnly}
              onChange={(event) => onDraftChange('parentScreenRefsText', event.target.value)}
              placeholder="nesy.route.stop-list, *"
            />
          </Field>
          <Field label="Default policy">
            <select
              className={inputClass}
              value={draft.defaultPolicy}
              disabled={readOnly}
              onChange={(event) => onDraftChange('defaultPolicy', event.target.value)}
            >
              {SURFACE_POLICIES.map((policy) => (
                <option key={policy} value={policy}>
                  {policy}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <input
              className={cn(inputClass, 'font-mono')}
              value={draft.priority}
              disabled={readOnly}
              onChange={(event) => onDraftChange('priority', event.target.value)}
            />
          </Field>
          <Field label="Required fact keys" className="sm:col-span-2">
            <input
              className={cn(inputClass, 'font-mono')}
              value={draft.detectionRequiredText}
              disabled={readOnly}
              onChange={(event) => onDraftChange('detectionRequiredText', event.target.value)}
            />
          </Field>
          <Field label="Any-of fact keys">
            <input
              className={cn(inputClass, 'font-mono')}
              value={draft.detectionAnyOfText}
              disabled={readOnly}
              onChange={(event) => onDraftChange('detectionAnyOfText', event.target.value)}
            />
          </Field>
          <Field label="None-of fact keys">
            <input
              className={cn(inputClass, 'font-mono')}
              value={draft.detectionNoneOfText}
              disabled={readOnly}
              onChange={(event) => onDraftChange('detectionNoneOfText', event.target.value)}
            />
          </Field>
          <Field label="Detection deadline (ms)">
            <input
              className={cn(inputClass, 'font-mono')}
              value={draft.detectionDeadlineMs}
              disabled={readOnly}
              onChange={(event) => onDraftChange('detectionDeadlineMs', event.target.value)}
            />
          </Field>
          <Field label="Stable for (ms)">
            <input
              className={cn(inputClass, 'font-mono')}
              value={draft.detectionStableForMs}
              disabled={readOnly}
              onChange={(event) => onDraftChange('detectionStableForMs', event.target.value)}
              placeholder="optional"
            />
          </Field>
          <Field label="Handler macro ref" className="sm:col-span-2">
            <input
              className={cn(inputClass, 'font-mono')}
              value={draft.handlerMacroRef}
              disabled={readOnly}
              onChange={(event) => onDraftChange('handlerMacroRef', event.target.value)}
            />
          </Field>
          <label className="flex items-center gap-2 text-xs sm:col-span-2">
            <input
              type="checkbox"
              checked={draft.blocksProductVerdict}
              disabled={readOnly}
              onChange={(event) => onDraftChange('blocksProductVerdict', event.target.checked)}
              className="rounded border-border"
            />
            <span className="text-foreground">blocksProductVerdict</span>
          </label>
        </div>

        {!readOnly ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              className="h-9 gap-2 rounded-[8px] bg-nesy text-white hover:bg-nesy-hover"
              onClick={onSave}
              disabled={!dirty || saving}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save surface to draft
            </Button>
            {dirty ? (
              <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                Unsaved changes
              </span>
            ) : null}
          </div>
        ) : null}

        {saveError ? (
          <div className="mt-3 rounded-[8px] border border-red-200/80 bg-red-50/70 px-3 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {saveError}
          </div>
        ) : null}
        {saveOk ? (
          <div className="mt-3 rounded-[8px] border border-teal-200/80 bg-teal-50/70 px-3 py-2 text-xs text-teal-800 dark:border-teal-900/50 dark:bg-teal-950/30 dark:text-teal-200">
            {saveOk}
          </div>
        ) : null}

        {readOnly ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Read-only snapshot: {formatFactKeys(surface.detection.requiredFactKeys)}
          </p>
        ) : null}
      </DetailSection>
    </div>
  )
}
