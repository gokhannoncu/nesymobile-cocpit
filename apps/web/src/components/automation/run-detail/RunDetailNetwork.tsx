'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock3,
  Lock,
  Network,
  Timer,
} from 'lucide-react'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Input } from '@nesy/metronic/components/ui/input'
import { cn } from '@nesy/metronic/lib/utils'
import { StatCard, StatGrid } from '@/components/product/stats'
import {
  formatBytes,
  formatDuration,
  type RunNetworkCall,
  type RunDetailViewModel,
} from '@/lib/verdict-runtime/run-detail-view-model'
import type { RunTelemetryHttpBody } from '@/lib/verdict-runtime/types'

/**
 * Per-call HTTP view: the request list on the left, one call's bodies on the right.
 *
 * The Performance tab answers "how fast was the network" with percentiles. This
 * answers "what actually went over it", which is a different question and needs
 * the individual call, not the distribution.
 *
 * ## The rule this file exists to honour
 *
 * A missing body is never rendered as a dash. There are five distinct reasons a
 * body is not on screen — the device declined to capture it, the viewer lacks
 * permission, retention erased it, chunks were lost in transit, or the request
 * genuinely had no body — and they lead the reader to completely different
 * conclusions. Collapsing them into one blank is how "we chose not to record
 * this" gets read as "the app sent nothing".
 */
export function RunDetailNetwork({
  view,
  canViewRawEvidence,
}: {
  view: RunDetailViewModel
  canViewRawEvidence: boolean
}) {
  const calls = view.charts.network
  const [query, setQuery] = useState('')
  const [failedOnly, setFailedOnly] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return calls
      .map((item, index) => ({ item, key: rowKey(item, index) }))
      .filter(({ item }) => {
        if (failedOnly && item.call.success !== false) return false
        if (needle.length === 0) return true
        return [item.call.method, item.call.host, item.call.path, String(item.call.code)]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(needle))
      })
  }, [calls, failedOnly, query])

  const selected =
    rows.find(({ key }) => key === selectedKey)?.item ?? rows[0]?.item ?? null

  const capturedBodies = calls.filter(
    (item) => item.request?.body !== undefined || item.response?.body !== undefined,
  ).length
  const withheldCount = calls.filter(
    (item) => item.request?.withheld === true || item.response?.withheld === true,
  ).length
  const failureCount = calls.filter((item) => item.call.success === false).length

  if (calls.length === 0) {
    return (
      <EmptyState
        title="No HTTP traffic was recorded for this run"
        detail="The SDK emits HTTP_CALL for every request it observes. An empty list means no call reached the observer, not that the app made none."
      />
    )
  }

  return (
    <div className="space-y-4">
      <StatGrid cols={3} dense>
        <StatCard
          variant="compact"
          label="Requests"
          value={String(calls.length)}
          hint={failureCount > 0 ? `${failureCount} failed` : 'All observed calls succeeded'}
          icon={Network}
          tone={failureCount > 0 ? 'red' : 'blue'}
        />
        <StatCard
          variant="compact"
          label="Bodies captured"
          value={`${capturedBodies} / ${calls.length}`}
          hint="Body capture is opt-in per host and disabled in production"
          icon={ArrowDownToLine}
          tone={capturedBodies > 0 ? 'green' : 'gray'}
        />
        <StatCard
          variant="compact"
          label="Restricted"
          value={withheldCount === 0 ? '0' : String(withheldCount)}
          hint={
            canViewRawEvidence
              ? 'You may view captured payloads'
              : 'Payloads require the raw-evidence permission'
          }
          icon={Lock}
          tone={withheldCount > 0 ? 'amber' : 'gray'}
        />
      </StatGrid>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by method, host, path or status…"
          className="h-8 max-w-xs text-xs"
          aria-label="Filter requests"
        />
        <button
          type="button"
          onClick={() => setFailedOnly((current) => !current)}
          aria-pressed={failedOnly}
          className={cn(
            'h-8 rounded-md border px-2.5 text-xs font-medium transition-colors',
            failedOnly
              ? 'border-red-300 bg-red-50 text-red-700'
              : 'border-border/80 text-muted-foreground hover:bg-muted/40',
          )}
        >
          Failed only
        </button>
        <span className="text-[11px] text-muted-foreground">
          {rows.length} of {calls.length} shown
        </span>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="min-w-0 overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
          <div className="border-b border-border/80 px-3 py-2">
            <h2 className="text-xs font-semibold text-foreground">Requests</h2>
          </div>
          {rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No request matches this filter.
            </p>
          ) : (
            <ul className="max-h-[520px] divide-y divide-border/60 overflow-y-auto">
              {rows.map(({ item, key }) => (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => setSelectedKey(key)}
                    aria-current={selected === item}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left transition-colors',
                      selected === item ? 'bg-primary/5' : 'hover:bg-muted/40',
                    )}
                  >
                    <StatusDot success={item.call.success} />
                    <span className="w-11 shrink-0 font-mono text-[10px] font-semibold uppercase text-muted-foreground">
                      {item.call.method ?? '—'}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">
                      {item.call.path ?? item.call.host ?? 'unknown request'}
                    </span>
                    <BodyDots item={item} />
                    <span className="w-10 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                      {item.call.code ?? '—'}
                    </span>
                    <span className="w-14 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                      {item.call.durationMs === null
                        ? '—'
                        : formatDuration(item.call.durationMs)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="min-w-0 space-y-3">
          {selected === null ? (
            <EmptyState title="Select a request" detail="Pick a call to inspect its bodies." />
          ) : (
            <>
              <CallOverview item={selected} />
              <BodyPanel
                title="Request body"
                icon={ArrowUpFromLine}
                body={selected.request}
                canViewRawEvidence={canViewRawEvidence}
                bytesHint={selected.call.bytesOut}
              />
              <BodyPanel
                title="Response body"
                icon={ArrowDownToLine}
                body={selected.response}
                canViewRawEvidence={canViewRawEvidence}
                bytesHint={selected.call.bytesIn}
              />
            </>
          )}
        </section>
      </div>
    </div>
  )
}

function CallOverview({ item }: { item: RunNetworkCall }) {
  const { call } = item
  const orphan = call.method === null && call.requestId !== null

  return (
    <section className="rounded-lg border border-border/80 bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatusDot success={call.success} />
        <span className="font-mono text-[11px] font-semibold uppercase">
          {call.method ?? 'UNKNOWN'}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
          {call.host ?? ''}
          {call.path ?? ''}
        </span>
      </div>
      {orphan ? (
        // Bodies leave the OkHttp interceptor and HTTP_CALL leaves the
        // EventListener, so a body arriving first is ordinary rather than a
        // fault. Saying so stops it reading as data corruption.
        <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
          Body evidence arrived without its call. The metrics event may still be
          in flight, or was dropped from the log buffer.
        </p>
      ) : null}
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-4">
        <Field label="Status" value={call.code === null ? 'NOT_MEASURED' : String(call.code)} />
        <Field
          label="Duration"
          value={call.durationMs === null ? 'NOT_MEASURED' : formatDuration(call.durationMs)}
        />
        <Field label="Sent" value={byteLabel(call.bytesOut)} />
        <Field label="Received" value={byteLabel(call.bytesIn)} />
      </dl>
    </section>
  )
}

/**
 * One body, or a precise statement of why it is not here.
 *
 * The order of the checks is the order of certainty: a stated omission comes
 * from the device and is the most specific answer available; permission and
 * retention are facts about this system; an incomplete reassembly is a
 * transport observation; only when none of those hold does "no body" mean the
 * request carried none.
 */
function BodyPanel({
  title,
  icon: Icon,
  body,
  canViewRawEvidence,
  bytesHint,
}: {
  title: string
  icon: typeof ArrowDownToLine
  body: RunTelemetryHttpBody | null
  canViewRawEvidence: boolean
  bytesHint: number | null
}) {
  const state = bodyState(body, canViewRawEvidence, bytesHint)

  return (
    <section className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border/80 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden />
          <h3 className="truncate text-xs font-semibold text-foreground">{title}</h3>
          {body?.contentType ? (
            <span className="truncate font-mono text-[10px] text-muted-foreground">
              {body.contentType}
            </span>
          ) : null}
        </div>
        <Badge variant="outline" className={cn('h-5 shrink-0 px-1.5 text-[10px] font-semibold', state.badgeClass)}>
          {state.badge}
        </Badge>
      </div>

      <div className="p-3 pt-2">
        {state.kind === 'text' ? (
          <>
            {body?.truncated === true ? (
              // Truncation only happens after redaction, so the text can be a
              // fragment that no longer parses as JSON. Rendering it as plain
              // text and saying it was cut is honest; pretty-printing it and
              // failing silently is not.
              <p className="mb-2 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
                Cut to fit the capture limit — this is a fragment, not the whole body.
              </p>
            ) : null}
            <pre className="max-h-[280px] overflow-auto rounded-md bg-muted/40 p-2 font-mono text-[11px] leading-relaxed text-foreground">
              {prettyIfJson(state.text)}
            </pre>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              {describeSize(body)}
            </p>
          </>
        ) : (
          <div className="rounded-md border border-dashed border-border/80 bg-muted/15 px-3 py-4 text-center">
            <p className="font-mono text-[10px] font-semibold uppercase text-muted-foreground">
              {state.badge}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{state.detail}</p>
          </div>
        )}
      </div>
    </section>
  )
}

interface BodyState {
  kind: 'text' | 'absent'
  badge: string
  badgeClass?: string
  detail: string
  text: string
}

function bodyState(
  body: RunTelemetryHttpBody | null,
  canViewRawEvidence: boolean,
  bytesHint: number | null,
): BodyState {
  if (body === null) {
    // No body event at all for this direction. Distinguish "the transfer was
    // empty" from "capture never ran", using the byte counter the metrics
    // event always carries.
    const empty = bytesHint === 0
    return {
      kind: 'absent',
      badge: empty ? 'EMPTY' : 'NOT_CAPTURED',
      detail: empty
        ? 'The transfer carried no body.'
        : 'Body capture was not armed for this call. It is opt-in per host and never arms on a production build.',
      text: '',
    }
  }

  if (body.omittedReason !== null) {
    return {
      kind: 'absent',
      badge: 'NOT_CAPTURED',
      badgeClass: 'border-slate-300 text-slate-600',
      detail: omissionCopy(body.omittedReason),
      text: '',
    }
  }

  if (body.withheld) {
    return {
      kind: 'absent',
      badge: 'RESTRICTED',
      badgeClass: 'border-amber-300 text-amber-700',
      detail: canViewRawEvidence
        ? 'The payload was withheld by the API for this request. Reload the page to fetch it with your permission.'
        : 'Captured, but viewing payloads requires the raw-evidence permission.',
      text: '',
    }
  }

  if (body.purged) {
    return {
      kind: 'absent',
      badge: 'EXPIRED',
      badgeClass: 'border-slate-300 text-slate-600',
      detail:
        'Captured and since erased by retention. Payloads are kept for 14 days; the measurements around them for 90.',
      text: '',
    }
  }

  if (!body.complete) {
    return {
      kind: 'absent',
      badge: 'INCOMPLETE',
      badgeClass: 'border-red-300 text-red-700',
      detail: `Only ${body.chunksReceived} of ${body.chunkCount ?? '?'} chunks arrived, so the body cannot be shown without inventing the gap.`,
      text: '',
    }
  }

  if (body.body === null || body.body.length === 0) {
    return {
      kind: 'absent',
      badge: 'EMPTY',
      detail: 'Captured, and the body was empty.',
      text: '',
    }
  }

  return {
    kind: 'text',
    badge: body.truncated === true ? 'TRUNCATED' : 'CAPTURED',
    badgeClass:
      body.truncated === true ? 'border-amber-300 text-amber-700' : 'border-emerald-300 text-emerald-700',
    detail: '',
    text: body.body,
  }
}

/** Plain-language rendering of the SDK's omission vocabulary. */
function omissionCopy(reason: string): string {
  switch (reason) {
    case 'POLICY_DISABLED':
      return 'Body capture was switched off for this run.'
    case 'HOST_NOT_ALLOWLISTED':
      return 'This host is not on the capture allowlist.'
    case 'CONTENT_TYPE_NOT_TEXTUAL':
      return 'Not a textual media type — images and binary payloads are never captured.'
    case 'BODY_TOO_LARGE':
      return 'Larger than the capture limit. Redaction needs the whole document, so an oversized body is skipped rather than sent unredacted.'
    case 'RUN_BUDGET_EXHAUSTED':
      return 'This run had already spent its body-capture budget.'
    case 'NOT_REDACTABLE':
      return 'Textual but without key structure (plain text or XML), so sensitive fields could not be identified and masked.'
    case 'STREAMING_BODY':
      return 'A one-shot or streaming body — reading it would have consumed the request.'
    case 'CAPTURE_FAILED':
      return 'Capture failed on the device. The request itself was unaffected.'
    default:
      return 'The device declined to capture this body.'
  }
}

function describeSize(body: RunTelemetryHttpBody | null): string {
  if (body === null) return ''
  const parts: string[] = []
  if (body.capturedBytes !== null) parts.push(`${formatBytes(body.capturedBytes)} shown`)
  if (body.originalBytes !== null && body.originalBytes >= 0) {
    parts.push(`${formatBytes(body.originalBytes)} on the wire`)
  }
  if (body.chunkCount !== null && body.chunkCount > 1) {
    parts.push(`${body.chunkCount} chunks`)
  }
  parts.push('sensitive fields masked on device')
  return parts.join(' · ')
}

/** Small dots showing which directions have body evidence, without opening the row. */
function BodyDots({ item }: { item: RunNetworkCall }) {
  return (
    <span className="flex shrink-0 items-center gap-1" aria-hidden>
      <Dot present={item.request !== null} carriesText={item.request?.body !== null} />
      <Dot present={item.response !== null} carriesText={item.response?.body !== null} />
    </span>
  )
}

function Dot({ present, carriesText }: { present: boolean; carriesText?: boolean }) {
  return (
    <span
      className={cn(
        'size-1.5 rounded-full',
        !present
          ? 'bg-border'
          : carriesText
            ? 'bg-emerald-500'
            : 'bg-amber-400',
      )}
    />
  )
}

function StatusDot({ success }: { success: boolean | null }) {
  return (
    <span
      className={cn(
        'size-1.5 shrink-0 rounded-full',
        success === false ? 'bg-red-500' : success === true ? 'bg-emerald-500' : 'bg-slate-300',
      )}
      aria-hidden
    />
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="truncate font-mono text-[11px] text-foreground">{value}</dd>
    </div>
  )
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/15 px-4 py-8 text-center">
      <div className="max-w-sm">
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
      </div>
    </div>
  )
}

/** `-1` is the SDK's "unknown", and showing it as a size would be a lie. */
function byteLabel(value: number | null): string {
  if (value === null) return 'NOT_MEASURED'
  if (value < 0) return 'UNKNOWN'
  return formatBytes(value)
}

/**
 * Pretty-prints JSON when it parses, and returns the text untouched when it
 * does not — a truncated capture is a fragment by design, and a viewer that
 * only renders valid JSON would show nothing exactly when the body is most
 * interesting.
 */
function prettyIfJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

function rowKey(item: RunNetworkCall, index: number): string {
  return item.call.requestId ?? `row-${index}`
}
