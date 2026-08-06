'use client'

import { useMemo } from 'react'
import { Button } from '@nesy/metronic/components/ui/button'
import { Download } from 'lucide-react'
import type { RunDetailResult } from '@/lib/verdict-runtime/types'
import { buildReproExport, downloadReproExport } from '@/lib/verdict-runtime/repro-export'

export function ReproExportPanel({ run }: { run: RunDetailResult }) {
  const manifest = useMemo(() => buildReproExport(run), [run])
  const capturedSlots = Object.entries(manifest.slots).filter(
    ([, slot]) => slot.status === 'CAPTURED',
  )
  const missingSlots = Object.entries(manifest.slots).filter(
    ([, slot]) => slot.status === 'NOT_CAPTURED',
  )
  const canDownload = Boolean(manifest.compiledPlanHash) || capturedSlots.length > 0

  return (
    <div className="border rounded-md p-4 bg-accent/30 space-y-4">
      <div>
        <h3 className="font-medium">Repro Artifact Export</h3>
        <p className="text-sm text-muted-foreground">
          Download exact state reproduction for debugging. Does not open Act Mode.
        </p>
      </div>

      {!canDownload ? (
        <div className="text-sm text-destructive font-medium bg-destructive/10 p-2 rounded-md border border-destructive/20 inline-block">
          NOT_CAPTURED: Artifact missing or unavailable.
        </div>
      ) : (
        <div className="space-y-3">
          {manifest.compiledPlanHash ? (
            <div className="text-xs font-mono bg-background p-2 rounded border break-all">
              Hash: {manifest.compiledPlanHash}
            </div>
          ) : null}
          <ul className="text-[11px] font-mono space-y-0.5">
            {Object.entries(manifest.slots).map(([name, slot]) => (
              <li key={name} className="flex justify-between gap-2">
                <span>{name}</span>
                <span
                  className={
                    slot.status === 'CAPTURED' ? 'text-emerald-700' : 'text-amber-700'
                  }
                >
                  {slot.status}
                </span>
              </li>
            ))}
          </ul>
          {missingSlots.length > 0 ? (
            <p className="text-[10px] text-muted-foreground">
              {missingSlots.length} slot(s) NOT_CAPTURED — export still includes captured metadata.
            </p>
          ) : null}
          <Button
            size="sm"
            className="gap-2"
            type="button"
            onClick={() => downloadReproExport(manifest)}
          >
            <Download className="w-4 h-4" />
            Download Repro Artifact
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Secrets/tokens redacted. opensActMode={String(manifest.opensActMode)}.
          </p>
        </div>
      )}
    </div>
  )
}
