'use client'

import { useState } from 'react'
import { FileDown, LoaderCircle } from 'lucide-react'
import type { Workspace } from '@nesy/metronic/config/types'
import type { GroupExportProgress } from '@nesy/metronic/lib/export-group-pdf'
import { Button } from '@nesy/metronic/components/ui/button'

/**
 * Grup overview sayfasında görünen buton: o grubun TÜM sayfalarını tek bir
 * birleşik PDF olarak indirir. İşlem sırasında ilerleme (n/toplam + başlık)
 * gösterilir. `data-pdf-exclude` ile hem tek-sayfa export'un hem de bu export'un
 * yakalamasına girmez.
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
        console.warn('PDF export — atlanan sayfalar:', result.skipped)
        window.alert(
          `PDF indirildi. ${result.skipped.length} sayfa yüklenemediği için atlandı:\n` +
            result.skipped.map((s) => `• ${s.title}`).join('\n'),
        )
      }
    } catch (error) {
      console.error('Grup PDF dışa aktarma başarısız:', error)
      window.alert('PDF oluşturulamadı. Lütfen tekrar deneyin.')
    } finally {
      setExporting(false)
      setProgress(null)
    }
  }

  const label = exporting
    ? progress?.stage === 'finalizing'
      ? 'PDF birleştiriliyor…'
      : progress
        ? `Hazırlanıyor… ${progress.current}/${progress.total}`
        : 'Hazırlanıyor…'
    : 'Tüm Sayfaları PDF İndir'

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={exporting}
      data-pdf-exclude
      aria-label="Bu grubun tüm sayfalarını PDF olarak indir"
      title={
        exporting && progress?.title
          ? progress.title
          : 'Bu grubun tüm sayfalarını tek PDF olarak indirir (~1-3 dk)'
      }
    >
      {exporting ? <LoaderCircle className="animate-spin" /> : <FileDown />}
      {label}
    </Button>
  )
}
