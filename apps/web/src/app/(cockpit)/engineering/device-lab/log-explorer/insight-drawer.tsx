'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Info,
  Layers,
  Link2,
  Search,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  Ticket,
  Siren,
  Clock,
  Hash,
  FileCode,
  Database,
  Terminal,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Button } from '@nesy/metronic/components/ui/button'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { ScrollArea } from '@nesy/metronic/components/ui/scroll-area'
import { Separator } from '@nesy/metronic/components/ui/separator'
import { EASE, toneIcon } from '@/components/product'
import { RunIdBadge } from '@/components/engineering/device-lab/device-lab-shared'
import { CodeBlock } from '@/components/engineering/tools/shared'
import type { LogEvent } from '@/data/engineering/device-lab/device-lab-types'
import {
  LOG_SOURCE_META,
  LOG_LEVEL_META,
} from '@/data/engineering/device-lab/log-presets'

/* ──────────────────────────── Props ──────────────────────────────── */

interface InsightDrawerProps {
  event: LogEvent | null
  events: LogEvent[]
  onClose: () => void
}

/* ──────────────────────── Tab definitions ────────────────────────── */

const TABS = [
  { key: 'details' as const, label: 'Detaylar', icon: Info },
  { key: 'context' as const, label: 'Bağlam', icon: Layers },
  { key: 'related' as const, label: 'İlişkili', icon: Link2 },
  { key: 'investigation' as const, label: 'Araştırma', icon: Search },
]

type TabKey = (typeof TABS)[number]['key']

/* ──────────────────────── Helpers ────────────────────────────────── */

function fmtTimeFull(ts: string) {
  try {
    return new Date(ts).toLocaleString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    })
  } catch {
    return ts
  }
}

function fmtTimeShort(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return ts
  }
}

/* ──────────────────────── Main Component ─────────────────────────── */

export function InsightDrawer({ event, events, onClose }: InsightDrawerProps) {
  const [tab, setTab] = useState<TabKey>('details')

  /* ── Empty state ────────────────────────────────────────────────── */
  if (!event) {
    return (
      <motion.aside
        className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-8 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        <div className="flex size-11 items-center justify-center rounded-xl bg-muted">
          <Info className="size-5 text-muted-foreground" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground">
            Olay Seçilmedi
          </h4>
          <p className="mt-1 max-w-[200px] text-xs leading-relaxed text-muted-foreground">
            Timeline&apos;dan bir olay satırına tıklayarak detayları
            görüntüleyin.
          </p>
        </div>
      </motion.aside>
    )
  }

  const levelMeta = LOG_LEVEL_META[event.level]
  const sourceMeta = LOG_SOURCE_META[event.source]

  return (
    <motion.aside
      className="rounded-xl border bg-card overflow-hidden"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      key={event.id}
    >
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <Badge
          variant="secondary"
          appearance="outline"
          size="xs"
          className={cn('font-mono', toneIcon[levelMeta?.tone ?? 'gray'])}
        >
          {levelMeta?.shortLabel ?? 'I'}
        </Badge>
        <span className="flex-1 text-xs font-semibold text-foreground truncate">
          {event.tag}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="size-6"
          onClick={onClose}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 border-b bg-muted/20 px-3 py-1">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all',
                active
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-3" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ── Tab content ──────────────────────────────────────────── */}
      <ScrollArea className="h-[calc(100vh-340px)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="p-4"
          >
            {tab === 'details' && (
              <DetailsTab event={event} levelMeta={levelMeta} sourceMeta={sourceMeta} />
            )}
            {tab === 'context' && (
              <ContextTab event={event} events={events} />
            )}
            {tab === 'related' && (
              <RelatedTab event={event} events={events} />
            )}
            {tab === 'investigation' && (
              <InvestigationTab event={event} />
            )}
          </motion.div>
        </AnimatePresence>
      </ScrollArea>
    </motion.aside>
  )
}

/* ── Details Tab ─────────────────────────────────────────────────── */

function DetailsTab({
  event,
  levelMeta,
  sourceMeta,
}: {
  event: LogEvent
  levelMeta: (typeof LOG_LEVEL_META)[keyof typeof LOG_LEVEL_META] | undefined
  sourceMeta: (typeof LOG_SOURCE_META)[keyof typeof LOG_SOURCE_META] | undefined
}) {
  const [copied, setCopied] = useState(false)

  return (
    <div className="space-y-4">
      {/* Message */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Mesaj
        </label>
        <div className="relative mt-1 rounded-lg bg-muted/40 p-3">
          <pre className="font-mono text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-all">
            {event.message}
          </pre>
          <button
            onClick={() => {
              void navigator.clipboard?.writeText(event.message)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
            className="absolute right-2 top-2"
          >
            {copied ? (
              <Check className="size-3 text-green-600" />
            ) : (
              <Copy className="size-3 text-muted-foreground hover:text-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-2">
        <MetaItem label="Tag" value={event.tag} />
        <MetaItem label="Level">
          <Badge
            variant="secondary"
            appearance="outline"
            size="xs"
            className={cn(toneIcon[levelMeta?.tone ?? 'gray'])}
          >
            {levelMeta?.label ?? event.level}
          </Badge>
        </MetaItem>
        <MetaItem label="Source">
          <Badge variant="secondary" appearance="outline" size="xs">
            {sourceMeta?.label ?? event.source}
          </Badge>
        </MetaItem>
        <MetaItem label="Timestamp" value={fmtTimeFull(event.timestamp)} mono />
        <MetaItem label="Process ID" value={String(event.processId)} mono />
        <MetaItem label="Thread ID" value={String(event.threadId)} mono />
        <MetaItem label="Thread Name" value={event.threadName} mono />
        {event.correlationId && (
          <MetaItem label="Correlation ID" value={event.correlationId} mono />
        )}
        {event.shipmentId && (
          <MetaItem label="Shipment ID" value={event.shipmentId} mono />
        )}
        {event.requestId && (
          <MetaItem label="Request ID" value={event.requestId} mono />
        )}
        {event.fiscalId && (
          <MetaItem label="Fiscal ID" value={event.fiscalId} mono />
        )}
      </div>

      {/* Stack trace */}
      {event.stackTrace && (
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Stack Trace
          </label>
          <div className="mt-1">
            <CodeBlock
              code={event.stackTrace}
              label="stacktrace"
              labelTone="red"
              lineNumbers
            />
          </div>
        </div>
      )}

      {/* Raw log line */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Raw Log
        </label>
        <div className="mt-1 rounded-lg bg-muted/30 p-2">
          <pre className="font-mono text-[10px] leading-relaxed text-foreground/60 whitespace-pre-wrap break-all">
            {event.raw}
          </pre>
        </div>
      </div>
    </div>
  )
}

/* ── Context Tab ─────────────────────────────────────────────────── */

function ContextTab({
  event,
  events,
}: {
  event: LogEvent
  events: LogEvent[]
}) {
  const idx = events.findIndex((e) => e.id === event.id)
  const prevEvents = events.slice(Math.max(0, idx - 10), idx)
  const nextEvents = events.slice(idx + 1, idx + 11)

  // Same correlation ID events
  const correlatedEvents = useMemo(() => {
    if (!event.correlationId) return []
    return events.filter(
      (e) => e.correlationId === event.correlationId && e.id !== event.id,
    )
  }, [event, events])

  // Same shipment events
  const shipmentEvents = useMemo(() => {
    if (!event.shipmentId) return []
    return events.filter(
      (e) => e.shipmentId === event.shipmentId && e.id !== event.id,
    )
  }, [event, events])

  return (
    <div className="space-y-4">
      {/* Previous events */}
      <ContextGroup
        title={`Önceki ${prevEvents.length} Olay`}
        events={prevEvents}
        emptyText="Öncesinde olay yok."
      />

      {/* Next events */}
      <ContextGroup
        title={`Sonraki ${nextEvents.length} Olay`}
        events={nextEvents}
        emptyText="Sonrasında olay yok."
      />

      {/* Correlated */}
      {event.correlationId && (
        <>
          <Separator />
          <ContextGroup
            title={`Correlation: ${event.correlationId}`}
            events={correlatedEvents}
            emptyText="Aynı correlation ID ile olay bulunamadı."
          />
        </>
      )}

      {/* Same shipment */}
      {event.shipmentId && (
        <>
          <Separator />
          <ContextGroup
            title={`Shipment: ${event.shipmentId}`}
            events={shipmentEvents.slice(0, 20)}
            emptyText="Aynı shipment ID ile olay bulunamadı."
          />
        </>
      )}
    </div>
  )
}

function ContextGroup({
  title,
  events,
  emptyText,
}: {
  title: string
  events: LogEvent[]
  emptyText: string
}) {
  return (
    <div>
      <h4 className="text-[11px] font-semibold text-foreground/80 mb-1.5">
        {title}
      </h4>
      {events.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="space-y-0.5">
          {events.map((e) => (
            <CompactEventRow key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Related Tab ─────────────────────────────────────────────────── */

function RelatedTab({
  event,
  events,
}: {
  event: LogEvent
  events: LogEvent[]
}) {
  const groupedRelated = useMemo(() => {
    const groups: Record<string, LogEvent[]> = {}
    const relSources = ['network', 'offline-queue', 'fiscal', 'payment', 'room'] as const

    relSources.forEach((source) => {
      const sourceEvents = events.filter(
        (e) =>
          e.source === source &&
          e.id !== event.id &&
          (e.shipmentId === event.shipmentId ||
            e.correlationId === event.correlationId ||
            e.requestId === event.requestId),
      )
      if (sourceEvents.length > 0) {
        const label = LOG_SOURCE_META[source]?.label ?? source
        groups[label] = sourceEvents.slice(0, 10)
      }
    })

    return groups
  }, [event, events])

  const hasRelated = Object.keys(groupedRelated).length > 0

  return (
    <div className="space-y-4">
      {!hasRelated && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Link2 className="size-5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Bu olayla ilişkili başka olay bulunamadı.
          </p>
        </div>
      )}

      {Object.entries(groupedRelated).map(([label, evts]) => (
        <div key={label}>
          <h4 className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground/80 mb-1.5">
            <ChevronRight className="size-3" />
            {label}
            <Badge variant="secondary" appearance="outline" size="xs">
              {evts.length}
            </Badge>
          </h4>
          <div className="space-y-0.5">
            {evts.map((e) => (
              <CompactEventRow key={e.id} event={e} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Investigation Tab ───────────────────────────────────────────── */

function InvestigationTab({ event }: { event: LogEvent }) {
  return (
    <div className="space-y-3">
      {/* External links */}
      <div>
        <h4 className="text-[11px] font-semibold text-foreground/80 mb-2">
          Harici Araçlar
        </h4>
        <div className="space-y-1.5">
          <InvestigationLink
            icon={Terminal}
            label="Graylog'da Aç"
            description={`"${event.tag}" tag filtreleri ile Graylog sorgusunu aç`}
            href="#"
          />
          <InvestigationLink
            icon={Database}
            label="Data Locator'da Bul"
            description={
              event.shipmentId
                ? `${event.shipmentId} için Data Locator sorgusunu oluştur`
                : 'İlgili veri noktalarını bul'
            }
            href="#"
          />
          <InvestigationLink
            icon={FileCode}
            label="MongoDB Query Generator'da Ara"
            description="Bu olay için MongoDB sorgusu oluştur"
            href="#"
          />
        </div>
      </div>

      <Separator />

      {/* Action buttons */}
      <div>
        <h4 className="text-[11px] font-semibold text-foreground/80 mb-2">
          Aksiyonlar
        </h4>
        <div className="space-y-1.5">
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-start gap-2 text-xs"
          >
            <Ticket className="size-3.5 text-blue-500" />
            {"Ticket'a Ekle"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-start gap-2 text-xs"
          >
            <Siren className="size-3.5 text-red-500" />
            {"Incident'e Ekle"}
          </Button>
        </div>
      </div>

      <Separator />

      {/* Event identifiers for copy */}
      <div>
        <h4 className="text-[11px] font-semibold text-foreground/80 mb-2">
          Olay Kimlikleri
        </h4>
        <div className="space-y-1">
          <CopyableField label="Event ID" value={event.id} />
          {event.correlationId && (
            <CopyableField
              label="Correlation ID"
              value={event.correlationId}
            />
          )}
          {event.shipmentId && (
            <CopyableField label="Shipment ID" value={event.shipmentId} />
          )}
          {event.requestId && (
            <CopyableField label="Request ID" value={event.requestId} />
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Shared sub-components ───────────────────────────────────────── */

function MetaItem({
  label,
  value,
  mono,
  children,
}: {
  label: string
  value?: string
  mono?: boolean
  children?: React.ReactNode
}) {
  return (
    <div>
      <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children ?? (
        <p
          className={cn(
            'mt-0.5 text-[11px] text-foreground/80 break-all',
            mono && 'font-mono',
          )}
        >
          {value}
        </p>
      )}
    </div>
  )
}

function CompactEventRow({ event }: { event: LogEvent }) {
  const levelMeta = LOG_LEVEL_META[event.level]
  const sourceMeta = LOG_SOURCE_META[event.source]
  return (
    <div className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] hover:bg-muted/40 transition-colors cursor-pointer">
      <span className="w-16 shrink-0 font-mono text-muted-foreground">
        {fmtTimeShort(event.timestamp)}
      </span>
      <span
        className={cn(
          'shrink-0 text-[9px] font-bold',
          toneIcon[levelMeta?.tone ?? 'gray'],
        )}
      >
        {levelMeta?.shortLabel ?? '?'}
      </span>
      <span className="w-14 shrink-0 truncate text-muted-foreground">
        {sourceMeta?.label ?? event.source}
      </span>
      <span className="flex-1 min-w-0 truncate text-foreground/70">
        {event.message}
      </span>
    </div>
  )
}

function InvestigationLink({
  icon: Icon,
  label,
  description,
  href,
}: {
  icon: LucideIcon
  label: string
  description: string
  href: string
}) {
  return (
    <a
      href={href}
      className="flex items-start gap-2.5 rounded-lg border bg-muted/20 p-2.5 transition-colors hover:bg-muted/40"
    >
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-xs font-semibold text-foreground">
          {label}
          <ExternalLink className="size-3 text-muted-foreground" />
        </p>
        <p className="text-[10px] text-muted-foreground leading-snug">
          {description}
        </p>
      </div>
    </a>
  )
}

function CopyableField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/30 px-2.5 py-1.5">
      <span className="text-[10px] text-muted-foreground w-24 shrink-0">
        {label}
      </span>
      <span className="flex-1 min-w-0 truncate font-mono text-[10px] text-foreground/80">
        {value}
      </span>
      <button
        onClick={() => {
          void navigator.clipboard?.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
      >
        {copied ? (
          <Check className="size-3 text-green-600" />
        ) : (
          <Copy className="size-3 text-muted-foreground hover:text-foreground" />
        )}
      </button>
    </div>
  )
}
