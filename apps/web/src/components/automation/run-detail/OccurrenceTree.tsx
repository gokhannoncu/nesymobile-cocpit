'use client'

import { ChevronRight, ChevronDown, Circle, PlayCircle } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { cn } from '@nesy/metronic/lib/utils'
import {
  stepLabelOf,
  stepResultOf,
  type OutcomeTone,
} from '@/lib/verdict-runtime/run-detail-view-model'
import type { RunDetailResult } from '@/lib/verdict-runtime/types'

export function OccurrenceTree({ run }: { run: RunDetailResult }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['root']))

  const toggle = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpanded(next)
  }

  return (
    <div className="border rounded-md p-4">
      <h3 className="font-medium mb-4">Occurrence Hierarchy</h3>
      <div className="space-y-1 text-sm">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-accent"
          onClick={() => toggle('root')}
          aria-expanded={expanded.has('root')}
        >
          {expanded.has('root') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <Circle className="w-4 h-4 text-primary" />
          <span>Workflow Execution</span>
        </button>
        {expanded.has('root') && (
          <div className="ml-6 max-h-80 space-y-1 overflow-y-auto">
            {run.steps.map((step, idx) => {
              const row = step as Record<string, unknown>
              const label = stepLabelOf(row, idx)
              const status = stepResultOf(row)
              const tone = toneFor(status)
              return (
                <div key={text(step.id) ?? `${label}-${idx}`} className="flex items-start gap-2 rounded px-2 py-1 hover:bg-accent">
                  <div className="w-4" />
                  <PlayCircle className="mt-0.5 w-4 h-4 shrink-0 text-blue-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words">{label}</span>
                    <Badge
                      variant="outline"
                      className={cn('mt-1 font-mono text-[10px] uppercase', badgeToneClass(tone))}
                    >
                      {status}
                    </Badge>
                  </span>
                </div>
              )
            })}
            {run.steps.length === 0 && (
              <div className="px-2 py-1 text-muted-foreground">No execution steps recorded.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function toneFor(value: string): OutcomeTone {
  if (/(FAIL|ERROR|CRASH|ABORT|REJECT|BLOCK|LEAKED|INCONCLUSIVE)/i.test(value)) return 'red'
  if (/(WARN|RISK|PARTIAL|INCONCLUSIVE)/i.test(value)) return 'amber'
  if (/(PASS|SUCCEEDED|SUCCESS|COMPLETED|DONE|NORMAL|RELEASED|VERIFIED|MATCH)/i.test(value)) return 'green'
  if (value === 'NOT_MEASURED' || value === 'UNAVAILABLE') return 'gray'
  if (/(RUNNING|ACTIVE|STARTED)/i.test(value)) return 'blue'
  return 'gray'
}

function badgeToneClass(tone: OutcomeTone): string {
  if (tone === 'green') return 'border-emerald-300 bg-emerald-50 text-emerald-800'
  if (tone === 'red') return 'border-red-300 bg-red-50 text-red-800'
  if (tone === 'amber') return 'border-amber-300 bg-amber-50 text-amber-800'
  if (tone === 'blue') return 'border-blue-300 bg-blue-50 text-blue-800'
  return 'text-muted-foreground'
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}
