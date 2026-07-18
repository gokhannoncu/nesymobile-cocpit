'use client'

import {
  Activity,
  AlertTriangle,
  Bug,
  Cpu,
  Gauge,
  GitBranch,
  Layers,
  ListTodo,
  Radar,
  Route,
  ShieldCheck,
  Siren,
} from 'lucide-react'
import {
  Callout,
  CardGrid,
  HeroCallout,
  InfoCard,
  PageSection,
  ProductPage,
  StatCard,
  StatGrid,
} from '@/components/product'
import { EDGE_STATS } from '@/data/engineering/edge-cases'
import { INCIDENT_STATS } from '@/data/engineering/incidents'
import { PERF_REPORTS } from '@/data/engineering/performance'

export default function EngineeringOverviewPage() {
  const perfAboveTarget = PERF_REPORTS.filter((r) => !r.appStart.belowTarget).length

  return (
    <ProductPage path="/engineering/overview">
      <HeroCallout
        icon={Cpu}
        eyebrow="Engineering"
        tone="orange"
        title="Nesy Mobile engineering command center."
        lead="This space aggregates the entire engineering operation in one place; from incident response to edge-case maps, architectural plans, and country-based performance reports. Each page is fed by real repo, ticket, and Firebase data — written to be educational (why is it like this?) and tracking (what is the current status?)."
        chips={['515 Kotlin files · ~68K LOC', '5 countries · 11 flavors', 'Room v240 · 527 endpoints']}
      >
        <StatGrid cols={2}>
          <StatCard label="Open Ticket" value={INCIDENT_STATS.openTickets} tone="orange" icon={Siren} hint={`${INCIDENT_STATS.totalTickets} tickets analyzed`} />
          <StatCard label="Edge Case" value={EDGE_STATS.total} tone="red" icon={Radar} hint={`${EDGE_STATS.critical} critical`} />
        </StatGrid>
      </HeroCallout>

      <PageSection
        eyebrow="Health Summary"
        title="Today's status — at a glance"
        icon={Activity}
        tone="orange"
        description="Every red box opens a page in this area; it shows the destination, not the number."
      >
        <StatGrid cols={4}>
          <StatCard label="Test Coverage" value="%0" tone="red" icon={Bug} hint="0 test files · 140 bug-fixes/6 months" />
          <StatCard label="Bus Factor" value={1} tone="red" icon={GitBranch} hint="94% of commits are by one person" />
          <StatCard label="Perf Above Target" value={perfAboveTarget} suffix=" / 4 countries" tone="amber" icon={Gauge} hint="App start > 2.0 s: BA, SI" />
          <StatCard label="Security Risk" value={4} tone="red" icon={ShieldCheck} hint="TLS, token, host, release config" />
        </StatGrid>
      </PageSection>

      <PageSection eyebrow="This Area" title="Engineering map" icon={Layers} tone="amber">
        <CardGrid cols={3}>
          <InfoCard
            icon={Siren}
            tone="red"
            eyebrow="Reliability"
            title="Incident Command Center"
            desc="Detect → Declare → Contain → Diagnose → Recover → Learn: incident validation, severity, roles, containment and group playbooks."
            href="/engineering/incident-playbook"
          />
          <InfoCard
            icon={Radar}
            tone="orange"
            eyebrow="Reliability"
            title="Edge Case Map"
            desc="E1–E33: trigger → impact → mitigation. All known edge cases in 9 categories."
            href="/engineering/edge-case-map"
          />
          <InfoCard
            icon={Gauge}
            tone="teal"
            eyebrow="Reliability"
            title="Performance Reports"
            desc="Firebase Performance CW27 — Report in presentation format for HR, BA, SI, RS."
            href="/engineering/performance"
          />
          <InfoCard
            icon={Layers}
            tone="blue"
            eyebrow="Architecture"
            title="Current Architecture"
            desc="6 layer map, god objects and 'why it is not sustainable' analysis."
            href="/engineering/current-architecture"
          />
          <InfoCard
            icon={Route}
            tone="indigo"
            eyebrow="Architecture"
            title="Modernization Plan"
            desc="6 phases / ~12 months new architecture plan + 6 months refactor alternative and risks."
            href="/engineering/modernization-plan"
          />
          <InfoCard
            icon={ListTodo}
            tone="purple"
            eyebrow="Architecture"
            title="Technical Debt"
            desc="10 anti-patterns, 9 critical bugs and screen health scores (46 screens × 15 categories)."
            href="/engineering/technical-debt"
          />
          <InfoCard
            icon={GitBranch}
            tone="green"
            eyebrow="Delivery"
            title="GitHub Pulse"
            desc="Commit purpose distribution, bus factor, CI pipelines and release counters."
            href="/engineering/github-pulse"
          />
          <InfoCard
            icon={ShieldCheck}
            tone="gray"
            eyebrow="Delivery"
            title="Security Posture"
            desc="TLS/pinning, token, host routing, release config — status and actions."
            href="/engineering/security"
          />
        </CardGrid>
      </PageSection>

      <Callout icon={AlertTriangle} title="How to read this area?" tone="orange">
        <b>For tracking:</b> Overview + Performance + GitHub Pulse are updated on a weekly rhythm.{' '}
        <b>For education:</b> Edge Case Map and Current Architecture are two pages that every new engineer should read in their first
        week. <b>In a crisis:</b> go directly to Incident
        Playbook — the first 15 minutes protocol is there.
      </Callout>
    </ProductPage>
  )
}
