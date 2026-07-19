'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  AlertTriangle,
  GitBranch,
  Globe,
  Info,
  Lightbulb,
  PackageCheck,
  PackageSearch,
  Route,
  Truck,
  Boxes,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import {
  Callout,
  FeatureCountryRows,
  FeatureHeaderMetrics,
  FeatureOpsPanel,
  FeatureOverviewPanel,
  FeatureTicketsPanel,
  FlowDiagram,
  PageSection,
  ProductPage,
  StickySectionNav,
} from '@/components/product'
import {
  COUNTRIES,
  getFeatureDomain,
  isSupported,
  listFeatureRecordsByDomain,
} from '@/data/product/nesy'
import { toFeatureSlug } from '@/data/product/feature-slug'
import { toneCard, toneHero, toneIcon, toneIconBox, toneText } from '@/components/product/tones'
import { resolveFeatureDetailSections } from './feature-detail-sections'

const moduleIcons = [PackageCheck, PackageSearch, Route, Truck, Globe, Boxes] as const
const moduleTones = ['orange', 'amber', 'teal', 'blue', 'purple', 'indigo'] as const

const featureRecords = listFeatureRecordsByDomain()

const scoreMeta: Record<
  string,
  { label: string; hint: string; higherIsWorse: boolean }
> = {
  bugProneness: { label: 'Bug riski', hint: 'Yüksek = daha riskli', higherIsWorse: true },
  boilerplate: { label: 'Boilerplate', hint: 'Yüksek = daha fazla tekrar', higherIsWorse: true },
  complexity: { label: 'Karmaşıklık', hint: 'Yüksek = daha karmaşık', higherIsWorse: true },
  testCoverage: { label: 'Test coverage', hint: 'Yüksek = daha iyi', higherIsWorse: false },
}

export default function FeatureDetailPage() {
  const params = useParams<{ slugName: string }>()
  const recordIndex = featureRecords.findIndex(
    (item) => toFeatureSlug(item.feature.id) === params.slugName,
  )
  const record = featureRecords[recordIndex]

  if (!record) {
    return (
      <ProductPage path="/product/feature-library" hideToolbar>
        <Callout icon={AlertTriangle} title="Feature bulunamadı" tone="red">
          <p>Bu slug ile eşleşen feature kaydı yok.</p>
          <Link
            href="/product/feature-library"
            className="mt-2 inline-flex font-semibold underline underline-offset-4"
          >
            Feature Library’ye dön
          </Link>
        </Callout>
      </ProductPage>
    )
  }

  const { feature, moduleIndex } = record
  const detail = feature.detail
  const domain = getFeatureDomain(feature.domainId)
  const tone = moduleTones[moduleIndex % moduleTones.length]!
  const ModuleIcon = moduleIcons[moduleIndex % moduleIcons.length]!
  const activeCountries = COUNTRIES.filter((country) => country.id !== 'core')
  const supportedCountryCount = activeCountries.filter((country) =>
    isSupported(feature.values[country.id]),
  ).length

  const sections = resolveFeatureDetailSections({
    hasDetail: Boolean(detail),
    hasDiagram: Boolean(detail?.diagram && detail.diagram.length > 0),
  })
  const sectionIds = new Set(sections.map((section) => section.id))

  return (
    <ProductPage path="/product/feature-library" hideToolbar>
      <section
        className={cn(
          'rounded-2xl border bg-gradient-to-br p-5 sm:p-6',
          toneHero[tone],
          toneCard[tone],
        )}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', toneIconBox[tone])}>
                <ModuleIcon className={cn('size-5', toneIcon[tone])} />
              </span>
              <div className="min-w-0">
                {domain && (
                  <div className={cn('text-[11px] font-bold uppercase tracking-[0.16em]', toneText[tone])}>
                    {domain.title} · Feature detayı
                  </div>
                )}
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {feature.title}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/80">{feature.desc}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-border/50 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <FeatureHeaderMetrics
              supportedCountryCount={supportedCountryCount}
              totalCountries={activeCountries.length}
              bugProneness={detail?.score.bugProneness}
              ticketCount={detail?.tickets.length ?? 0}
              openTicketCount={
                detail?.tickets.filter((ticket) => ticket.status === 'open').length ?? 0
              }
              countriesHref={sectionIds.has('countries') ? '#feature-countries' : undefined}
              opsHref={sectionIds.has('ops') ? '#feature-ops' : undefined}
            />
          </div>
        </div>
      </section>

      <StickySectionNav items={sections} tone={tone} />

      <div className="space-y-10 pt-2">
        {sectionIds.has('overview') && (
          <PageSection
            id="feature-overview"
            className="scroll-mt-24"
            eyebrow="Genel bakış"
            title="Özet"
            icon={Info}
            tone={tone}
            description={detail ? undefined : 'Bu feature için detay içeriği henüz hazır değil.'}
          >
            {detail ? (
              <FeatureOverviewPanel
                whatIs={detail.whatIs}
                steps={detail.howItWorks}
                tone={tone}
              />
            ) : (
              <EmptyPanel message="Bu feature için detay içeriği henüz hazır değil." />
            )}
          </PageSection>
        )}

        {sectionIds.has('flow') && detail?.diagram && (
          <PageSection
            id="feature-flow"
            className="scroll-mt-24"
            eyebrow="İş akışı"
            title={`${feature.title} · Operasyon diyagramı`}
            icon={GitBranch}
            tone={tone}
          >
            <div className={cn('rounded-xl border bg-background/50 px-3 py-4 sm:px-4 sm:py-5', toneCard[tone])}>
              <FlowDiagram elements={detail.diagram} tone={tone} />
            </div>
          </PageSection>
        )}

        {sectionIds.has('countries') && (
          <PageSection
            id="feature-countries"
            className="scroll-mt-24"
            eyebrow="Ülkeler"
            title="Ülke kapsamı"
            icon={Globe}
            tone={tone}
          >
            <FeatureCountryRows
              rows={COUNTRIES.map((country) => ({
                id: country.id,
                name: country.name,
                subtitle: country.subtitle,
                value: feature.values[country.id],
              }))}
            />
          </PageSection>
        )}

        {sectionIds.has('ops') && detail && (
          <PageSection
            id="feature-ops"
            className="scroll-mt-24"
            eyebrow="Saha notları"
            title="Bilmeniz gerekenler"
            icon={Lightbulb}
            tone={tone}
          >
            <div className="space-y-4">
              <FeatureOpsPanel
                tone={tone}
                tips={detail.tips}
                scores={Object.entries(detail.score).map(([key, value]) => {
                  const meta = scoreMeta[key]
                  return {
                    key,
                    label: meta?.label ?? key,
                    value,
                    higherIsWorse: meta?.higherIsWorse ?? true,
                  }
                })}
              />

              <FeatureTicketsPanel
                tone={tone}
                tickets={detail.tickets}
                experts={detail.experts}
              />
            </div>
          </PageSection>
        )}
      </div>

    </ProductPage>
  )
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-muted/20 px-6 py-16 text-center">
      <Info className="mx-auto size-8 text-muted-foreground/50" />
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
