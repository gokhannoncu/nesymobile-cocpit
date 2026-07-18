'use client'

import { type ReactNode } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { EASE, type Tone, toneCard, toneDot, toneIcon, toneText } from './tones'

export function TagBadge({ label, tone = 'gray' }: { label: string; tone?: Tone }) {
  const variants: Record<
    Tone,
    'primary' | 'success' | 'warning' | 'info' | 'destructive' | 'secondary'
  > = {
    green: 'success',
    amber: 'warning',
    orange: 'warning',
    red: 'destructive',
    blue: 'info',
    indigo: 'info',
    purple: 'primary',
    teal: 'success',
    nesy: 'primary',
    gray: 'secondary',
  }

  return (
    <Badge variant={variants[tone]} appearance="light" size="sm">
      {label}
    </Badge>
  )
}

export function DataTable({
  columns,
  rows,
  className,
}: {
  columns: { key: string; label: string; className?: string }[]
  rows: Record<string, ReactNode>[]
  className?: string
}) {
  return (
    <motion.div
      className={cn('overflow-x-auto rounded-xl border border-border', className)}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  'whitespace-nowrap px-3.5 py-2.5 text-start text-[11px] font-bold uppercase tracking-wide text-muted-foreground',
                  column.className,
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={cn(
                'border-b border-border/60 transition-colors last:border-0 hover:bg-muted/30',
                rowIndex % 2 === 1 && 'bg-muted/20',
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'px-3.5 py-3 align-top leading-relaxed text-foreground/90',
                    column.className,
                  )}
                >
                  {row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  )
}

export interface BoardCard {
  title: string
  desc?: string
  icon?: LucideIcon
  badges?: { label: string; tone?: Tone }[]
  meta?: string
  href?: string
  onClick?: () => void
}

export interface BoardColumn {
  title: string
  tone?: Tone
  icon?: LucideIcon
  cards: BoardCard[]
}

export function BoardGrid({ columns, className }: { columns: BoardColumn[]; className?: string }) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-3.5 md:grid-cols-2',
        columns.length <= 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4',
        className,
      )}
    >
      {columns.map((column) => {
        const tone = column.tone ?? 'gray'
        const ColumnIcon = column.icon

        return (
          <motion.section
            key={column.title}
            className="flex flex-col rounded-xl border border-border bg-muted/20 p-2.5"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <header className="mb-2.5 flex items-center gap-2 px-1.5 pt-1">
              <span className={cn('size-2 rounded-full', toneDot[tone])} />
              {ColumnIcon && <ColumnIcon className={cn('size-3.5', toneIcon[tone])} />}
              <h3 className={cn('text-xs font-bold uppercase tracking-wide', toneText[tone])}>
                {column.title}
              </h3>
              <span className="ms-auto rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                {column.cards.length}
              </span>
            </header>

            <div className="space-y-2">
              {column.cards.map((card) => {
                const CardIcon = card.icon
                const content = (
                  <>
                    <div className="flex items-start gap-2">
                      {CardIcon && (
                        <CardIcon className={cn('mt-0.5 size-4 shrink-0', toneIcon[tone])} />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold leading-snug text-foreground">
                          {card.title}
                        </div>
                        {card.desc && (
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {card.desc}
                          </p>
                        )}
                      </div>
                    </div>

                    {(card.badges?.length || card.meta) && (
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {card.badges?.map((badge) => (
                          <TagBadge key={badge.label} label={badge.label} tone={badge.tone} />
                        ))}
                        {card.meta && (
                          <span className="ms-auto text-[10px] font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                            {card.meta}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )

                const cardClassName = cn(
                  'group block w-full rounded-lg border bg-background p-3 text-left transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  toneCard[tone],
                )

                return card.href ? (
                  <motion.div key={card.title} whileTap={{ scale: 0.99 }}>
                    <Link href={card.href} className={cardClassName}>
                      {content}
                    </Link>
                  </motion.div>
                ) : card.onClick ? (
                  <motion.button
                    type="button"
                    key={card.title}
                    onClick={card.onClick}
                    className={cardClassName}
                    whileTap={{ scale: 0.99 }}
                    aria-label={`Open ${card.title} feature details`}
                  >
                    {content}
                  </motion.button>
                ) : (
                  <motion.div key={card.title} className={cardClassName}>
                    {content}
                  </motion.div>
                )
              })}
            </div>
          </motion.section>
        )
      })}
    </div>
  )
}
