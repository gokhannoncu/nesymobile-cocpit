'use client'

// Execution History — alt bölüm.
// Geçmiş çalıştırmaları tablo ve detay drawer ile listeler.

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  History,
  Loader2,
  Undo2,
  X,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@nesy/metronic/components/ui/dialog'
import { ScrollArea } from '@nesy/metronic/components/ui/scroll-area'
import { PageSection, EASE } from '@/components/product'
import { RunIdBadge, StepStatusIndicator } from '@/components/engineering/device-lab/device-lab-shared'
import { CodeBlock } from '@/components/engineering/tools/shared'
import type { ExecutionRecord, RunStatus } from '@/data/engineering/device-lab/device-lab-types'

/* ─── Durum rozeti ─── */
const STATUS_CONFIG: Record<
  RunStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  pending: { label: 'Bekliyor', icon: Clock, className: 'text-muted-foreground' },
  running: { label: 'Çalışıyor', icon: Loader2, className: 'text-blue-600 dark:text-blue-400' },
  success: {
    label: 'Başarılı',
    icon: CheckCircle2,
    className: 'text-green-600 dark:text-green-400',
  },
  partial: {
    label: 'Kısmi',
    icon: AlertTriangle,
    className: 'text-amber-600 dark:text-amber-400',
  },
  failed: { label: 'Başarısız', icon: XCircle, className: 'text-red-600 dark:text-red-400' },
}

function StatusBadge({ status }: { status: RunStatus }) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon
  return (
    <Badge
      variant="secondary"
      appearance="outline"
      size="xs"
      className={cn('gap-1', config.className)}
    >
      <Icon className={cn('size-3', { 'animate-spin': status === 'running' })} />
      {config.label}
    </Badge>
  )
}

/* ─── Zaman formatla ─── */
function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDuration(startIso: string, endIso: string | null): string {
  if (!endIso) return '—'
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime()
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

/* ─── Props ─── */
interface ExecutionHistoryProps {
  records: ExecutionRecord[]
}

export function ExecutionHistory({ records }: ExecutionHistoryProps) {
  const [selectedRecord, setSelectedRecord] = useState<ExecutionRecord | null>(null)

  // En son 15 kayıt, zamana göre sıralı
  const sorted = [...records]
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, 15)

  return (
    <PageSection
      eyebrow="Geçmiş"
      title="Execution History"
      description="Son çalıştırılan ADB senaryolarının detaylı kayıtları. Bir satıra tıklayarak detayları görüntüleyebilirsiniz."
      icon={History}
      tone="gray"
    >
      {/* ─── Tablo ─── */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">
                  Run ID
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">
                  Senaryo
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">
                  Cihaz
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">
                  Kullanıcı
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">
                  Zaman
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">
                  Süre
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">
                  Sonuç
                </th>
                <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground">
                  Rollback
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {sorted.map((record, i) => (
                <motion.tr
                  key={record.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.03, ease: EASE }}
                  onClick={() => setSelectedRecord(record)}
                  className="cursor-pointer transition-colors hover:bg-muted/30"
                >
                  <td className="px-3 py-2.5">
                    <RunIdBadge id={record.id} />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-medium text-foreground">{record.scenarioName}</span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{record.deviceName}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{record.user}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                    <div>{formatDate(record.startedAt)}</div>
                    <div className="text-[10px]">{formatTime(record.startedAt)}</div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-muted-foreground">
                    {formatDuration(record.startedAt, record.completedAt)}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={record.status} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {record.rollbackAvailable ? (
                      <Badge
                        variant="secondary"
                        appearance="outline"
                        size="xs"
                        className="gap-0.5 text-green-600 dark:text-green-400"
                      >
                        <Undo2 className="size-2.5" />
                        Mevcut
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Detay Drawer ─── */}
      <Dialog
        open={!!selectedRecord}
        onOpenChange={(open) => !open && setSelectedRecord(null)}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden p-0">
          {selectedRecord && (
            <>
              <DialogHeader className="border-b border-border px-5 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <RunIdBadge id={selectedRecord.id} />
                      <StatusBadge status={selectedRecord.status} />
                    </div>
                    <DialogTitle className="mt-2 text-base font-bold text-foreground">
                      {selectedRecord.scenarioName}
                    </DialogTitle>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span>
                    Cihaz:{' '}
                    <strong className="text-foreground">{selectedRecord.deviceName}</strong>
                  </span>
                  <span>
                    Kullanıcı:{' '}
                    <strong className="text-foreground">{selectedRecord.user}</strong>
                  </span>
                  <span>
                    Başlangıç:{' '}
                    <strong className="text-foreground">
                      {formatTime(selectedRecord.startedAt)}
                    </strong>
                  </span>
                  <span>
                    Süre:{' '}
                    <strong className="text-foreground">
                      {formatDuration(selectedRecord.startedAt, selectedRecord.completedAt)}
                    </strong>
                  </span>
                </div>
              </DialogHeader>

              <ScrollArea className="max-h-[60vh] px-5 py-4">
                <div className="space-y-5">
                  {/* Adımlar */}
                  <div>
                    <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Adımlar
                    </h4>
                    <div className="space-y-1">
                      {selectedRecord.steps.map((step) => (
                        <div key={step.step} className="flex items-center gap-2 text-xs">
                          <StepStatusIndicator status={step.status} />
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {step.step}.
                          </span>
                          <span className="text-foreground">{step.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Parametreler */}
                  {Object.keys(selectedRecord.parameters).length > 0 && (
                    <div>
                      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Parametreler
                      </h4>
                      <div className="rounded-lg border border-border bg-muted/20 p-3">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {Object.entries(selectedRecord.parameters).map(([key, value]) => (
                            <div key={key}>
                              <span className="text-muted-foreground">{key}:</span>{' '}
                              <span className="font-mono font-medium text-foreground">
                                {String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Önceki / Yeni değerler */}
                  {(Object.keys(selectedRecord.previousValues).length > 0 ||
                    Object.keys(selectedRecord.newValues).length > 0) && (
                    <div>
                      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Değer Değişiklikleri
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-red-200 bg-red-50/30 p-3 dark:border-red-900 dark:bg-red-950/20">
                          <div className="mb-1.5 text-[10px] font-bold uppercase text-red-600 dark:text-red-400">
                            Önceki
                          </div>
                          {Object.entries(selectedRecord.previousValues).map(([key, value]) => (
                            <div key={key} className="text-xs">
                              <span className="text-muted-foreground">{key}:</span>{' '}
                              <span className="font-mono text-red-700 dark:text-red-300">
                                {String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="rounded-lg border border-green-200 bg-green-50/30 p-3 dark:border-green-900 dark:bg-green-950/20">
                          <div className="mb-1.5 text-[10px] font-bold uppercase text-green-600 dark:text-green-400">
                            Yeni
                          </div>
                          {Object.entries(selectedRecord.newValues).map(([key, value]) => (
                            <div key={key} className="text-xs">
                              <span className="text-muted-foreground">{key}:</span>{' '}
                              <span className="font-mono text-green-700 dark:text-green-300">
                                {String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Terminal çıktısı */}
                  <div>
                    <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Terminal Çıktısı
                    </h4>
                    <CodeBlock
                      code={selectedRecord.terminalOutput}
                      label="terminal"
                      labelTone="gray"
                    />
                  </div>

                  {/* Bağlı oturum */}
                  {selectedRecord.linkedSessionId && (
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
                      <ExternalLink className="size-3 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs text-muted-foreground">
                        Bağlı log oturumu:
                      </span>
                      <Badge
                        variant="secondary"
                        appearance="outline"
                        size="xs"
                        className="font-mono text-[10px]"
                      >
                        ◉ {selectedRecord.linkedSessionId}
                      </Badge>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Footer aksiyonları */}
              <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
                {selectedRecord.rollbackAvailable && (
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                    <Undo2 className="size-3" />
                    Geri Al
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedRecord(null)}
                  className="gap-1.5 text-xs"
                >
                  <X className="size-3" />
                  Kapat
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageSection>
  )
}
