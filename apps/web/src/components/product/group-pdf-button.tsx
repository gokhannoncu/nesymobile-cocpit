'use client'

import { useState } from 'react'
import { FileDown, LoaderCircle } from 'lucide-react'
import type { Workspace } from '@nesy/metronic/config/types'
import type { GroupExportProgress } from '@nesy/metronic/lib/export-group-pdf'
import { Button } from '@nesy/metronic/components/ui/button'

/**
 * Button displayed on the group overview page: downloads ALL pages of the group
 * as a single merged PDF. Progress is shown during export (n/total + title).
 * The `data-pdf-exclude` attribute ensures it is excluded from both single-page
 * and group PDF captures.
 */
export function GroupPdfButton({ workspace }: { workspace: Workspace }) {
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState<GroupExportProgress | null>(null)

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    setProgress(null)
    try {
      const { exportGroupToPdf } = await import('@nesy/metronic/lib/export-group-pdf')
      const result = await exportGroupToPdf({
        workspace,
        onProgress: (p) => setProgress(p),
      })
      if (result.skipped.length > 0) {
        console.warn('PDF export — skipped pages:', result.skipped)
        window.alert(
          `PDF downloaded. ${result.skipped.length} page(s) skipped because they could not be loaded:\n` +
            result.skipped.map((s) => `• ${s.title}`).join('\n'),
        )
      }
    } catch (error) {
      console.error('Group PDF export failed:', error)
      window.alert('PDF could not be generated. Please try again.')
    } finally {
      setExporting(false)
      setProgress(null)
    }
  }

  const label = exporting
    ? progress?.stage === 'finalizing'
      ? 'Merging PDF…'
      : progress
        ? `Preparing… ${progress.current}/${progress.total}`
        : 'Preparing…'
    : 'Download All Pages as PDF'

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={exporting}
      data-pdf-exclude
      aria-label="Download all pages of this group as PDF"
      title={
        exporting && progress?.title
          ? progress.title
          : 'Downloads all pages of this group as a single PDF (~1-3 min)'
      }
    >
      {exporting ? <LoaderCircle className="animate-spin" /> : <FileDown />}
      {label}
    </Button>
  )
}
