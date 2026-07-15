'use client'

// Debug View — Live Screen State
// O anda ekranda ne var? Aktif fragment (DeliveryFragment), ekran hafızası
// (state alanları), collectionType ve o ekrandaki son olay geçmişi.

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Clock,
  CreditCard,
  LayoutDashboard,
  Layers,
  MousePointerClick,
  Navigation,
  Radio,
  Repeat,
  ScrollText,
  Smartphone,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { ProductPage, PageSection, EASE, toneCard, toneIcon, toneText, type Tone } from '@/components/product'
import { DebugHeader, DebugCrossLinks, TonePill, NoDeviceState } from '@/components/debug-view/shared'
import { useDebugView } from '@/components/debug-view/debug-context'
import { MOCK_SCREEN_STATE, SCREEN_HISTORY } from '@/data/debug-view/mock-screen-state'
import { COLLECTION_TYPE, enumLabel } from '@/data/debug-view/enums'
import type { ScreenStateField, ScreenEvent } from '@/data/debug-view/types'

const GROUP_META: Record<ScreenStateField['group'], { label: string; tone: Tone }> = {
  lifecycle: { label: 'Yaşam döngüsü', tone: 'indigo' },
  viewmodel: { label: 'SharedViewModel (activity-scoped)', tone: 'purple' },
  selection: { label: 'Seçim & mevcut bağlam', tone: 'blue' },
  'ui-state': { label: 'UI durumu', tone: 'teal' },
  flags: { label: 'Bayraklar', tone: 'amber' },
}

const EVENT_META: Record<ScreenEvent['type'], { tone: Tone; icon: typeof Clock }> = {
  lifecycle: { tone: 'indigo', icon: Repeat },
  user: { tone: 'teal', icon: MousePointerClick },
  state: { tone: 'purple', icon: Layers },
  network: { tone: 'green', icon: Radio },
  navigation: { tone: 'blue', icon: Navigation },
}

export default function ScreenStatePage() {
  const { selectedDevice } = useDebugView()
  const s = MOCK_SCREEN_STATE
  const [activeGroup, setActiveGroup] = useState<ScreenStateField['group'] | 'all'>('all')

  const collection = enumLabel(COLLECTION_TYPE, s.collectionTypeRaw)
  const groups = Object.keys(GROUP_META) as ScreenStateField['group'][]
  const visibleFields = activeGroup === 'all' ? s.fields : s.fields.filter((f) => f.group === activeGroup)

  return (
    <ProductPage path="/debug-view/screen-state">
      <DebugHeader
        icon={LayoutDashboard}
        title="Live Screen State"
        lead="Cihazda o anda hangi ekran açık, ekran hafızasındaki state ne durumda ve o ekranda en son hangi olaylar gerçekleşti — canlı olarak."
        tone="teal"
        badges={[{ label: 'Aktif fragment' }, { label: 'Ekran hafızası' }, { label: 'Olay geçmişi' }]}
        actions={<DebugCrossLinks currentPath="/debug-view/screen-state" />}
      />

      {!selectedDevice ? (
        <NoDeviceState />
      ) : (
        <>
          {/* ─── Aktif ekran kartı ─── */}
          <motion.section
            className={cn('rounded-2xl border p-5', toneCard.teal)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900/40">
                  <Smartphone className={cn('size-5.5', toneIcon.teal)} />
                </span>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                    Aktif ekran
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{s.fragmentName}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {s.activityName} · nav: <code className="text-foreground">{s.navGraphDestination}</code> ·{' '}
                    {s.viewModelName}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Badge variant="success" appearance="light" size="md" className="gap-1.5">
                  <span className="size-1.5 rounded-full bg-current animate-pulse" />
                  {s.lifecycleState}
                </Badge>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="size-3" />
                  Ekranda {s.timeOnScreenSec}s · {new Date(s.enteredAt).toLocaleTimeString('tr-TR')}
                </span>
              </div>
            </div>

            {/* collectionType vurgusu */}
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-background/60 px-4 py-3">
              <CreditCard className={cn('size-5', toneIcon[collection.tone])} />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  collectionType (CollectionType enum)
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-lg font-bold', toneText[collection.tone])}>{collection.label}</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    = {s.collectionTypeRaw}
                  </code>
                </div>
              </div>
              <div className="ms-auto text-right text-[11px] text-muted-foreground">
                <div>None(0) · Cash(1) · CreditCard(6)</div>
                <div>VPos(7) · OnInvoice(8)</div>
              </div>
            </div>
          </motion.section>

          {/* ─── State alanları + olay geçmişi ─── */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
            {/* State */}
            <PageSection eyebrow="Ekran hafızası" title="State Alanları" icon={Layers} tone="purple">
              <div className="mb-3 flex flex-wrap gap-1.5">
                <FilterChip label="Tümü" active={activeGroup === 'all'} onClick={() => setActiveGroup('all')} count={s.fields.length} />
                {groups.map((g) => (
                  <FilterChip
                    key={g}
                    label={GROUP_META[g].label}
                    active={activeGroup === g}
                    onClick={() => setActiveGroup(g)}
                    count={s.fields.filter((f) => f.group === g).length}
                    tone={GROUP_META[g].tone}
                  />
                ))}
              </div>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <table className="w-full text-left">
                  <thead className="border-b border-border bg-muted/40">
                    <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2 font-semibold">Alan</th>
                      <th className="px-3 py-2 font-semibold">Tür</th>
                      <th className="px-3 py-2 font-semibold">Değer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {visibleFields.map((f) => (
                      <tr key={f.name} className="hover:bg-muted/30">
                        <td className="px-3 py-1.5">
                          <code className="text-[11px] font-semibold text-foreground">{f.name}</code>
                        </td>
                        <td className="px-3 py-1.5">
                          <span className="text-[11px] text-muted-foreground">{f.type}</span>
                        </td>
                        <td className="px-3 py-1.5">
                          <code className={cn('text-[11px] font-medium', toneText[GROUP_META[f.group].tone])}>{f.value}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PageSection>

            {/* Olay geçmişi */}
            <PageSection eyebrow="Bu ekranda" title="Son Olaylar" icon={ScrollText} tone="blue">
              <div className="relative space-y-0 rounded-xl border border-border bg-card p-4">
                <div className="absolute bottom-4 left-[27px] top-4 w-px bg-border" />
                {[...s.recentEvents].reverse().map((ev, i) => {
                  const meta = EVENT_META[ev.type]
                  const Icon = meta.icon
                  return (
                    <motion.div
                      key={ev.id}
                      className="relative flex gap-3 pb-3 last:pb-0"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04, ease: EASE }}
                    >
                      <span className={cn('z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-background', toneCard[meta.tone])}>
                        <Icon className={cn('size-3', toneIcon[meta.tone])} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">{ev.label}</span>
                          <TonePill label={ev.type} tone={meta.tone} className="ms-auto shrink-0" />
                        </div>
                        {ev.detail && <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{ev.detail}</p>}
                        <span className="text-[10px] text-muted-foreground/70">{new Date(ev.timestamp).toLocaleTimeString('tr-TR')}</span>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </PageSection>
          </div>

          {/* ─── Ekran geçmişi (navigation stack) ─── */}
          <PageSection eyebrow="Navigasyon" title="Ekran Geçmişi" description="Bu oturumda ziyaret edilen fragment'lar (navigation back stack)." icon={Navigation} tone="indigo">
            <div className="flex flex-wrap items-center gap-2">
              {SCREEN_HISTORY.map((h, i) => (
                <div key={h.destination + i} className="flex items-center gap-2">
                  <div
                    className={cn(
                      'rounded-lg border px-3 py-2',
                      i === SCREEN_HISTORY.length - 1 ? toneCard.teal : 'bg-card border-border',
                    )}
                  >
                    <div className="text-xs font-semibold text-foreground">{h.fragmentName}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(h.enteredAt).toLocaleTimeString('tr-TR')} · {h.timeOnScreenSec}s
                    </div>
                  </div>
                  {i < SCREEN_HISTORY.length - 1 && <ArrowRight className="size-4 text-muted-foreground" />}
                </div>
              ))}
            </div>
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
