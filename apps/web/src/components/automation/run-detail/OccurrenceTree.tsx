'use client'

import { ChevronRight, ChevronDown, Circle, PlayCircle } from 'lucide-react'
import { useState } from 'react'

export function OccurrenceTree({ run }: { run: any }) {
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
        <div className="flex items-center gap-2 cursor-pointer hover:bg-accent rounded px-2 py-1" onClick={() => toggle('root')}>
          {expanded.has('root') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <Circle className="w-4 h-4 text-primary" />
          <span>Workflow Execution</span>
        </div>
        {expanded.has('root') && (
          <div className="ml-6 space-y-1">
            {(run?.steps || []).map((step: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 px-2 py-1 hover:bg-accent rounded">
                <div className="w-4" />
                <PlayCircle className="w-4 h-4 text-blue-500" />
                <span>Iteration {idx + 1}</span>
              </div>
            ))}
            {!(run?.steps?.length) && (
              <div className="px-2 py-1 text-muted-foreground">No execution steps recorded.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
