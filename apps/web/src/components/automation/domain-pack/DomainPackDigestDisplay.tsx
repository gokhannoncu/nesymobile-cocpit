'use client'

import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'

interface DomainPackDigestDisplayProps {
  label: string
  digest: string
  className?: string
}

export function DomainPackDigestDisplay({ label, digest, className }: DomainPackDigestDisplayProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(digest)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const truncated = digest.length > 12 ? `${digest.substring(0, 6)}...${digest.substring(digest.length - 6)}` : digest

  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <code className="rounded-[4px] border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
        {truncated}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[4px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
        title="Copy to clipboard"
      >
        {copied ? (
          <Check className="size-3.5 text-emerald-600" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
    </div>
  )
}
