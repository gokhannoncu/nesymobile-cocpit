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
}: {
  headers: { label: string; tone?: Tone }[]
  rows: ReactNode[][]
  /** Index of the column to highlight (e.g. the "CORE" column). */
  highlightCol?: number
  className?: string
}) {
  return (
    <motion.div
      className={cn('overflow-x-auto rounded-xl border border-border', className)}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {headers.map((h, i) => (
              <th
                key={h.label}
                className={cn(
                  'px-4 py-2.5 text-start text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap',
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
                'border-b border-border/60 last:border-0 transition-colors hover:bg-muted/30',
                ri % 2 === 1 && 'bg-muted/20',
              )}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={cn(
                    'px-4 py-3 align-top text-foreground/90 leading-relaxed',
                    ci === 0 && 'font-medium text-foreground',
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
