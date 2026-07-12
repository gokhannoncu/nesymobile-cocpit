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

const TR_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

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
  return `${d.getDate()} ${TR_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VersionsPage() {
  const outdated = getOutdatedCountries()
  const latest = getLatestRelease()

  // ─ Section 2: Comparison Table ──────────────────────────────────────────────
  const tableHeaders = [
    { label: 'Ülke' },
    { label: 'Production', tone: 'green' as const },
    { label: 'Staging', tone: 'blue' as const },
    { label: 'Son Deploy' },
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
    <ProductPage path="/pm/versions" title="Versiyon Takipçisi">
      {/* ─ Hero ────────────────────────────────────────────────────────────── */}
      <HeroCallout
        icon={Tag}
        eyebrow="Release & Versions"
        tone="indigo"
        title="Versiyon Takipçisi"
        lead="Her ülkenin production ve staging sürümlerini, store linklerini ve versiyon geçmişini tek ekrandan takip edin."
        chips={['Ülke Bazlı', 'Prod & Staging', 'Store Linkleri']}
      />

      {/* ─ Güncel Sürümler ─────────────────────────────────────────────────── */}
      <PageSection
        title="Güncel Sürümler"
        icon={Globe}
        tone="green"
        description="Ülke bazında canlıdaki ve staging ortamındaki mevcut versiyonlar."
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

      {/* ─ Ülke × Versiyon Matrisi ─────────────────────────────────────────── */}
      <PageSection
        title="Ülke × Versiyon Matrisi"
        icon={Tag}
        tone="indigo"
        description="Tüm ülkelerin production, staging, deploy tarihi ve store bağlantıları."
      >
        <ComparisonTable headers={tableHeaders} rows={tableRows} highlightCol={1} />
      </PageSection>

      {/* ─ Versiyon Geçmişi ────────────────────────────────────────────────── */}
      <PageSection
        title="Versiyon Geçmişi"
        icon={History}
        tone="blue"
        description="Tüm sürümlerin kronolojik listesi ve öne çıkan değişiklikler."
      >
        <Timeline items={historyItems} />
      </PageSection>

      {/* ─ Guardrail ───────────────────────────────────────────────────────── */}
      <GuardrailCallout
        title="Güncel Olmayan Sürüm Uyarısı"
        icon={ShieldAlert}
        tone="amber"
      >
        {outdated.length > 0 ? (
          <>
            <strong>{outdated.length} ülke</strong> güncel sürümün ({latest?.version}) gerisinde.
            Güncel olmayan ülkeler:{' '}
            {outdated.map((c) => c.countryName).join(', ')}.
            Güvenlik yamaları ve kritik düzeltmeler tüm ülkelere eş zamanlı deploy edilmelidir.
          </>
        ) : (
          <>
            Tüm ülkeler güncel sürümde. Yeni release&apos;lerde deploy sırasının
            48 saat içinde tamamlanması hedeflenmelidir.
          </>
        )}
      </GuardrailCallout>
    </ProductPage>
  )
}
