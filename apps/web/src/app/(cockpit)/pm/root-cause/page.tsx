'use client'

import { useMemo } from 'react'
import {
  Search,
  ShieldCheck,
  AlertTriangle,
  FileQuestion,
  Lightbulb,
  Info,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import {
  ProductPage,
  HeroCallout,
  PageSection,
  CardGrid,
  InfoCard,
  StatCard,
  StatGrid,
  Callout,
  ComparisonTable,
  SegmentTabs,
  EvidenceRef,
} from '@/components/product'
import { tickets, ALL_GROUPS, ALL_SCREENS } from '@/data/pm/tickets'

// ═══ Group icon map ══════════════════════════════════════════════════════
const groupIcons: Record<string, typeof Search> = {
  'Finans & Ödeme': ShieldCheck,
  'Barcode & Scan': Search,
  'Tour & Teslimat': AlertTriangle,
  'Bildirim': Lightbulb,
  'State & Race': AlertTriangle,
  'D4Me & Locker': ShieldCheck,
  'Konum & GPS': Search,
  'UI & Crash': AlertTriangle,
}

const groupTones = [
  'purple',
  'indigo',
  'blue',
  'teal',
  'orange',
  'amber',
  'green',
  'red',
] as const

export default function RootCausePage() {
  // ═══ Stats ═══════════════════════════════════════════════════════════
  const analyzed = useMemo(
    () => tickets.filter((t) => t.analysis?.story && t.analysis.story.length > 0).length,
    [],
  )
  const unanalyzed = useMemo(
    () => tickets.filter((t) => !t.analysis?.story || t.analysis.story.length === 0).length,
    [],
  )
  const highRisk = useMemo(
    () => tickets.filter((t) => t.analysis?.recurrenceRisk === 'high').length,
    [],
  )
  const edgeCaseCount = useMemo(
    () =>
      tickets.reduce(
        (acc, t) => acc + (t.analysis?.edgeCases?.length ?? 0),
        0,
      ),
    [],
  )

  // ═══ Group breakdown ═══════════════════════════════════════════════════
  const groupBreakdown = useMemo(() => {
    return ALL_GROUPS.map((group, idx) => {
      const groupTickets = tickets.filter((t) => t.group === group)
      const severityCounts: Record<string, number> = {
        Critical: 0,
        High: 0,
        Medium: 0,
        Low: 0,
      }
      groupTickets.forEach((t) => {
        severityCounts[t.severity] = (severityCounts[t.severity] || 0) + 1
      })

      const riskCounts: Record<string, number> = { high: 0, medium: 0, low: 0 }
      groupTickets.forEach((t) => {
        if (t.analysis?.recurrenceRisk) {
          riskCounts[t.analysis.recurrenceRisk] =
            (riskCounts[t.analysis.recurrenceRisk] || 0) + 1
        }
      })

      return {
        group,
        total: groupTickets.length,
        severityCounts,
        riskCounts,
        tone: groupTones[idx % groupTones.length]!,
      }
    })
  }, [])

  // ═══ Risk Matrix: Screen × Group ═══════════════════════════════════════
  const riskMatrixHeaders = useMemo(
    () => [
      { label: 'Screen', tone: 'gray' as const },
      ...ALL_GROUPS.map((g, i) => ({
        label: g.length > 12 ? g.split(' ')[0]! : g,
        tone: groupTones[i % groupTones.length]!,
      })),
    ],
    [],
  )

  const riskMatrixRows = useMemo(() => {
    return ALL_SCREENS.map((screen) => {
      const screenCell = (
        <span className="text-xs font-medium text-foreground whitespace-nowrap">
          {screen}
        </span>
      )
      const groupCells = ALL_GROUPS.map((group) => {
        const count = tickets.filter(
          (t) => t.screen === screen && t.group === group,
        ).length
        if (count === 0) {
          return (
            <span className="text-xs text-muted-foreground">—</span>
          )
        }
        return (
          <span
            className={cn(
              'inline-flex items-center justify-center size-6 rounded-full text-xs font-bold text-white',
              count >= 3
                ? 'bg-red-500'
                : 'bg-amber-500',
            )}
          >
            {count}
          </span>
        )
      })
      return [screenCell, ...groupCells]
    })
  }, [])

  return (
    <ProductPage path="/pm/root-cause">
      {/* ─── Hero ────────────────────────────────────────────────────── */}
      <HeroCallout
        icon={Search}
        eyebrow="Ticket Management"
        tone="indigo"
        title="Root Cause Analysis"
        lead="Root cause analyses of tickets, group-based distributions, and screen × group risk matrix."
        chips={['Group Analysis', 'Risk Matrix', 'Edge Cases']}
      >
        <StatGrid cols={4}>
          <StatCard label="Analyzed" value={analyzed} tone="green" icon={ShieldCheck} />
          <StatCard label="Unanalyzed" value={unanalyzed} tone="amber" icon={FileQuestion} />
          <StatCard label="High Risk" value={highRisk} tone="red" icon={AlertTriangle} />
          <StatCard label="Edge Cases" value={edgeCaseCount} tone="indigo" icon={Lightbulb} />
        </StatGrid>
      </HeroCallout>

      {/* ─── Tabs ────────────────────────────────────────────────────── */}
      <SegmentTabs
        items={[
          {
            value: 'grup',
            label: 'By Group',
            content: (
              <CardGrid cols={2}>
                {groupBreakdown.map((g) => {
                  const Icon = groupIcons[g.group] ?? Search
                  const riskEntries = Object.entries(g.riskCounts).filter(
                    ([, v]) => v > 0,
                  )
                  return (
                    <InfoCard
                      key={g.group}
                      icon={Icon}
                      tone={g.tone}
                      title={g.group}
                      desc={`${g.total} ticket`}
                      bullets={[
                        (g.severityCounts.Critical ?? 0) > 0
                          ? `Critical: ${g.severityCounts.Critical}`
                          : null,
                        (g.severityCounts.High ?? 0) > 0
                          ? `High: ${g.severityCounts.High}`
                          : null,
                        (g.severityCounts.Medium ?? 0) > 0
                          ? `Medium: ${g.severityCounts.Medium}`
                          : null,
                        (g.severityCounts.Low ?? 0) > 0
                          ? `Low: ${g.severityCounts.Low}`
                          : null,
                      ].filter(Boolean) as string[]}
                      footer={
                        riskEntries.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {riskEntries.map(([risk, count]) => (
                              <EvidenceRef
                                key={risk}
                                level={
                                  risk === 'high'
                                    ? 'unverified'
                                    : risk === 'medium'
                                      ? 'needs-validation'
                                      : 'confirmed'
                                }
                                label={`${risk} risk: ${count}`}
                              />
                            ))}
                          </div>
                        ) : undefined
                      }
                    />
                  )
                })}
              </CardGrid>
            ),
          },
          {
            value: 'risk',
            label: 'Risk Matrix',
            content: (
              <ComparisonTable headers={riskMatrixHeaders} rows={riskMatrixRows} />
            ),
          },
        ]}
      />

      {/* ─── Callout ─────────────────────────────────────────────────── */}
      <Callout icon={Info} tone="amber">
        Pay attention to the &quot;Unanalyzed&quot; counter for tickets where root cause
        analysis has not yet been completed. Tickets with high recurrence risk
        should be prioritized in sprint planning.
      </Callout>
    </ProductPage>
  )
}
