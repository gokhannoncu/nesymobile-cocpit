'use client'

import { useMemo } from 'react'
import { Map, AlertTriangle } from 'lucide-react'
import {
  ProductPage,
  HeroCallout,
  PageSection,
  ComparisonTable,
  Timeline,
  SegmentTabs,
  GuardrailCallout,
  DoesDontGrid,
} from '@/components/product'
import type { TimelineItem } from '@/components/product/timeline'
import type { SegmentTabItem } from '@/components/product/segment-tabs'
import { newArchPhases, refactorPhases, roadmapSummary } from '@/data/pm/roadmap'
import type { RoadmapPhase, RoadmapRiskLevel } from '@/data/pm/types'

// ═══ Helpers ════════════════════════════════════════════════════════════════

const riskTone: Record<RoadmapRiskLevel, 'red' | 'orange' | 'amber' | 'green'> = {
  critical: 'red',
  high: 'orange',
  medium: 'amber',
  low: 'green',
}

function phasesToTimeline(phases: RoadmapPhase[], isNewArch: boolean): TimelineItem[] {
  return phases.map((p) => ({
    period: p.months,
    title: `Phase ${p.phase}: ${p.title}`,
    desc: p.subtitle,
    tone: riskTone[p.riskLevel],
    status: isNewArch
      ? p.phase === 0
        ? 'done'
        : p.phase === 1
          ? 'active'
          : 'next'
      : p.phase === 1
        ? 'active'
        : 'next',
    bullets: p.objectives,
    badges: [
      p.duration,
      `${p.deliverables.length} deliverable`,
      `${p.riskLevel} risk`,
    ],
  }))
}

function phaseMetricsRows(phases: RoadmapPhase[]) {
  return phases.flatMap((p) =>
    p.metrics.map((m) => [
      <span key="phase" className="font-medium">{`Phase ${p.phase}`}</span>,
      m.label,
      m.current,
      m.target,
    ]),
  )
}

// ═══ Component ═══════════════════════════════════════════════════════════════

export default function RoadmapPage() {
  const newArchTimeline = useMemo(() => phasesToTimeline(newArchPhases, true), [])
  const refactorTimeline = useMemo(() => phasesToTimeline(refactorPhases, false), [])

  const newArchMetrics = useMemo(() => phaseMetricsRows(newArchPhases), [])
  const refactorMetrics = useMemo(() => phaseMetricsRows(refactorPhases), [])

  const comparisonRows = useMemo(
    () => [
      ['Duration', roadmapSummary.newArch.duration, roadmapSummary.refactor.duration],
      ['Team', roadmapSummary.newArch.teamSize, roadmapSummary.refactor.teamSize],
      ['Risk', roadmapSummary.newArch.risk, roadmapSummary.refactor.risk],
      [
        'Phase Count',
        String(roadmapSummary.newArch.totalPhases),
        String(roadmapSummary.refactor.totalPhases),
      ],
      [
        'Goal',
        'Clean architecture, full rewrite',
        'Quick stabilization, low cost',
      ],
      [
        'Advantage',
        roadmapSummary.newArch.benefit,
        roadmapSummary.refactor.benefit,
      ],
      [
        'Disadvantage',
        'Long timeline, high cost, large team required',
        'Technical debt not fully resolved, limited improvement',
      ],
    ],
    [],
  )

  const tabs: SegmentTabItem[] = useMemo(
    () => [
      {
        value: 'yeni-mimari',
        label: 'New Architecture Migration',
        content: (
          <div className="space-y-6">
            <Timeline items={newArchTimeline} />
            <PageSection title="Metric Targets">
              <ComparisonTable
                headers={[
                  { label: 'Phase', tone: 'purple' },
                  { label: 'Metric', tone: 'blue' },
                  { label: 'Current', tone: 'red' },
                  { label: 'Target', tone: 'green' },
                ]}
                rows={newArchMetrics}
              />
            </PageSection>
          </div>
        ),
      },
      {
        value: 'refactor',
        label: 'Existing App Refactor',
        content: (
          <div className="space-y-6">
            <Timeline items={refactorTimeline} />
            <PageSection title="Metric Targets">
              <ComparisonTable
                headers={[
                  { label: 'Phase', tone: 'purple' },
                  { label: 'Metric', tone: 'blue' },
                  { label: 'Current', tone: 'red' },
                  { label: 'Target', tone: 'green' },
                ]}
                rows={refactorMetrics}
              />
            </PageSection>
          </div>
        ),
      },
      {
        value: 'karsilastirma',
        label: 'Plan Comparison',
        content: (
          <div className="space-y-6">
            <ComparisonTable
              headers={[
                { label: 'Feature', tone: 'gray' },
                { label: 'New Architecture', tone: 'indigo' },
                { label: 'Existing Refactor', tone: 'teal' },
              ]}
              rows={comparisonRows}
              highlightCol={1}
            />
            <DoesDontGrid
              doesTitle="New Architecture Advantages"
              dontTitle="New Architecture Risks"
              does={[
                'Clean architecture — testability and maintainability',
                'Modern, rapid development with Compose UI',
                'Parallel development via feature module boundaries',
                'Technical debt fully eliminated',
              ]}
              dont={[
                '12-month timeline — long delivery cycle',
                '3-4 person team — high cost',
                'High regression risk during rewrite',
                'Existing features may be frozen during transition',
              ]}
            />
          </div>
        ),
      },
    ],
    [newArchTimeline, refactorTimeline, newArchMetrics, refactorMetrics, comparisonRows],
  )

  return (
    <ProductPage path="/pm/roadmap" title="Roadmap">
      {/* 1 — Hero */}
      <HeroCallout
        icon={Map}
        eyebrow="Planning"
        tone="indigo"
        title="Roadmap"
        lead="NeSy Mobile architecture transformation plans — two alternative approaches."
        chips={['New Architecture', 'Existing Refactor', '2-Plan Comparison']}
      />

      {/* 2 — Segment Tabs */}
      <SegmentTabs items={tabs} defaultValue="yeni-mimari" />

      {/* 3 — Guardrail */}
      <GuardrailCallout tone="amber" icon={AlertTriangle} title="Roadmap ≠ Sprint Plan">
        The roadmap is a strategic guidance tool. For sprint-based task distribution,
        use the Sprint Calendar page. Roadmap changes are only approved
        at Architecture Review meetings.
      </GuardrailCallout>
    </ProductPage>
  )
}
