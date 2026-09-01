'use client'

import { useMemo } from 'react'
import { Button } from '@nesy/metronic/components/ui/button'
import { Download } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import type { RunDetailResult } from '@/lib/verdict-runtime/types'
import { buildReproExport, downloadReproExport } from '@/lib/verdict-runtime/repro-export'
import { CopyableHash } from './CopyableHash'

export function ReproExportPanel({ run }: { run: RunDetailResult }) {
  const manifest = useMemo(() => buildReproExport(run), [run])
  const slotEntries = Object.entries(manifest.slots)
  const capturedSlots = slotEntries.filter(([, slot]) => slot.status === 'CAPTURED')
  const missingSlots = slotEntries.filter(([, slot]) => slot.status === 'NOT_CAPTURED')
  const canDownload = Boolean(manifest.compiledPlanHash) || capturedSlots.length > 0
  const capturePct = slotEntries.length === 0
    ? 0
    : Math.round((capturedSlots.length / slotEntries.length) * 100)

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-emerald-200/70 bg-gradient-to-br from-emerald-50/40 via-card to-card shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/15">
      <div className="border-b border-emerald-100/80 px-3 py-2.5 dark:border-emerald-900/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              <Download className="size-3.5" strokeWidth={2} aria-hidden />
            </span>
            <div>
              <h3 className="text-xs font-semibold text-foreground">Repro export</h3>
              <p className="text-[10px] text-muted-foreground">Debug snapshot · no Act Mode</p>
            </div>
          </div>
          <span className="text-sm font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
            {capturedSlots.length}/{slotEntries.length}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950/40">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${capturePct}%` }}
          />
        </div>
      </div>

      {!canDownload ? (
        <p className="px-3 py-4 text-xs text-muted-foreground">Artifact missing or unavailable.</p>
      ) : (
        <>
          {manifest.compiledPlanHash ? (
            <div className="border-b border-emerald-100/80 px-3 py-2 dark:border-emerald-900/30">
              <p className="text-[10px] font-medium text-muted-foreground">Plan hash</p>
              <CopyableHash value={manifest.compiledPlanHash} className="mt-0.5" />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
            {slotEntries.map(([name, slot]) => (
              <span
                key={name}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                  slot.status === 'CAPTURED'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-amber-200 bg-amber-50 text-amber-800',
                )}
                title={slot.status}
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    slot.status === 'CAPTURED' ? 'bg-emerald-500' : 'bg-amber-500',
                  )}
                  aria-hidden
                />
                {name}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-emerald-100/80 px-3 py-2 dark:border-emerald-900/30">
            <p className="text-[10px] text-muted-foreground">
              {missingSlots.length > 0
                ? `${missingSlots.length} missing · secrets redacted`
                : 'All slots captured'}
            </p>
            <Button
              size="sm"
              className="h-7 gap-1.5 bg-emerald-700 px-2.5 text-xs hover:bg-emerald-800"
              type="button"
              onClick={() => downloadReproExport(manifest)}
            >
              <Download className="size-3.5" />
              Download
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
