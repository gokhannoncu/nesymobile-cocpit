'use client'

import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Check, X, type LucideIcon } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { EASE, type Tone, toneCard, toneIcon, toneText } from './tones'

/**
 * Color-headed comparison table — equivalent of Notion colored table.
 * Scrolls horizontally within its own container (page body never scrolls horizontally).
 */
export function ComparisonTable({
  headers,
  rows,
  highlightCol,
  className,
  density = 'default',
}: {
  headers: { label: string; tone?: Tone }[]
  rows: ReactNode[][]
  /** Index of the column to highlight (e.g. the "CORE" column). */
  highlightCol?: number
  className?: string
  /** `dense` — tighter rows, stronger zebra and cell borders. */
  density?: 'default' | 'dense'
}) {
  const dense = density === 'dense'

  return (
    <motion.div
      className={cn(
        'overflow-x-auto rounded-lg border border-border bg-card',
        dense && 'border-border/90 shadow-sm',
        className,
      )}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <table className={cn('w-full', dense ? 'text-xs' : 'text-sm', dense && 'border-collapse')}>
        <thead>
          <tr className={cn('border-b border-border bg-muted/60', dense && 'border-border')}>
            {headers.map((h, i) => (
              <th
                key={h.label}
                className={cn(
                  'text-start font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap',
                  dense ? 'border-r border-border px-3 py-2 text-[10px] last:border-r-0' : 'px-4 py-2.5 text-xs font-bold',
                  h.tone && toneText[h.tone],
                  highlightCol === i && 'bg-primary/5',
                )}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className={cn(
                'border-b border-border transition-colors',
                dense ? 'border-border/80 hover:bg-muted/50' : 'border-border/60 hover:bg-muted/30',
                dense
                  ? ri % 2 === 0
                    ? 'bg-background'
                    : 'bg-muted/35'
                  : ri % 2 === 1 && 'bg-muted/20',
                dense && 'last:border-b-0',
                !dense && 'last:border-0',
              )}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={cn(
                    'align-middle text-foreground/90',
                    dense
                      ? 'border-r border-border/80 px-3 py-2 leading-snug last:border-r-0'
                      : 'px-4 py-3 align-top leading-relaxed',
                    ci === 0 && (dense ? 'font-medium text-foreground' : 'font-medium text-foreground'),
                    highlightCol === ci && 'bg-primary/5',
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  )
}

/**
 * Does / Does Not dual panel — green checkmark and red cross lists side by side.
 */
export function DoesDontGrid({
  doesTitle = 'What It Does',
  dontTitle = 'What It Does Not',
  does,
  dont,
}: {
  doesTitle?: string
  dontTitle?: string
  does: string[]
  dont: string[]
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      <BoundaryPanel title={doesTitle} items={does} tone="green" icon={Check} />
      <BoundaryPanel title={dontTitle} items={dont} tone="red" icon={X} />
    </div>
  )
}

function BoundaryPanel({
  title,
  items,
  tone,
  icon: Icon,
}: {
  title: string
  items: string[]
  tone: Tone
  icon: LucideIcon
}) {
  return (
    <motion.div
      className={cn('rounded-xl border p-4', toneCard[tone])}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <div className={cn('text-xs font-bold uppercase tracking-wide', toneText[tone])}>{title}</div>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-foreground/90">
            <Icon className={cn('size-4 shrink-0 mt-0.5', toneIcon[tone])} />
            <span className="leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  )
}
