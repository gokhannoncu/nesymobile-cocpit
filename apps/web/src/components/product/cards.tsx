'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, type LucideIcon } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { EASE, type Tone, toneCard, toneDot, toneIcon, toneIconBox, toneText } from './tones'

/** Genel kart ızgarası — stagger animasyonlu. */
export function CardGrid({
  children,
  cols = 3,
  className,
}: {
  children: ReactNode
  cols?: 2 | 3 | 4 | 5
  className?: string
}) {
  const colCls = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-2 xl:grid-cols-3',
    4: 'sm:grid-cols-2 xl:grid-cols-4',
    5: 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
  }[cols]
  return (
    <motion.div
      className={cn('grid grid-cols-1 gap-3.5', colCls, className)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.1 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
    >
      {children}
    </motion.div>
  )
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: EASE } },
}

/**
 * Bilgi kartı — ikon squircle + başlık + açıklama + madde listesi + rozetler.
 * Notion "renkli callout kartı" karşılığı; href verilirse tıklanabilir.
 */
export function InfoCard({
  icon: Icon,
  title,
  eyebrow,
  desc,
  bullets,
  badges,
  tone = 'gray',
  href,
  footer,
}: {
  icon: LucideIcon
  title: string
  eyebrow?: string
  desc?: string
  bullets?: string[]
  badges?: { label: string; tone?: Tone }[]
  tone?: Tone
  href?: string
  footer?: ReactNode
}) {
  const body = (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'group h-full rounded-xl border p-4 transition-shadow hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/30',
        toneCard[tone],
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-xl',
            toneIconBox[tone],
          )}
        >
          <Icon className={cn('size-4.5', toneIcon[tone])} />
        </span>
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div className={cn('text-[10px] font-bold uppercase tracking-[0.15em]', toneText[tone])}>
              {eyebrow}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <span className="truncate">{title}</span>
            {href && (
              <ArrowRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
            )}
          </div>
        </div>
      </div>
      {desc && <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>}
      {bullets && bullets.length > 0 && (
        <ul className="mt-2.5 space-y-1 text-xs text-foreground/80">
          {bullets.map((b) => (
            <li key={b} className="flex gap-1.5">
              <span className={cn('mt-[7px] size-1 shrink-0 rounded-full', toneIcon[tone], 'bg-current')} />
              <span className="leading-relaxed">{b}</span>
            </li>
          ))}
        </ul>
      )}
      {badges && badges.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {badges.map((b) => (
            <Badge key={b.label} variant="secondary" appearance="outline" size="xs">
              {b.label}
            </Badge>
          ))}
        </div>
      )}
      {footer && <div className="mt-3 border-t border-border/60 pt-2.5">{footer}</div>}
    </motion.div>
  )

  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  )
}

/**
 * Prensip kartı — numara + ikon + prensip + Neden / Pratikte / İhlal örneği satırları.
 */
export function PrincipleCard({
  num,
  icon: Icon,
  title,
  why,
  inPractice,
  violation,
  tone = 'teal',
}: {
  num: number
  icon: LucideIcon
  title: string
  why: string
  inPractice: string
  violation?: string
  tone?: Tone
}) {
  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -3 }}
      className={cn('h-full rounded-xl border p-4', toneCard[tone])}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white',
            toneDot[tone],
          )}
        >
          {num}
        </span>
        <Icon className={cn('size-4.5 shrink-0', toneIcon[tone])} />
        <div className="text-sm font-bold text-foreground">{title}</div>
      </div>
      <dl className="mt-3 space-y-2 text-xs leading-relaxed">
        <div>
          <dt className={cn('font-bold uppercase tracking-wide text-[10px]', toneText[tone])}>
            Neden
          </dt>
          <dd className="mt-0.5 text-foreground/85">{why}</dd>
        </div>
        <div>
          <dt className={cn('font-bold uppercase tracking-wide text-[10px]', toneText[tone])}>
            Pratikte ne demek
          </dt>
          <dd className="mt-0.5 text-foreground/85">{inPractice}</dd>
        </div>
        {violation && (
          <div>
            <dt className="font-bold uppercase tracking-wide text-[10px] text-red-600 dark:text-red-400">
              İhlal örneği
            </dt>
            <dd className="mt-0.5 text-muted-foreground italic">{violation}</dd>
          </div>
        )}
      </dl>
    </motion.div>
  )
}
