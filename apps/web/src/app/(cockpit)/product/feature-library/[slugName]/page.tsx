'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bug,
  CheckCircle2,
  Code2,
  FileText,
  GitBranch,
  Globe,
  Info,
  Lightbulb,
  MonitorSmartphone,
  PackageCheck,
  PackageSearch,
  Route,
  Settings,
  Ticket,
  Truck,
  Users,
  Boxes,
} from 'lucide-react'
import { Button } from '@nesy/metronic/components/ui/button'
import { cn } from '@nesy/metronic/lib/utils'
import {
  Callout,
  FeatureCountryRows,
  FlowDiagram,
  PageSection,
  ProductPage,
  StickySectionNav,
  TagBadge,
} from '@/components/product'
import {
  COUNTRIES,
  getFeatureDomain,
  isSupported,
  listFeatureRecordsByDomain,
} from '@/data/product/nesy'
import { toFeatureSlug } from '@/data/product/feature-slug'
import { toneCard, toneDot, toneHero, toneIcon, toneIconBox, toneText } from '@/components/product/tones'
import { resolveFeatureDetailSections } from './feature-detail-sections'

const moduleIcons = [PackageCheck, PackageSearch, Route, Truck, Globe, Boxes] as const
const moduleTones = ['orange', 'amber', 'teal', 'blue', 'purple', 'indigo'] as const

const featureRecords = listFeatureRecordsByDomain()

const scoreLabels: Record<string, string> = {
  bugProneness: 'Bug Risk',
  boilerplate: 'Boilerplate',
  complexity: 'Complexity',
  testCoverage: 'Test Coverage',
}

const scoreColors: Record<number, string> = {
  1: 'bg-green-500',
  2: 'bg-emerald-500',
  3: 'bg-amber-500',
  4: 'bg-orange-500',
  5: 'bg-red-500',
}

const ticketStatus = {
  open: { label: 'Open', tone: 'amber' as const },
  closed: { label: 'Closed', tone: 'green' as const },
  'in-progress': { label: 'In Progress', tone: 'blue' as const },
}

export default function FeatureDetailPage() {
  const params = useParams<{ slugName: string }>()
  const recordIndex = featureRecords.findIndex(
    (item) => toFeatureSlug(item.feature.id) === params.slugName,
  )
  const record = featureRecords[recordIndex]

  if (!record) {
    return (
      <ProductPage path="/product/feature-library">
        <Callout icon={AlertTriangle} title="Feature not found" tone="red">
          <p>No feature record matching this slug found.</p>
          <Link
            href="/product/feature-library"
            className="mt-2 inline-flex font-semibold underline underline-offset-4"
          >
            Return to Feature Library
          </Link>
        </Callout>
      </ProductPage>
    )
  }

  const { feature, module, moduleIndex } = record
  const detail = feature.detail
  const domain = getFeatureDomain(feature.domainId)
  const tone = moduleTones[moduleIndex % moduleTones.length]!
  const ModuleIcon = moduleIcons[moduleIndex % moduleIcons.length]!
  const activeCountries = COUNTRIES.filter((country) => country.id !== 'core')
  const supportedCountryCount = activeCountries.filter((country) =>
    isSupported(feature.values[country.id]),
  ).length
  const previousFeature = featureRecords[recordIndex - 1]?.feature
  const nextFeature = featureRecords[recordIndex + 1]?.feature
  const isCore = isSupported(feature.values.core)

  const sections = resolveFeatureDetailSections({
    hasDetail: Boolean(detail),
    hasDiagram: Boolean(detail?.diagram && detail.diagram.length > 0),
  })
  const sectionIds = new Set(sections.map((section) => section.id))

  return (
    <ProductPage path="/product/feature-library">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/product/feature-library">
              <ArrowLeft className="size-4" />
              Feature Library
            </Link>
          </Button>
          {domain && (
            <>
              <span className="text-muted-foreground">/</span>
              <Link
                href={`/product/feature-library#domain-${domain.id}`}
                className="font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                {domain.title}
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="font-semibold text-foreground">{feature.title}</span>
            </>
          )}
        </div>
        <span className="hidden text-xs text-muted-foreground sm:block">
          {recordIndex + 1} / {featureRecords.length}
        </span>
      </div>

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
                    {domain.title} · Feature Detail
                  </div>
                )}
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {feature.title}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/80">{feature.desc}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <TagBadge label={isCore ? 'CORE' : 'No CORE'} tone={isCore ? 'green' : 'gray'} />
              <TagBadge label={module.title} tone="gray" />
              <TagBadge
                label={detail ? 'Detail document ready' : 'Detail pending'}
                tone={detail ? 'blue' : 'amber'}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-border/50 pt-4 lg:min-w-[240px] lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <IdentityMetric
              label="Country"
              value={`${supportedCountryCount}/${activeCountries.length}`}
            />
            <IdentityMetric label="Risk" value={detail ? `${detail.score.bugProneness}/5` : '—'} />
            <IdentityMetric label="Tickets" value={String(detail?.tickets.length ?? 0)} />
          </div>
        </div>
      </section>

      <StickySectionNav items={sections} tone={tone} />

      <div className="space-y-10 pt-2">
        {sectionIds.has('overview') && (
          <PageSection
            id="feature-overview"
            className="scroll-mt-24"
            eyebrow="Overview"
            title="What is it?"
            icon={Info}
            tone={tone}
            description={detail ? undefined : 'Detail content is not prepared yet for this feature.'}
          >
            {detail ? (
              <div className="space-y-6">
                <p className="max-w-3xl text-sm leading-7 text-foreground/85">{detail.whatIs}</p>

                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                    <GitBranch className={cn('size-4', toneIcon[tone])} />
                    How it works
                  </h3>
                  <ol className="grid gap-2.5 md:grid-cols-2">
                    {detail.howItWorks.map((step, index) => (
                      <li
                        key={step}
                        className="flex gap-2.5 rounded-lg border border-border/50 bg-background/40 p-3 text-sm"
                      >
                        <span
                          className={cn(
                            'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white',
                            toneDot[tone],
                          )}
                        >
                          {index + 1}
                        </span>
                        <span className="leading-relaxed text-foreground/85">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                    <MonitorSmartphone className={cn('size-4', toneIcon[tone])} />
                    Screens used
                  </h3>
                  <div className="space-y-2">
                    {detail.screens.map((screen) => (
                      <div
                        key={screen}
                        className="flex gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2.5 text-xs leading-relaxed"
                      >
                        <Code2 className={cn('mt-0.5 size-3.5 shrink-0', toneIcon[tone])} />
                        {screen}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyPanel message="Detail content is not prepared yet for this feature." />
            )}
          </PageSection>
        )}

        {sectionIds.has('flow') && detail?.diagram && (
          <PageSection
            id="feature-flow"
            className="scroll-mt-24"
            eyebrow="Flow"
            title={`${feature.title} · Operation flow`}
            icon={GitBranch}
            tone={tone}
          >
            <div className={cn('rounded-2xl border p-5 sm:p-8', toneCard[tone])}>
              <FlowDiagram elements={detail.diagram} tone={tone} />
            </div>
          </PageSection>
        )}

        {sectionIds.has('countries') && (
          <PageSection
            id="feature-countries"
            className="scroll-mt-24"
            eyebrow="Countries"
            title="Country scope"
            icon={Globe}
            tone={tone}
            description="How this capability behaves across CORE and country markets."
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

        {sectionIds.has('tech') && detail && (
          <PageSection
            id="feature-tech"
            className="scroll-mt-24"
            eyebrow="Tech"
            title="Parameters & API"
            icon={Settings}
            tone={tone}
          >
            <div className="grid gap-6 xl:grid-cols-2">
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                  <Settings className={cn('size-4', toneIcon[tone])} />
                  Linked parameters
                </h3>
                {detail.parameters.length > 0 ? (
                  <div className="space-y-2">
                    {detail.parameters.map((parameter) => (
                      <div key={parameter.name} className="rounded-lg border border-border/60 bg-background/40 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <code className="text-xs font-bold text-foreground">{parameter.name}</code>
                          <TagBadge label={parameter.type} tone="gray" />
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{parameter.desc}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <InlineEmpty label="No linked parameters." />
                )}
              </div>

              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                  <Code2 className={cn('size-4', toneIcon[tone])} />
                  API endpoints
                </h3>
                {detail.apis && detail.apis.length > 0 ? (
                  <div className="space-y-2">
                    {detail.apis.map((api) => (
                      <div key={`${api.method}-${api.endpoint}`} className="rounded-lg border border-border/60 bg-background/40 p-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <TagBadge label={api.method} tone="blue" />
                          <code className="min-w-0 break-all text-xs font-semibold text-foreground">{api.endpoint}</code>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{api.desc}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <InlineEmpty label="No linked API endpoints." />
                )}
              </div>
            </div>
          </PageSection>
        )}

        {sectionIds.has('ops') && detail && (
          <PageSection
            id="feature-ops"
            className="scroll-mt-24"
            eyebrow="Ops"
            title="Know-how & score"
            icon={Lightbulb}
            tone={tone}
          >
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                  <Lightbulb className={cn('size-4', toneIcon[tone])} />
                  Info & tricks
                </h3>
                {detail.tips.length > 0 ? (
                  <ul className="space-y-2">
                    {detail.tips.map((tip) => (
                      <li
                        key={tip}
                        className="flex gap-2.5 rounded-lg border border-border/60 bg-background/40 p-3 text-sm"
                      >
                        <CheckCircle2 className={cn('mt-0.5 size-4 shrink-0', toneIcon[tone])} />
                        <span className="leading-relaxed text-foreground/85">{tip}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <InlineEmpty label="No saved tips." />
                )}
              </div>

              <div className="lg:col-span-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                  <Bug className={cn('size-4', toneIcon[tone])} />
                  Feature score
                </h3>
                <div className="space-y-3 rounded-xl border border-border/60 bg-background/40 p-4">
                  {Object.entries(detail.score).map(([key, value]) => (
                    <ScoreBar key={key} label={scoreLabels[key] ?? key} value={value} />
                  ))}
                </div>
              </div>

              <div className="lg:col-span-7">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                  <Ticket className={cn('size-4', toneIcon[tone])} />
                  Tickets
                </h3>
                {detail.tickets.length > 0 ? (
                  <div className="space-y-2">
                    {detail.tickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 p-3"
                      >
                        <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <code className="text-xs font-bold">{ticket.id}</code>
                            <TagBadge
                              label={ticketStatus[ticket.status].label}
                              tone={ticketStatus[ticket.status].tone}
                            />
                          </div>
                          <p className="mt-1 text-sm text-foreground/80">{ticket.title}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <InlineEmpty label="No tickets for this feature." />
                )}
              </div>

              <div className="lg:col-span-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                  <Users className={cn('size-4', toneIcon[tone])} />
                  Know-how owners
                </h3>
                {detail.experts.length > 0 ? (
                  <div className="space-y-2">
                    {detail.experts.map((expert) => (
                      <div
                        key={expert.name}
                        className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 p-3"
                      >
                        <span
                          className={cn(
                            'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white',
                            toneDot[tone],
                          )}
                        >
                          {expert.name
                            .split(' ')
                            .map((word) => word[0])
                            .slice(0, 2)
                            .join('')}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{expert.name}</div>
                          <div className="truncate text-xs text-muted-foreground">{expert.role}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <InlineEmpty label="No know-how owner defined." />
                )}
              </div>
            </div>
          </PageSection>
        )}
      </div>

      <nav className="grid gap-3 border-t border-border/60 pt-6" aria-label="Feature navigation">
        <div className="grid gap-3 sm:grid-cols-2">
          {previousFeature ? (
            <Link
              href={`/product/feature-library/${toFeatureSlug(previousFeature.id)}`}
              className="group rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
            >
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                <ArrowLeft className="size-3" /> Previous feature
              </div>
              <div className="mt-1.5 text-sm font-semibold group-hover:text-primary">{previousFeature.title}</div>
            </Link>
          ) : (
            <div />
          )}
          {nextFeature && (
            <Link
              href={`/product/feature-library/${toFeatureSlug(nextFeature.id)}`}
              className="group rounded-xl border bg-card p-4 text-right transition-colors hover:bg-muted/40"
            >
              <div className="flex items-center justify-end gap-1 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                Next feature <ArrowRight className="size-3" />
              </div>
              <div className="mt-1.5 text-sm font-semibold group-hover:text-primary">{nextFeature.title}</div>
            </Link>
          )}
        </div>
      </nav>
    </ProductPage>
  )
}

function IdentityMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center lg:text-left">
      <div className="text-lg font-bold text-foreground">{value}</div>
      <div className="text-[9px] font-bold uppercase tracking-[0.13em] text-muted-foreground">{label}</div>
    </div>
  )
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="font-bold text-foreground">{value}/5</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', scoreColors[value])} style={{ width: `${value * 20}%` }} />
      </div>
    </div>
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

function InlineEmpty({ label }: { label: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{label}</p>
}
