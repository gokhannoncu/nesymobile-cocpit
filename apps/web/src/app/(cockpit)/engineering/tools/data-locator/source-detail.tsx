'use client'

// Selected data source detail — used in the right panel and catalog drawer.

import { ReactNode } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowUpRight,
  CircleHelp,
  Database,
  Info,
  Link2,
  Table2,
  XCircle,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { toneCard, toneText, type Tone } from '@/components/product'
import { CodeBlock, CopyButton } from '@/components/engineering/tools/shared'
import {
  TRUTH_META,
  mongoGeneratorHref,
  type DataSource,
} from '@/data/engineering/tools/data-locator'

function DetailSection({
  icon: Icon,
  title,
  tone = 'gray',
  children,
}: {
  icon: typeof Info
  title: string
  tone?: Tone
  children: ReactNode
}) {
  return (
    <section>
      <div className="flex items-center gap-2">
        <Icon className={cn('size-4', toneText[tone])} />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
          {title}
        </h3>
      </div>
      <div className="mt-2">{children}</div>
    </section>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="w-36 shrink-0 font-semibold text-muted-foreground">{label}</span>
      <span className="min-w-0 text-foreground/85">{children}</span>
    </div>
  )
}

export function SourceDetailHeader({ source }: { source: DataSource }) {
  const truth = TRUTH_META[source.truth]
  return (
    <div>
      <div className="flex items-center gap-2">
        <Database className="size-4 text-orange-500" />
        <span className="font-mono text-base font-bold text-foreground">{source.name}</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {source.sourceType} · {source.system}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge
          variant="secondary"
          appearance="outline"
          size="sm"
          className={cn('font-semibold', toneText[truth.tone])}
        >
          Source of Truth: {truth.label}
        </Badge>
        {source.kind === 'mongo' && source.database && (
          <Badge variant="secondary" appearance="outline" size="sm">
            {source.database}
          </Badge>
        )}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{truth.hint}</p>
    </div>
  )
}

export function SourceDetailBody({
  source,
  sourceById,
  onSelectRelated,
}: {
  source: DataSource
  sourceById: Map<string, DataSource>
  onSelectRelated?: (id: string) => void
}) {
  const generatorHref = mongoGeneratorHref(source)

  return (
    <div className="space-y-6">
      <DetailSection icon={Info} title="Overview" tone="blue">
        <div className="space-y-2.5">
          <div className="rounded-lg border border-green-200 bg-green-50/60 p-2.5 text-xs leading-relaxed text-foreground/85 dark:border-green-900/60 dark:bg-green-950/30">
            <span className="font-bold text-green-700 dark:text-green-300">Used for: </span>
            {source.purpose}
          </div>
          <div className="flex items-start gap-1.5 rounded-lg border p-2.5 text-xs leading-relaxed text-foreground/80">
            <XCircle className="mt-px size-3.5 shrink-0 text-muted-foreground" />
            <span>
              <span className="font-bold">Not intended for: </span>
              {source.notFor}
            </span>
          </div>
          <div className="space-y-1.5 pt-1">
            <Fact label="Owner">{source.owner}</Fact>
            <Fact label="Environment">{source.environments.join(' · ')}</Fact>
            <Fact label="Retention">{source.retention}</Fact>
            <Fact label="Update frequency">{source.updateFrequency}</Fact>
            <Fact label="Freshness">{source.freshness}</Fact>
            <Fact label="Last schema update">{source.lastSchemaUpdate}</Fact>
          </div>
        </div>
      </DetailSection>

      <DetailSection icon={Table2} title="Key fields" tone="orange">
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full border-collapse text-xs">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-2.5 py-1.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
                  Field
                </th>
                <th className="px-2.5 py-1.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
                  Type
                </th>
                <th className="px-2.5 py-1.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
                  Meaning
                </th>
              </tr>
            </thead>
            <tbody>
              {source.keyFields.map((f) => (
                <tr key={f.name} className="border-b last:border-b-0">
                  <td className="px-2.5 py-1.5 font-mono font-semibold text-foreground">{f.name}</td>
                  <td className="px-2.5 py-1.5 text-muted-foreground">{f.type}</td>
                  <td className="px-2.5 py-1.5 text-foreground/80">{f.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DetailSection>

      <DetailSection icon={CircleHelp} title="Common questions" tone="teal">
        <ul className="space-y-1">
          {source.commonQuestions.map((q) => (
            <li key={q} className="flex items-start gap-1.5 text-xs leading-relaxed text-foreground/85">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-teal-500" />
              {q}
            </li>
          ))}
        </ul>
      </DetailSection>

      <DetailSection icon={Database} title="Example query" tone="green">
        <CodeBlock code={source.exampleQuery.code} label={source.exampleQuery.label} />
        <div className="mt-2.5 flex flex-wrap gap-2">
          {generatorHref && (
            <Button size="sm" variant="outline" asChild>
              <Link href={generatorHref}>
                Open in MongoDB Query Generator
                <ArrowUpRight className="size-3.5 opacity-60" />
              </Link>
            </Button>
          )}
          <CopyButton text={source.exampleQuery.code} label="Copy query" />
        </div>
      </DetailSection>

      <DetailSection icon={Link2} title="Related sources" tone="purple">
        <div className="flex flex-wrap gap-1.5">
          {source.relatedSources.map((id) => {
            const rel = sourceById.get(id)
            if (!rel) return null
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectRelated?.(id)}
                className="rounded-full border border-border bg-muted/40 px-2.5 py-1 font-mono text-[11px] font-medium text-foreground/80 transition-colors hover:border-blue-300 hover:bg-blue-50/70 hover:text-blue-700 dark:hover:border-blue-800 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
              >
                {rel.name}
              </button>
            )
          })}
        </div>
      </DetailSection>

      {source.caveats.length > 0 && (
        <DetailSection icon={AlertTriangle} title="Data caveats" tone="amber">
          <div className="space-y-1.5">
            {source.caveats.map((c) => (
              <div key={c} className={cn('rounded-lg border p-2.5 text-xs leading-relaxed', toneCard.amber)}>
                {c}
              </div>
            ))}
          </div>
        </DetailSection>
      )}
    </div>
  )
}
