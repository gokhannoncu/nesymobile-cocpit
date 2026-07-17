'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Braces,
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  Copy,
  ShieldCheck,
  WrapText,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@nesy/metronic/components/ui/tabs'
import { CopyButton } from '@/components/engineering/tools/shared'
import {
  extractMongoPayload,
  formatMongoShell,
  jsonPretty,
  toCompassPasteText,
  tokenizeMongo,
  type HighlightToken,
} from '@/lib/mongo-query-format'

const TOKEN_CLASS: Record<HighlightToken['type'], string> = {
  plain: 'text-zinc-200',
  key: 'text-sky-300',
  string: 'text-emerald-300',
  number: 'text-amber-300',
  boolean: 'text-violet-300',
  null: 'text-zinc-500 italic',
  punct: 'text-zinc-400',
  method: 'text-orange-300',
  comment: 'text-zinc-500 italic',
  fn: 'text-cyan-300',
}

function HighlightedCode({ code, className }: { code: string; className?: string }) {
  const tokens = useMemo(() => tokenizeMongo(code), [code])
  const lines = useMemo(() => {
    const rows: HighlightToken[][] = [[]]
    for (const t of tokens) {
      const parts = t.text.split('\n')
      parts.forEach((part, idx) => {
        if (idx > 0) rows.push([])
        if (part) rows[rows.length - 1]!.push({ type: t.type, text: part })
      })
    }
    return rows
  }, [tokens])

  return (
    <pre
      className={cn(
        'overflow-auto bg-[#0f1419] p-4 font-mono text-[12.5px] leading-[1.65]',
        className,
      )}
    >
      <code>
        {lines.map((line, i) => (
          <div key={i} className="flex min-h-[1.65em]">
            <span className="me-4 w-7 shrink-0 select-none text-right text-[11px] text-zinc-600">
              {i + 1}
            </span>
            <span className="min-w-0 whitespace-pre">
              {line.length === 0 ? (
                <span>&nbsp;</span>
              ) : (
                line.map((t, j) => (
                  <span key={j} className={TOKEN_CLASS[t.type]}>
                    {t.text}
                  </span>
                ))
              )}
            </span>
          </div>
        ))}
      </code>
    </pre>
  )
}

function JsonTree({ value, path = 'root' }: { value: unknown; path?: string }) {
  if (value === null) {
    return <span className="italic text-zinc-500">null</span>
  }
  if (typeof value === 'boolean') {
    return <span className="text-violet-300">{String(value)}</span>
  }
  if (typeof value === 'number') {
    return <span className="text-amber-300">{value}</span>
  }
  if (typeof value === 'string') {
    return <span className="text-emerald-300">&quot;{value}&quot;</span>
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-zinc-400">[]</span>
    return (
      <div className="space-y-0.5">
        {value.map((item, i) => (
          <JsonNode key={`${path}.${i}`} name={`${i}`} value={item} path={`${path}.${i}`} />
        ))}
      </div>
    )
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return <span className="text-zinc-400">{'{}'}</span>
    return (
      <div className="space-y-0.5">
        {entries.map(([k, v]) => (
          <JsonNode key={`${path}.${k}`} name={k} value={v} path={`${path}.${k}`} />
        ))}
      </div>
    )
  }
  return <span className="text-zinc-200">{String(value)}</span>
}

function JsonNode({ name, value, path }: { name: string; value: unknown; path: string }) {
  const isExpandable =
    value !== null && typeof value === 'object' && (Array.isArray(value) ? value.length > 0 : Object.keys(value).length > 0)
  const [open, setOpen] = useState(true)
  const preview = Array.isArray(value)
    ? `Array(${value.length})`
    : value !== null && typeof value === 'object'
      ? `{${Object.keys(value).length}}`
      : null

  return (
    <div className="font-mono text-[12.5px] leading-relaxed">
      <div className="flex items-start gap-1">
        {isExpandable ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-0.5 shrink-0 rounded p-0.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            aria-label={open ? 'Collapse' : 'Expand'}
          >
            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        ) : (
          <span className="inline-block size-4 shrink-0" />
        )}
        <span className="text-sky-300">{name}</span>
        <span className="text-zinc-500">:</span>
        {!isExpandable || !open ? (
          <span className="min-w-0">
            {isExpandable ? (
              <span className="text-zinc-500">{preview}</span>
            ) : (
              <JsonTree value={value} path={path} />
            )}
          </span>
        ) : null}
      </div>
      {isExpandable && open && (
        <div className="ms-4 border-l border-white/10 ps-3">
          <JsonTree value={value} path={path} />
        </div>
      )}
    </div>
  )
}

export function MongoQueryEditor({
  query,
  summary,
  className,
}: {
  query: string
  summary?: string
  className?: string
}) {
  const [formatted, setFormatted] = useState(() => formatMongoShell(query))
  const [formatPulse, setFormatPulse] = useState(false)
  const [compassPulse, setCompassPulse] = useState(false)

  useEffect(() => {
    setFormatted(formatMongoShell(query))
  }, [query])

  const payload = useMemo(() => extractMongoPayload(formatted), [formatted])
  const compassText = useMemo(() => toCompassPasteText(formatted), [formatted])
  const jsonText =
    compassText ??
    (payload?.json != null ? jsonPretty(payload.json) : payload?.pretty ?? '')

  const onFormat = () => {
    setFormatted(formatMongoShell(formatted))
    setFormatPulse(true)
    setTimeout(() => setFormatPulse(false), 1200)
  }

  const onCopyCompass = () => {
    if (!compassText) return
    void navigator.clipboard?.writeText(compassText)
    setCompassPulse(true)
    setTimeout(() => setCompassPulse(false), 1600)
  }

  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card shadow-sm', className)}>
      <div className="flex flex-wrap items-center gap-1.5 border-b bg-muted/40 px-3 py-1.5">
        <Badge variant="secondary" appearance="outline" size="xs" className="font-mono text-emerald-700 dark:text-emerald-300">
          mongodb
        </Badge>
        <Badge variant="success" appearance="outline" size="xs" className="gap-1">
          <ShieldCheck className="size-3" />
          Read-only
        </Badge>
        <div className="ms-auto flex items-center gap-0.5">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onFormat}>
            {formatPulse ? <Check className="size-3.5 text-green-600" /> : <WrapText className="size-3.5" />}
            {formatPulse ? 'Formatted' : 'Format'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            title="Copy full mongosh query"
            onClick={() => void navigator.clipboard?.writeText(formatted)}
          >
            <Copy className="size-3.5" />
            Copy shell
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            disabled={!compassText}
            title="Copy Filter/Pipeline JSON for Atlas Data Explorer / Compass paste"
            onClick={onCopyCompass}
          >
            {compassPulse ? <Check className="size-3.5 text-green-600" /> : <Compass className="size-3.5" />}
            {compassPulse ? 'Copied JSON' : 'Compass'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="shell" className="gap-0">
        <div className="border-b bg-[#0f1419] px-3 pt-2">
          <TabsList variant="line" className="h-8 bg-transparent">
            <TabsTrigger value="shell" className="text-xs text-zinc-300 data-[state=active]:text-white">
              Query
            </TabsTrigger>
            <TabsTrigger value="json" className="gap-1 text-xs text-zinc-300 data-[state=active]:text-white">
              <Braces className="size-3" />
              {payload?.label ?? 'JSON'}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="shell" className="mt-0">
          <HighlightedCode code={formatted} className="max-h-[420px] min-h-[220px]" />
        </TabsContent>

        <TabsContent value="json" className="mt-0">
          {payload && jsonText ? (
            <div className="relative max-h-[420px] min-h-[220px] overflow-auto bg-[#0f1419] p-4">
              <div className="absolute end-3 top-3 z-10 flex flex-col items-end gap-1">
                <CopyButton text={jsonText} label="Copy for Compass" />
                <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-zinc-400">
                  Paste into Atlas Filter
                </span>
              </div>
              {payload.json != null ? (
                <JsonTree value={payload.json} />
              ) : (
                <HighlightedCode code={jsonText} className="p-0" />
              )}
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center bg-[#0f1419] px-4 text-center text-xs text-zinc-500">
              No filter / pipeline object found to preview as JSON.
            </div>
          )}
        </TabsContent>
      </Tabs>

      {summary && (
        <div className="border-t bg-muted/30 px-4 py-2 text-[11px] leading-relaxed text-muted-foreground">
          {summary}
        </div>
      )}
    </div>
  )
}
