'use client'

import { useMemo } from 'react'
import { ShieldCheck, AlertTriangle, Bug, CheckCircle2, XCircle, Clock } from 'lucide-react'
import {
  ProductPage,
  HeroCallout,
  PageSection,
  CardGrid,
  InfoCard,
  StatCard,
  StatGrid,
  ComparisonTable,
  EvidenceRef,
  SeverityBadge,
  GuardrailCallout,
  DoesDontGrid,
} from '@/components/product'
import { tickets } from '@/data/pm/tickets'

const severityTone: Record<string, 'red' | 'orange' | 'amber' | 'green' | 'gray'> = {
  Critical: 'red',
  High: 'orange',
  Medium: 'amber',
  Low: 'green',
}

export default function TestCoveragePage() {
  const stats = useMemo(() => {
    const tested = tickets.filter((t) => t.testCases && t.testCases.length > 0)
    const untested = tickets.filter((t) => !t.testCases || t.testCases.length === 0)
    const allCases = tickets.flatMap((t) => t.testCases ?? [])
    const passed = allCases.filter((tc) => tc.status === 'passed').length
    const failed = allCases.filter((tc) => tc.status === 'failed').length
    return { tested: tested.length, untested: untested.length, passed, failed }
  }, [])

  const ticketsWithTests = useMemo(
    () => tickets.filter((t) => t.testCases && t.testCases.length > 0),
    [],
  )

  const untestedCriticalHigh = useMemo(
    () =>
      tickets.filter(
        (t) =>
          (!t.testCases || t.testCases.length === 0) &&
          (t.severity === 'Critical' || t.severity === 'High'),
      ),
    [],
  )

  return (
    <ProductPage path="/pm/test-coverage" title="Test Coverage">
      {/* 1 — Hero */}
      <HeroCallout
        icon={ShieldCheck}
        eyebrow="Ticket Management"
        tone="green"
        title="Test Coverage"
        lead="Ticket-based test status, edge case coverage, and quality metrics."
        chips={['Unit', 'Integration', 'E2E', 'Manual']}
      />

      {/* 2 — Stats */}
      <StatGrid cols={4}>
        <StatCard icon={CheckCircle2} label="Tested" value={stats.tested} tone="green" />
        <StatCard icon={XCircle} label="Untested" value={stats.untested} tone="red" />
        <StatCard icon={CheckCircle2} label="Passed" value={stats.passed} tone="teal" />
        <StatCard icon={AlertTriangle} label="Failed" value={stats.failed} tone="orange" />
      </StatGrid>

      {/* 3 — Test Status Matrix */}
      <PageSection title="Test Status Matrix">
        <ComparisonTable
          headers={[
            { label: 'Ticket', tone: 'gray' },
            { label: 'Severity', tone: 'red' },
            { label: 'Test', tone: 'blue' },
            { label: '✓ Passed', tone: 'green' },
            { label: '✗ Failed', tone: 'red' },
            { label: 'Pending', tone: 'amber' },
          ]}
          rows={ticketsWithTests.map((t) => {
            const cases = t.testCases!
            const passed = cases.filter((c) => c.status === 'passed').length
            const failed = cases.filter((c) => c.status === 'failed').length
            const pending = cases.filter(
              (c) => c.status === 'pending' || c.status === 'skipped',
            ).length
            return [
              <span key="title" className="font-medium" title={t.title}>
                {t.title.length > 40 ? `${t.title.slice(0, 40)}…` : t.title}
              </span>,
              <SeverityBadge key="sev" severity={t.severity} />,
              <span key="cnt" className="font-semibold">{cases.length}</span>,
              <span key="pass" className="font-semibold text-green-600 dark:text-green-400">{passed}</span>,
              <span key="fail" className="font-semibold text-red-600 dark:text-red-400">{failed}</span>,
              <span key="pend" className="font-semibold text-amber-600 dark:text-amber-400">{pending}</span>,
            ]
          })}
        />
      </PageSection>

      {/* 4 — Untested Tickets */}
      <PageSection title="Untested Tickets">
        <CardGrid cols={2}>
          {untestedCriticalHigh.map((t) => (
            <InfoCard
              key={t.id}
              icon={Bug}
              tone={severityTone[t.severity] ?? 'gray'}
              title={t.title}
              desc={t.summary.length > 120 ? `${t.summary.slice(0, 120)}…` : t.summary}
              badges={[
                { label: t.group },
                { label: t.screen },
              ]}
              footer={
                <EvidenceRef level="unverified" label="No tests" />
              }
            />
          ))}
        </CardGrid>
      </PageSection>

      {/* 5 — Test Policy Guardrail */}
      <GuardrailCallout tone="red" icon={AlertTriangle} title="Test Policy">
        {
          "Closing critical and high-priority tickets without test coverage is unacceptable. At least 1 integration test is mandatory for every Critical/High ticket."
        }
      </GuardrailCallout>

      {/* 6 — Does / Don't */}
      <DoesDontGrid
        does={[
          'Every Critical ticket includes a regression test',
          'Edge cases are added to test scenarios',
          'Test results run automatically in the CI pipeline',
          'Hotfixes are merged together with tests',
        ]}
        dont={[
          'Load test coverage is not tracked on this page',
          'Manual test results are not updated automatically',
          'Security tests are managed in a separate pipeline',
        ]}
      />
    </ProductPage>
  )
}
