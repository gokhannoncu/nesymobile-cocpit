'use client'

import { useState } from 'react'
import {
  FileArchive,
  FileJson,
  FileText,
  Shield,
  Loader2,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Button } from '@nesy/metronic/components/ui/button'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Switch } from '@nesy/metronic/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@nesy/metronic/components/ui/dialog'
import { PRIVACY_RULES } from '@/data/engineering/device-lab/log-presets'
import type { BundleFormat, PrivacyRule } from '@/data/engineering/device-lab/device-lab-types'

interface ShareBundleDialogProps {
  open: boolean
  onClose: () => void
  /** Session id being exported (null disables Create). */
  sessionId: string | null
  eventCount: number
  onCreate: (opts: { format: BundleFormat; privacyRules: PrivacyRule[] }) => Promise<void>
}

const FORMAT_OPTIONS: { id: BundleFormat; label: string; description: string; icon: typeof FileArchive }[] = [
  { id: 'zip', label: 'ZIP Bundle', description: 'manifest, events.jsonl, logcat.txt, markers, device & correlation', icon: FileArchive },
  { id: 'json', label: 'JSON', description: 'Single structured JSON document with everything inline', icon: FileJson },
  { id: 'txt', label: 'Plain Text', description: 'Masked raw logcat lines with a short header', icon: FileText },
]

export function ShareBundleDialog({ open, onClose, sessionId, eventCount, onCreate }: ShareBundleDialogProps) {
  const [format, setFormat] = useState<BundleFormat>('zip')
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    () => Object.fromEntries(PRIVACY_RULES.map((r) => [r.id, r.enabled])),
  )
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = (id: string) => setEnabled((prev) => ({ ...prev, [id]: !prev[id] }))
  const activeCount = Object.values(enabled).filter(Boolean).length

  const handleCreate = async () => {
    if (!sessionId) return
    setCreating(true)
    setError(null)
    try {
      const rules: PrivacyRule[] = PRIVACY_RULES.map((r) => ({ ...r, enabled: enabled[r.id] ?? false }))
      await onCreate({ format, privacyRules: rules })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create bundle')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileArchive className="size-4 text-purple-600 dark:text-purple-400" />
            Create diagnostic bundle
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <p className="text-xs text-muted-foreground">
            Exports {eventCount.toLocaleString()} captured events. Masking is applied to the exported copy
            only — your stored session is never modified. The bundle stays on this machine.
          </p>

          {/* Format */}
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Format</div>
            <div className="grid grid-cols-3 gap-2">
              {FORMAT_OPTIONS.map((opt) => {
                const Icon = opt.icon
                const active = format === opt.id
                return (
                  <button
                    key={opt.id}
                    onClick={() => setFormat(opt.id)}
                    className={cn(
                      'flex flex-col gap-1 rounded-lg border p-3 text-left transition-all',
                      active
                        ? 'border-purple-400 bg-purple-50/50 dark:border-purple-700 dark:bg-purple-950/20'
                        : 'hover:bg-muted/40',
                    )}
                  >
                    <Icon className={cn('size-4', active ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground')} />
                    <span className="text-xs font-medium">{opt.label}</span>
                    <span className="text-[10px] leading-tight text-muted-foreground">{opt.description}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Privacy rules */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Shield className="size-3.5" /> Privacy redaction
              </span>
              <Badge variant="secondary" appearance="outline" size="xs">{activeCount} / {PRIVACY_RULES.length} active</Badge>
            </div>
            <div className="grid max-h-56 grid-cols-2 gap-x-4 gap-y-1.5 overflow-y-auto rounded-lg border p-3">
              {PRIVACY_RULES.map((rule) => (
                <label key={rule.id} className="flex items-center justify-between gap-2 py-0.5">
                  <span className="truncate text-xs text-foreground/80">{rule.label}</span>
                  <Switch checked={enabled[rule.id] ?? false} onCheckedChange={() => toggle(rule.id)} className="scale-75" />
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="mt-2 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={creating}>Cancel</Button>
          <Button size="sm" onClick={handleCreate} disabled={!sessionId || creating} className="gap-1.5">
            {creating && <Loader2 className="size-3.5 animate-spin" />}
            Create &amp; download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
