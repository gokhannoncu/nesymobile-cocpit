'use client'

// Backend domain'inin "el kitabı bölümü" görünümü — spec'teki 12 bölüm.

import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  GitCommitHorizontal,
  ListChecks,
  Route,
  Table2,
  Workflow,
} from 'lucide-react'
import Link from 'next/link'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@nesy/metronic/components/ui/accordion'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@nesy/metronic/components/ui/table'
import {
  Callout,
  ComparisonTable,
  GuardrailCallout,
  PageSection,
  Timeline,
} from '@/components/product'
import {
  EndpointTable,
  FlowDiagram,
  Lineage,
  MetaBadgeRow,
} from '@/components/engineering/mobile-knowledge'
import { COUNTRY_LABELS, type BackendDomain, type Country } from '@/data/engineering/mobile-knowledge/types'

export function DomainView({ domain }: { domain: BackendDomain }) {
  const countries: Country[] = ['HR', 'BA', 'SI', 'RS']

  return (
    <div className="min-w-0 flex-1 space-y-8">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{domain.title}</h1>
          <p className="mt-1 text-muted-foreground">{domain.subtitle}</p>
        </div>
        <MetaBadgeRow meta={domain.meta} />
      </header>

      <PageSection id="purpose" eyebrow="1" title="Bu domain ne yapar?" tone={domain.tone}>
        <Callout icon={Workflow} tone={domain.tone}>
          {domain.purpose}
        </Callout>
      </PageSection>

      {!domain.documented ? (
        <Callout icon={AlertTriangle} tone="amber" title="Henüz belgelenmedi">
          Bu domain için detaylı el kitabı içeriği henüz yazılmadı. Yapı hazır; owner
          tarafından doldurulmayı bekliyor.
        </Callout>
      ) : (
        <>
          {domain.whenUsed.length > 0 && (
            <PageSection id="when" eyebrow="2" title="Mobil ne zaman kullanır?" icon={ListChecks} tone="teal">
              <ul className="grid gap-2 sm:grid-cols-2">
                {domain.whenUsed.map((w) => (
                  <li key={w} className="flex items-start gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    {w}
                  </li>
                ))}
              </ul>
            </PageSection>
          )}

          {domain.flow?.length ? (
            <PageSection id="flow" eyebrow="3" title="Temel akış" icon={Route} tone="blue">
              <FlowDiagram steps={domain.flow} />
            </PageSection>
          ) : null}

          {domain.endpoints?.length ? (
            <PageSection id="endpoints" eyebrow="4" title="Endpoint tablosu" icon={Table2} tone="indigo">
              <EndpointTable endpoints={domain.endpoints} />
            </PageSection>
          ) : null}

          {domain.callers?.length ? (
            <PageSection id="callers" eyebrow="5" title="Mobilde nereden çağrılır?" icon={GitCommitHorizontal} tone="teal">
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Feature</TableHead>
                      <TableHead>Class / Method</TableHead>
                      <TableHead>Ekran</TableHead>
                      <TableHead>Not</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {domain.callers.map((c) => (
                      <TableRow key={c.classMethod}>
                        <TableCell className="font-medium">{c.feature}</TableCell>
                        <TableCell className="font-mono text-xs">{c.classMethod}</TableCell>
                        <TableCell>{c.screen}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.note}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </PageSection>
          ) : null}

          {domain.lineage?.length ? (
            <PageSection id="lineage" eyebrow="6" title="State ve veri kaynakları" icon={Activity} tone="green">
              <Lineage nodes={domain.lineage} />
            </PageSection>
          ) : null}

          {domain.errors?.length ? (
            <PageSection id="errors" eyebrow="7" title="Hata davranışları" icon={AlertTriangle} tone="red">
              <Accordion type="single" collapsible className="rounded-xl border">
                {domain.errors.map((err) => (
                  <AccordionItem key={err.id} value={err.id}>
                    <AccordionTrigger className="px-4">{err.title}</AccordionTrigger>
                    <AccordionContent className="px-4">
                      <dl className="space-y-2">
                        {err.rows.map((r) => (
                          <div key={r.label} className="grid gap-1 sm:grid-cols-[180px_1fr]">
                            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {r.label}
                            </dt>
                            <dd className="text-sm">{r.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </PageSection>
          ) : null}

          {domain.countryDiffs?.length ? (
            <PageSection id="country" eyebrow="8" title="Country differences" tone="indigo">
              <ComparisonTable
                headers={[{ label: 'Davranış' }, ...countries.map((c) => ({ label: COUNTRY_LABELS[c] }))]}
                rows={domain.countryDiffs.map((row) => [
                  row.behaviour,
                  ...countries.map((c) => row.values[c] ?? '—'),
                ])}
              />
            </PageSection>
          ) : null}

          {domain.investigation?.length ? (
            <PageSection id="investigation" eyebrow="9" title="Investigation shortcuts" tone="gray">
              <div className="flex flex-wrap gap-2">
                {domain.investigation.map((s) =>
                  s.href ? (
                    <Link
                      key={s.label}
                      href={s.href}
                      className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm hover:bg-accent"
                    >
                      {s.label}
                      <ArrowUpRight className="size-3.5 text-muted-foreground" />
                    </Link>
                  ) : (
                    <span key={s.label} className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">
                      {s.label}
                    </span>
                  ),
                )}
              </div>
            </PageSection>
          ) : null}

          {domain.risks?.length ? (
            <PageSection id="risks" eyebrow="10" title="Known risks" tone="amber">
              <GuardrailCallout title="Bilinen riskler" icon={AlertTriangle}>
                <ul className="list-disc space-y-1 ps-4">
                  {domain.risks.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </GuardrailCallout>
            </PageSection>
          ) : null}

          {domain.changes?.length ? (
            <PageSection id="changes" eyebrow="11" title="Change history" tone="purple">
              <Timeline
                items={domain.changes.map((ch) => ({
                  period: ch.version,
                  title: ch.note,
                }))}
              />
            </PageSection>
          ) : null}
        </>
      )}
    </div>
  )
}

/** Sağ rail için domain bölüm anchor'ları. */
export function domainRailSections(domain: BackendDomain) {
  const s: { id: string; label: string }[] = [{ id: 'purpose', label: 'Bu domain ne yapar?' }]
  if (!domain.documented) return s
  if (domain.whenUsed.length) s.push({ id: 'when', label: 'Ne zaman kullanılır?' })
  if (domain.flow?.length) s.push({ id: 'flow', label: 'Temel akış' })
  if (domain.endpoints?.length) s.push({ id: 'endpoints', label: 'Endpoint tablosu' })
  if (domain.callers?.length) s.push({ id: 'callers', label: 'Mobil çağrılar' })
  if (domain.lineage?.length) s.push({ id: 'lineage', label: 'Veri kaynakları' })
  if (domain.errors?.length) s.push({ id: 'errors', label: 'Hata davranışları' })
  if (domain.countryDiffs?.length) s.push({ id: 'country', label: 'Country differences' })
  if (domain.investigation?.length) s.push({ id: 'investigation', label: 'Investigation' })
  if (domain.risks?.length) s.push({ id: 'risks', label: 'Known risks' })
  if (domain.changes?.length) s.push({ id: 'changes', label: 'Change history' })
  return s
}
