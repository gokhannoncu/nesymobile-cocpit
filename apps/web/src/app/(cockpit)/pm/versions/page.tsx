'use client'

import { ExternalLink, Globe, History, ShieldAlert, Tag } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import {
  ProductPage,
  HeroCallout,
  PageSection,
  StatCard,
  StatGrid,
  ComparisonTable,
  Timeline,
  GuardrailCallout,
} from '@/components/product'
import type { TimelineItem } from '@/components/product/timeline'
import { countryVersions, versionHistory, COUNTRY_LABELS, getOutdatedCountries } from '@/data/pm/versions'
import { getLatestRelease } from '@/data/pm/releases'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function versionFreshnessTone(production: string): 'green' | 'amber' | 'red' {
  const latest = getLatestRelease()
  if (!latest) return 'amber'
  if (production === latest.version) return 'green'
  // One minor behind → amber, more → red
  const pMinor = Number(production.split('.')[1] ?? 0)
  const lMinor = Number(latest.version.split('.')[1] ?? 0)
  if (lMinor - pMinor <= 1) return 'amber'
  return 'red'
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VersionsPage() {
  const outdated = getOutdatedCountries()
  const latest = getLatestRelease()

  // ─ Section 2: Comparison Table ──────────────────────────────────────────────
  const tableHeaders = [
    { label: 'Country' },
    { label: 'Production', tone: 'green' as const },
    { label: 'Staging', tone: 'blue' as const },
    { label: 'Last Deploy' },
    { label: 'Store' },
  ]

  const tableRows = countryVersions.map((cv) => [
    cv.countryName,
    cv.production,
    cv.staging,
    formatDate(cv.lastDeployDate),
    cv.storeUrl ? (
      <a
        key={cv.countryId}
        href={cv.storeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <ExternalLink className="size-3" />
        Play Store
      </a>
    ) : (
      <span key={cv.countryId} className="text-xs text-muted-foreground">—</span>
    ),
  ])

  // ─ Section 3: Version History Timeline ──────────────────────────────────────
  const historyItems: TimelineItem[] = versionHistory.map((v) => ({
    period: formatDate(v.releaseDate),
    title: `v${v.version}`,
    bullets: v.highlights,
    badges: [
      ...(v.ticketsResolved > 0 ? [`${v.ticketsResolved} ticket`] : []),
      ...(v.endOfLife ? [`EOL: ${formatDate(v.endOfLife)}`] : []),
    ],
    tone: v.endOfLife ? 'red' as const : 'green' as const,
    status: v.endOfLife ? 'done' as const : 'done' as const,
  }))

  return (
    <ProductPage path="/pm/versions" title="Version Tracker">
      {/* ─ Hero ────────────────────────────────────────────────────────────── */}
      <HeroCallout
        icon={Tag}
        eyebrow="Release & Versions"
        tone="indigo"
        title="Version Tracker"
        lead="Track each country's production and staging versions, store links, and version history from a single screen."
        chips={['By Country', 'Prod & Staging', 'Store Links']}
      />

      {/* ─ Current Versions ────────────────────────────────────────────────── */}
      <PageSection
        title="Current Versions"
        icon={Globe}
        tone="green"
        description="Current versions in production and staging environments by country."
      >
        <StatGrid cols={3}>
          {countryVersions.map((cv) => (
            <StatCard
              key={cv.countryId}
              label={cv.countryName}
              value={cv.production}
              hint={`Staging: ${cv.staging}`}
              tone={versionFreshnessTone(cv.production)}
            />
          ))}
        </StatGrid>
      </PageSection>

      {/* ─ Country × Version Matrix ────────────────────────────────────────── */}
      <PageSection
        title="Country × Version Matrix"
        icon={Tag}
        tone="indigo"
        description="Production, staging, deploy dates, and store links for all countries."
      >
        <ComparisonTable headers={tableHeaders} rows={tableRows} highlightCol={1} />
      </PageSection>

      {/* ─ Version History ─────────────────────────────────────────────────── */}
      <PageSection
        title="Version History"
        icon={History}
        tone="blue"
        description="Chronological list of all versions and key changes."
      >
        <Timeline items={historyItems} />
      </PageSection>

      {/* ─ Guardrail ───────────────────────────────────────────────────────── */}
      <GuardrailCallout
        title="Outdated Version Warning"
        icon={ShieldAlert}
        tone="amber"
      >
        {outdated.length > 0 ? (
          <>
            <strong>{outdated.length} countries</strong> are behind the current version ({latest?.version}).
            Outdated countries:{' '}
            {outdated.map((c) => c.countryName).join(', ')}.
            Security patches and critical fixes should be deployed to all countries simultaneously.
          </>
        ) : (
          <>
            All countries are on the current version. For new releases, deployment should be completed within 48 hours.
          </>
        )}
      </GuardrailCallout>
    </ProductPage>
  )
}
