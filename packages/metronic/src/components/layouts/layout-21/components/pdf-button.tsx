'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { FileDown, LoaderCircle } from 'lucide-react'
import { Button } from '@nesy/metronic/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@nesy/metronic/components/ui/tooltip'
import { getBreadcrumbs } from '@nesy/metronic/config/menu-utils'
import { cn } from '@nesy/metronic/lib/utils'

/**
 * Sayfa içeriğini A4 PDF olarak doğrudan indiren buton.
 * Önizleme açılmaz; render tamamen ekran dışında yapılır.
 */
export function PdfButton({ className }: { className?: string }) {
  const pathname = usePathname()
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const crumbs = getBreadcrumbs(pathname)
      const title = crumbs[crumbs.length - 1]?.title ?? 'Nesy Mobile Cockpit'
      const { exportPageToPdf } = await import('@nesy/metronic/lib/export-pdf')
      await exportPageToPdf({ title })
    } catch (error) {
      console.error('PDF dışa aktarma başarısız:', error)
    } finally {
      setExporting(false)
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          mode="icon"
          onClick={handleExport}
          disabled={exporting}
          aria-label="Sayfayı PDF olarak indir"
          className={cn('text-muted-foreground hover:text-foreground', className)}
        >
          {exporting ? <LoaderCircle className="animate-spin" /> : <FileDown />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {exporting ? 'PDF hazırlanıyor…' : 'PDF olarak indir'}
      </TooltipContent>
    </Tooltip>
  )
}
