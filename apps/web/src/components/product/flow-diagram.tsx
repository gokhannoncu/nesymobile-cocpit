'use client'

import {
  CheckCircle2,
  ChevronDown,
  CirclePlay,
  Cog,
  ExternalLink,
  HelpCircle,
  XCircle,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import type { DiagramElement, DiagramNodeVariant } from '@/data/product/nesy-types'
import type { Tone } from './tones'

/* ─── Node variant stilleri ─── */
const nodeStyles: Record<
  DiagramNodeVariant,
  { bg: string; border: string; text: string; icon: typeof Cog; iconBg: string }
> = {
  start: {
    bg: 'bg-teal-50 dark:bg-teal-950/40',
    border: 'border-teal-300 dark:border-teal-700',
    text: 'text-teal-800 dark:text-teal-200',
    icon: CirclePlay,
    iconBg: 'bg-teal-100 text-teal-600 dark:bg-teal-900/60 dark:text-teal-400',
  },
  process: {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    border: 'border-blue-300 dark:border-blue-700',
    text: 'text-blue-800 dark:text-blue-200',
    icon: Cog,
    iconBg: 'bg-blue-100 text-blue-600 dark:bg-blue-900/60 dark:text-blue-400',
  },
  decision: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-400 dark:border-amber-600',
    text: 'text-amber-800 dark:text-amber-200',
    icon: HelpCircle,
    iconBg: 'bg-amber-100 text-amber-600 dark:bg-amber-900/60 dark:text-amber-400',
  },
  end: {
    bg: 'bg-green-50 dark:bg-green-950/40',
    border: 'border-green-300 dark:border-green-700',
    text: 'text-green-800 dark:text-green-200',
    icon: CheckCircle2,
    iconBg: 'bg-green-100 text-green-600 dark:bg-green-900/60 dark:text-green-400',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-300 dark:border-red-700',
    text: 'text-red-800 dark:text-red-200',
    icon: XCircle,
    iconBg: 'bg-red-100 text-red-600 dark:bg-red-900/60 dark:text-red-400',
  },
  external: {
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    border: 'border-purple-300 dark:border-purple-700 border-dashed',
    text: 'text-purple-800 dark:text-purple-200',
    icon: ExternalLink,
    iconBg: 'bg-purple-100 text-purple-600 dark:bg-purple-900/60 dark:text-purple-400',
  },
}

/* ═══════════════════════════════════════════════════════
 * Ana Bileşen: FlowDiagram
 * ═══════════════════════════════════════════════════════ */

export function FlowDiagram({
  elements,
  tone = 'orange',
  className,
}: {
  elements: DiagramElement[]
  tone?: Tone
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center w-full', className)}>
      {elements.map((el, i) => (
        <FlowElement key={i} element={el} tone={tone} isLast={i === elements.length - 1} />
      ))}
    </div>
  )
}

function FlowElement({
  element,
  tone,
  isLast,
}: {
  element: DiagramElement
  tone: Tone
  isLast: boolean
}) {
  switch (element.type) {
    case 'node':
      return <FlowNode label={element.label} variant={element.variant} desc={element.desc} />
    case 'arrow':
      return <FlowArrow label={element.label} />
    case 'branch':
      return <FlowBranch branch={element} tone={tone} />
    default:
      return null
  }
}

/* ─── FlowNode: Görsel adım kartı ─── */
function FlowNode({
  label,
  variant,
  desc,
}: {
  label: string
  variant: DiagramNodeVariant
  desc?: string
}) {
  const style = nodeStyles[variant]
  const Icon = style.icon

  return (
    <div
      className={cn(
        'relative flex items-center gap-2.5 rounded-xl border px-4 py-2.5 shadow-sm transition-all',
        'max-w-xs sm:max-w-sm',
        'hover:shadow-md hover:-translate-y-px',
        style.bg,
        style.border,
        // Karar noktaları için belirgin stil
        variant === 'decision' && 'border-2 rounded-2xl shadow-amber-100/50 dark:shadow-amber-900/20',
      )}
    >
      <span
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-lg',
          style.iconBg,
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <div className={cn('text-[13px] font-semibold leading-tight', style.text)}>
          {label}
        </div>
        {desc && (
          <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{desc}</div>
        )}
      </div>
    </div>
  )
}

/* ─── FlowArrow: Bağlantı oku ─── */
function FlowArrow({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center py-0.5">
      {/* Dikey çizgi */}
      <div className="w-px h-5 bg-border dark:bg-border" />
      {label && (
        <span className="text-[10px] font-medium text-muted-foreground bg-background px-1.5 py-0.5 rounded -my-0.5 border border-border/50">
          {label}
        </span>
      )}
      {label && <div className="w-px h-2 bg-border dark:bg-border" />}
      {/* Ok başı */}
      <ChevronDown className="size-3.5 text-muted-foreground -mt-1.5" />
    </div>
  )
}

/* ─── FlowBranch: Karar dallanması ─── */
function FlowBranch({
  branch,
  tone,
}: {
  branch: Extract<DiagramElement, { type: 'branch' }>
  tone: Tone
}) {
  return (
    <div className="w-full flex flex-col items-center">
      {/* Üst bağlantı çizgisi — karar noktasından yanlara */}
      <div className="relative w-full max-w-md lg:max-w-lg">
        {/* Yatay çizgi */}
        <div className="absolute top-0 left-1/4 right-1/4 h-px bg-border" />
        {/* Sol dikey */}
        <div className="absolute top-0 left-1/4 w-px h-3 bg-border" />
        {/* Sağ dikey */}
        <div className="absolute top-0 right-1/4 w-px h-3 bg-border" />
      </div>

      {/* Dal etiketleri ve içerikleri */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full max-w-md lg:max-w-lg mt-3">
        {/* SOL DAL — Evet */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50 px-2 py-0.5 rounded-full border border-green-200 dark:border-green-800 mb-2">
            {branch.yes.label}
          </span>
          <div className="flex flex-col items-center w-full">
            {branch.yes.steps.map((step, i) => (
              <FlowElement
                key={`yes-${i}`}
                element={step}
                tone={tone}
                isLast={i === branch.yes.steps.length - 1}
              />
            ))}
          </div>
        </div>

        {/* SAĞ DAL — Hayır */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800 mb-2">
            {branch.no.label}
          </span>
          <div className="flex flex-col items-center w-full">
            {branch.no.steps.map((step, i) => (
              <FlowElement
                key={`no-${i}`}
                element={step}
                tone={tone}
                isLast={i === branch.no.steps.length - 1}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Alt birleşme çizgisi */}
      <div className="relative w-full max-w-md lg:max-w-lg mt-1">
        <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-border" />
        <div className="absolute bottom-0 left-1/4 w-px h-3 bg-border" />
        <div className="absolute bottom-0 right-1/4 w-px h-3 bg-border" />
        <div className="absolute bottom-0 left-1/2 -translate-x-px w-px h-3 bg-border" />
        <div className="h-3" />
      </div>
    </div>
  )
}
