'use client'

import { motion } from 'framer-motion'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { EASE, type Tone, toneCard, toneDot, toneIcon, toneText } from './tones'

export interface TimelineItem {
  /** Dönem etiketi — "Faz 1 · Ay 1-3", "Şimdi", "2026 Q1" */
  period: string
  title: string
  desc?: string
  icon?: LucideIcon
  tone?: Tone
  bullets?: string[]
  badges?: string[]
  /** Durum işareti — "done" geçmiş, "active" mevcut, "next" gelecek */
  status?: 'done' | 'active' | 'next'
}

const statusBadge: Record<NonNullable<TimelineItem['status']>, { label: string; cls: string }> = {
  done: { label: 'Tamamlandı', cls: 'bg-green-500' },
  active: { label: 'Aktif', cls: 'bg-blue-500 animate-pulse' },
  next: { label: 'Sırada', cls: 'bg-muted-foreground/50' },
}

/**
 * Dikey zaman şeridi — faz / horizon / kronolojik değişim için.
 * Sol tarafta renkli hat + nokta; her öğe tint kart.
 */
export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <motion.ol
      className={cn('relative space-y-0 ps-0', className)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.05 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
    >
      {items.map((item, i) => {
        const Icon = item.icon
        const tone = item.tone ?? 'blue'
        const isLast = i === items.length - 1
        return (
          <motion.li
            key={item.title + i}
            className="relative flex gap-4 pb-6 last:pb-0"
            variants={{
              hidden: { opacity: 0, x: -10 },
              show: { opacity: 1, x: 0, transition: { duration: 0.4, ease: EASE } },
            }}
          >
            {/* Hat + nokta */}
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'z-10 mt-1.5 flex size-3.5 shrink-0 items-center justify-center rounded-full ring-4 ring-background',
                  toneDot[tone],
                )}
              />
              {!isLast && <span className="w-px flex-1 bg-border" />}
            </div>

            <div className={cn('mb-1 flex-1 rounded-xl border p-4 min-w-0', toneCard[tone])}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className={cn('text-[11px] font-bold uppercase tracking-[0.15em]', toneText[tone])}>
                  {item.period}
                </span>
                {item.status && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    <span className={cn('size-1.5 rounded-full', statusBadge[item.status].cls)} />
                    {statusBadge[item.status].label}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2">
                {Icon && <Icon className={cn('size-4.5 shrink-0', toneIcon[tone])} />}
                <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
              </div>
              {item.desc && (
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
              )}
              {item.bullets && item.bullets.length > 0 && (
                <ul className="mt-2.5 grid gap-1 sm:grid-cols-2">
                  {item.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-1.5 text-xs text-foreground/85">
                      <span className={cn('mt-[6px] size-1 shrink-0 rounded-full', toneDot[tone])} />
                      <span className="leading-relaxed">{b}</span>
                    </li>
                  ))}
                </ul>
              )}
              {item.badges && item.badges.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {item.badges.map((b) => (
                    <Badge key={b} variant="secondary" appearance="outline" size="xs">
                      {b}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </motion.li>
        )
      })}
    </motion.ol>
  )
}
