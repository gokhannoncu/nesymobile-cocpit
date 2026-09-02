'use client'

import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import {
  EASE,
  type Tone,
  toneCard,
  toneHero,
  toneIcon,
  toneIconBox,
  toneText,
} from './tones'

/**
 * Large colored header block at the top of the page — "header callout".
 * Gradient tint background + icon squircle + eyebrow + title + single-sentence purpose + chips.
 */
export function HeroCallout({
  icon: Icon,
  eyebrow,
  title,
  lead,
  tone = 'purple',
  chips,
  children,
  compact = false,
  /** `split` = stats beside title (default). `stack` = full-width stats under the lead. */
  layout = 'split',
  /** Top-right header actions (e.g. refresh). */
  actions,
}: {
  icon: LucideIcon
  eyebrow: string
  title: string
  /** Single-sentence purpose of the page — "what question does this page answer?" */
  lead: string
  tone?: Tone
  /** Short labels — e.g. scope, status, owner. */
  chips?: string[]
  /** Optional content aligned to the right (mini statistics, etc.) */
  children?: ReactNode
  /** Tighter padding and type scale for denser page headers. */
  compact?: boolean
  layout?: 'split' | 'stack'
  actions?: ReactNode
}) {
  const stack = layout === 'stack'
  return (
    <motion.section
      className={cn(
        'relative overflow-hidden border bg-gradient-to-br',
        compact ? 'rounded-lg p-4 lg:p-5' : 'rounded-2xl p-6 lg:p-8',
        toneHero[tone],
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
    >
      {actions ? (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-2 sm:right-4 sm:top-4">
          {actions}
        </div>
      ) : null}
      {/* Decorative dot grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20 [background-image:radial-gradient(circle,currentColor_1px,transparent_1px)] [background-size:22px_22px] text-foreground/10"
      />
      <div
        className={cn(
          'relative flex flex-col',
          compact ? 'gap-4' : 'gap-6',
          !stack && 'lg:flex-row lg:items-start',
        )}
      >
        <div className={cn('flex-1 min-w-0', actions && 'pr-28 sm:pr-32')}>
          <div className={cn('flex items-start', compact ? 'gap-3' : 'gap-4')}>
            <span
              className={cn(
                'flex shrink-0 items-center justify-center',
                compact ? 'size-9 rounded-lg' : 'size-12 rounded-2xl',
                toneIconBox[tone],
              )}
            >
              <Icon className={cn(compact ? 'size-4' : 'size-6', toneIcon[tone])} />
            </span>
            <div className="min-w-0">
              <div
                className={cn(
                  'text-[11px] font-bold uppercase tracking-[0.2em]',
                  toneIcon[tone],
                )}
              >
                {eyebrow}
              </div>
              <h1
                className={cn(
                  'mt-1 font-bold text-foreground text-balance',
                  compact ? 'text-xl lg:text-2xl' : 'text-2xl lg:text-3xl',
                )}
              >
                {title}
              </h1>
            </div>
          </div>
          <p
            className={cn(
              'max-w-3xl leading-relaxed text-foreground/85',
              compact ? 'mt-2 text-sm' : 'mt-4 text-sm lg:text-[15px]',
            )}
          >
            {lead}
          </p>
          {chips && chips.length > 0 && (
            <div className={cn('flex flex-wrap gap-1.5', compact ? 'mt-2.5' : 'mt-4')}>
              {chips.map((c) => (
                <Badge key={c} variant="secondary" appearance="outline" size="sm" className="rounded-lg">
                  {c}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {children && (
          <div className={cn(stack ? 'w-full' : 'shrink-0 lg:max-w-sm')}>{children}</div>
        )}
      </div>
    </motion.section>
  )
}

/** Inline colored highlight box — callout. */
export function Callout({
  icon: Icon,
  title,
  tone = 'blue',
  children,
  className,
}: {
  icon: LucideIcon
  title?: string
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      className={cn('rounded-xl border p-4 flex items-start gap-3', toneCard[tone], className)}
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <Icon className={cn('size-4.5 shrink-0 mt-0.5', toneIcon[tone])} />
      <div className="min-w-0 flex-1 text-sm leading-relaxed text-foreground/90">
        {title && (
          <div className={cn('mb-1 text-xs font-bold uppercase tracking-wide', toneText[tone])}>
            {title}
          </div>
        )}
        {children}
      </div>
    </motion.div>
  )
}
