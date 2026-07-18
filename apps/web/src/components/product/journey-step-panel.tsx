'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Lightbulb, MapPin, Target, UserRound } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import type { JourneyStepDetail } from '@/data/product/user-journeys'
import { EASE, type Tone, toneIconBox, toneText } from './tones'

export function JourneyStepPanel({ step, tone }: { step: JourneyStepDetail; tone: Tone }) {
  return (
    <section
      aria-label="Step detail"
      className="rounded-2xl border border-border bg-background p-4 lg:p-5"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={step.title}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="space-y-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-base font-bold text-foreground">{step.title}</h3>
            <div className="flex flex-wrap gap-1.5">
              {step.nesyActive && (
                <span
                  className={cn(
                    'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase',
                    toneIconBox[tone],
                    toneText[tone],
                  )}
                >
                  ◈ Nesy active
                </span>
              )}
              {step.actor && (
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  <UserRound className="size-3" />
                  {step.actor}
                </span>
              )}
            </div>
          </div>

          <p className="text-sm leading-relaxed text-foreground/90">{step.whatHappens}</p>

          <div className="grid gap-3 sm:grid-cols-3">
            <DetailChip icon={Target} label="Courier goal" value={step.courierGoal} />
            <DetailChip icon={MapPin} label="Touchpoint" value={step.touchpoint} />
            <DetailChip icon={UserRound} label="Experience" value={step.experience} />
          </div>

          <div
            className={cn(
              'rounded-xl border p-3',
              toneIconBox[tone],
              'border-transparent dark:border-border/40',
            )}
          >
            <div className={cn('mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide', toneText[tone])}>
              <Lightbulb className="size-3.5" />
              Design opportunity
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">{step.designOpportunity}</p>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  )
}

function DetailChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Target
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
        <Icon className="size-3" />
        {label}
      </div>
      <p className="text-xs leading-relaxed text-foreground">{value}</p>
    </div>
  )
}
