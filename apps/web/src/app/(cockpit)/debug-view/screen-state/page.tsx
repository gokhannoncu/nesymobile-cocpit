'use client'

// Debug View — Live Screen State
// Which fragment is on the device screen *right now* plus its opt-in in-memory
// debug state. Fragment-owned fields are polled over ADB and compared with the
// prior snapshot to build a near-real-time state-change timeline.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Braces,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  LayoutDashboard,
  Loader2,
  Navigation,
  Pause,
  Play,
  RefreshCw,
  ScrollText,
  Search,
  Server,
  Smartphone,
  SquareStack,
  Zap,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { Input } from '@nesy/metronic/components/ui/input'
import {
  ProductPage,
  PageSection,
  EASE,
  toneCard,
  toneDot,
  toneIcon,
  toneIconBox,
  toneText,
  type Tone,
} from '@/components/product'
import { DebugHeader, DebugCrossLinks, InfoRow, TonePill, NoDeviceState } from '@/components/debug-view/shared'
import { useDebugView } from '@/components/debug-view/debug-context'
import { CATEGORY_META, fragmentMeta } from '@/data/debug-view/fragment-registry'
import {
  diffCurrentScreenFields,
  type ScreenStateChange,
  type ScreenStateChangeKind,
} from '@/data/debug-view/screen-state-diff'
import type { FragmentLifecycle, LiveScreenField, LiveScreenState } from '@/data/debug-view/live-types'

const POLL_MS = 1_000
const MAX_HISTORY = 12
const MAX_STATE_CHANGES = 60

/** Nesy Mobile / Debug View brand accent — matches overview, network, interactions pages. */
const PAGE_TONE = 'orange' as const satisfies Tone

const LIFECYCLE_HINT: Record<FragmentLifecycle, string> = {
  RESUMED: 'Visible and interactive',
  STARTED: 'Started, not fully visible',
  VIEW_CREATED: 'View created, not started',
  CREATED: 'Created, view not ready',
  ATTACHED: 'Attached to activity',
  INITIALIZING: 'Still initializing',
  UNKNOWN: 'Lifecycle unknown',
}

const MSTATE_LABELS: Record<number, string> = {
  0: 'INITIALIZING',
  1: 'CREATED',
  2: 'ACTIVITY_CREATED',
  3: 'STOPPED',
  4: 'STARTED',
  5: 'VIEW_CREATED',
  6: 'AWAITING_EXIT_EFFECT',
  7: 'RESUMED',
}

const LIFECYCLE_TONE: Record<FragmentLifecycle, Tone> = {
  RESUMED: 'green',
  STARTED: 'teal',
  VIEW_CREATED: 'blue',
  CREATED: 'indigo',
  ATTACHED: 'amber',
  INITIALIZING: 'gray',
  UNKNOWN: 'gray',
}

interface LiveStateChange extends ScreenStateChange {
  id: string
  timestamp: number
  screenWho: string
  screenClass: string
}

interface HistoryEntry {
  who: string
  className: string
  enteredAt: number
  leftAt: number | null
}

const STATE_CHANGE_META: Record<ScreenStateChangeKind, { label: string; tone: Tone }> = {
  added: { label: 'added', tone: 'green' },
  changed: { label: 'changed', tone: 'amber' },
  removed: { label: 'removed', tone: 'red' },
}

const SERVICE_META: Record<string, { label: string; hint: string; tone: Tone }> = {
  LocationService: { label: 'Location', hint: 'GPS tracking & geofence', tone: 'teal' },
  RequestSenderService: { label: 'Request sender', hint: 'Outbound API queue', tone: 'blue' },
  OfflineModeOldService: { label: 'Offline mode', hint: 'Legacy offline sync', tone: 'amber' },
  SessionLifecycleService: { label: 'Session', hint: 'Login & session lifecycle', tone: 'indigo' },
}

function serviceMeta(name: string): { label: string; hint: string; tone: Tone } {
  if (SERVICE_META[name]) return SERVICE_META[name]
  const label = name.endsWith('Service') ? name.slice(0, -'Service'.length) : name
  return { label, hint: 'Background service', tone: 'gray' }
}

// ---------------------------------------------------------------------------
// Live polling + current-screen state diff derivation
// ---------------------------------------------------------------------------

interface LiveState {
  snapshot: LiveScreenState | null
  history: HistoryEntry[]
  changes: LiveStateChange[]
  loading: boolean
  error: string | null
}

function useScreenStatePolling(serial: string | null, paused: boolean) {
  const [state, setState] = useState<LiveState>({
    snapshot: null,
    history: [],
    changes: [],
    loading: false,
    error: null,
  })
  // Refs survive re-renders so transitions are computed against the true prior snapshot.
  const prevRef = useRef<LiveScreenState | null>(null)
  const seqRef = useRef(0)
  const inFlightRef = useRef(false)

  const apply = useCallback((snapshot: LiveScreenState) => {
    // Diff against the previous snapshot outside setState. React invokes state
    // updaters twice under StrictMode, so the updater itself must remain pure.
    const prevSnap = prevRef.current
    prevRef.current = snapshot
    const prevCur = prevSnap?.current ?? null
    const cur = snapshot.current
    const sameScreen = Boolean(cur && prevCur && cur.who === prevCur.who)
    const capturedAt = Date.parse(snapshot.capturedAt)
    const now = Number.isFinite(capturedAt) ? capturedAt : Date.now()
    const detectedChanges: LiveStateChange[] =
      sameScreen && cur && prevSnap?.stateInstrumented && snapshot.stateInstrumented
        ? diffCurrentScreenFields(prevSnap.fields, snapshot.fields).map((change) => ({
            ...change,
            id: `state-${seqRef.current++}`,
            timestamp: now,
            screenWho: cur.who,
            screenClass: cur.className,
          }))
        : []
    const navigated = Boolean(cur && cur.who !== prevCur?.who)

    setState((prev) => {
      // History: close the open entry and push the new screen on navigation.
      let history = prev.history
      if (navigated && cur) {
        history = history.map((h) => (h.leftAt == null ? { ...h, leftAt: now } : h))
        history = [
          ...history,
          { who: cur.who, className: cur.className, enteredAt: now, leftAt: null },
        ].slice(-MAX_HISTORY)
      }
      return {
        snapshot,
        history,
        changes: !sameScreen
          ? []
          : detectedChanges.length
            ? [...prev.changes, ...detectedChanges].slice(-MAX_STATE_CHANGES)
            : prev.changes,
        loading: false,
        error: null,
      }
    })
  }, [])

  const load = useCallback(
    (showSpinner: boolean) => {
      if (!serial || inFlightRef.current) return
      inFlightRef.current = true
      if (showSpinner) setState((p) => ({ ...p, loading: true }))
      fetch(`/api/adb/screen?serial=${encodeURIComponent(serial)}`)
        .then(async (r) => {
          const body = (await r.json()) as LiveScreenState & { error?: string }
          if (!r.ok || body.error) throw new Error(body.error ?? `HTTP ${r.status}`)
          apply(body)
        })
        .catch((err: unknown) => {
          setState((p) => ({
            ...p,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to read screen state',
          }))
        })
        .finally(() => {
          inFlightRef.current = false
        })
    },
    [serial, apply],
  )

  // Reset accumulated history/state changes when the device changes.
  useEffect(() => {
    prevRef.current = null
    inFlightRef.current = false
    setState({ snapshot: null, history: [], changes: [], loading: Boolean(serial), error: null })
  }, [serial])

  useEffect(() => {
    if (!serial || paused) return
    load(true)
    const id = setInterval(() => load(false), POLL_MS)
    return () => clearInterval(id)
  }, [serial, paused, load])

  return { ...state, reload: () => load(true) }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ScreenStatePage() {
  const { selectedDevice } = useDebugView()
  const [paused, setPaused] = useState(false)
  const serial = selectedDevice?.serial ?? null
  const { snapshot, history, changes, loading, error, reload } = useScreenStatePolling(serial, paused)

  return (
    <ProductPage path="/debug-view/screen-state">
      <DebugHeader
        icon={LayoutDashboard}
        title="Live Screen State"
        lead="Active fragment and its in-memory state, sampled every second while this page is open."
        tone={PAGE_TONE}
        badges={[
          { label: 'Active fragment', tone: PAGE_TONE },
          { label: 'In-memory state', tone: PAGE_TONE },
          { label: '1s live polling', tone: paused || !serial ? 'gray' : PAGE_TONE },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={paused ? 'outline' : 'primary'} onClick={() => setPaused((p) => !p)} disabled={!serial}>
              {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
              {paused ? 'Resume' : 'Pause'}
            </Button>
            <Button size="sm" variant="outline" onClick={reload} disabled={!serial || loading}>
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Refresh
            </Button>
            <div className="hidden h-6 w-px bg-border sm:block" aria-hidden />
            <DebugCrossLinks currentPath="/debug-view/screen-state" />
          </div>
        }
      />

      {!selectedDevice ? (
        <NoDeviceState />
      ) : loading && !snapshot ? (
        <ScreenShimmer />
      ) : error && !snapshot ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !snapshot ? (
        <NoDeviceState />
      ) : (
        <div className="space-y-4">
          <ActiveScreenCard snapshot={snapshot} paused={paused} />

          {!snapshot.appForeground || !snapshot.current ? (
            <BackgroundNotice snapshot={snapshot} />
          ) : null}

          <StateFields snapshot={snapshot} />

          <RunningServices snapshot={snapshot} />

          {snapshot.fragments.length > 0 ? <FragmentStack snapshot={snapshot} /> : null}
          {history.length > 0 ? <ScreenHistoryStrip history={history} currentWho={snapshot.current?.who} /> : null}

          <StateChangeLog changes={changes} snapshot={snapshot} paused={paused} />
        </div>
      )}
    </ProductPage>
  )
}

// ---------------------------------------------------------------------------
// Active screen card
// ---------------------------------------------------------------------------

function shortenId(id: string, head = 8, tail = 4): string {
  if (id.length <= head + tail + 1) return id
  return `${id.slice(0, head)}…${id.slice(-tail)}`
}

function CopyMono({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/30 px-1.5 py-0.5 font-mono text-[11px] text-foreground transition-colors hover:bg-muted/60"
      onClick={() => {
        void navigator.clipboard?.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      title={value}
    >
      {shortenId(value)}
      {copied ? <Check className="size-3 text-green-600" /> : <Copy className="size-3 text-muted-foreground" />}
    </button>
  )
}

function ActiveScreenCard({ snapshot, paused }: { snapshot: LiveScreenState; paused: boolean }) {
  const cur = snapshot.current
  const meta = cur ? fragmentMeta(cur.className) : null
  const category = meta ? CATEGORY_META[meta.category] : null
  const tone: Tone = category?.tone ?? 'gray'
  const lifecycleTone = cur ? LIFECYCLE_TONE[cur.lifecycle] : 'gray'
  const destinations = snapshot.fragments.filter((f) => !f.isDialog)
  const stackPosition = cur ? destinations.findIndex((f) => f.who === cur.who) + 1 : 0
  const mStateLabel = cur ? MSTATE_LABELS[cur.stateCode] : null
  const capturedAt = new Date(snapshot.capturedAt)
  const ageSec = Math.max(0, Math.round((Date.now() - capturedAt.getTime()) / 1000))
  const isLive = !paused && snapshot.appForeground && ageSec < 3

  return (
    <motion.section
      className={cn('overflow-hidden rounded-2xl border shadow-sm', toneCard[tone])}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-background/50 px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {cur ? (
            <Badge variant={cur.lifecycle === 'RESUMED' ? 'success' : 'secondary'} appearance="light" size="md" className="gap-1.5">
              {cur.lifecycle === 'RESUMED' && isLive ? (
                <span className="size-1.5 rounded-full bg-current animate-pulse" />
              ) : null}
              {cur.lifecycle}
            </Badge>
          ) : null}
          <Badge variant={snapshot.appForeground ? 'success' : 'warning'} appearance="light" size="sm">
            {snapshot.appForeground ? 'Foreground' : 'Background'}
          </Badge>
          {snapshot.stateInstrumented && snapshot.fields.length > 0 ? (
            <Badge variant="secondary" appearance="outline" size="xs" className={toneText[PAGE_TONE]}>
              {snapshot.fields.length} state field{snapshot.fields.length === 1 ? '' : 's'}
            </Badge>
          ) : null}
        </div>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {isLive ? (
            <span className="inline-flex items-center gap-1 font-medium text-orange-700 dark:text-orange-400">
              <span className="size-1.5 animate-pulse rounded-full bg-orange-500" />
              Live
            </span>
          ) : paused ? (
            <span className="font-medium text-amber-700 dark:text-amber-400">Paused</span>
          ) : (
            <span>Last sample</span>
          )}
          <Clock className="size-3 opacity-60" />
          {capturedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
          {!paused && ageSec > 0 ? <span className="text-muted-foreground/70">· {ageSec}s ago</span> : null}
        </span>
      </div>

      <div className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-xl', toneIconBox[tone])}>
            <Smartphone className={cn('size-6', toneIcon[tone])} />
          </span>
          <div className="min-w-0 flex-1">
            <div className={cn('text-[11px] font-bold uppercase tracking-wider', toneText[tone])}>
              Active screen
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold text-foreground">
                {meta?.label ?? 'No fragment on screen'}
              </h2>
              {category ? <TonePill label={category.label} tone={tone} /> : null}
              {cur?.isDialog ? <TonePill label="Dialog" tone="purple" /> : null}
            </div>
            {cur ? (
              <p className="mt-1 text-xs text-muted-foreground">{LIFECYCLE_HINT[cur.lifecycle]}</p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                {snapshot.reason ?? 'Waiting for a fragment to become active'}
              </p>
            )}
          </div>
        </div>

        {cur ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-background/70 px-4 py-3">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Framework identity
              </div>
              <div className="divide-y divide-border/50">
                <InfoRow label="Fragment" value={<code className="font-mono text-[11px]">{cur.className}</code>} />
                <InfoRow label="Activity" value={snapshot.activityName ?? '—'} mono />
                <InfoRow label="Nav host" value={snapshot.navHostId ?? '—'} mono />
                <InfoRow
                  label="Fragment ID"
                  value={cur.tag ? <CopyMono value={cur.tag} /> : <CopyMono value={cur.who} />}
                />
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/70 px-4 py-3">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Runtime state
              </div>
              <div className="divide-y divide-border/50">
                <InfoRow
                  label="Lifecycle"
                  value={
                    <span className={cn('font-semibold', toneText[lifecycleTone])}>
                      {cur.lifecycle}
                    </span>
                  }
                />
                <InfoRow
                  label="mState"
                  value={
                    <span className="font-mono text-[11px]">
                      {cur.stateCode}
                      {mStateLabel ? (
                        <span className={cn('ms-1.5 font-sans font-medium', toneText[lifecycleTone])}>
                          · {mStateLabel}
                        </span>
                      ) : null}
                    </span>
                  }
                />
                {destinations.length > 0 ? (
                  <InfoRow
                    label="Back stack"
                    value={
                      stackPosition > 0
                        ? `Position ${stackPosition} of ${destinations.length}`
                        : `${destinations.length} destination${destinations.length === 1 ? '' : 's'}`
                    }
                  />
                ) : null}
                {snapshot.packageName ? (
                  <InfoRow label="Package" value={snapshot.packageName} mono />
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {snapshot.overlay ? (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-purple-300/50 bg-purple-50/80 px-4 py-3 dark:border-purple-900/50 dark:bg-purple-950/30">
            <SquareStack className="mt-0.5 size-4 shrink-0 text-purple-600 dark:text-purple-400" />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-purple-900 dark:text-purple-100">
                Overlay on top · {fragmentMeta(snapshot.overlay.className).label}
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-purple-800/80 dark:text-purple-200/80">
                {snapshot.overlay.className}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </motion.section>
  )
}

function BackgroundNotice({ snapshot }: { snapshot: LiveScreenState }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800/50 dark:bg-amber-950/30">
      <Pause className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="text-amber-800 dark:text-amber-200">
        {snapshot.reason ??
          'NesyMobile is not in the foreground. Open the app on the device to see its live screen — polling continues automatically.'}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Screen memory — live in-memory state fields (from the app debug dump hook)
// ---------------------------------------------------------------------------

const FIELD_GROUP_META: Record<LiveScreenField['group'], { label: string; tone: Tone }> = {
  screen: { label: 'This screen (fragment)', tone: PAGE_TONE },
  shared: { label: 'SharedViewModel (activity-scoped)', tone: 'blue' },
}

const KIND_TONE: Record<LiveScreenField['kind'], Tone> = {
  string: 'teal',
  number: 'amber',
  boolean: 'green',
  null: 'gray',
  object: 'purple',
  array: 'indigo',
}

function stateValueText(value: unknown, maxLength = 220): string {
  let text: string
  if (value === undefined) return '—'
  if (value === null) return 'null'
  if (typeof value === 'string') text = value
  else {
    try {
      text = JSON.stringify(value)
    } catch {
      text = String(value)
    }
  }
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function isDefaultFieldValue(field: LiveScreenField): boolean {
  const { value, kind, count } = field
  if (value === null || value === undefined) return true
  if (kind === 'boolean' && value === false) return true
  if (kind === 'number' && value === 0) return true
  if (kind === 'string' && value === '') return true
  if ((kind === 'array' || kind === 'object') && (count === 0 || count == null)) {
    if (Array.isArray(value) && value.length === 0) return true
    if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
      return true
    }
  }
  return false
}

function fieldKey(field: LiveScreenField): string {
  return `${field.group}:${field.name}`
}

function StateFieldFilterChip({
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
        active
          ? cn(toneCard[tone], toneText[tone], 'border-current/30')
          : 'border-border bg-card text-muted-foreground hover:bg-muted/50',
      )}
    >
      {label}
      <span className={cn('rounded px-1 text-[10px]', active ? 'bg-background/60' : 'bg-muted')}>{count}</span>
    </button>
  )
}

function StateFieldValue({
  field,
  expanded,
  onToggle,
}: {
  field: LiveScreenField
  expanded: boolean
  onToggle: () => void
}) {
  const [copied, setCopied] = useState(false)
  const isDefault = isDefaultFieldValue(field)
  const isExpandable = field.kind === 'object' || field.kind === 'array'
  const fullText = stateValueText(field.value, Number.POSITIVE_INFINITY)

  const copyValue = () => {
    void navigator.clipboard?.writeText(isExpandable ? prettyJson(field.value) : fullText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (field.kind === 'boolean') {
    return (
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          appearance="light"
          size="xs"
          className={cn(
            'font-mono',
            field.value === true
              ? 'bg-green-500/10 text-green-700 dark:text-green-300'
              : 'bg-muted/60 text-muted-foreground',
          )}
        >
          {String(field.value)}
        </Badge>
        <button type="button" onClick={copyValue} className="text-muted-foreground hover:text-foreground">
          {copied ? <Check className="size-3 text-green-600" /> : <Copy className="size-3" />}
        </button>
      </div>
    )
  }

  if (field.kind === 'null') {
    return <span className="font-mono text-[11px] italic text-muted-foreground/70">null</span>
  }

  if (isExpandable) {
    const preview =
      field.kind === 'array'
        ? `[]${field.count != null ? ` · ${field.count} items` : ''}`
        : `{}${field.count != null ? ` · ${field.count} keys` : ''}`

    return (
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors',
              isDefault
                ? 'border-border/60 bg-muted/20 text-muted-foreground'
                : cn(toneCard[KIND_TONE[field.kind]], toneText[KIND_TONE[field.kind]], 'border-current/20'),
            )}
          >
            {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            {preview}
          </button>
          <button type="button" onClick={copyValue} className="text-muted-foreground hover:text-foreground">
            {copied ? <Check className="size-3 text-green-600" /> : <Copy className="size-3" />}
          </button>
        </div>
        {expanded ? (
          <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-border/60 bg-muted/25 p-2.5 font-mono text-[10px] leading-relaxed text-foreground/90">
            {prettyJson(field.value)}
          </pre>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <code
        className={cn(
          'truncate text-[11px] font-medium',
          isDefault ? 'text-muted-foreground/70' : 'text-foreground',
          field.kind === 'string' && !isDefault && toneText.teal,
          field.kind === 'number' && !isDefault && toneText.amber,
        )}
        title={fullText}
      >
        {stateValueText(field.value)}
      </code>
      <button type="button" onClick={copyValue} className="shrink-0 text-muted-foreground hover:text-foreground">
        {copied ? <Check className="size-3 text-green-600" /> : <Copy className="size-3" />}
      </button>
    </div>
  )
}

function StateFieldGroup({
  group,
  fields,
  query,
  hideDefaults,
  expandedFields,
  onToggleField,
  collapsed,
  onToggleGroup,
}: {
  group: LiveScreenField['group']
  fields: LiveScreenField[]
  query: string
  hideDefaults: boolean
  expandedFields: Set<string>
  onToggleField: (key: string) => void
  collapsed: boolean
  onToggleGroup: () => void
}) {
  const meta = FIELD_GROUP_META[group]
  const q = query.trim().toLowerCase()

  const visible = useMemo(() => {
    return fields.filter((field) => {
      if (hideDefaults && isDefaultFieldValue(field)) return false
      if (!q) return true
      return (
        field.name.toLowerCase().includes(q) ||
        field.kind.toLowerCase().includes(q) ||
        stateValueText(field.value, Number.POSITIVE_INFINITY).toLowerCase().includes(q)
      )
    })
  }, [fields, hideDefaults, q])

  const activeCount = fields.filter((f) => !isDefaultFieldValue(f)).length

  if (fields.length === 0) return null

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={onToggleGroup}
        className={cn(
          'flex w-full items-center justify-between gap-3 border-b border-border/80 px-4 py-3 text-left transition-colors hover:bg-muted/20',
          group === 'screen' ? 'bg-orange-50/50 dark:bg-orange-950/15' : 'bg-blue-50/50 dark:bg-blue-950/15',
        )}
      >
        <div className="flex items-center gap-2.5">
          <span className={cn('flex size-8 items-center justify-center rounded-lg', toneIconBox[meta.tone])}>
            <Braces className={cn('size-4', toneIcon[meta.tone])} />
          </span>
          <div>
            <div className="text-sm font-semibold text-foreground">{meta.label}</div>
            <p className="text-[11px] text-muted-foreground">
              {fields.length} field{fields.length === 1 ? '' : 's'} · {activeCount} with values
              {q || hideDefaults ? ` · ${visible.length} shown` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TonePill label={meta.label} tone={meta.tone} />
          <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', collapsed && '-rotate-90')} />
        </div>
      </button>

      {!collapsed ? (
        visible.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No fields match the current filter.
          </p>
        ) : (
          <div>
            <div className="hidden border-b border-border/50 bg-muted/25 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:grid lg:grid-cols-[minmax(0,1.1fr)_88px_minmax(0,1.4fr)] lg:gap-4">
              <span>Field</span>
              <span>Type</span>
              <span>Value</span>
            </div>
            <div className="divide-y divide-border/50">
            {visible.map((field) => {
              const key = fieldKey(field)
              const isDefault = isDefaultFieldValue(field)
              return (
                <div
                  key={key}
                  className={cn(
                    'grid gap-2 px-4 py-2.5 transition-colors hover:bg-muted/20 lg:grid-cols-[minmax(0,1.1fr)_88px_minmax(0,1.4fr)] lg:items-center lg:gap-4',
                    isDefault && 'opacity-75',
                  )}
                >
                  <div className="min-w-0">
                    <code className="text-[11px] font-semibold text-foreground">{field.name}</code>
                  </div>
                  <div>
                    <TonePill label={field.kind} tone={KIND_TONE[field.kind]} />
                  </div>
                  <div className="min-w-0">
                    <StateFieldValue
                      field={field}
                      expanded={expandedFields.has(key)}
                      onToggle={() => onToggleField(key)}
                    />
                  </div>
                </div>
              )
            })}
            </div>
          </div>
        )
      ) : null}
    </div>
  )
}

function StateFields({ snapshot }: { snapshot: LiveScreenState }) {
  const groups: LiveScreenField['group'][] = ['screen', 'shared']
  const [query, setQuery] = useState('')
  const [hideDefaults, setHideDefaults] = useState(false)
  const [expandedFields, setExpandedFields] = useState<Set<string>>(() => new Set())
  const [collapsedGroups, setCollapsedGroups] = useState<Set<LiveScreenField['group']>>(() => new Set())

  const totalFields = snapshot.fields.length
  const activeFields = snapshot.fields.filter((f) => !isDefaultFieldValue(f)).length
  const screenFields = snapshot.fields.filter((f) => f.group === 'screen').length
  const sharedFields = snapshot.fields.filter((f) => f.group === 'shared').length

  const toggleField = (key: string) => {
    setExpandedFields((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleGroup = (group: LiveScreenField['group']) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  return (
    <PageSection
      eyebrow="Screen memory"
      title="State Fields"
      description="Live in-memory ViewModel / fragment state for the current screen, read from the app's debug dump hook."
      icon={Braces}
      tone={PAGE_TONE}
    >
      {!snapshot.stateInstrumented ? (
        <div className="flex items-start gap-3 rounded-xl border border-blue-300/60 bg-blue-50 px-4 py-3 text-sm dark:border-blue-900/50 dark:bg-blue-950/30">
          <Braces className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-blue-800 dark:text-blue-200">
            The installed build does not expose the debug state hook yet. Install a{' '}
            <code className="rounded bg-blue-100 px-1 py-0.5 text-[11px] dark:bg-blue-900/50">tstDebug</code>{' '}
            build that includes the <code className="rounded bg-blue-100 px-1 py-0.5 text-[11px] dark:bg-blue-900/50">--nesy-state</code>{' '}
            dump hook to see live in-memory field values here. Fragment, lifecycle, controls and services above are already live.
          </p>
        </div>
      ) : snapshot.fields.length === 0 ? (
        <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          Instrumented build detected, but this screen exposes no state fields yet.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by field name, type or value…"
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StateFieldFilterChip
                  label="All"
                  active={!hideDefaults}
                  onClick={() => setHideDefaults(false)}
                  count={totalFields}
                  tone={PAGE_TONE}
                />
                <StateFieldFilterChip
                  label="With values"
                  active={hideDefaults}
                  onClick={() => setHideDefaults(true)}
                  count={activeFields}
                  tone="green"
                />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
              <Badge variant="secondary" appearance="outline" size="xs" className={toneText[PAGE_TONE]}>
                {screenFields} fragment
              </Badge>
              <Badge variant="secondary" appearance="outline" size="xs" className={toneText.blue}>
                {sharedFields} shared
              </Badge>
              <span>
                Defaults = <code className="text-foreground">null</code>, <code className="text-foreground">false</code>,{' '}
                <code className="text-foreground">0</code>, empty string or empty collection
              </span>
            </div>
          </div>

          {groups.map((group) => (
            <StateFieldGroup
              key={group}
              group={group}
              fields={snapshot.fields.filter((f) => f.group === group)}
              query={query}
              hideDefaults={hideDefaults}
              expandedFields={expandedFields}
              onToggleField={toggleField}
              collapsed={collapsedGroups.has(group)}
              onToggleGroup={() => toggleGroup(group)}
            />
          ))}
        </div>
      )}
    </PageSection>
  )
}

function RunningServices({ snapshot }: { snapshot: LiveScreenState }) {
  const services = snapshot.runningServices

  return (
    <PageSection
      eyebrow="Background work"
      title="Running Services"
      description="NesyMobile services currently alive in the app process."
      icon={Server}
      tone="green"
    >
      {services.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/15 px-4 py-8 text-center">
          <Server className="size-7 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No NesyMobile services running.</p>
        </div>
      ) : (
        <motion.div
          className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border/80 bg-green-50/50 px-4 py-2.5 dark:bg-green-950/15">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-40" />
                <span className="relative inline-flex size-2 rounded-full bg-green-500" />
              </span>
              <span className="text-xs font-semibold text-foreground">
                {services.length} service{services.length === 1 ? '' : 's'} alive
              </span>
            </div>
            <Badge variant="success" appearance="light" size="xs">
              Process healthy
            </Badge>
          </div>
          <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
            {services.map((name) => {
              const meta = serviceMeta(name)
              return (
                <div
                  key={name}
                  className={cn(
                    'flex items-start gap-2.5 rounded-lg border px-2.5 py-2 transition-colors hover:bg-muted/20',
                    toneCard[meta.tone],
                  )}
                >
                  <span className={cn('mt-1 size-2 shrink-0 rounded-full', toneDot[meta.tone])} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground">{meta.label}</span>
                      <code className="truncate font-mono text-[9px] text-muted-foreground">{name}</code>
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{meta.hint}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}
    </PageSection>
  )
}

// ---------------------------------------------------------------------------
// Fragment stack
// ---------------------------------------------------------------------------

function FragmentStack({ snapshot }: { snapshot: LiveScreenState }) {
  const destinations = [...snapshot.fragments.filter((f) => !f.isDialog)].sort((a, b) => b.order - a.order)
  const dialogs = snapshot.fragments.filter((f) => f.isDialog)

  return (
    <PageSection
      eyebrow="Fragment manager"
      title="Fragment Stack"
      description="Nav destinations in back-stack order — top row is what the user sees right now."
      icon={SquareStack}
      tone={PAGE_TONE}
    >
      <motion.div
        className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-orange-50/40 px-4 py-2.5 dark:bg-orange-950/15">
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{destinations.length}</span> destination
            {destinations.length === 1 ? '' : 's'}
            {dialogs.length > 0 ? (
              <>
                {' '}
                · <span className="font-semibold text-foreground">{dialogs.length}</span> dialog
                {dialogs.length === 1 ? '' : 's'}
              </>
            ) : null}
          </div>
          <Badge variant="secondary" appearance="outline" size="xs" className="text-orange-700 dark:text-orange-300">
            Top = current screen
          </Badge>
        </div>

        <div className="p-4">
          {destinations.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No navigation destinations on the stack.</p>
          ) : (
            <div className="relative space-y-2">
              <div className="absolute bottom-3 left-[15px] top-3 w-px bg-orange-200 dark:bg-orange-900/60" />
              {destinations.map((f, i) => {
                const isCurrent = f.who === snapshot.current?.who
                const meta = fragmentMeta(f.className)
                const category = CATEGORY_META[meta.category]
                const mStateLabel = MSTATE_LABELS[f.stateCode]
                const depth = i + 1
                return (
                  <div
                    key={f.who}
                    className={cn(
                      'relative flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all',
                      isCurrent
                        ? cn(toneCard[PAGE_TONE], 'ms-0 shadow-[inset_3px_0_0_0_currentColor] ring-1 ring-orange-500/20')
                        : 'ms-3 border-border/70 bg-muted/15 opacity-90',
                    )}
                  >
                    <span
                      className={cn(
                        'z-10 flex size-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold',
                        isCurrent
                          ? cn(toneDot[PAGE_TONE], 'text-white shadow-sm')
                          : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
                      )}
                    >
                      {depth}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{meta.label}</span>
                        {isCurrent ? <TonePill label="current" tone={PAGE_TONE} /> : null}
                        <TonePill label={category.label} tone={category.tone} />
                      </div>
                      <code className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
                        {f.className}
                      </code>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <TonePill label={f.lifecycle} tone={LIFECYCLE_TONE[f.lifecycle]} />
                      <span className="font-mono text-[10px] text-muted-foreground">
                        mState {f.stateCode}
                        {mStateLabel ? (
                          <span className={cn('ms-1 font-sans font-medium', toneText[LIFECYCLE_TONE[f.lifecycle]])}>
                            · {mStateLabel}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {dialogs.length > 0 ? (
            <div className="mt-4 border-t border-border/60 pt-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Overlaid dialogs
              </div>
              <div className="flex flex-wrap gap-2">
                {dialogs.map((f) => {
                  const meta = fragmentMeta(f.className)
                  const isOverlay = f.who === snapshot.overlay?.who
                  return (
                    <div
                      key={f.who}
                      className={cn(
                        'rounded-lg border px-3 py-2',
                        isOverlay ? toneCard.purple : 'border-border/70 bg-muted/15',
                      )}
                    >
                      <div className="text-xs font-semibold text-foreground">{meta.label}</div>
                      <code className="text-[10px] text-muted-foreground">{f.className}</code>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      </motion.div>
    </PageSection>
  )
}

// ---------------------------------------------------------------------------
// Current-screen in-memory state changes (client-derived)
// ---------------------------------------------------------------------------

function StateChangeValueBlock({
  label,
  value,
  toneClass,
}: {
  label: string
  value: unknown
  toneClass: string
}) {
  const [copied, setCopied] = useState(false)
  const text = value === undefined ? '—' : prettyJson(value)

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <button
          type="button"
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation()
            void navigator.clipboard?.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? <Check className="size-3 text-green-600" /> : <Copy className="size-3" />}
          Copy
        </button>
      </div>
      <pre
        className={cn(
          'max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-border/60 bg-muted/25 p-3 font-mono text-[11px] leading-relaxed',
          toneClass,
        )}
      >
        {text}
      </pre>
    </div>
  )
}

function StateChangeRow({
  change,
  expanded,
  onToggle,
  index,
}: {
  change: LiveStateChange
  expanded: boolean
  onToggle: () => void
  index: number
}) {
  const meta = STATE_CHANGE_META[change.kind]
  const isComplex = change.valueKind === 'object' || change.valueKind === 'array'
  const previewBefore = stateValueText(change.before, isComplex ? 80 : 120)
  const previewAfter = stateValueText(change.after, isComplex ? 80 : 120)

  return (
    <motion.div
      className={cn(
        'relative rounded-xl border transition-colors',
        expanded ? 'border-orange-300/60 bg-orange-50/20 dark:border-orange-900/50 dark:bg-orange-950/15' : 'border-transparent hover:border-orange-500/20 hover:bg-orange-500/5',
      )}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 6) * 0.03, ease: EASE }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 p-3 text-left"
      >
        <span
          className={cn(
            'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-background',
            toneCard[meta.tone],
          )}
        >
          <Braces className={cn('size-3', toneIcon[meta.tone])} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-xs font-semibold text-foreground">{change.field}</code>
            <TonePill label={change.valueKind} tone={KIND_TONE[change.valueKind]} />
            <TonePill label={meta.label} tone={meta.tone} />
            <span className="ms-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
              {new Date(change.timestamp).toLocaleTimeString('en-US')}
              {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </span>
          </div>
          {!expanded ? (
            <div className="mt-2 grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-lg bg-muted/35 px-2.5 py-2">
              <code className="truncate text-[10px] text-red-700/80 dark:text-red-300/80">{previewBefore}</code>
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
              <code className="truncate text-[10px] text-green-700 dark:text-green-300">{previewAfter}</code>
            </div>
          ) : null}
          <div className="mt-1 text-[10px] text-muted-foreground/70">{change.screenClass}</div>
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-border/50 px-3 pb-3 pt-2">
          <div className="flex flex-col gap-3 lg:flex-row">
            <StateChangeValueBlock
              label="Before"
              value={change.before}
              toneClass="text-red-700/90 dark:text-red-300/90"
            />
            <StateChangeValueBlock
              label="After"
              value={change.after}
              toneClass="text-green-700 dark:text-green-300"
            />
          </div>
        </div>
      ) : null}
    </motion.div>
  )
}

function StateChangeLog({
  changes,
  snapshot,
  paused,
}: {
  changes: LiveStateChange[]
  snapshot: LiveScreenState
  paused: boolean
}) {
  const current = snapshot.current
  const currentLabel = current ? fragmentMeta(current.className).label : 'No active screen'
  const watchedFields = snapshot.fields.filter((field) => field.group === 'screen')
  const watchedFieldCount = watchedFields.length
  const recentChanges = [...changes].reverse()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const prevChangeCountRef = useRef(0)

  useEffect(() => {
    if (changes.length > prevChangeCountRef.current) {
      setExpandedId(changes[changes.length - 1]?.id ?? null)
    } else if (changes.length === 0) {
      setExpandedId(null)
    }
    prevChangeCountRef.current = changes.length
  }, [changes])

  return (
    <PageSection
      eyebrow="Current screen memory"
      title="Live State Changes"
      description={`${currentLabel} fragment-owned fields only · SharedViewModel and service changes are excluded.`}
      icon={ScrollText}
      tone={PAGE_TONE}
      className="w-full"
    >
      <motion.div
        className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-border/80 bg-orange-50/40 px-4 py-2.5 dark:bg-orange-950/15">
          <Badge
            variant={paused ? 'warning' : 'success'}
            appearance="light"
            size="sm"
            className="gap-1.5"
          >
            <span className={cn('size-1.5 rounded-full', paused ? 'bg-amber-500' : 'animate-pulse bg-orange-500')} />
            {paused ? 'Paused' : 'Live · 1s'}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {watchedFieldCount} field{watchedFieldCount === 1 ? '' : 's'} watched
          </span>
          <span className="ms-auto text-[11px] text-muted-foreground">
            {changes.length}/{MAX_STATE_CHANGES} changes
            {changes.length > 0 ? ' · click row to expand' : ''}
          </span>
        </div>

        {!snapshot.stateInstrumented ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            The installed build does not expose in-memory state for this screen.
          </div>
        ) : changes.length === 0 ? (
          <div className="px-4 py-6">
            <div className="flex items-start gap-3 rounded-lg border border-dashed border-orange-300/50 bg-orange-50/30 px-3 py-3 dark:border-orange-900/40 dark:bg-orange-950/20">
              <Zap className="mt-0.5 size-4 shrink-0 text-orange-500" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Watching {currentLabel}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Change a field on the device — toggle a switch, scan a parcel, or trigger navigation — and the
                  previous → next value will appear here instantly.
                </p>
              </div>
            </div>
            {watchedFields.length > 0 ? (
              <div className="mt-3">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Watched fields
                </div>
                <div className="flex flex-wrap gap-1">
                  {watchedFields.map((field) => (
                    <code
                      key={field.name}
                      className="rounded-md border border-border/70 bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] text-foreground/80"
                    >
                      {field.name}
                    </code>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2 p-4">
            {recentChanges.map((change, i) => (
              <StateChangeRow
                key={change.id}
                change={change}
                expanded={expandedId === change.id}
                onToggle={() => setExpandedId((prev) => (prev === change.id ? null : change.id))}
                index={i}
              />
            ))}
          </div>
        )}
      </motion.div>
    </PageSection>
  )
}

// ---------------------------------------------------------------------------
// Screen history strip (client-derived)
// ---------------------------------------------------------------------------

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const r = sec % 60
  return r > 0 ? `${m}m ${r}s` : `${m}m`
}

function ScreenHistoryStrip({ history, currentWho }: { history: HistoryEntry[]; currentWho?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const sessionStart = history[0]?.enteredAt ?? Date.now()
  const sessionSec = Math.round((Date.now() - sessionStart) / 1000)
  const uniqueScreens = new Set(history.map((h) => h.className)).size

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
  }, [history.length])

  return (
    <PageSection
      eyebrow="Navigation"
      title="Screen History"
      description="The path the courier took through the app since you opened this page — oldest step on the left."
      icon={Navigation}
      tone={PAGE_TONE}
    >
      <motion.div
        className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-orange-50/40 px-4 py-3 dark:bg-orange-950/15">
          <div className="flex items-center gap-2">
            <span className={cn('flex size-8 items-center justify-center rounded-lg border border-orange-500/20', toneIconBox[PAGE_TONE])}>
              <Navigation className="size-4 text-orange-600 dark:text-orange-400" />
            </span>
            <div>
              <div className="text-sm font-semibold text-foreground">Navigation path</div>
              <p className="text-[11px] text-muted-foreground">
                {history.length} screen{history.length === 1 ? '' : 's'} · {uniqueScreens} unique ·{' '}
                {formatDuration(sessionSec)} tracked
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" appearance="outline" size="xs" className="text-orange-700 dark:text-orange-300">
              {history.length} steps
            </Badge>
            {uniqueScreens < history.length ? (
              <Badge variant="secondary" appearance="outline" size="xs" className="text-amber-700 dark:text-amber-300">
                {history.length - uniqueScreens} revisit{history.length - uniqueScreens === 1 ? '' : 's'}
              </Badge>
            ) : null}
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-0 overflow-x-auto scroll-smooth p-4 pb-3 [scrollbar-width:thin]"
        >
          {(() => {
            const seenClasses = new Set<string>()
            return history.map((h, i) => {
              const isCurrent = h.who === currentWho && h.leftAt == null
              const meta = fragmentMeta(h.className)
              const category = CATEGORY_META[meta.category]
              const tone = category.tone
              const durationSec = Math.round(((h.leftAt ?? Date.now()) - h.enteredAt) / 1000)
              const isRevisit = seenClasses.has(h.className)
              seenClasses.add(h.className)

              return (
                <div key={h.who + h.enteredAt} className="flex shrink-0 items-stretch">
                  <motion.div
                    className={cn(
                      'group flex min-w-[152px] flex-col rounded-xl border px-3 py-2.5 transition-all',
                      isCurrent
                        ? cn(toneCard[tone], 'shadow-[inset_0_-2px_0_0_currentColor] ring-1 ring-current/20')
                        : 'border-border/70 bg-muted/15 hover:border-orange-500/30 hover:bg-orange-500/5',
                    )}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.28, delay: i * 0.04, ease: EASE }}
                    title={h.className}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'flex size-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold',
                          isCurrent
                            ? cn(toneDot[tone], 'text-white shadow-sm')
                            : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
                        )}
                      >
                        {i + 1}
                      </span>
                      {isCurrent ? (
                        <Badge variant="success" appearance="light" size="xs" className="gap-1">
                          <span className="size-1.5 animate-pulse rounded-full bg-green-500" />
                          Now
                        </Badge>
                      ) : isRevisit ? (
                        <Badge variant="secondary" appearance="outline" size="xs" className="text-amber-700 dark:text-amber-300">
                          Revisit
                        </Badge>
                      ) : null}
                    </div>

                    <span className="mt-2 truncate text-sm font-semibold text-foreground">{meta.label}</span>
                    <TonePill label={category.label} tone={tone} className="mt-1.5 w-fit" />

                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Clock className="size-3 shrink-0 opacity-60" />
                      <span>{new Date(h.enteredAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span>
                    </div>

                    <div
                      className={cn(
                        'mt-1 text-[10px] font-medium',
                        isCurrent ? toneText[tone] : 'text-muted-foreground',
                      )}
                    >
                      {isCurrent ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="size-1.5 animate-pulse rounded-full bg-current" />
                          {formatDuration(durationSec)} on screen
                        </span>
                      ) : (
                        <span>{formatDuration(durationSec)} spent here</span>
                      )}
                    </div>
                  </motion.div>

                  {i < history.length - 1 ? (
                    <div className="mx-2 flex min-w-[52px] flex-col items-center justify-center gap-1 self-center">
                      <ChevronRight className="size-4 text-orange-400/50 dark:text-orange-500/40" />
                      <span className="rounded-full bg-muted/60 px-2 py-0.5 font-mono text-[9px] font-semibold text-muted-foreground">
                        {formatDuration(durationSec)}
                      </span>
                    </div>
                  ) : null}
                </div>
              )
            })
          })()}
        </div>

        <div className="border-t border-border/60 px-4 py-2.5">
          <ScreenHistoryDurationBar history={history} currentWho={currentWho} />
        </div>
      </motion.div>
    </PageSection>
  )
}

function ScreenHistoryDurationBar({
  history,
  currentWho,
}: {
  history: HistoryEntry[]
  currentWho?: string
}) {
  const totalMs = history.reduce(
    (sum, h) => sum + ((h.leftAt ?? Date.now()) - h.enteredAt),
    0,
  )
  if (totalMs <= 0) return null

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="font-semibold uppercase tracking-wider">Time on each screen</span>
        <span>{formatDuration(Math.round(totalMs / 1000))} total</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted/50">
        {history.map((h) => {
          const meta = fragmentMeta(h.className)
          const tone = CATEGORY_META[meta.category].tone
          const ms = (h.leftAt ?? Date.now()) - h.enteredAt
          const pct = Math.max((ms / totalMs) * 100, 4)
          const isCurrent = h.who === currentWho && h.leftAt == null
          return (
            <div
              key={h.who + h.enteredAt}
              className={cn('h-full transition-all', toneDot[tone], isCurrent && 'animate-pulse')}
              style={{ width: `${pct}%` }}
              title={`${meta.label} · ${formatDuration(Math.round(ms / 1000))}`}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {history.map((h) => {
          const meta = fragmentMeta(h.className)
          const tone = CATEGORY_META[meta.category].tone
          return (
            <span key={h.who + h.enteredAt} className="inline-flex items-center gap-1 text-[9px] text-muted-foreground">
              <span className={cn('size-1.5 rounded-full', toneDot[tone])} />
              {meta.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading / error
// ---------------------------------------------------------------------------

function ScreenShimmer() {
  return (
    <div className="space-y-4">
      <div className="h-32 animate-pulse rounded-2xl border border-border bg-muted/40" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-muted/40" />
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-muted/40" />
      </div>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-300/60 bg-red-50 px-6 py-10 text-center dark:border-red-900/50 dark:bg-red-950/30">
      <p className="text-sm font-medium text-red-700 dark:text-red-300">{message}</p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw className="size-3.5" />
        Try again
      </Button>
    </div>
  )
}
