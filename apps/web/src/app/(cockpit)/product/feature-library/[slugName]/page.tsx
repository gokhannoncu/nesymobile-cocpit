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
  DataTable,
  FlowDiagram,
  HeroCallout,
  ProductPage,
  SegmentTabs,
  TagBadge,
} from '@/components/product'
import {
  COUNTRIES,
  getFeatureDomain,
  isSupported,
  listFeatureRecordsByDomain,
} from '@/data/product/nesy'
import { toFeatureSlug } from '@/data/product/feature-slug'
import { toneCard, toneDot, toneIcon, toneIconBox, toneText } from '@/components/product/tones'

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

  const countryRows = COUNTRIES.map((country) => {
    const value = feature.values[country.id]
    const isCore = country.id === 'core'
    const status = value === '—' ? 'None' : value === 'N/A' ? 'Out of scope' : 'Active'
    const statusTone = value === '—' ? 'red' : value === 'N/A' ? 'gray' : 'green'

    return {
      country: (
        <div>
          <div className="font-semibold text-foreground">{country.name}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{country.subtitle}</div>
        </div>
      ),
      type: <TagBadge label={isCore ? 'Standard' : 'Country'} tone={isCore ? 'indigo' : 'gray'} />,
      status: <TagBadge label={status} tone={statusTone} />,
      behavior: (
        <p className="max-w-2xl whitespace-pre-line text-xs leading-relaxed text-foreground/80">
          {value === '—' ? 'Not available yet.' : value === 'N/A' ? 'Out of scope for this country.' : value}
        </p>
      ),
    }
  })

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

      <HeroCallout
        icon={ModuleIcon}
        eyebrow={domain ? `${domain.title} · Feature Detail` : `${module.title} · Feature Detail`}
        tone={tone}
        title={feature.title}
        lead={feature.desc}
        chips={[
          isCore ? 'CORE' : 'No CORE',
          module.title,
          `${supportedCountryCount}/${activeCountries.length} countries`,
          detail ? 'Detail document ready' : 'Detail pending',
        ]}
      >
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/70 bg-background/75 p-3 shadow-sm backdrop-blur-sm">
          <HeroMetric label="Country" value={`${supportedCountryCount}/${activeCountries.length}`} />
          <HeroMetric label="Risk" value={detail ? `${detail.score.bugProneness}/5` : '—'} />
          <HeroMetric label="Ticket" value={String(detail?.tickets.length ?? 0)} />
        </div>
      </HeroCallout>

      <SegmentTabs
        variant="button"
        items={[
          {
            value: 'overview',
            label: 'Overview',
            icon: Info,
            content: detail ? (
              <div className="grid gap-4 lg:grid-cols-12">
                <DetailPanel
                  title="What is it?"
                  icon={Info}
                  tone={tone}
                  className="lg:col-span-7"
                >
                  <p className="text-sm leading-7 text-foreground/85">{detail.whatIs}</p>
                </DetailPanel>

                <DetailPanel
                  title="Screens Used"
                  icon={MonitorSmartphone}
                  tone={tone}
                  className="lg:col-span-5"
                >
                  <div className="space-y-2">
                    {detail.screens.map((screen) => (
                      <div
                        key={screen}
                        className="flex gap-2 rounded-lg border border-border/60 bg-background/70 px-3 py-2.5 text-xs leading-relaxed"
                      >
                        <Code2 className={cn('mt-0.5 size-3.5 shrink-0', toneIcon[tone])} />
                        {screen}
                      </div>
                    ))}
                  </div>
                </DetailPanel>

                <DetailPanel
                  title="How it Works?"
                  icon={GitBranch}
                  tone={tone}
                  className="lg:col-span-12"
                >
                  <ol className="grid gap-2.5 md:grid-cols-2">
                    {detail.howItWorks.map((step, index) => (
                      <li
                        key={step}
                        className="flex gap-2.5 rounded-lg border border-border/50 bg-background/60 p-3 text-sm"
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
                </DetailPanel>
              </div>
            ) : (
              <EmptyPanel message="Detail content is not prepared yet for this feature." />
            ),
          },
          {
            value: 'countries',
            label: 'Country Scope',
            icon: Globe,
            content: (
              <DataTable
                columns={[
                  { key: 'country', label: 'Country', className: 'min-w-36' },
                  { key: 'type', label: 'Type' },
                  { key: 'status', label: 'Status' },
                  { key: 'behavior', label: 'Behavior', className: 'min-w-80' },
                ]}
                rows={countryRows}
              />
            ),
          },
          {
            value: 'flow',
            label: 'Flow Diagram',
            icon: GitBranch,
            content:
              detail?.diagram && detail.diagram.length > 0 ? (
                <div className={cn('rounded-2xl border p-5 sm:p-8', toneCard[tone])}>
                  <div className={cn('mb-6 text-xs font-bold uppercase tracking-[0.16em]', toneText[tone])}>
                    {feature.title} · Operation Flow
                  </div>
                  <FlowDiagram elements={detail.diagram} tone={tone} />
                </div>
              ) : (
                <EmptyPanel message="Flow diagram is not prepared yet for this feature." />
              ),
          },
          {
            value: 'technical',
            label: 'Parameters & API',
            icon: Settings,
            content: detail ? (
              <div className="grid gap-5 xl:grid-cols-2">
                <DetailPanel title="Linked Parameters" icon={Settings} tone={tone}>
                  {detail.parameters.length > 0 ? (
                    <div className="space-y-2">
                      {detail.parameters.map((parameter) => (
                        <div key={parameter.name} className="rounded-lg border border-border/60 bg-background/70 p-3">
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
                </DetailPanel>

                <DetailPanel title="API Endpoints" icon={Code2} tone={tone}>
                  {detail.apis && detail.apis.length > 0 ? (
                    <div className="space-y-2">
                      {detail.apis.map((api) => (
                        <div key={`${api.method}-${api.endpoint}`} className="rounded-lg border border-border/60 bg-background/70 p-3">
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
                </DetailPanel>
              </div>
            ) : (
              <EmptyPanel message="Technical details are not prepared yet." />
            ),
          },
          {
            value: 'operations',
            label: 'Know-how & Score',
            icon: Lightbulb,
            content: detail ? (
              <div className="grid gap-5 lg:grid-cols-12">
                <DetailPanel title="Info & Tricks" icon={Lightbulb} tone={tone} className="lg:col-span-7">
                  {detail.tips.length > 0 ? (
                    <ul className="space-y-2">
                      {detail.tips.map((tip) => (
                        <li key={tip} className="flex gap-2.5 rounded-lg border border-border/60 bg-background/70 p-3 text-sm">
                          <CheckCircle2 className={cn('mt-0.5 size-4 shrink-0', toneIcon[tone])} />
                          <span className="leading-relaxed text-foreground/85">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <InlineEmpty label="No saved tips." />
                  )}
                </DetailPanel>

                <DetailPanel title="Feature Score" icon={Bug} tone={tone} className="lg:col-span-5">
                  <div className="space-y-3">
                    {Object.entries(detail.score).map(([key, value]) => (
                      <ScoreBar key={key} label={scoreLabels[key] ?? key} value={value} />
                    ))}
                  </div>
                </DetailPanel>

                <DetailPanel title="Tickets" icon={Ticket} tone={tone} className="lg:col-span-7">
                  {detail.tickets.length > 0 ? (
                    <div className="space-y-2">
                      {detail.tickets.map((ticket) => (
                        <div key={ticket.id} className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/70 p-3">
                          <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <code className="text-xs font-bold">{ticket.id}</code>
                              <TagBadge label={ticketStatus[ticket.status].label} tone={ticketStatus[ticket.status].tone} />
                            </div>
                            <p className="mt-1 text-sm text-foreground/80">{ticket.title}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <InlineEmpty label="No tickets for this feature." />
                  )}
                </DetailPanel>

                <DetailPanel title="Know-how Owners" icon={Users} tone={tone} className="lg:col-span-5">
                  {detail.experts.length > 0 ? (
                    <div className="space-y-2">
                      {detail.experts.map((expert) => (
                        <div key={expert.name} className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/70 p-3">
                          <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white', toneDot[tone])}>
                            {expert.name.split(' ').map((word) => word[0]).slice(0, 2).join('')}
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
                </DetailPanel>
              </div>
            ) : (
              <EmptyPanel message="Operational know-how is not prepared yet." />
            ),
          },
        ]}
      />

      <nav className="grid gap-3 border-t border-border/60 pt-6 sm:grid-cols-2" aria-label="Feature navigation">
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
      </nav>
    </ProductPage>
  )
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold text-foreground">{value}</div>
      <div className="text-[9px] font-bold uppercase tracking-[0.13em] text-muted-foreground">{label}</div>
    </div>
  )
}

function DetailPanel({
  title,
  icon: Icon,
  tone,
  children,
  className,
}: {
  title: string
  icon: typeof Info
  tone: (typeof moduleTones)[number]
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-2xl border p-4 sm:p-5', toneCard[tone], className)}>
      <header className="mb-3 flex items-center gap-2.5">
        <span className={cn('flex size-8 items-center justify-center rounded-lg', toneIconBox[tone])}>
          <Icon className={cn('size-4', toneIcon[tone])} />
        </span>
        <h2 className={cn('text-sm font-bold', toneText[tone])}>{title}</h2>
      </header>
      {children}
    </section>
  )
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="font-bold text-foreground">{value}/5</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-background">
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
