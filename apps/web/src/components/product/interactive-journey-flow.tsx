'use client'

import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import type { DiagramElement, DiagramNodeVariant } from '@/data/product/nesy-types'
import { flowNodeStyles } from './flow-diagram'
import { EASE, type Tone } from './tones'

export function InteractiveJourneyFlow({
  elements,
  selectedId,
  onSelect,
  className,
}: {
  elements: DiagramElement[]
  tone?: Tone
  selectedId: string | null
  onSelect: (id: string) => void
  className?: string
}) {
  return (
    <motion.div
      className={cn('flex w-full flex-col items-center', className)}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
    >
      {elements.map((el, i) => (
        <InteractiveElement
          key={i}
          element={el}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </motion.div>
  )
}

function InteractiveElement({
  element,
  selectedId,
  onSelect,
}: {
  element: DiagramElement
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  switch (element.type) {
    case 'node':
      return (
        <InteractiveNode
          id={element.id}
          label={element.label}
          variant={element.variant}
          desc={element.desc}
          selected={Boolean(element.id && element.id === selectedId)}
          onSelect={onSelect}
        />
      )
    case 'arrow':
      return <InteractiveArrow label={element.label} />
    case 'branch':
      return (
        <InteractiveBranch branch={element} selectedId={selectedId} onSelect={onSelect} />
      )
    default:
      return null
  }
}

function InteractiveNode({
  id,
  label,
  variant,
  desc,
  selected,
  onSelect,
}: {
  id?: string
  label: string
  variant: DiagramNodeVariant
  desc?: string
  selected: boolean
  onSelect: (id: string) => void
}) {
  const style = flowNodeStyles[variant]
  const Icon = style.icon
  const selectable = Boolean(id)

  const className = cn(
    'relative flex w-full max-w-xs items-center gap-2.5 rounded-xl border px-4 py-2.5 shadow-sm transition-all sm:max-w-sm',
    style.bg,
    style.border,
    variant === 'decision' && 'rounded-2xl border-2 shadow-amber-100/50 dark:shadow-amber-900/20',
    selectable && 'cursor-pointer text-left hover:shadow-md hover:-translate-y-px',
    selected && 'ring-2 ring-nesy ring-offset-2 scale-[1.02] shadow-md',
  )

  const content = (
    <>
      <span
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-lg',
          style.iconBg,
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <div className={cn('text-[13px] font-semibold leading-tight', style.text)}>{label}</div>
        {desc && (
          <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{desc}</div>
        )}
      </div>
    </>
  )

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
      }}
      className="w-full flex justify-center"
    >
      {selectable && id ? (
        <button
          type="button"
          className={className}
          aria-pressed={selected}
          onClick={() => onSelect(id)}
        >
          {content}
        </button>
      ) : (
        <div className={className}>{content}</div>
      )}
    </motion.div>
  )
}

function InteractiveArrow({ label }: { label?: string }) {
  return (
    <motion.div
      className="flex flex-col items-center py-0.5"
      variants={{
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { duration: 0.25, ease: EASE } },
      }}
    >
      <div className="h-5 w-px bg-border" />
      {label && (
        <span className="-my-0.5 rounded border border-border/50 bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {label}
        </span>
      )}
      {label && <div className="h-2 w-px bg-border" />}
      <ChevronDown className="-mt-1.5 size-3.5 text-muted-foreground" />
    </motion.div>
  )
}

function InteractiveBranch({
  branch,
  selectedId,
  onSelect,
}: {
  branch: Extract<DiagramElement, { type: 'branch' }>
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex w-full flex-col items-center">
      <div className="relative w-full max-w-md lg:max-w-lg">
        <div className="absolute top-0 right-1/4 left-1/4 h-px bg-border" />
        <div className="absolute top-0 left-1/4 h-3 w-px bg-border" />
        <div className="absolute top-0 right-1/4 h-3 w-px bg-border" />
      </div>

      <div className="mt-3 grid w-full max-w-md grid-cols-2 gap-3 sm:gap-4 lg:max-w-lg">
        <div className="flex flex-col items-center">
          <span className="mb-2 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-green-600 uppercase dark:border-green-800 dark:bg-green-950/50 dark:text-green-400">
            {branch.yes.label}
          </span>
          <div className="flex w-full flex-col items-center">
            {branch.yes.steps.map((step, i) => (
              <InteractiveElement
                key={`yes-${i}`}
                element={step}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center">
          <span className="mb-2 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-red-600 uppercase dark:border-red-800 dark:bg-red-950/50 dark:text-red-400">
            {branch.no.label}
          </span>
          <div className="flex w-full flex-col items-center">
            {branch.no.steps.map((step, i) => (
              <InteractiveElement
                key={`no-${i}`}
                element={step}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="relative mt-1 w-full max-w-md lg:max-w-lg">
        <div className="absolute right-1/4 bottom-0 left-1/4 h-px bg-border" />
        <div className="absolute bottom-0 left-1/4 h-3 w-px bg-border" />
        <div className="absolute right-1/4 bottom-0 h-3 w-px bg-border" />
        <div className="absolute bottom-0 left-1/2 h-3 w-px -translate-x-px bg-border" />
        <div className="h-3" />
      </div>
    </div>
  )
}
