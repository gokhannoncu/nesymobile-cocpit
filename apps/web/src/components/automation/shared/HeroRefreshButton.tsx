'use client'

import { RefreshCw } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'

export function HeroRefreshButton({
  onRefresh,
  isRefreshing,
  label = 'Refresh',
}: {
  onRefresh: () => void
  isRefreshing: boolean
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={isRefreshing}
      aria-label={isRefreshing ? `Refreshing ${label.toLowerCase()}` : label}
      title={label}
      className={cn(
        'group inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border-2 border-nesy/30 bg-white pl-1.5 pr-4 text-sm font-semibold text-nesy-ink shadow-md shadow-nesy/15 transition',
        'hover:border-nesy/50 hover:bg-white hover:shadow-lg hover:shadow-nesy/20',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nesy/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
        'disabled:cursor-wait disabled:opacity-90',
        isRefreshing && 'border-nesy/40 shadow-lg shadow-nesy/20',
      )}
    >
      <span
        className={cn(
          'inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-nesy text-white shadow-sm transition',
          'group-hover:bg-nesy-hover',
          isRefreshing && 'bg-nesy-hover',
        )}
        aria-hidden
      >
        <RefreshCw
          className={cn(
            'size-3.5 transition-transform motion-reduce:transition-none',
            isRefreshing ? 'animate-spin motion-reduce:animate-none' : 'group-hover:-rotate-90',
          )}
        />
      </span>
      <span className="whitespace-nowrap">{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
    </button>
  )
}
