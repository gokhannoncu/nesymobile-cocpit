'use client'

import { useCallback, useState } from 'react'
import { Check, Clipboard } from 'lucide-react'
import { Button } from '@nesy/metronic/components/ui/button'
import { cn } from '@nesy/metronic/lib/utils'

export function CopyableHash({
  value,
  className,
}: {
  value: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(() => {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1_400)
    })
  }, [value])

  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1', className)}>
      <button
        type="button"
        onClick={copy}
        title={value}
        className="min-w-0 truncate font-mono text-[11px] text-foreground hover:underline"
      >
        {shortHash(value)}
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6 shrink-0 text-muted-foreground"
        aria-label="Copy value"
        onClick={copy}
      >
        {copied ? <Check className="size-3" /> : <Clipboard className="size-3" />}
      </Button>
    </span>
  )
}

function shortHash(value: string): string {
  if (value.length <= 28) return value
  const prefix = value.startsWith('sha256:') ? 'sha256:' : ''
  const body = prefix ? value.slice(7) : value
  if (body.length <= 20) return value
  return `${prefix}${body.slice(0, 8)}…${body.slice(-8)}`
}
