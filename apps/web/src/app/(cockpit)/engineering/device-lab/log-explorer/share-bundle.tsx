'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileArchive,
  Link2,
  Lock,
  Package,
  Shield,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Button } from '@nesy/metronic/components/ui/button'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Checkbox } from '@nesy/metronic/components/ui/checkbox'
import { Switch } from '@nesy/metronic/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@nesy/metronic/components/ui/dialog'
import { Separator } from '@nesy/metronic/components/ui/separator'
import { EASE } from '@/components/product'
import { PRIVACY_RULES } from '@/data/engineering/device-lab/log-presets'

/* ──────────────────────────── Props ──────────────────────────────── */

interface ShareBundleDialogProps {
  open: boolean
  onClose: () => void
  sessionId: string | null
}

/* ──────────────────── Step definitions ───────────────────────────── */

const STEPS = [
  { num: 1, label: 'İçerik Seçimi', icon: Package },
  { num: 2, label: 'Gizlilik İnceleme', icon: Shield },
  { num: 3, label: 'Format', icon: FileArchive },
  { num: 4, label: 'Erişim Kontrolü', icon: Lock },
]

/* ──────────────────── Content options ────────────────────────────── */

const CONTENT_OPTIONS = [
  { id: 'timeline', label: 'Timeline olayları', description: 'Filtrelenmiş timeline görünümündeki tüm olaylar', checked: true },
  { id: 'raw-logcat', label: 'Raw logcat çıktısı', description: 'İşlenmemiş ham logcat buffer metni', checked: true },
  { id: 'app-logs', label: 'Uygulama log dosyaları', description: 'NesyMobile uygulama log dosyaları', checked: false },
  { id: 'device-info', label: 'Cihaz bilgisi', description: 'Model, Android sürümü, build tipi, batarya vb.', checked: true },
  { id: 'network', label: 'Network trace', description: 'HTTP istek/yanıt özetleri ve zamanlama', checked: false },
  { id: 'screenshots', label: 'Ekran görüntüleri', description: 'Yakalama sırasında alınan ekran görüntüleri', checked: false },
  { id: 'adb-report', label: 'ADB senaryo raporu', description: 'İlişkili ADB senaryo çalıştırma sonuçları', checked: false },
]

/* ──────────────────── Format options ─────────────────────────────── */

const FORMAT_OPTIONS = [
  { id: 'link', label: 'Paylaşılabilir Link', description: 'Cockpit üzerinden erişilebilir güvenli link' },
  { id: 'zip', label: 'ZIP Bundle', description: 'İndirilebilir sıkıştırılmış teşhis paketi' },
  { id: 'plaintext', label: 'Plain Text', description: 'Düz metin formatında log çıktısı' },
  { id: 'ticket', label: 'Ticket', description: 'Doğrudan ticket sistemine gönder' },
  { id: 'incident', label: 'Incident', description: 'Incident yönetim sistemine ekle' },
]

/* ──────────────────── Main Component ─────────────────────────────── */

export function ShareBundleDialog({ open, onClose, sessionId }: ShareBundleDialogProps) {
  const [step, setStep] = useState(1)
  const [contents, setContents] = useState<Record<string, boolean>>(
    Object.fromEntries(CONTENT_OPTIONS.map((c) => [c.id, c.checked])),
  )
  const [privacyToggles, setPrivacyToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(PRIVACY_RULES.map((r) => [r.id, true])),
  )
  const [selectedFormat, setSelectedFormat] = useState('link')
  const [accessLevel, setAccessLevel] = useState<'internal' | 'team'>('internal')
  const [expiry, setExpiry] = useState<'7d' | '30d' | 'none'>('7d')
  const [auditEnabled, setAuditEnabled] = useState(true)

  const toggleContent = (id: string) => {
    setContents((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const togglePrivacy = (id: string) => {
    setPrivacyToggles((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const canGoNext = step < 4
  const canGoBack = step > 1

  const handleNext = () => {
    if (canGoNext) setStep((s) => s + 1)
  }

  const handleBack = () => {
    if (canGoBack) setStep((s) => s - 1)
  }

  const handleCreate = () => {
    // Mock: close dialog
    setStep(1)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileArchive className="size-4 text-purple-500" />
            Teşhis Paketi Oluştur
            {sessionId && (
              <Badge variant="secondary" appearance="outline" size="xs" className="font-mono">
                {sessionId}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* ── Step indicator ──────────────────────────────────────── */}
        <div className="flex items-center gap-1 py-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const isActive = step === s.num
            const isDone = step > s.num
            return (
              <div key={s.num} className="flex items-center gap-1 flex-1">
                <div
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-all flex-1',
                    isActive
                      ? 'bg-purple-50 border border-purple-200 dark:bg-purple-950/30 dark:border-purple-800'
                      : isDone
                        ? 'bg-green-50/60 border border-green-200 dark:bg-green-950/20 dark:border-green-800'
                        : 'bg-muted/30 border border-transparent',
                  )}
                >
                  <div
                    className={cn(
                      'flex size-5 items-center justify-center rounded-full text-[10px] font-bold',
                      isActive
                        ? 'bg-purple-600 text-white'
                        : isDone
                          ? 'bg-green-600 text-white'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {isDone ? <Check className="size-3" /> : s.num}
                  </div>
                  <span
                    className={cn(
                      'text-[10px] font-medium truncate',
                      isActive
                        ? 'text-purple-800 dark:text-purple-200'
                        : isDone
                          ? 'text-green-800 dark:text-green-200'
                          : 'text-muted-foreground',
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="size-3 text-muted-foreground/40 shrink-0" />
                )}
              </div>
            )
          })}
        </div>

        <Separator />

        {/* ── Step content ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto py-3 min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, ease: EASE }}
            >
              {/* Step 1: Content Selection */}
              {step === 1 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-3">
                    Teşhis paketine dahil edilecek içerikleri seçin.
                  </p>
                  {CONTENT_OPTIONS.map((opt) => (
                    <label
                      key={opt.id}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                        contents[opt.id]
                          ? 'border-purple-200 bg-purple-50/40 dark:border-purple-800 dark:bg-purple-950/20'
                          : 'border-border hover:bg-muted/30',
                      )}
                    >
                      <Checkbox
                        checked={contents[opt.id]}
                        onCheckedChange={() => toggleContent(opt.id)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground">
                          {opt.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {opt.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {/* Step 2: Privacy Review */}
              {step === 2 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-3">
                    Hassas verilerin maskeleme kurallarını gözden geçirin. Aktif kurallar paylaşılan verilerde uygulanacaktır.
                  </p>
                  {PRIVACY_RULES.map((rule) => (
                    <div
                      key={rule.id}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                        privacyToggles[rule.id]
                          ? 'border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/15'
                          : 'border-border',
                      )}
                    >
                      <Switch
                        checked={privacyToggles[rule.id]}
                        onCheckedChange={() => togglePrivacy(rule.id)}
                        className="scale-90"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">
                          {(rule as any).label ?? rule.field}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-[9px] font-mono text-muted-foreground bg-muted/50 px-1 py-0.5 rounded">
                            {rule.pattern.slice(0, 40)}
                            {rule.pattern.length > 40 ? '…' : ''}
                          </code>
                          <span className="text-[9px] text-muted-foreground">→</span>
                          <code className="text-[9px] font-mono text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-1 py-0.5 rounded">
                            {rule.replacement.slice(0, 30)}
                          </code>
                        </div>
                      </div>
                      {privacyToggles[rule.id] && (
                        <Badge variant="secondary" appearance="outline" size="xs" className="text-green-700 dark:text-green-400">
                          <Eye className="size-3 mr-0.5" />
                          Aktif
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Step 3: Format Selection */}
              {step === 3 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-3">
                    Teşhis paketinin çıktı formatını seçin.
                  </p>
                  {FORMAT_OPTIONS.map((fmt) => (
                    <button
                      key={fmt.id}
                      onClick={() => setSelectedFormat(fmt.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all',
                        selectedFormat === fmt.id
                          ? 'border-purple-300 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/30'
                          : 'border-border hover:bg-muted/30',
                      )}
                    >
                      <div
                        className={cn(
                          'flex size-4 items-center justify-center rounded-full border-2',
                          selectedFormat === fmt.id
                            ? 'border-purple-600'
                            : 'border-muted-foreground/30',
                        )}
                      >
                        {selectedFormat === fmt.id && (
                          <div className="size-2 rounded-full bg-purple-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground">
                          {fmt.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {fmt.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Step 4: Access Control */}
              {step === 4 && (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground mb-3">
                    Teşhis paketinin erişim ve denetim ayarlarını yapılandırın.
                  </p>

                  {/* Access level */}
                  <div>
                    <label className="text-[11px] font-semibold text-foreground/80 block mb-2">
                      Erişim Seviyesi
                    </label>
                    <div className="flex gap-2">
                      {([
                        { id: 'internal' as const, label: 'Internal', icon: Lock, desc: 'Sadece ekip üyeleri' },
                        { id: 'team' as const, label: 'Team', icon: Users, desc: 'Tüm organizasyon' },
                      ]).map((opt) => {
                        const Icon = opt.icon
                        return (
                          <button
                            key={opt.id}
                            onClick={() => setAccessLevel(opt.id)}
                            className={cn(
                              'flex flex-1 items-center gap-2 rounded-lg border p-3 transition-all',
                              accessLevel === opt.id
                                ? 'border-purple-300 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/30'
                                : 'border-border hover:bg-muted/30',
                            )}
                          >
                            <Icon
                              className={cn(
                                'size-4',
                                accessLevel === opt.id
                                  ? 'text-purple-600'
                                  : 'text-muted-foreground',
                              )}
                            />
                            <div className="text-left">
                              <p className="text-xs font-semibold text-foreground">
                                {opt.label}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {opt.desc}
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Expiry */}
                  <div>
                    <label className="text-[11px] font-semibold text-foreground/80 block mb-2">
                      Geçerlilik Süresi
                    </label>
                    <div className="flex gap-2">
                      {([
                        { id: '7d' as const, label: '7 gün' },
                        { id: '30d' as const, label: '30 gün' },
                        { id: 'none' as const, label: 'Süresiz' },
                      ]).map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setExpiry(opt.id)}
                          className={cn(
                            'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all',
                            expiry === opt.id
                              ? 'border-purple-300 bg-purple-50/50 text-purple-800 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-200'
                              : 'border-border text-muted-foreground hover:bg-muted/30',
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Audit */}
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        Denetim Kaydı
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Kim ne zaman erişti bilgisini kaydet
                      </p>
                    </div>
                    <Switch
                      checked={auditEnabled}
                      onCheckedChange={setAuditEnabled}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <Separator />

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleBack}
            disabled={!canGoBack}
            className="gap-1"
          >
            <ChevronLeft className="size-3.5" />
            Geri
          </Button>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onClose}>
              İptal
            </Button>
            {canGoNext ? (
              <Button
                size="sm"
                onClick={handleNext}
                className="gap-1 bg-purple-600 hover:bg-purple-700 text-white"
              >
                İleri
                <ChevronRight className="size-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleCreate}
                className="gap-1 bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Package className="size-3.5" />
                Teşhis Paketini Oluştur
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
