'use client'

// Debug View — User Interaction Timeline
// Cihazdaki kullanıcı etkileşim geçmişi: app open → login → tıklama → ekran
// açılışı → tarama → ağ isteği, kronolojik akış.

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  Keyboard,
  MonitorSmartphone,
  MousePointerClick,
  MousePointer2,
  Radio,
  ScanLine,
  Smartphone,
  Zap,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { ProductPage, PageSection, EASE, toneCard, toneIcon, toneText, type Tone } from '@/components/product'
import { DebugHeader, DebugCrossLinks, NoDeviceState } from '@/components/debug-view/shared'
import { useDebugView } from '@/components/debug-view/debug-context'
import { MOCK_INTERACTIONS, INTERACTION_KIND_META } from '@/data/debug-view/mock-interactions'
import type { InteractionKind } from '@/data/debug-view/types'

const KIND_ICON: Record<InteractionKind, typeof Zap> = {
  app: Zap,
  screen: MonitorSmartphone,
  click: MousePointer2,
  input: Keyboard,
  scan: ScanLine,
  network: Radio,
  system: Smartphone,
  error: AlertCircle,
}

function fmtOffset(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const rem = s % 60
  return m > 0 ? `+${m}m ${rem}s` : `+${rem}s`
}

export default function InteractionsPage() {
  const { selectedDevice } = useDebugView()
  const [filter, setFilter] = useState<InteractionKind | 'all'>('all')

  const events = useMemo(
    () => (filter === 'all' ? MOCK_INTERACTIONS : MOCK_INTERACTIONS.filter((e) => e.kind === filter)),
    [filter],
  )

  const kinds = Object.keys(INTERACTION_KIND_META) as InteractionKind[]
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const e of MOCK_INTERACTIONS) c[e.kind] = (c[e.kind] ?? 0) + 1
    return c
  }, [])

  return (
    <ProductPage path="/debug-view/interactions">
      <DebugHeader
        icon={MousePointerClick}
        title="User Interaction Timeline"
        lead="Cihazda kullanıcının attığı her adım: uygulama açılışı, login, buton tıklamaları, ekran geçişleri, barkod taramaları ve tetiklenen ağ istekleri — zaman sırasıyla."
        tone="teal"
        badges={[{ label: 'Oturum akışı' }, { label: 'Ekran geçişleri' }, { label: 'Analytics event' }]}
        actions={<DebugCrossLinks currentPath="/debug-view/interactions" />}
      />

      {!selectedDevice ? (
        <NoDeviceState />
      ) : (
        <>
          {/* Filtreler */}
          <div className="flex flex-wrap gap-1.5">
            <FilterChip label="Tümü" active={filter === 'all'} onClick={() => setFilter('all')} count={MOCK_INTERACTIONS.length} />
            {kinds.map((k) => (
              <FilterChip
                key={k}
                label={INTERACTION_KIND_META[k].label}
                active={filter === k}
                onClick={() => setFilter(k)}
                count={counts[k] ?? 0}
                tone={INTERACTION_KIND_META[k].tone}
              />
            ))}
          </div>

          {/* Timeline */}
          <PageSection eyebrow="Oturum" title="Etkileşim Akışı" icon={MousePointerClick} tone="teal">
            <div className="relative rounded-xl border border-border bg-card p-5">
              <div className="absolute bottom-5 left-[34px] top-5 w-px bg-border" />
              <div className="space-y-1">
                {events.map((ev, i) => {
                  const meta = INTERACTION_KIND_META[ev.kind]
                  const Icon = KIND_ICON[ev.kind]
                  return (
                    <motion.div
                      key={ev.id}
                      className="relative flex gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/30"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.28, delay: i * 0.03, ease: EASE }}
                    >
                      <span className={cn('z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-background', toneCard[meta.tone])}>
                        <Icon className={cn('size-3.5', toneIcon[meta.tone])} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{ev.label}</span>
                          <Badge variant="secondary" appearance="outline" size="xs" className={cn(toneText[meta.tone])}>
                            {ev.screen}
                          </Badge>
                          {ev.analyticsEvent && (
                            <Badge variant="secondary" size="xs" className="gap-1 font-mono text-[9px]">
                              <Zap className="size-2.5" />
                              {ev.analyticsEvent}
                            </Badge>
                          )}
                          <span className="ms-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                            {new Date(ev.timestamp).toLocaleTimeString('tr-TR')} · {fmtOffset(ev.offsetMs)}
                          </span>
                        </div>
                        {ev.detail && <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{ev.detail}</p>}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Ekran görünümleri Crashlytics breadcrumb, tıklama/tarama ise cihaz üstü etkileşim kaydından türetilir.
              Analytics rozetleri gerçek <code className="text-foreground">logEvent</code> çağrılarıdır.
            </p>
          </PageSection>
        </>
      )}
    </ProductPage>
  )
}

function FilterChip({
  label,
  active,
  onClick,
  count,
  tone = 'gray',
}: {
  label: string
  active: boolean
  onClick: () => void
  count: number
  tone?: Tone
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors',
        active ? cn(toneCard[tone], toneText[tone], 'border-current/30') : 'border-border bg-card text-muted-foreground hover:bg-muted/50',
      )}
    >
      {label}
      <span className={cn('rounded px-1 text-[10px]', active ? 'bg-background/60' : 'bg-muted')}>{count}</span>
    </button>
  )
}
