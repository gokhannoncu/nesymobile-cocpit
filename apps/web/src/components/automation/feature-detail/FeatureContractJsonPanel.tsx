'use client'

import { useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'

type JsonScope = 'contract' | 'executable' | 'authoring'

export function FeatureContractJsonPanel({
  feature,
  className,
}: {
  feature: Record<string, unknown>
  className?: string
}) {
  const [scope, setScope] = useState<JsonScope>('contract')
  const [copied, setCopied] = useState(false)

  const authoring =
    feature.authoring && typeof feature.authoring === 'object' && !Array.isArray(feature.authoring)
      ? (feature.authoring as Record<string, unknown>)
      : null

  const executable =
    feature.executable && typeof feature.executable === 'object' && !Array.isArray(feature.executable)
      ? (feature.executable as Record<string, unknown>)
      : feature

  const payload = useMemo(() => {
    if (scope === 'authoring') return authoring ?? {}
    if (scope === 'executable') return executable
    return feature
  }, [authoring, executable, feature, scope])

  const jsonText = useMemo(() => JSON.stringify(payload, null, 2), [payload])
  const lines = useMemo(() => jsonText.split('\n'), [jsonText])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonText)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn('flex h-full min-h-[420px] flex-col overflow-hidden rounded-[8px] border border-border', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <div className="flex min-w-0 items-center gap-1">
          {(
            [
              ['contract', 'contract.json'],
              ['executable', 'executable.json'],
              ['authoring', 'authoring.json'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setScope(value)}
              disabled={value === 'authoring' && !authoring}
              className={cn(
                'rounded-[4px] px-2 py-1 font-mono text-[10px] font-semibold transition',
                scope === value
                  ? 'bg-background text-foreground shadow-xs ring-1 ring-border/80'
                  : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
                value === 'authoring' && !authoring && 'cursor-not-allowed opacity-40',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-[4px] px-2 py-1 text-[11px] font-semibold text-muted-foreground transition hover:bg-background hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-emerald-600" />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              Copy
            </>
          )}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 overflow-auto bg-zinc-950 text-zinc-100 dark:bg-zinc-950">
        <div
          className="sticky left-0 shrink-0 border-r border-zinc-800 bg-zinc-900/80 px-2 py-3 text-right font-mono text-[11px] leading-[1.45] text-zinc-500 select-none"
          aria-hidden
        >
          {lines.map((_, index) => (
            <div key={index}>{index + 1}</div>
          ))}
        </div>
        <pre className="min-w-0 flex-1 overflow-x-auto p-3 font-mono text-[11px] leading-[1.45] text-zinc-100">
          <code>{jsonText}</code>
        </pre>
      </div>
    </div>
  )
}
