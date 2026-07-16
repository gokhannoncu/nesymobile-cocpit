'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Smartphone,
  Hash,
  Download,
  Trash2,
  FileArchive,
  FileJson,
  FileText,
  ShieldCheck,
} from 'lucide-react'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { ScrollArea } from '@nesy/metronic/components/ui/scroll-area'
import { EASE, PageSection } from '@/components/product'
import type { BundleFormat, StoredLogBundle } from '@/data/engineering/device-lab/device-lab-types'

interface SharedBundlesProps {
  bundles: StoredLogBundle[]
  onDownload: (id: string) => void
  onDelete: (id: string) => void
}

const FORMAT_ICON: Record<BundleFormat, typeof FileArchive> = {
  zip: FileArchive,
  json: FileJson,
  txt: FileText,
}

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function SharedBundles({ bundles, onDownload, onDelete }: SharedBundlesProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null)

  return (
    <PageSection
      title="Diagnostic Bundles"
      description="Diagnostic packages generated on this machine. Sensitive values were masked at export time. Bundles stay in your browser profile — nothing is uploaded automatically."
    >
      <motion.div
        className="rounded-xl border bg-card overflow-hidden"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
      >
        <ScrollArea className="max-h-[60vh]">
          <div className="divide-y divide-border/50">
            {bundles.map((bundle, idx) => {
              const Icon = FORMAT_ICON[bundle.format]
              const redactions = bundle.maskManifest.reduce((n, m) => n + m.hits, 0)
              return (
                <motion.div
                  key={bundle.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3), ease: EASE }}
                >
                  <Icon className="size-4 shrink-0 text-purple-600 dark:text-purple-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-xs text-foreground/90">{bundle.filename}</div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Smartphone className="size-3" /> {bundle.deviceName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Hash className="size-3" /> {bundle.eventCount} events
                      </span>
                      <span>{sizeLabel(bundle.sizeBytes)}</span>
                      <span>{new Date(bundle.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <Badge variant="secondary" appearance="outline" size="xs" className="gap-1 shrink-0">
                    <ShieldCheck className="size-3" /> {redactions} masked
                  </Badge>
                  {confirmId === bundle.id ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">Delete?</span>
                      <Button size="xs" variant="ghost" className="h-6 px-2 text-[10px] text-red-600" onClick={() => { onDelete(bundle.id); setConfirmId(null) }}>Yes</Button>
                      <Button size="xs" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setConfirmId(null)}>No</Button>
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1">
                      <Button size="xs" variant="ghost" className="h-6 gap-1 px-1.5 text-[10px]" onClick={() => onDownload(bundle.id)}>
                        <Download className="size-3" /> Download
                      </Button>
                      <Button size="xs" variant="ghost" className="h-6 px-1.5 text-[10px] text-red-600 hover:text-red-700" onClick={() => setConfirmId(bundle.id)}>
                        <Trash2 className="size-3" />
                      </Button>
                    </span>
                  )}
                </motion.div>
              )
            })}
          </div>

          {bundles.length === 0 && (
            <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
              No bundles yet. Open a session and create a diagnostic bundle.
            </div>
          )}
        </ScrollArea>
      </motion.div>
    </PageSection>
  )
}
