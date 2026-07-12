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
 * Sayfa üstü büyük renkli başlık bloğu — "header callout".
 * Degrade tint zemin + ikon squircle + eyebrow + başlık + tek cümle amaç + chip'ler.
 */
export function HeroCallout({
  icon: Icon,
  eyebrow,
  title,
  lead,
  tone = 'purple',
  chips,
  children,
}: {
  icon: LucideIcon
  eyebrow: string
  title: string
  /** Sayfanın tek cümlelik amacı — "bu sayfa hangi soruya cevap veriyor?" */
  lead: string
  tone?: Tone
  /** Kısa etiketler — ör. kapsam, durum, sahip. */
  chips?: string[]
  /** Sağ tarafa yaslanan opsiyonel içerik (mini istatistik vb.) */
  children?: ReactNode
}) {
  return (
    <motion.section
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 lg:p-8',
        toneHero[tone],
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
    >
      {/* Dekoratif nokta ızgarası */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20 [background-image:radial-gradient(circle,currentColor_1px,transparent_1px)] [background-size:22px_22px] text-foreground/10"
      />
      <div className="relative flex flex-col lg:flex-row lg:items-start gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-4">
            <span
              className={cn(
                'flex size-12 shrink-0 items-center justify-center rounded-2xl',
                toneIconBox[tone],
              )}
            >
              <Icon className={cn('size-6', toneIcon[tone])} />
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
              <h1 className="mt-1 text-2xl lg:text-3xl font-bold text-foreground text-balance">
                {title}
              </h1>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-sm lg:text-[15px] leading-relaxed text-foreground/85">
            {lead}
          </p>
          {chips && chips.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <Badge key={c} variant="secondary" appearance="outline" size="sm">
                  {c}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {children && <div className="shrink-0 lg:max-w-sm">{children}</div>}
      </div>
    </motion.section>
  )
}

/** Satır içi renkli vurgu kutusu — callout. */
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
