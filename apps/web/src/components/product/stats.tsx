'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
import { animate, motion, useInView, useMotionValue } from 'framer-motion'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { EASE, type Tone, toneCard, toneDot, toneIcon } from './tones'

/** Animated count-up number that starts counting when in view (Calm Tech — ease-out). */
function CountUp({ to, format }: { to: number; format?: (v: number) => string }) {
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
  icon: Icon,
  label,
  value,
  suffix,
  prefix,
  hint,
  tone = 'blue',
  format,
}: {
  icon?: LucideIcon
  label: string
  value: number | string
  suffix?: string
  prefix?: string
  hint?: string
  tone?: Tone
  format?: (v: number) => string
}) {
  return (
    <motion.div
      className={cn('relative overflow-hidden rounded-xl border p-4', toneCard[tone])}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, ease: EASE }}
      whileHover={{ y: -2 }}
    >
      <span className={cn('absolute inset-x-0 top-0 h-0.5', toneDot[tone])} />
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        {Icon && <Icon className={cn('size-4 shrink-0', toneIcon[tone])} />}
      </div>
      <div className="mt-2 text-2xl lg:text-[28px] font-bold text-foreground tabular-nums leading-none">
        {prefix}
        {typeof value === 'number' ? <CountUp to={value} format={format} /> : value}
        {suffix && <span className="ml-0.5 text-base font-semibold text-foreground/70">{suffix}</span>}
      </div>
      {hint && <div className="mt-2 text-xs text-muted-foreground leading-relaxed">{hint}</div>}
    </motion.div>
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
