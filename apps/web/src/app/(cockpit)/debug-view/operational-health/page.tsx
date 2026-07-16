'use client'

// Debug View — Operational Readiness
// A decision-first companion to Device Overview: instead of dumping every
// hardware field, it answers "can the courier app work right now, and is there
// data-loss risk?" as a single Ready / Attention / Blocked verdict backed by
// five decision cards (environment, session, sync, location, backend).

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleHelp,
  Loader2,
  MapPin,
  Package,
  Power,
  RefreshCw,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { ProductPage, EASE, toneCard, toneDot, toneHero, toneIcon, toneIconBox, toneText } from '@/components/product'
import { DebugHeader, DebugCrossLinks, NoDeviceState } from '@/components/debug-view/shared'
import { useDebugView } from '@/components/debug-view/debug-context'
import type {
  HealthCard,
  HealthCardId,
  HealthSignal,
  HealthVerdict,
  OperationalHealthSnapshot,
} from '@/data/debug-view/live-types'
import type { Tone } from '@/components/product'

const VERDICT_META: Record<HealthVerdict, { tone: Tone; label: string; icon: LucideIcon }> = {
  ready: { tone: 'green', label: 'Ready', icon: CheckCircle2 },
  attention: { tone: 'amber', label: 'Attention', icon: AlertTriangle },
  blocked: { tone: 'red', label: 'Blocked', icon: ShieldAlert },
  unknown: { tone: 'gray', label: 'Unknown', icon: CircleHelp },
}

const OVERALL_HEADLINE: Record<HealthVerdict, string> = {
  ready: 'Courier app is ready to work',
  attention: 'Ready, but some checks need attention',
  blocked: 'App is blocked — resolve before dispatch',
  unknown: 'Readiness could not be determined',
}

const CARD_ICON: Record<HealthCardId, LucideIcon> = {
  environment: Package,
  session: CalendarClock,
  sync: UploadCloud,
  location: MapPin,
  backend: ServerCog,
}

export default function OperationalHealthPage() {
  const { selectedDevice } = useDebugView()
  const [snapshot, setSnapshot] = useState<OperationalHealthSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const serial = selectedDevice?.serial ?? null

  const load = useCallback(() => {
    if (!serial) {
      setSnapshot(null)
      return
    }
    setLoading(true)
    setError(null)
    fetch(`/api/adb/health?serial=${encodeURIComponent(serial)}`)
      .then(async (r) => {
        const body = (await r.json()) as OperationalHealthSnapshot & { error?: string }
        if (!r.ok || body.error) throw new Error(body.error ?? `HTTP ${r.status}`)
        setSnapshot(body)
      })
      .catch((err: unknown) => {
        setSnapshot(null)
        setError(err instanceof Error ? err.message : 'Failed to evaluate readiness')
      })
      .finally(() => setLoading(false))
  }, [serial])

  useEffect(() => {
    load()
  }, [load])

  return (
    <ProductPage path="/debug-view/operational-health">
      <DebugHeader
        icon={ShieldCheck}
        title="Operational Readiness"
        lead="A single Ready / Attention / Blocked verdict for the selected device — is the courier app fit to work right now, and is any data at risk of being lost? Composed from live ADB, session prefs and the on-device Room database."
        tone="teal"
        badges={[
          { label: 'Readiness verdict', tone: 'teal' },
          { label: 'Session + JWT', tone: 'teal' },
          { label: 'Sync & location risk', tone: 'teal' },
        ]}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={load} disabled={!serial || loading}>
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Re-evaluate
            </Button>
            <DebugCrossLinks currentPath="/debug-view/operational-health" />
          </>
        }
      />

      {!selectedDevice ? (
        <NoDeviceState />
      ) : loading && !snapshot ? (
        <ReadinessShimmer />
      ) : error ? (
        <ErrorState deviceName={selectedDevice.name} message={error} onRetry={load} />
      ) : !snapshot ? (
        <NoDeviceState />
      ) : (
        <div className="space-y-4">
          <VerdictHero
            deviceName={selectedDevice.name}
            serial={selectedDevice.serial}
            snapshot={snapshot}
            loading={loading}
          />

          {snapshot.blockers.length > 0 ? <BlockerStrip snapshot={snapshot} /> : null}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {snapshot.cards.map((card, i) => (
              <DecisionCard key={card.id} card={card} index={i} />
            ))}
          </div>

          <MetaFooter snapshot={snapshot} />
        </div>
      )}
    </ProductPage>
  )
}

// ---------------------------------------------------------------------------
// Hero verdict banner
// ---------------------------------------------------------------------------

function VerdictHero({
  deviceName,
  serial,
  snapshot,
  loading,
}: {
  deviceName: string
  serial: string
  snapshot: OperationalHealthSnapshot
  loading: boolean
}) {
  const meta = VERDICT_META[snapshot.overall]
  const HeroIcon = meta.icon
  const counts = {
    ready: snapshot.cards.filter((c) => c.verdict === 'ready').length,
    attention: snapshot.cards.filter((c) => c.verdict === 'attention').length,
    blocked: snapshot.cards.filter((c) => c.verdict === 'blocked').length,
  }

  return (
    <motion.section
      className={cn('overflow-hidden rounded-2xl border bg-gradient-to-br', toneHero[meta.tone])}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
        <div className="flex items-center gap-4">
          <span className={cn('flex size-16 shrink-0 items-center justify-center rounded-2xl', toneIconBox[meta.tone])}>
            <HeroIcon className={cn('size-8', toneIcon[meta.tone])} />
          </span>
          <div>
            <div className={cn('text-[11px] font-bold uppercase tracking-[0.2em]', toneText[meta.tone])}>
              Overall readiness
            </div>
            <h2 className="mt-0.5 text-2xl font-bold text-foreground lg:text-3xl">{meta.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{OVERALL_HEADLINE[snapshot.overall]}</p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <div className="flex items-center gap-2">
            <VerdictCountPill tone="green" label="Ready" count={counts.ready} />
            <VerdictCountPill tone="amber" label="Attention" count={counts.attention} />
            <VerdictCountPill tone="red" label="Blocked" count={counts.blocked} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">{deviceName}</span>
            <Badge variant="secondary" appearance="outline" size="xs" className="font-mono">
              {serial}
            </Badge>
            <span>
              {loading ? 'Re-evaluating…' : `Captured ${new Date(snapshot.capturedAt).toLocaleTimeString('en-US')}`}
            </span>
          </div>
        </div>
      </div>
    </motion.section>
  )
}

function VerdictCountPill({ tone, label, count }: { tone: Tone; label: string; count: number }) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold',
        count > 0 ? toneCard[tone] : 'border-border bg-muted/30 text-muted-foreground',
      )}
    >
      <span className={cn('size-2 rounded-full', count > 0 ? toneDot[tone] : 'bg-muted-foreground/40')} />
      <span className="tabular-nums">{count}</span>
      <span className="font-medium">{label}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Top blockers
// ---------------------------------------------------------------------------

function BlockerStrip({ snapshot }: { snapshot: OperationalHealthSnapshot }) {
  return (
    <motion.div
      className="overflow-hidden rounded-xl border border-border bg-card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <div className="flex items-center gap-2 border-b border-border/80 bg-muted/30 px-4 py-2.5">
        <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
        <h3 className="text-sm font-bold text-foreground">Active blockers</h3>
        <Badge variant="secondary" appearance="outline" size="xs" className="ms-auto">
          Top {snapshot.blockers.length}
        </Badge>
      </div>
      <ul className="divide-y divide-border/50">
        {snapshot.blockers.map((b, i) => {
          const tone: Tone = b.severity === 'blocked' ? 'red' : 'amber'
          return (
            <li key={`${b.card}-${i}`} className="flex items-start gap-3 px-4 py-3">
              <span className={cn('mt-1 size-2 shrink-0 rounded-full', toneDot[tone])} />
              <div className="min-w-0">
                <span className={cn('text-xs font-semibold uppercase tracking-wide', toneText[tone])}>
                  {b.severity === 'blocked' ? 'Blocked' : 'Attention'}
                </span>
                <p className="text-sm text-foreground">{b.message}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Decision card
// ---------------------------------------------------------------------------

function DecisionCard({ card, index }: { card: HealthCard; index: number }) {
  const meta = VERDICT_META[card.verdict]
  const Icon = CARD_ICON[card.id]

  return (
    <motion.section
      className={cn('flex flex-col overflow-hidden rounded-xl border bg-card', toneCard[meta.tone])}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE, delay: index * 0.04 }}
    >
      <div className={cn('h-1 w-full', toneDot[meta.tone])} />
      <div className="flex items-start gap-3 px-4 pt-4">
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', toneIconBox[meta.tone])}>
          <Icon className={cn('size-4.5', toneIcon[meta.tone])} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">{card.title}</h3>
            <Badge
              variant="secondary"
              appearance="outline"
              size="xs"
              className={cn('ms-auto shrink-0', toneText[meta.tone])}
            >
              {meta.label}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{card.headline}</p>
        </div>
      </div>
      <div className="mt-3 divide-y divide-border/50 px-4 pb-4">
        {card.signals.map((s) => (
          <SignalRow key={s.id} signal={s} />
        ))}
      </div>
    </motion.section>
  )
}

function SignalRow({ signal }: { signal: HealthSignal }) {
  const tone = VERDICT_META[signal.verdict].tone
  return (
    <div className="py-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'size-2 shrink-0 rounded-full',
            signal.measured ? toneDot[tone] : 'bg-muted-foreground/30',
          )}
        />
        <span className="text-xs text-muted-foreground">{signal.label}</span>
        <span
          className={cn(
            'ms-auto text-right text-xs font-semibold',
            signal.measured ? 'text-foreground' : 'text-muted-foreground/70 italic',
          )}
        >
          {signal.value}
        </span>
      </div>
      {signal.hint ? <p className="ms-4 mt-0.5 text-[11px] leading-snug text-muted-foreground">{signal.hint}</p> : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Footer: environment meta + capture caveats
// ---------------------------------------------------------------------------

function MetaFooter({ snapshot }: { snapshot: OperationalHealthSnapshot }) {
  const { meta } = snapshot
  const items = [
    { label: 'Version', value: meta.versionName ? `${meta.versionName} (${meta.versionCode ?? '?'})` : '—' },
    { label: 'Environment', value: meta.environment ?? '—' },
    { label: 'Build', value: meta.debuggable ? 'debuggable' : 'release' },
    { label: 'API host', value: meta.apiHost ?? 'Not measured' },
    { label: 'Android', value: `${meta.androidVersion} · API ${meta.apiLevel}` },
    { label: 'Package', value: meta.flavor ?? '—' },
  ]

  return (
    <motion.div
      className="overflow-hidden rounded-xl border border-border bg-card"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 xl:grid-cols-6">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</div>
            <div className="mt-0.5 truncate font-mono text-xs text-foreground" title={item.value}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 border-t border-border/70 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
        <Power
          className={cn(
            'mt-0.5 size-3.5 shrink-0',
            snapshot.appStopped ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400',
          )}
        />
        {snapshot.appStopped ? (
          <span>
            Reading the on-device database force-stopped the app for a consistent point-in-time copy. Relaunch NesyMobile
            on the device to resume services.
          </span>
        ) : (
          <span>
            Live read — the app is left running, so you can re-evaluate freely. The on-device database is copied while
            NesyMobile is active, which may rarely skew mid-write. Database Access and Schedule Explorer use the same
            non-disruptive capture mode.
          </span>
        )}
      </div>

      {snapshot.warnings.length > 0 ? (
        <div className="border-t border-border/70 px-4 py-3">
          <ul className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
            {snapshot.warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
                {w}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Loading / error states
// ---------------------------------------------------------------------------

function ReadinessShimmer() {
  return (
    <div className="space-y-4" role="status" aria-label="Evaluating readiness">
      <span className="sr-only">Evaluating readiness</span>
      <div className="h-28 animate-pulse rounded-2xl border border-border bg-muted/40" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-xl border border-border bg-muted/40" />
        ))}
      </div>
    </div>
  )
}

function ErrorState({ deviceName, message, onRetry }: { deviceName: string; message: string; onRetry: () => void }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-red-300 bg-red-50/40 py-14 text-center dark:border-red-900 dark:bg-red-950/20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <AlertTriangle className="size-6 text-red-500" />
      <div>
        <h3 className="text-sm font-semibold text-foreground">Could not evaluate {deviceName}</h3>
        <p className="mt-1 max-w-md break-all text-xs leading-relaxed text-muted-foreground">{message}</p>
      </div>
      <Button size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw className="size-3.5" />
        Try again
      </Button>
    </motion.div>
  )
}
