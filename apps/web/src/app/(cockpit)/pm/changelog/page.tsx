'use client'

import { AlertTriangle, ScrollText } from 'lucide-react'
import {
  ProductPage,
  HeroCallout,
  StatCard,
  StatGrid,
  Callout,
  Timeline,
} from '@/components/product'
import type { TimelineItem } from '@/components/product/timeline'
import { releases } from '@/data/pm/releases'
import { COUNTRY_LABELS } from '@/data/pm/versions'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const statusTone: Record<string, 'green' | 'blue' | 'gray'> = {
  released: 'green',
  staging: 'blue',
  planned: 'gray',
}

const statusMap: Record<string, 'done' | 'active' | 'next'> = {
  released: 'done',
  staging: 'active',
  planned: 'next',
}

const statusLabel: Record<string, string> = {
  released: 'Released',
  staging: 'Staging',
  planned: 'Planned',
  'rolled-back': 'Rolled Back',
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChangelogPage() {
  const totalReleases = releases.length
  const totalFeatures = releases.reduce((sum, r) => sum + r.features.length, 0)
  const totalFixes = releases.reduce((sum, r) => sum + r.fixes.length, 0)

  const sorted = [...releases].sort((a, b) => b.date.localeCompare(a.date))

  const timelineItems: TimelineItem[] = sorted.map((r) => {
    const title = `v${r.version}${r.codename ? ` (${r.codename})` : ''}`
    const bullets = [
      ...r.features.map((f) => `✨ ${f}`),
      ...r.fixes.map((f) => `🐛 ${f}`),
      ...(r.breakingChanges ?? []).map((f) => `⚠️ ${f}`),
    ]
    const badges = [
      ...r.countries.map((c) => COUNTRY_LABELS[c] ?? c.toUpperCase()),
      statusLabel[r.status] ?? r.status,
    ]

    return {
      period: formatDate(r.date),
      title,
      desc: r.notes,
      tone: statusTone[r.status] ?? ('gray' as const),
      status: statusMap[r.status] ?? ('next' as const),
      bullets,
      badges,
    }
  })

  return (
    <ProductPage path="/pm/changelog" title="Changelog">
      {/* ─ Hero ────────────────────────────────────────────────────────────── */}
      <HeroCallout
        icon={ScrollText}
        eyebrow="Release & Versions"
        tone="purple"
        title="Changelog"
        lead="Complete record of features added, bugs fixed, and breaking changes in every release."
      >
        <StatGrid cols={3}>
          <StatCard label="Total Releases" value={totalReleases} tone="purple" />
          <StatCard label="Total Features" value={totalFeatures} tone="green" />
          <StatCard label="Total Fixes" value={totalFixes} tone="blue" />
        </StatGrid>
      </HeroCallout>

      {/* ─ Changelog Timeline ──────────────────────────────────────────────── */}
      <Timeline items={timelineItems} />

      {/* ─ Guardrail ───────────────────────────────────────────────────────── */}
      <Callout icon={AlertTriangle} title="Changelog ≠ Decision Record" tone="orange">
        The changelog lists technical changes but does not answer &quot;why did we make this decision?&quot;
        For architectural decisions and trade-offs, use ADR (Architecture Decision Record) documents.
        The changelog should only contain &quot;what changed.&quot;
      </Callout>
    </ProductPage>
  )
}
