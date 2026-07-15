'use client'

import { motion } from 'framer-motion'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import {
  EASE,
  type Tone,
  toneCard,
  toneDot,
  toneIcon,
  toneIconBox,
  toneText,
} from './tones'

export interface JourneyStep {
  label: string
  desc?: string
  icon?: LucideIcon
  tone?: Tone
  /** 1 = high friction, 5 = safe and comfortable. */
  emotion: 1 | 2 | 3 | 4 | 5
  /** Indicates that Nesy Mobile directly manages this touchpoint. */
  nesy?: boolean
}

const EMOTION_LABELS = ['😰 high friction', '😟 anxious', '😐 focused', '🙂 comfortable', '😌 safe']

const curveStroke: Record<Tone, string> = {
  purple: 'stroke-purple-500',
  blue: 'stroke-blue-500',
  green: 'stroke-green-600',
  orange: 'stroke-orange-500',
  red: 'stroke-red-500',
  amber: 'stroke-amber-500',
  teal: 'stroke-teal-500',
  indigo: 'stroke-indigo-500',
  gray: 'stroke-muted-foreground',
}

const curveFill: Record<Tone, string> = {
  purple: 'fill-purple-500',
  blue: 'fill-blue-500',
  green: 'fill-green-600',
  orange: 'fill-orange-500',
  red: 'fill-red-500',
  amber: 'fill-amber-500',
  teal: 'fill-teal-500',
  indigo: 'fill-indigo-500',
  gray: 'fill-muted-foreground',
}

export function JourneyMap({
  steps,
  tone = 'orange',
  className,
}: {
  steps: JourneyStep[]
  tone?: Tone
  className?: string
}) {
  const stepCount = steps.length
  const width = Math.max(stepCount * 150, 600)
  const height = 120
  const pointX = (index: number) =>
    stepCount === 1 ? width / 2 : (index / (stepCount - 1)) * (width - 60) + 30
  const pointY = (emotion: number) => height - 14 - ((emotion - 1) / 4) * (height - 34)
  const points = steps.map((step, index) => ({
    x: pointX(index),
    y: pointY(step.emotion),
  }))
  const path = points
    .map((point, index) => {
      const previous = points[index - 1]
      if (index === 0 || !previous) return `M ${point.x} ${point.y}`
      const controlX = (previous.x + point.x) / 2
      return `C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`
    })
    .join(' ')

  return (
    <div
      className={cn(
        'overflow-x-auto rounded-2xl border border-border bg-background p-4 lg:p-6',
        className,
      )}
    >
      <div style={{ minWidth: width }} className="space-y-4">
        <motion.div
          className="grid gap-2.5"
          style={{ gridTemplateColumns: `repeat(${stepCount}, minmax(0, 1fr))` }}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
        >
          {steps.map((step, index) => {
            const stepTone = step.tone ?? (step.nesy ? tone : 'gray')
            const Icon = step.icon

            return (
              <motion.article
                key={step.label}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
                }}
                className={cn('relative rounded-xl border p-3', toneCard[stepTone])}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'flex size-4.5 items-center justify-center rounded-full text-[10px] font-bold text-white',
                      toneDot[stepTone],
                    )}
                  >
                    {index + 1}
                  </span>
                  {Icon && <Icon className={cn('size-3.5 shrink-0', toneIcon[stepTone])} />}
                </div>
                <div className="mt-1.5 text-xs font-bold leading-snug text-foreground">
                  {step.label}
                </div>
                {step.desc && (
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {step.desc}
                  </p>
                )}
                {step.nesy && (
                  <span
                    className={cn(
                      'mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                      toneIconBox[tone],
                      toneText[tone],
                    )}
                  >
                    ◈ Nesy active
                  </span>
                )}
              </motion.article>
            )
          })}
        </motion.div>

        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Experience curve
          </div>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{ width: '100%', height: 'auto' }}
            role="img"
            aria-label="Experience and friction curve throughout the journey"
          >
            {[1, 3, 5].map((emotion) => (
              <line
                key={emotion}
                x1={20}
                x2={width - 20}
                y1={pointY(emotion)}
                y2={pointY(emotion)}
                className="stroke-border"
                strokeWidth={1}
                strokeDasharray="3 5"
              />
            ))}
            <motion.path
              d={path}
              fill="none"
              className={curveStroke[tone]}
              strokeWidth={2.5}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
            {points.map((point, index) => (
              <motion.circle
                key={steps[index]?.label}
                cx={point.x}
                cy={point.y}
                r={4.5}
                className={cn(
                  'stroke-background',
                  steps[index]?.nesy ? curveFill[tone] : 'fill-muted-foreground',
                )}
                strokeWidth={2}
                initial={{ scale: 0, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, ease: 'easeOut', delay: 0.15 + index * 0.08 }}
              />
            ))}
          </svg>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{EMOTION_LABELS[0]}</span>
            <span>{EMOTION_LABELS[4]}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
