'use client'

import { Button } from '@nesy/metronic/components/ui/button'
import { Download } from 'lucide-react'

export function ReproExportPanel({ run }: { run: any }) {
  const isCaptured = !!run?.compiledPlanHash

  return (
    <div className="border rounded-md p-4 bg-accent/30 space-y-4">
      <div>
        <h3 className="font-medium">Repro Artifact Export</h3>
        <p className="text-sm text-muted-foreground">Download exact state reproduction for debugging.</p>
      </div>

      {!isCaptured ? (
        <div className="text-sm text-destructive font-medium bg-destructive/10 p-2 rounded-md border border-destructive/20 inline-block">
          NOT_CAPTURED: Artifact missing or unavailable.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs font-mono bg-background p-2 rounded border">
            Hash: {run.compiledPlanHash}
          </div>
          <Button size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            Download Repro Artifact
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Includes: App, SDK, Bridge, Workflow, Device, Fingerprint. Secrets/Tokens are redacted. Does not auto-activate production Act Mode.
          </p>
        </div>
      )}
    </div>
  )
}
