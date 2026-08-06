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
    <div className={cn("flex items-center space-x-2 text-sm text-gray-500", className)}>
      <span className="font-medium text-gray-700 dark:text-gray-300">{label}:</span>
      <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">
        {truncated}
      </code>
      <button 
        onClick={handleCopy}
        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
        title="Copy to clipboard"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}
