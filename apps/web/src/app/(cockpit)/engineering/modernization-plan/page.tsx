'use client'

import { AlertTriangle, Flag, GitCompareArrows, Route, Target, Users } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import {
  Callout,
  HeroCallout,
  PageSection,
  ProductPage,
  StatCard,
  StatGrid,
  Timeline,
  toneCard,
  toneText,
  type Tone,
} from '@/components/product'
import {
  NEW_ARCH_PHASES,
  PLAN_RISKS,
  PLAN_SUMMARY,
  REFACTOR_ALTERNATIVE,
} from '@/data/engineering/modernization'

const priorityTone: Record<string, Tone> = {
  critical: 'red',
  high: 'orange',
  medium: 'amber',
  low: 'gray',
}

export default function ModernizationPlanPage() {
  return (
    <ProductPage path="/engineering/modernization-plan">
      <HeroCallout
        icon={Route}
        eyebrow="Architecture & Modernization"
        tone="orange"
        title="New architecture plan: 6 phases, ~12 months."
        lead="Goal: Compose+MVI, Domain UseCase layer, normalized Room (single source of truth) and Outbox/WorkManager synchronization. The plan proceeds while preserving operation — each phase ends with measurable exit criteria and the critical path is Phase 0→1→2→3."
        chips={[PLAN_SUMMARY.totalDuration, PLAN_SUMMARY.team, 'Critical path: Phase 0→1→2→3']}
      >
        <StatGrid cols={2}>
          <StatCard label="Phase" value={NEW_ARCH_PHASES.length} tone="orange" icon={Flag} hint="Phase 4 and 5 can run in parallel" />
          <StatCard label="Plan Risk" value={PLAN_RISKS.length} tone="red" icon={AlertTriangle} hint="2 are critical: bus factor + split without tests" />
        </StatGrid>
      </HeroCallout>

      <PageSection
        eyebrow="Phases"
        title="Roadmap"
        icon={Route}
        tone="orange"
        description="Each phase's metric table is the exit criteria: the next phase does not start until the target value is reached."
      >
        <Timeline
          items={NEW_ARCH_PHASES.map((p, i) => ({
            period: `Phase ${i} · ${p.duration} · ${p.team}`,
            title: p.name,
            tone: priorityTone[p.priority],
            status: p.status,
            bullets: p.objectives,
            badges: p.metrics.map((m) => `${m.label}: ${m.current} → ${m.target}`),
          }))}
        />
      </PageSection>

      <PageSection
        eyebrow="Risks"
        title="6 risks threatening the plan"
        icon={AlertTriangle}
        tone="red"
        description="Risks are embedded in the phase plan: each risk is converted into a phase rule (e.g. 'no splitting without tests')."
      >
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {PLAN_RISKS.map((r) => (
            <div key={r.title} className={cn('rounded-xl border p-4', toneCard[r.severity === 'critical' ? 'red' : r.severity === 'high' ? 'orange' : 'amber'])}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-foreground">{r.title}</div>
                <Badge variant="secondary" appearance="outline" size="xs">
                  {r.severity === 'critical' ? 'Critical' : r.severity === 'high' ? 'High' : 'Medium'}
                </Badge>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-foreground/85">{r.detail}</p>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection
        eyebrow="Alternative"
        title={REFACTOR_ALTERNATIVE.name}
        icon={GitCompareArrows}
        tone="gray"
        description={REFACTOR_ALTERNATIVE.duration}
      >
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          <ul className="space-y-1.5">
            {REFACTOR_ALTERNATIVE.phases.map((p) => (
              <li key={p} className="flex items-start gap-2 rounded-lg border border-border bg-background p-2.5 text-xs text-foreground/85">
                <span className="mt-[6px] size-1 shrink-0 rounded-full bg-muted-foreground" />
                <span className="leading-relaxed">{p}</span>
              </li>
            ))}
          </ul>
          <div className={cn('rounded-xl border p-4', toneCard.amber)}>
            <div className={cn('text-xs font-bold uppercase tracking-wide', toneText.amber)}>Verdict</div>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">{REFACTOR_ALTERNATIVE.verdict}</p>
          </div>
        </div>
      </PageSection>

      <Callout icon={Target} title="Key decision" tone="red">
        {PLAN_SUMMARY.keyDecision} Decomposition without tests means uncontrolled
        regression in a 68K line production application — this rule is non-negotiable.
      </Callout>

      <Callout icon={Users} title="Bus factor precaution" tone="orange">
        94% of commits are by a single developer. From Phase 0 onwards, each phase is executed by at least two people,
        architectural decision records (ADR) are written for critical flows (payment, offline sync, scan) and this cockpit
        is kept up to date — knowledge accumulates in the system, not in the person.
      </Callout>
    </ProductPage>
  )
}
