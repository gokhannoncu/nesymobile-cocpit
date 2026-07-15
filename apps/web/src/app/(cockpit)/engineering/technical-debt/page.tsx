'use client'

import { AlertTriangle, Bug, Gauge, Info, ListTodo, Microscope } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import {
  Callout,
  ComparisonTable,
  HeroCallout,
  PageSection,
  ProductPage,
  StatCard,
  StatGrid,
  toneCard,
} from '@/components/product'
import {
  ANTI_PATTERNS,
  CRITICAL_BUGS,
  HEALTH_SCORE_NOTE,
  SCREEN_HEALTH,
} from '@/data/engineering/architecture'

const sevBadge = { critical: 'Critical', high: 'High', medium: 'Medium' } as const

export default function TechnicalDebtPage() {
  return (
    <ProductPage path="/engineering/technical-debt">
      <HeroCallout
        icon={ListTodo}
        eyebrow="Architecture & Modernization"
        tone="orange"
        title="Technical debt: inventory, evidence and payback order."
        lead="Technical debt here is an inventory, not a rumor: 10 anti-patterns, 9 verified critical bugs with line numbers, and health scores of 46 screens in 15 categories. The payback order depends on the Modernization Plan phases; since refactor commits dropped −69% in the last 6 months, this inventory is actively growing."
        chips={['10 anti-patterns', '9 critical bugs', '46 screens scored', 'Refactor trend: −69%']}
      >
        <StatGrid cols={2}>
          <StatCard label="Refactor Commit" value="4" tone="red" icon={Gauge} hint="Previous 6 months: 13 (−69%) — debt payment stopped" />
          <StatCard label="Net Code Growth" value="+109K" tone="orange" icon={AlertTriangle} hint="+33% in 6 months — deletions are decreasing" />
        </StatGrid>
      </HeroCallout>

      <PageSection
        eyebrow="Patterns"
        title="10 anti-patterns"
        icon={AlertTriangle}
        tone="red"
        description="Not single errors, but systematic patterns — each affects multiple screens."
      >
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {ANTI_PATTERNS.map((a) => (
            <div
              key={a.title}
              className={cn(
                'rounded-xl border p-4',
                toneCard[a.severity === 'critical' ? 'red' : a.severity === 'high' ? 'orange' : 'amber'],
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-foreground">{a.title}</div>
                <Badge variant="secondary" appearance="outline" size="xs">{sevBadge[a.severity]}</Badge>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-foreground/85">{a.detail}</p>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection
        eyebrow="Verified"
        title="Critical bug list — with line numbers"
        icon={Bug}
        tone="red"
        description="Bugs verified in code review, with known behaviors. This is the direct input for Phase 0 (Emergency Intervention)."
      >
        <ComparisonTable
          headers={[{ label: '#' }, { label: 'Location' }, { label: 'Finding' }, { label: 'Severity', tone: 'red' }]}
          rows={CRITICAL_BUGS.map((b) => [
            b.id,
            <code key="w" className="text-xs">{b.where}</code>,
            <span key="x" className="text-xs">{b.what}</span>,
            sevBadge[b.severity],
          ])}
        />
      </PageSection>

      <PageSection
        eyebrow="Screen Health"
        title="Most risky screens (health score out of 10)"
        icon={Microscope}
        tone="orange"
        description={HEALTH_SCORE_NOTE}
      >
        <ComparisonTable
          headers={[
            { label: 'Screen' },
            { label: 'Lines', tone: 'orange' },
            { label: 'Score', tone: 'red' },
            { label: 'Prominent finding' },
          ]}
          rows={SCREEN_HEALTH.map((s) => [
            <code key="n" className="text-xs font-semibold">{s.name}</code>,
            <span key="l" className="tabular-nums">{s.lines.toLocaleString('tr-TR')}</span>,
            <span key="s" className={cn('font-bold tabular-nums', s.score < 2.5 ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400')}>
              {s.score.toFixed(1)}
            </span>,
            <span key="f" className="text-xs">{s.finding}</span>,
          ])}
        />
      </PageSection>

      <Callout icon={Info} title="How is the debt paid off?" tone="orange">
        Every item in this inventory is mapped to a phase in the Modernization Plan: critical bugs + security →{' '}
        <b>Phase 0</b>; zero tests → <b>Phase 1</b>; duplication + country branching → <b>Phase 2</b>; god
        objects → <b>Phase 3</b>; deprecated API + polling → <b>Phase 4</b>; UI debt → <b>Phase 5</b>.
        Any new item added to the inventory is not considered "accepted" without being linked to a phase.
      </Callout>
    </ProductPage>
  )
}
