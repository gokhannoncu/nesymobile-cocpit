'use client'

import { useState } from 'react'
import { cn } from '@nesy/metronic/lib/utils'
import { TagBadge } from './collection'

export type FeatureCountryRow = {
  id: string
  name: string
  subtitle: string
  value: string
}

function statusOf(value: string): { label: string; tone: 'red' | 'gray' | 'green'; text: string } {
  if (value === '—') return { label: 'None', tone: 'red', text: 'Not available yet.' }
  if (value === 'N/A') return { label: 'Out of scope', tone: 'gray', text: 'Out of scope for this country.' }
  return { label: 'Active', tone: 'green', text: value }
}

function ExpandableText({ text }: { text: string }) {
  const needsClamp = text.length > 120 || (text.includes('\n') && text.length > 80)
  const [open, setOpen] = useState(false)
  return (
    <div>
      <p
        className={cn(
          'whitespace-pre-line text-xs leading-relaxed text-foreground/80',
          needsClamp && !open && 'line-clamp-2',
        )}
      >
        {text}
      </p>
      {needsClamp && (
        <button
          type="button"
          className="mt-1 text-[11px] font-semibold text-primary"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

export function FeatureCountryRows({ rows }: { rows: FeatureCountryRow[] }) {
  return (
    <ul className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card/40">
      {rows.map((row) => {
        const status = statusOf(row.value)
        const isCore = row.id === 'core'
        return (
          <li
            key={row.id}
            className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(140px,180px)_auto_1fr] sm:items-start sm:gap-4"
          >
            <div>
              <div className="text-sm font-semibold text-foreground">{row.name}</div>
              <div className="text-xs text-muted-foreground">{row.subtitle}</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <TagBadge label={isCore ? 'Standard' : 'Country'} tone={isCore ? 'indigo' : 'gray'} />
              <TagBadge label={status.label} tone={status.tone} />
            </div>
            <ExpandableText text={status.text} />
          </li>
        )
      })}
    </ul>
  )
}
