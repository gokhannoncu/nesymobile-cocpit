'use client'

import Link from 'next/link'
import { CircleX, ExternalLink, Package2 } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'

function formatPackKeyLabel(packKey: string): string {
  return packKey
    .split('.')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function domainPackHref(packKey: string, packVersion: string): string {
  return `/automation/domain-packs/${encodeURIComponent(packKey)}?version=${encodeURIComponent(packVersion)}`
}

export function PaletteDomainPackBanner({
  packKey,
  packVersion,
}: {
  packKey: string
  packVersion: string
}) {
  const href = domainPackHref(packKey, packVersion)
  const label = formatPackKeyLabel(packKey)

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open domain pack ${label} (${packKey} v${packVersion}) in a new tab`}
      className={cn(
        'group mt-3 flex w-full min-w-0 items-start gap-2.5 rounded-[8px] border border-slate-200/90 bg-white px-2.5 py-2.5 text-left',
        'transition-[border-color,background-color] hover:border-indigo-200/90 hover:bg-indigo-50/35',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200/90 focus-visible:ring-offset-1',
      )}
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-[8px] border border-indigo-100/90 bg-indigo-50/80 text-indigo-700 transition-colors group-hover:border-indigo-200 group-hover:bg-indigo-100/80"
        aria-hidden
      >
        <Package2 className="size-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-start justify-between gap-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold leading-tight text-slate-900">{label}</span>
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-emerald-800 ring-1 ring-emerald-200/70">
                <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                Published
              </span>
              <span className="shrink-0 rounded-md border border-slate-200/90 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none text-slate-600">
                v{packVersion}
              </span>
            </span>
          </span>
          <ExternalLink
            className="mt-0.5 size-3.5 shrink-0 text-slate-300 transition-colors group-hover:text-indigo-600"
            aria-hidden
          />
        </span>
        <span className="mt-1.5 block break-all font-mono text-[10px] leading-snug text-slate-500">{packKey}</span>
        <span className="mt-1 block text-[10px] font-medium text-slate-400 transition-colors group-hover:text-indigo-600/90">
          View pack details
        </span>
      </span>
    </Link>
  )
}

export function PaletteBlockedBanner({ reason }: { reason: string }) {
  return (
    <div
      className="mt-3 overflow-hidden rounded-[8px] border border-amber-200/90 bg-amber-50/80"
      role="alert"
    >
      <div className="flex items-start gap-2 px-2.5 py-2">
        <CircleX className="mt-0.5 size-3.5 shrink-0 text-amber-800" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold leading-tight text-amber-950">Palette unavailable</p>
          <p className="mt-0.5 line-clamp-3 text-[10px] leading-snug text-amber-900/90">{reason}</p>
        </div>
      </div>
    </div>
  )
}
