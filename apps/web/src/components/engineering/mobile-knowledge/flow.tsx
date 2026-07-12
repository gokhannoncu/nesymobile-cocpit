'use client'

// Dikey akış diyagramı (Temel akış / Event chain) ve source-of-truth lineage.
// Node'a tıklanınca varsa detay açılır. Mimari SVG diyagramların aksine bu
// bileşen içerik-güdümlü ve yeniden kullanılabilir.

import { useState } from 'react'
import { ChevronDown, CornerDownRight } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { toneCard, toneDot, toneText, type Tone } from '@/components/product'
import { SourceLevelBadge } from './badges'
import type { FlowStep, LineageNode } from '@/data/engineering/mobile-knowledge/types'

export function FlowDiagram({ steps, className }: { steps: FlowStep[]; className?: string }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className={cn('space-y-0', className)}>
      {steps.map((step, i) => {
        const tone: Tone = step.tone ?? 'blue'
        const isOpen = open === step.id
        const hasDetail = Boolean(step.detail)
        return (
          <div key={step.id}>
            <div className={cn('flex items-stretch gap-3', step.branch && 'ml-6')}>
              <div className="flex flex-col items-center">
                {step.branch ? (
                  <CornerDownRight className={cn('size-4', toneText[tone])} />
                ) : (
                  <span className={cn('mt-3 size-2.5 shrink-0 rounded-full', toneDot[tone])} />
                )}
                {i < steps.length - 1 && <span className="my-1 w-px flex-1 bg-border" />}
              </div>
              <button
                type="button"
                disabled={!hasDetail}
                onClick={() => setOpen(isOpen ? null : step.id)}
                className={cn(
                  'group my-1 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-start transition-colors',
                  toneCard[tone],
                  hasDetail ? 'cursor-pointer hover:brightness-[0.98]' : 'cursor-default',
                )}
              >
                <span className="flex flex-col">
                  <span className={cn('text-sm font-medium', toneText[tone])}>{step.label}</span>
                  {step.note && <span className="text-xs text-muted-foreground">{step.note}</span>}
                </span>
                {hasDetail && (
                  <ChevronDown
                    className={cn('size-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')}
                  />
                )}
              </button>
            </div>
            {hasDetail && isOpen && (
              <div className={cn('mb-1 ml-8 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground', step.branch && 'ml-14')}>
                {step.detail}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Dikey source-of-truth lineage; her node'da otorite seviyesi rozeti. */
export function Lineage({ nodes, className }: { nodes: LineageNode[]; className?: string }) {
  return (
    <div className={cn('space-y-0', className)}>
      {nodes.map((node, i) => (
        <div key={node.label} className="flex items-stretch gap-3">
          <div className="flex flex-col items-center">
            <span className="mt-3 size-2 shrink-0 rounded-full bg-foreground/40" />
            {i < nodes.length - 1 && <span className="my-1 w-px flex-1 bg-border" />}
          </div>
          <div className="my-1 flex w-full items-center justify-between rounded-lg border bg-card px-3 py-2">
            <span className="text-sm font-medium">{node.label}</span>
            <SourceLevelBadge level={node.level} />
          </div>
        </div>
      ))}
    </div>
  )
}
