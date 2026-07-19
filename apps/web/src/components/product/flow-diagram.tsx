'use client'

import {
  CheckCircle2,
  CirclePlay,
  Cog,
  CornerDownLeft,
  ExternalLink,
  HelpCircle,
  RotateCcw,
  XCircle,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import type { DiagramElement, DiagramNodeVariant } from '@/data/product/nesy-types'
import type { Tone } from './tones'

/* ═══════════════════════════════════════════════════════
 * Node semantics — each variant carries its own visual weight,
 * a category eyebrow and an icon so start / decision / user-step /
 * system-step / external / result never read as the same box.
 * ═══════════════════════════════════════════════════════ */

const flowNodeStyles: Record<
  DiagramNodeVariant,
  { eyebrow: string; bg: string; border: string; text: string; icon: typeof Cog; iconBg: string }
> = {
  start: {
    eyebrow: 'START',
    bg: 'bg-teal-50/80 dark:bg-teal-950/30',
    border: 'border-teal-200 dark:border-teal-800',
    text: 'text-teal-950 dark:text-teal-100',
    icon: CirclePlay,
    iconBg: 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300',
  },
  process: {
    eyebrow: 'STEP',
    bg: 'bg-blue-50/70 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-950 dark:text-blue-100',
    icon: Cog,
    iconBg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  },
  decision: {
    eyebrow: 'DECISION',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-300 dark:border-amber-700',
    text: 'text-amber-950 dark:text-amber-100',
    icon: HelpCircle,
    iconBg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  },
  end: {
    eyebrow: 'RESULT',
    bg: 'bg-green-50 dark:bg-green-950/40',
    border: 'border-green-300 dark:border-green-700',
    text: 'text-green-950 dark:text-green-100',
    icon: CheckCircle2,
    iconBg: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  },
  error: {
    eyebrow: 'RETRY',
    bg: 'bg-red-50/80 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-950 dark:text-red-100',
    icon: RotateCcw,
    iconBg: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  },
  external: {
    eyebrow: 'EXTERNAL',
    bg: 'bg-purple-50/80 dark:bg-purple-950/30',
    border: 'border-purple-200 border-dashed dark:border-purple-800',
    text: 'text-purple-950 dark:text-purple-100',
    icon: ExternalLink,
    iconBg: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  },
}

/* ═══════════════════════════════════════════════════════
 * Branch semantics — infer a colour from the branch label so
 * Yes / No / Cash / Credit Card each get a distinct pill and a
 * whisper-light lane, instead of one heavy bordered container.
 * ═══════════════════════════════════════════════════════ */

type BranchTone = {
  pill: string
  line: string
  lane: string
  dot: string
}

const branchTones = {
  yes: {
    pill: 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300',
    line: 'bg-green-300 dark:bg-green-700',
    lane: 'bg-green-50/40 border-green-100/80 dark:bg-green-950/15 dark:border-green-900/40',
    dot: 'bg-green-500',
  },
  no: {
    pill: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
    line: 'bg-red-300 dark:bg-red-700',
    lane: 'bg-red-50/40 border-red-100/80 dark:bg-red-950/15 dark:border-red-900/40',
    dot: 'bg-red-500',
  },
  cash: {
    pill: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300',
    line: 'bg-teal-300 dark:bg-teal-700',
    lane: 'bg-teal-50/40 border-teal-100/80 dark:bg-teal-950/15 dark:border-teal-900/40',
    dot: 'bg-teal-500',
  },
  card: {
    pill: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300',
    line: 'bg-purple-300 dark:bg-purple-700',
    lane: 'bg-purple-50/40 border-purple-100/80 dark:bg-purple-950/15 dark:border-purple-900/40',
    dot: 'bg-purple-500',
  },
  neutral: {
    pill: 'bg-muted text-muted-foreground',
    line: 'bg-border',
    lane: 'bg-muted/20 border-border/60',
    dot: 'bg-muted-foreground/60',
  },
} satisfies Record<string, BranchTone>

type BranchKind = 'yes' | 'no' | 'cash' | 'card' | 'neutral'

function branchKindFor(label: string): BranchKind {
  const l = label.trim().toLowerCase()
  if (/(cash|nakit)/.test(l)) return 'cash'
  if (/(credit|card|kart|kredi)/.test(l)) return 'card'
  if (/^(yes|evet|onay|success)/.test(l)) return 'yes'
  if (/^(no|hay[ıi]r|fail)/.test(l)) return 'no'
  return 'neutral'
}

/* ═══════════════════════════════════════════════════════ */

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
    <div className={cn('w-full', className)}>
      <FlowLegend />
      <div className="overflow-x-auto pb-2">
        <div className="mx-auto flex w-fit min-w-full flex-col items-center px-2">
          {elements.map((element, index) => (
            <FlowElement key={index} element={element} tone={tone} />
          ))}
        </div>
      </div>
    </div>
  )
}

function FlowLegend() {
  const items: { variant: DiagramNodeVariant; label: string }[] = [
    { variant: 'start', label: 'Start' },
    { variant: 'process', label: 'Step' },
    { variant: 'decision', label: 'Decision' },
    { variant: 'external', label: 'External app' },
    { variant: 'end', label: 'Result' },
    { variant: 'error', label: 'Retry' },
  ]
  return (
    <div className="mb-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
      {items.map(({ variant, label }) => {
        const style = flowNodeStyles[variant]
        return (
          <span key={variant} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={cn('size-2.5 rounded-full border', style.bg, style.border)} />
            {label}
          </span>
        )
      })}
    </div>
  )
}

function FlowElement({ element, tone }: { element: DiagramElement; tone: Tone }) {
  switch (element.type) {
    case 'node':
      return <FlowNode label={element.label} variant={element.variant} desc={element.desc} />
    case 'arrow':
      return <FlowConnector label={element.label} />
    case 'branch':
      return <FlowBranch branch={element} tone={tone} />
    default:
      return null
  }
}

function FlowNode({
  label,
  variant,
  desc,
}: {
  label: string
  variant: DiagramNodeVariant
  desc?: string
}) {
  const style = flowNodeStyles[variant]
  const Icon = style.icon
  const isDecision = variant === 'decision'
  const isResult = variant === 'end'

  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          'flex items-center gap-2 rounded-xl border px-3 py-2 shadow-sm',
          'w-[12.5rem] max-w-full',
          isResult && 'w-[14.5rem]',
          style.bg,
          style.border,
          isDecision && 'ring-1 ring-amber-200/70 dark:ring-amber-800/40',
        )}
      >
        <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg', style.iconBg)}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn('text-[10px] font-bold uppercase tracking-[0.12em] opacity-60', style.text)}>
            {style.eyebrow}
          </p>
          <p className={cn('text-[13px] font-semibold leading-snug', style.text)}>{label}</p>
          {desc && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{desc}</p>}
        </div>
      </div>

      {variant === 'error' && (
        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50/60 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          <CornerDownLeft className="size-3" />
          loops back
        </span>
      )}
    </div>
  )
}

function FlowConnector({ label, tone }: { label?: string; tone?: BranchTone }) {
  return (
    <div className="flex flex-col items-center">
      <div className="h-3.5 w-px bg-border" />
      {label ? (
        <span
          className={cn(
            'my-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
            tone ? tone.pill : 'border border-border/60 bg-background text-muted-foreground',
          )}
        >
          {label}
        </span>
      ) : (
        <ArrowGlyph />
      )}
      <div className="h-3.5 w-px bg-border" />
    </div>
  )
}

function ArrowGlyph() {
  return (
    <span className="my-px flex flex-col items-center">
      <span className="h-2 w-px bg-border" />
      <span className="-mt-px size-1.5 rotate-45 border-b border-r border-border" />
    </span>
  )
}

/* ═══════════════════════════════════════════════════════
 * Branch — a centred fork into balanced, self-sized columns.
 * No heavy containers, no forced equal heights: a short branch
 * stays short (items-start) and each lane is a whisper-light tint.
 * ═══════════════════════════════════════════════════════ */

function FlowBranch({
  branch,
  tone,
}: {
  branch: Extract<DiagramElement, { type: 'branch' }>
  tone: Tone
}) {
  return (
    <div className="flex flex-col items-center">
      {/* fork stem */}
      <div className="h-3.5 w-px bg-border" />
      <div className="flex items-start justify-center gap-2 sm:gap-3">
        <BranchColumn label={branch.yes.label} steps={branch.yes.steps} tone={tone} />
        <BranchColumn label={branch.no.label} steps={branch.no.steps} tone={tone} />
      </div>
    </div>
  )
}

function BranchColumn({
  label,
  steps,
  tone,
}: {
  label: string
  steps: DiagramElement[]
  tone: Tone
}) {
  const kind = branchKindFor(label)
  const bt = branchTones[kind]
  // Only the Cash / Credit Card comparison gets a whisper-light lane so the
  // two payment paths read as parallel. Yes / No / other branches stay
  // container-free — no big empty boxes wrapping a decision path.
  const withLane = kind === 'cash' || kind === 'card'

  return (
    <div className="flex flex-col items-center">
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
          bt.pill,
        )}
      >
        <span className={cn('size-1.5 rounded-full', bt.dot)} />
        {label}
      </span>
      <div className={cn('h-3 w-px', bt.line)} />
      <div
        className={cn(
          'flex flex-col items-center',
          withLane && cn('rounded-xl border px-2 py-2.5', bt.lane),
        )}
      >
        {steps.map((step, index) => (
          <BranchStep key={index} step={step} tone={tone} last={index === steps.length - 1} />
        ))}
      </div>
    </div>
  )
}

function BranchStep({
  step,
  tone,
  last,
}: {
  step: DiagramElement
  tone: Tone
  last: boolean
}) {
  if (step.type === 'branch') {
    return <FlowBranch branch={step} tone={tone} />
  }
  if (step.type === 'arrow') {
    return <FlowConnector label={step.label} />
  }
  return (
    <>
      <FlowNode label={step.label} variant={step.variant} desc={step.desc} />
      {!last && <ArrowGlyph />}
    </>
  )
}
