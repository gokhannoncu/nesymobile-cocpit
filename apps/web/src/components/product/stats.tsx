'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
import { animate, motion, useInView, useMotionValue } from 'framer-motion'
import { Check, type LucideIcon } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { EASE, type Tone, toneCard, toneDot, toneText } from './tones'

/** Animated count-up number that starts counting when in view (Calm Tech — ease-out). */
export function CountUp({ to, format }: { to: number; format?: (v: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const mv = useMotionValue(0)
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!inView) return
    const controls = animate(mv, to, {
      duration: 1.4,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(v),
    })
    return () => controls.stop()
  }, [inView, to, mv])

  return <span ref={ref}>{format ? format(display) : Math.round(display).toLocaleString('en-US')}</span>
}

/**
 * KPI / impact card — large animated value + label + footnote.
 * If value is a number, counter animation is applied; if string, plain display (e.g. "18–24 months").
 */
export function StatCard({
  icon: _icon,
  label,
  value,
  suffix,
  prefix,
  hint,
  tone = 'blue',
  format,
  onClick,
  active = false,
  selectionIndicator,
}: {
  icon?: LucideIcon
  label: string
  value: number | string
  suffix?: string
  prefix?: string
  hint?: string
  tone?: Tone
  format?: (v: number) => string
  /** Makes the card a toggle control (e.g. filter by status). */
  onClick?: () => void
  active?: boolean
  /** Top-right radio/check indicator for filter cards. Defaults to true when onClick is set. */
  selectionIndicator?: boolean
}) {
  const interactive = Boolean(onClick)
  const showSelection = selectionIndicator ?? interactive
  return (
    <motion.div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? active : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      className={cn(
        'relative overflow-hidden rounded-lg border p-4 outline-none transition-[box-shadow,opacity,border-color,ring-color]',
        toneCard[tone],
        interactive && 'cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/40',
        interactive && !active && 'hover:border-border/80 hover:shadow-sm',
        active &&
          cn(
            'border-current/30 shadow-sm ring-2 ring-current/20 ring-offset-1 ring-offset-background',
            toneText[tone],
          ),
      )}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, ease: EASE }}
      whileHover={interactive ? { y: -2 } : undefined}
    >
      {showSelection && interactive ? (
        <span
          aria-hidden
          className={cn(
            'absolute right-3 top-3 flex size-6 items-center justify-center rounded-full border-2 transition-all',
            active
              ? cn('border-transparent text-white shadow-sm', toneDot[tone])
              : 'border-muted-foreground/30 bg-background/70',
          )}
        >
          {active ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : null}
        </span>
      ) : null}
      <div className={cn('flex h-5 items-center gap-2', showSelection && interactive && 'pr-8')}>
        <div className="truncate text-[11px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
          {label}
        </div>
      </div>
      <div className="mt-2 min-h-[1.75rem] text-2xl lg:text-[28px] font-bold text-foreground tabular-nums leading-none">
        {prefix}
        {typeof value === 'number' ? <CountUp to={value} format={format} /> : value}
        {suffix && <span className="ml-0.5 text-base font-semibold text-foreground/70">{suffix}</span>}
      </div>
      {hint && (
        <div className="mt-2 min-h-[1rem] text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {hint}
        </div>
      )}
    </motion.div>
  )
}

/** Compact inline KPI pill — filter toggles, dense stat strips. */
export function StatPill({
  label,
  value,
  pct,
  tone = 'gray',
  active = false,
  onClick,
  delay = 0,
  title,
}: {
  label: string
  value: number
  pct?: number
  tone?: Tone
  active?: boolean
  onClick?: () => void
  delay?: number
  title?: string
}) {
  const interactive = Boolean(onClick)
  return (
    <motion.button
      type="button"
      layout
      title={title}
      aria-pressed={interactive ? active : undefined}
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: active ? 1.02 : 1 }}
      transition={{ duration: 0.32, ease: EASE, delay }}
      whileHover={interactive ? { y: -1 } : undefined}
      whileTap={interactive ? { scale: 0.96 } : undefined}
      onClick={onClick}
      className={cn(
        'group relative inline-flex min-w-0 items-center gap-1.5 overflow-hidden rounded-lg border px-2 py-1',
        'text-left outline-none transition-[box-shadow,opacity] duration-200',
        toneCard[tone],
        interactive && 'cursor-pointer hover:shadow-sm',
        interactive && !active && 'opacity-70 hover:opacity-100',
        active && 'ring-2 ring-primary/25 shadow-sm',
      )}
    >
      {pct != null && pct > 0 && (
        <motion.span
          aria-hidden
          className={cn('absolute inset-y-0 left-0 opacity-[0.12]', toneDot[tone])}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: EASE, delay: delay + 0.15 }}
        />
      )}
      <span className={cn('relative size-1.5 shrink-0 rounded-full', toneDot[tone])} />
      <span className="relative truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={cn('relative text-sm font-bold tabular-nums leading-none', toneText[tone])}>
        <CountUp to={value} />
      </span>
      {pct != null && (
        <span className="relative text-[10px] tabular-nums text-muted-foreground">%{pct}</span>
      )}
    </motion.button>
  )
}

/** KPI cards grid. */
export function StatGrid({
  children,
  cols = 4,
  className,
}: {
  children: ReactNode
  cols?: 2 | 3 | 4 | 5
  className?: string
}) {
  const colCls = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
    5: 'sm:grid-cols-2 lg:grid-cols-5',
  }[cols]
  return <div className={cn('grid grid-cols-1 gap-3', colCls, className)}>{children}</div>
}
