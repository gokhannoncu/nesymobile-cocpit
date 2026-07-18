'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { findStartNodeId, type UserJourney } from '@/data/product/user-journeys'
import { Callout } from './blocks'
import { InteractiveJourneyFlow } from './interactive-journey-flow'
import { JourneyStepPanel } from './journey-step-panel'

export function JourneyExplorer({ journey }: { journey: UserJourney }) {
  const startId = useMemo(() => findStartNodeId(journey.diagram), [journey.diagram])
  const [selectedId, setSelectedId] = useState<string | null>(startId ?? null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSelectedId(findStartNodeId(journey.diagram) ?? null)
  }, [journey.value, journey.diagram])

  useEffect(() => {
    if (!selectedId || typeof window === 'undefined') return
    if (!window.matchMedia('(max-width: 1023px)').matches) return
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedId])

  const step = selectedId ? journey.steps[selectedId] : undefined

  return (
    <div className="space-y-4">
      <Callout icon={journey.icon} title="Journey purpose" tone={journey.tone}>
        {journey.purpose}
      </Callout>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.45fr)_minmax(0,0.55fr)]">
        <div className="overflow-x-auto rounded-2xl border border-border bg-background p-4 lg:p-5">
          <InteractiveJourneyFlow
            elements={journey.diagram}
            tone={journey.tone}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
        <div ref={panelRef}>
          {step ? (
            <JourneyStepPanel step={step} tone={journey.tone} />
          ) : (
            <p className="text-sm text-muted-foreground">Select a step in the flow.</p>
          )}
        </div>
      </div>
    </div>
  )
}
