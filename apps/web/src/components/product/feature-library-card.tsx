'use client'

import { ChevronRight, CircleAlert, FileText, type LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@nesy/metronic/lib/utils'
import { COUNTRIES, isSupported } from '@/data/product/nesy'
import type { Feature } from '@/data/product/nesy'
import {
  EASE,
  type Tone,
  toneDot,
  toneIcon,
  toneIconBox,
  toneText,
} from './tones'

const activeCountries = COUNTRIES.filter((country) => country.id !== 'core')

const toneBorder: Record<Tone, string> = {
  purple: 'hover:border-purple-300 focus-visible:ring-purple-400/30 dark:hover:border-purple-800',
  blue: 'hover:border-blue-300 focus-visible:ring-blue-400/30 dark:hover:border-blue-800',
  green: 'hover:border-green-300 focus-visible:ring-green-400/30 dark:hover:border-green-800',
  orange: 'hover:border-orange-300 focus-visible:ring-orange-400/30 dark:hover:border-orange-800',
  red: 'hover:border-red-300 focus-visible:ring-red-400/30 dark:hover:border-red-800',
  amber: 'hover:border-amber-300 focus-visible:ring-amber-400/30 dark:hover:border-amber-800',
  teal: 'hover:border-teal-300 focus-visible:ring-teal-400/30 dark:hover:border-teal-800',
  indigo: 'hover:border-indigo-300 focus-visible:ring-indigo-400/30 dark:hover:border-indigo-800',
  gray: 'hover:border-foreground/25 focus-visible:ring-foreground/15',
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.36, ease: EASE } },
}

export function FeatureLibraryCard({
  feature,
  icon: Icon,
  index,
  tone,
  onClick,
}: {
  feature: Feature
  icon: LucideIcon
  index: number
  tone: Tone
  onClick: () => void
}) {
  const supportedCountries = activeCountries.filter((country) =>
    isSupported(feature.values[country.id]),
  )
  const detail = feature.detail
  const ticketCount = detail?.tickets.length ?? 0
  const isRisky = detail ? detail.score.bugProneness >= 4 : false

  return (
    <motion.button
      type="button"
      variants={itemVariants}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onClick={onClick}
      aria-label={`${feature.title} feature detayını aç`}
      className={cn(
        'group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-sm outline-none transition-[border-color,box-shadow,transform] hover:shadow-lg hover:shadow-black/[0.06] focus-visible:ring-4 dark:hover:shadow-black/25',
        toneBorder[tone],
      )}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', toneDot[tone])} />

      <div className="flex flex-1 flex-col p-5 pl-6">
        <div className="flex items-center justify-between gap-3">
          <div className={cn('text-[10px] font-bold uppercase tracking-[0.18em]', toneText[tone])}>
            Feature {String(index).padStart(2, '0')}
          </div>
          {detail && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/45 px-2 py-1 text-[10px] font-semibold text-muted-foreground">
              <span className={cn('size-1.5 rounded-full', toneDot[tone])} />
              Detay hazır
            </span>
          )}
        </div>

        <div className="mt-3 flex items-start gap-3.5">
          <span
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105',
              toneIconBox[tone],
            )}
          >
            <Icon className={cn('size-5', toneIcon[tone])} />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-[15px] font-bold leading-snug text-foreground">{feature.title}</h3>
              <ChevronRight className="mt-0.5 size-4.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {feature.desc}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-border/60 bg-muted/25 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
              Ülke kapsamı
            </span>
            <span className="text-[11px] font-semibold text-foreground">
              {supportedCountries.length}/{activeCountries.length} aktif
            </span>
          </div>
          <div className="mt-2 grid grid-cols-6 gap-1.5" aria-label="Ülke destek durumu">
            {activeCountries.map((country) => {
              const supported = isSupported(feature.values[country.id])
              return (
                <span
                  key={country.id}
                  title={`${country.name}: ${supported ? 'aktif' : 'desteklenmiyor'}`}
                  className={cn(
                    'h-1.5 rounded-full transition-colors',
                    supported ? toneDot[tone] : 'bg-border',
                  )}
                />
              )
            })}
          </div>
        </div>

        <div className="mt-3 flex min-h-6 flex-wrap items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
            <span
              className={cn(
                'size-1.5 rounded-full',
                isSupported(feature.values.core) ? 'bg-emerald-500' : 'bg-muted-foreground/40',
              )}
            />
            CORE {isSupported(feature.values.core) ? 'mevcut' : 'yok'}
          </span>

          {isRisky && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 font-semibold text-red-600 dark:bg-red-950/40 dark:text-red-400">
              <CircleAlert className="size-3" />
              Risk {detail?.score.bugProneness}/5
            </span>
          )}

          {ticketCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              <FileText className="size-3" />
              {ticketCount} ticket
            </span>
          )}

          <span className={cn('ml-auto font-bold transition-colors', toneText[tone])}>
            İncele
          </span>
        </div>
      </div>
    </motion.button>
  )
}
