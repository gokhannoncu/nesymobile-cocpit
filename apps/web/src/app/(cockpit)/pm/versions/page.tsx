'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  Code2,
  ExternalLink,
  GitCommit,
  Globe2,
  History,
  PackageCheck,
  Tag,
  Workflow,
} from 'lucide-react'
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
  type Tone,
} from '@/components/product'
import {
  getCountryVersionHistory,
  productionReleases,
  productionReleaseSummary,
  type CountryVersionTransition,
  type ProductionReleaseKind,
} from '@/data/pm/production-releases'
import { countryVersions } from '@/data/pm/versions'

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

type VersionCountryId = CountryVersionTransition['countryId']
type CountryFilter = VersionCountryId | 'all'

const COUNTRY_ORDER: VersionCountryId[] = ['hr', 'si', 'rs', 'ba', 'me']

const COUNTRY_NAMES: Record<VersionCountryId | 'sk', string> = {
  hr: 'Hırvatistan',
  si: 'Slovenya',
  rs: 'Sırbistan',
  ba: 'Bosna Hersek',
  me: 'Karadağ',
  sk: 'Slovakya',
}

const COUNTRY_TONES: Record<VersionCountryId, Tone> = {
  hr: 'red',
  si: 'blue',
  rs: 'green',
  ba: 'amber',
  me: 'purple',
}

const KIND_LABELS: Record<ProductionReleaseKind, string> = {
  code: 'Uygulama kodu',
  workflow: 'Prod CI / Workflow',
  rollout: 'Yalnızca rollout',
}

const KIND_BADGES: Record<ProductionReleaseKind, string> = {
  code: 'border-transparent bg-green-600 text-white',
  workflow: 'border-transparent bg-blue-600 text-white',
  rollout: 'border-transparent bg-amber-500 text-amber-950',
}

const KIND_ICONS = {
  code: Code2,
  workflow: Workflow,
  rollout: PackageCheck,
} satisfies Record<ProductionReleaseKind, typeof Code2>

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return `${day} ${MONTHS[month! - 1]} ${year}`
}

function isVersionCountry(countryId: string): countryId is VersionCountryId {
  return COUNTRY_ORDER.includes(countryId as VersionCountryId)
}

export default function VersionsPage() {
  const [countryFilter, setCountryFilter] = useState<CountryFilter>('all')
  const [showAllHistory, setShowAllHistory] = useState(false)

  const countryRows = useMemo(
    () =>
      countryVersions
        .map((country) => {
          const history = isVersionCountry(country.countryId)
            ? getCountryVersionHistory(country.countryId)
            : []
          return { country, history, latest: history.at(-1) }
        })
        .sort((a, b) => {
          const aIndex = isVersionCountry(a.country.countryId)
            ? COUNTRY_ORDER.indexOf(a.country.countryId)
            : COUNTRY_ORDER.length
          const bIndex = isVersionCountry(b.country.countryId)
            ? COUNTRY_ORDER.indexOf(b.country.countryId)
            : COUNTRY_ORDER.length
          return aIndex - bIndex
        }),
    [],
  )

  const trackedCountries = countryRows.filter(
    (row): row is typeof row & { country: typeof row.country & { countryId: VersionCountryId }; latest: NonNullable<typeof row.latest> } =>
      isVersionCountry(row.country.countryId) && Boolean(row.latest),
  )

  const filteredHistory = useMemo(() => {
    const filtered =
      countryFilter === 'all'
        ? productionReleases
        : productionReleases.filter((release) =>
            release.versionTransitions.some((transition) => transition.countryId === countryFilter),
          )

    return [...filtered].reverse()
  }, [countryFilter])

  const visibleHistory = showAllHistory ? filteredHistory : filteredHistory.slice(0, 12)
  const latestRelease = productionReleases.at(-1)
  const missingCountries = countryRows.filter((row) => row.history.length === 0)

  const tableHeaders = [
    { label: 'Ülke' },
    { label: 'Production versionCode', tone: 'green' as const },
    { label: 'Önceki versionCode' },
    { label: 'Son release' },
    { label: 'Son deploy' },
    { label: 'Store' },
  ]

  const tableRows = countryRows.map(({ country, latest }) => {
    const countryName = COUNTRY_NAMES[country.countryId as keyof typeof COUNTRY_NAMES] ?? country.countryName

    return [
      <div key={`${country.countryId}-name`}>
        <div className="text-sm font-semibold text-foreground">{countryName}</div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {country.countryId}
        </div>
      </div>,
      latest ? (
        <span key={`${country.countryId}-production`} className="text-lg font-bold tabular-nums text-foreground">
          {latest.transition.to}
        </span>
      ) : (
        <span key={`${country.countryId}-production-empty`} className="text-xs text-muted-foreground">
          Kayıt yok
        </span>
      ),
      <span key={`${country.countryId}-previous`} className="text-sm font-semibold tabular-nums text-muted-foreground">
        {latest?.transition.from ?? '—'}
      </span>,
      latest ? (
        <div key={`${country.countryId}-release`} className="min-w-36">
          <div className="text-xs font-bold text-foreground">
            #{latest.release.sequence} · {latest.release.title}
          </div>
          <div className="mt-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
            {latest.release.commit}
          </div>
        </div>
      ) : (
        <span key={`${country.countryId}-release-empty`} className="text-xs text-muted-foreground">—</span>
      ),
      <span key={`${country.countryId}-deploy`} className="whitespace-nowrap text-xs font-medium">
        {latest ? formatDate(latest.release.date) : '—'}
      </span>,
      country.storeUrl ? (
        <a
          key={`${country.countryId}-store`}
          href={country.storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <ExternalLink className="size-3" />
          Play Store
        </a>
      ) : (
        <span key={`${country.countryId}-store-empty`} className="text-xs text-muted-foreground">—</span>
      ),
    ]
  })

  function selectCountry(countryId: CountryFilter) {
    setCountryFilter(countryId)
    setShowAllHistory(false)
  }

  return (
    <ProductPage path="/pm/versions" hideToolbar>
      <HeroCallout
        icon={Tag}
        eyebrow="Release & Versions"
        tone="indigo"
        title="Version Tracker"
        lead="Ülke bazındaki production versionCode’larını, son deploy bilgilerini ve version geçmişini rel/env-prod release’lerinden takip edin."
        chips={[
          `${productionReleaseSummary.total} first-parent release`,
          `${trackedCountries.length} ülke`,
          'Production versionCode',
          latestRelease ? `Güncel · ${formatDate(latestRelease.date)}` : 'Release kaydı yok',
        ]}
        layout="stack"
      />

      <PageSection
        title="Güncel production version’ları"
        icon={Globe2}
        tone="green"
        description="Her ülkenin release geçmişindeki son version geçişi."
      >
        <StatGrid cols={5}>
          {trackedCountries.map(({ country, latest }) => (
            <StatCard
              key={country.countryId}
              label={`${country.countryId.toUpperCase()} · ${COUNTRY_NAMES[country.countryId]}`}
              value={String(latest.transition.to)}
              hint={`Son release #${latest.release.sequence} · ${formatDate(latest.release.date)}`}
              tone={COUNTRY_TONES[country.countryId]}
            />
          ))}
        </StatGrid>
      </PageSection>

      <PageSection
        title="Ülke × version matrisi"
        icon={Tag}
        tone="indigo"
        description="Production versionCode, önceki değer, son release ve deploy tarihi. Store linkleri mevcut haliyle korunmuştur."
      >
        <ComparisonTable headers={tableHeaders} rows={tableRows} highlightCol={1} />
      </PageSection>

      <PageSection
        title="Version geçmişi"
        icon={History}
        tone="blue"
        description="Release’lerdeki ülke version geçişlerini kronolojik olarak inceleyin."
      >
        <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-border bg-muted/20 p-2.5">
          <button
            type="button"
            onClick={() => selectCountry('all')}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
              countryFilter === 'all'
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:bg-background hover:text-foreground',
            )}
          >
            Tümü · {productionReleases.length}
          </button>
          {COUNTRY_ORDER.map((countryId) => {
            const count = getCountryVersionHistory(countryId).length
            return (
              <button
                key={countryId}
                type="button"
                onClick={() => selectCountry(countryId)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                  countryFilter === countryId
                    ? 'bg-foreground text-background shadow-sm'
                    : 'text-muted-foreground hover:bg-background hover:text-foreground',
                )}
              >
                {countryId.toUpperCase()} · {count}
              </button>
            )
          })}
        </div>

        <ol className="space-y-2">
          {visibleHistory.map((release) => {
            const transitions =
              countryFilter === 'all'
                ? release.versionTransitions
                : release.versionTransitions.filter(
                    (transition) => transition.countryId === countryFilter,
                  )
            const KindIcon = KIND_ICONS[release.kind]
            const changeCount = release.features.length + release.fixes.length
            const hasRollback = transitions.some(
              (transition) => transition.from !== null && transition.to < transition.from,
            )

            return (
              <li key={release.id}>
                <article className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30">
                        <KindIcon className="size-4 text-muted-foreground" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge size="sm" className={KIND_BADGES[release.kind]}>
                            {KIND_LABELS[release.kind]}
                          </Badge>
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {formatDate(release.date)}{release.time ? ` · ${release.time}` : ''}
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-muted-foreground">
                            <GitCommit className="size-3" />
                            {release.commit}
                          </span>
                        </div>
                        <h3 className="mt-1.5 text-sm font-bold text-foreground">
                          <span className="me-1.5 text-muted-foreground">#{release.sequence}</span>
                          {release.title}
                        </h3>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-1.5">
                      {transitions.map((transition) => {
                        const isRollback =
                          transition.from !== null && transition.to < transition.from
                        return (
                          <span
                            key={transition.countryId}
                            className={cn(
                              'rounded-md border px-2 py-1 text-xs font-bold tabular-nums',
                              isRollback
                                ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
                                : 'border-border bg-muted/25 text-foreground',
                            )}
                          >
                            {transition.countryId.toUpperCase()}{' '}
                            {transition.from === null
                              ? transition.to
                              : `${transition.from}→${transition.to}`}
                          </span>
                        )
                      })}
                    </div>
                  </div>

                  {(changeCount > 0 || release.notes || hasRollback) && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
                      {release.features.length > 0 && (
                        <span className="rounded-md bg-muted px-2 py-1">
                          {release.features.length} {release.features.length === 1 ? 'feature' : 'features'}
                        </span>
                      )}
                      {release.fixes.length > 0 && (
                        <span className="rounded-md bg-muted px-2 py-1">
                          {release.fixes.length} {release.fixes.length === 1 ? 'fix' : 'fixes'}
                        </span>
                      )}
                      {hasRollback && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                          <AlertTriangle className="size-3" />
                          Rollback
                        </span>
                      )}
                      {release.notes && <span className="leading-relaxed">{release.notes}</span>}
                    </div>
                  )}
                </article>
              </li>
            )
          })}
        </ol>

        {filteredHistory.length > 12 && (
          <button
            type="button"
            onClick={() => setShowAllHistory((value) => !value)}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/20 px-4 py-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            {showAllHistory
              ? 'Daha az göster'
              : `Tüm ${filteredHistory.length} release’i göster`}
            <ChevronDown
              className={cn('size-3.5 transition-transform', showAllHistory && 'rotate-180')}
            />
          </button>
        )}
      </PageSection>

      <Callout icon={GitCommit} title="Veri kaynağı" tone="amber">
        Production versionCode’ları <code>rel/env-prod</code> dalındaki first-parent release
        geçişlerinden üretildi. Staging için bu kaynakta doğrulanabilir version verisi bulunmadığı
        için staging değeri gösterilmedi.
        {missingCountries.length > 0 && (
          <>
            {' '}Release geçmişinde {missingCountries.map(({ country }) => country.countryId.toUpperCase()).join(', ')}
            {' '}version geçişi bulunmadığından ilgili production alanı boş bırakıldı.
          </>
        )}
      </Callout>
    </ProductPage>
  )
}
