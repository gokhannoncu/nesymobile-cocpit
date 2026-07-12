'use client'

// Sağ kolon — Query / Query Breakdown / Expected Signals sekmeleri + Query Quality paneli.

import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ListOrdered,
  Save,
  SearchX,
  Share2,
  Sparkles,
  WrapText,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@nesy/metronic/components/ui/tabs'
import { toneCard, toneDot, toneText } from '@/components/product'
import { CodeBlock } from '@/components/engineering/tools/shared'
import {
  ANOMALY_EXAMPLES,
  EXPECTED_EVENT_SEQUENCE,
  GENERATED_QUERY,
  QUALITY_CHECKS,
  QUALITY_VERDICT_BROAD,
  QUALITY_VERDICT_STRONG,
  QUERY_BREAKDOWN,
} from '@/data/engineering/tools/graylog-generator'

function EmptyState() {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed bg-card p-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-muted">
        <SearchX className="size-6 text-muted-foreground" />
      </span>
      <p className="mt-4 text-sm font-bold text-foreground">Graylog sorgusu henüz oluşturulmadı</p>
      <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-muted-foreground">
        Bir shipment, courier, error code veya teknik davranış tanımlayarak başlayabilirsin.
      </p>
    </div>
  )
}

/** Ghost toolbar aksiyonları — mock, tıklama sonucu yok. */
function QueryToolbar() {
  const actions = [
    { label: 'Format', icon: WrapText },
    { label: 'Save', icon: Save },
    { label: 'Open in Graylog', icon: ArrowUpRight },
    { label: 'Share link', icon: Share2 },
  ]
  return (
    <>
      {actions.map((a) => (
        <Button key={a.label} size="sm" variant="ghost" className="h-7 px-2 text-xs">
          <a.icon className="size-3.5" />
          {a.label}
        </Button>
      ))}
    </>
  )
}

function QualityPanel({ strong }: { strong: boolean }) {
  const verdict = strong ? QUALITY_VERDICT_STRONG : QUALITY_VERDICT_BROAD
  const VerdictIcon = strong ? CheckCircle2 : AlertTriangle
  return (
    <section className="rounded-xl border bg-card p-4">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
        Query Quality
      </h3>
      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3">
        {QUALITY_CHECKS.map((c) => (
          <div key={c.label} className="rounded-lg border bg-muted/20 p-2.5">
            <div className="flex items-center gap-1.5">
              <span className={cn('size-1.5 rounded-full', toneDot[c.tone])} />
              <span className="text-[11px] font-bold text-foreground">{c.label}</span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{c.value}</p>
          </div>
        ))}
      </div>
      <div className={cn('mt-3 flex items-start gap-2.5 rounded-lg border p-3', toneCard[verdict.tone])}>
        <VerdictIcon className={cn('mt-0.5 size-4 shrink-0', toneText[verdict.tone])} />
        <div>
          <p className={cn('text-xs font-bold', toneText[verdict.tone])}>{verdict.label}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-foreground/80">{verdict.explanation}</p>
        </div>
      </div>
    </section>
  )
}

export function ResultPanel({
  generated,
  contextBar,
  strong,
}: {
  generated: boolean
  /** Ör. "Production · HR · Last 1 hour · 3 sources". */
  contextBar: string
  /** Identifier gücüne göre verdict — true: Strong, false: Broad. */
  strong: boolean
}) {
  if (!generated) return <EmptyState />

  return (
    <div className="space-y-4">
      <Tabs defaultValue="query">
        <TabsList variant="line" size="sm" className="w-full">
          <TabsTrigger value="query">Query</TabsTrigger>
          <TabsTrigger value="breakdown">Query Breakdown</TabsTrigger>
          <TabsTrigger value="signals">Expected Signals</TabsTrigger>
        </TabsList>

        <TabsContent value="query" className="mt-4 space-y-3">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <Sparkles className="size-3.5 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-semibold text-foreground/85">{contextBar}</span>
          </div>
          <CodeBlock
            code={GENERATED_QUERY}
            label="graylog"
            labelTone="orange"
            actions={<QueryToolbar />}
            summary="Search only · time range zorunlu · sensitive alanlar maskeli"
          />
        </TabsContent>

        <TabsContent value="breakdown" className="mt-4 space-y-2">
          {QUERY_BREAKDOWN.map((row) => (
            <div key={row.part} className="flex flex-col gap-1.5 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:gap-3">
              <code className={cn('shrink-0 rounded bg-muted/60 px-2 py-1 font-mono text-[11px] font-bold', toneText[row.tone])}>
                {row.part}
              </code>
              <p className="text-xs leading-relaxed text-foreground/80">{row.explanation}</p>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="signals" className="mt-4 space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2">
              <ListOrdered className="size-4 text-green-600 dark:text-green-400" />
              <h3 className="text-xs font-bold text-foreground">Beklenen event sırası</h3>
            </div>
            <ol className="mt-3 space-y-1.5">
              {EXPECTED_EVENT_SEQUENCE.map((e, i) => (
                <li key={e} className="flex items-center gap-2.5 text-xs">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-green-100 font-bold text-green-700 dark:bg-green-900/40 dark:text-green-300">
                    {i + 1}
                  </span>
                  <code className="font-semibold text-foreground">{e}</code>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Anomali örnekleri
            </h3>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ANOMALY_EXAMPLES.map((a) => (
                <div key={a.title} className="rounded-lg border bg-card p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="text-xs font-bold text-foreground">{a.title}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{a.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" appearance="outline" size="xs">
              Sinyaller shipment yaşam döngüsüne göre sıralanır
            </Badge>
          </div>
        </TabsContent>
      </Tabs>

      <QualityPanel strong={strong} />
    </div>
  )
}
