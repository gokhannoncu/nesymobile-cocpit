'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, XCircle, type LucideIcon } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@nesy/metronic/components/ui/tooltip'
import { EASE, type Tone, toneCard, toneIcon, toneText, toneDot } from './tones'

// ═══ Evidence Ref Badge ═════════════════════════════════════════════════════

export type EvidenceLevel = 'confirmed' | 'needs-validation' | 'unverified'

const levelConfig: Record<EvidenceLevel, { icon: LucideIcon; tone: Tone; label: string }> = {
  confirmed: { icon: CheckCircle2, tone: 'green', label: 'Doğrulandı' },
  'needs-validation': { icon: AlertTriangle, tone: 'amber', label: 'Doğrulama Bekliyor' },
  unverified: { icon: XCircle, tone: 'red', label: 'Doğrulanmadı' },
}

export function EvidenceRef({
  level,
  label,
  tooltip,
  className,
}: {
  level: EvidenceLevel
  label: string
  tooltip?: string
  className?: string
}) {
  const config = levelConfig[level]
  const Icon = config.icon

  const badge = (
    <motion.span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
        toneCard[config.tone],
        className,
      )}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      <Icon className={cn('size-3.5', toneIcon[config.tone])} />
      <span className={toneText[config.tone]}>{label}</span>
    </motion.span>
  )

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    )
  }

  return badge
}

// ═══ Severity Badge ═════════════════════════════════════════════════════════

const severityTone: Record<string, Tone> = {
  Critical: 'red',
  High: 'orange',
  Medium: 'amber',
  Low: 'green',
}

export function SeverityBadge({ severity, className }: { severity: string; className?: string }) {
  const tone = severityTone[severity] ?? 'gray'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide',
        toneCard[tone],
        toneText[tone],
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', toneDot[tone])} />
      {severity}
    </span>
  )
}

// ═══ Recurrence Risk Badge ══════════════════════════════════════════════════

const riskTone: Record<string, Tone> = {
  high: 'red',
  medium: 'amber',
  low: 'green',
}

const riskLabel: Record<string, string> = {
  high: 'Yüksek Tekrar Riski',
  medium: 'Orta Tekrar Riski',
  low: 'Düşük Tekrar Riski',
}

export function RecurrenceRiskBadge({ risk, className }: { risk: string; className?: string }) {
  const tone = riskTone[risk] ?? 'gray'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
        toneCard[tone],
        toneText[tone],
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', toneDot[tone])} />
      {riskLabel[risk] ?? risk}
    </span>
  )
}

// ═══ Status Badge ═══════════════════════════════════════════════════════════

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const isOpen = status === 'open'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide',
        isOpen
          ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-900/60 dark:text-blue-300'
          : 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-900/60 dark:text-green-300',
        'border',
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', isOpen ? 'bg-blue-500 animate-pulse' : 'bg-green-600')} />
      {isOpen ? 'Open' : 'Closed'}
    </span>
  )
}

// ═══ Guardrail Callout ══════════════════════════════════════════════════════

export function GuardrailCallout({
  title,
  children,
  tone = 'amber',
  icon: Icon,
  className,
}: {
  title: string
  children: React.ReactNode
  tone?: Tone
  icon?: LucideIcon
  className?: string
}) {
  return (
    <motion.div
      className={cn(
        'rounded-xl border-2 border-dashed p-4',
        toneCard[tone],
        className,
      )}
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className={cn('size-4.5', toneIcon[tone])} />}
        <span className={cn('text-xs font-bold uppercase tracking-wide', toneText[tone])}>{title}</span>
      </div>
      <div className="text-sm text-foreground/80 leading-relaxed">{children}</div>
    </motion.div>
  )
}
