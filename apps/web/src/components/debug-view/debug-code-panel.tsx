'use client'

import { useMemo, useState } from 'react'
import { Braces, Check, Copy, FileCode2, Terminal } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'

type PanelLanguage = 'json' | 'text' | 'shell'

interface HighlightToken {
  text: string
  className?: string
}

function tryPrettyJson(raw: string): { formatted: string; isJson: boolean } {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return { formatted: raw, isJson: false }
  }
  try {
    return { formatted: JSON.stringify(JSON.parse(trimmed), null, 2), isJson: true }
  } catch {
    return { formatted: raw, isJson: false }
  }
}

function tokenizeJsonLine(line: string): HighlightToken[] {
  const tokens: HighlightToken[] = []
  const pattern = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\{|\}|\[|\]|,|:|\s+/g
  let match: RegExpExecArray | null
  let lastIndex = 0

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: line.slice(lastIndex, match.index) })
    }
    const [full, quoted, colon] = match
    if (quoted) {
      tokens.push({
        text: quoted,
        className: colon ? 'text-sky-300' : 'text-emerald-300',
      })
      if (colon) tokens.push({ text: colon, className: 'text-zinc-500' })
    } else if (full === 'true' || full === 'false' || full === 'null') {
      tokens.push({ text: full, className: 'text-violet-300' })
    } else if (/^-?\d/.test(full)) {
      tokens.push({ text: full, className: 'text-amber-300' })
    } else if ('{}[],:'.includes(full)) {
      tokens.push({ text: full, className: 'text-zinc-500' })
    } else {
      tokens.push({ text: full })
    }
    lastIndex = match.index + full.length
  }

  if (lastIndex < line.length) {
    tokens.push({ text: line.slice(lastIndex) })
  }

  return tokens.length > 0 ? tokens : [{ text: line }]
}

function languageMeta(language: PanelLanguage) {
  switch (language) {
    case 'json':
      return { label: 'JSON', icon: Braces }
    case 'shell':
      return { label: 'Shell', icon: Terminal }
    default:
      return { label: 'Text', icon: FileCode2 }
  }
}

/** Dark IDE-style read-only code / JSON panel for Debug View. */
export function DebugCodePanel({
  code,
  label,
  language = 'text',
  maxHeightClassName = 'max-h-80',
  className,
  lineNumbers = true,
}: {
  code: string
  label?: string
  language?: PanelLanguage
  maxHeightClassName?: string
  className?: string
  lineNumbers?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const meta = languageMeta(language)

  const displayCode = useMemo(() => {
    if (language === 'json') return tryPrettyJson(code)
    return { formatted: code, isJson: false }
  }, [code, language])

  const lines = useMemo(() => displayCode.formatted.split('\n'), [displayCode.formatted])
  const resolvedLanguage: PanelLanguage = language === 'json' && displayCode.isJson ? 'json' : language === 'json' ? 'text' : language

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/90 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-red-500/80" />
          <span className="size-2.5 rounded-full bg-amber-500/80" />
          <span className="size-2.5 rounded-full bg-emerald-500/80" />
        </div>
        <Badge
          variant="secondary"
          appearance="outline"
          size="xs"
          className="border-zinc-700 bg-zinc-900 font-mono text-[10px] text-zinc-300"
        >
          <meta.icon className="me-1 size-3" />
          {label ?? meta.label}
        </Badge>
        <span className="ms-1 font-mono text-[10px] text-zinc-500">
          {lines.length} line{lines.length === 1 ? '' : 's'}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="ms-auto h-7 gap-1 px-2 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          onClick={() => {
            void navigator.clipboard?.writeText(displayCode.formatted)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      <div className={cn('overflow-auto', maxHeightClassName)}>
        <pre className="min-w-full p-0 text-[11.5px] leading-[1.65]">
          <code className="block font-mono text-zinc-100">
            {lines.map((line, index) => (
              <span key={index} className="flex">
                {lineNumbers ? (
                  <span className="w-10 shrink-0 select-none border-r border-zinc-800/80 bg-zinc-900/50 px-2 text-right text-[10px] text-zinc-600">
                    {index + 1}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 whitespace-pre-wrap break-all px-3 py-px">
                  {resolvedLanguage === 'json'
                    ? tokenizeJsonLine(line).map((token, tokenIndex) => (
                        <span key={tokenIndex} className={token.className}>
                          {token.text}
                        </span>
                      ))
                    : line || ' '}
                </span>
              </span>
            ))}
          </code>
        </pre>
      </div>
    </div>
  )
}
