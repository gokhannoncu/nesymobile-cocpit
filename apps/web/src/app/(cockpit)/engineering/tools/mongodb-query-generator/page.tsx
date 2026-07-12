'use client'

// MongoDB Query Generator — doğal dilden güvenli, read-only MongoDB sorgusu.
// Tüm etkileşim mock/simülasyon: "Query Oluştur" sağ paneli sonuç durumuna
// geçirir, guardrail'ler metin ve environment seçimine göre görünür.

import { useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  Clock,
  Database,
  DatabaseZap,
  Eraser,
  EyeOff,
  History,
  ListChecks,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Button } from '@nesy/metronic/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@nesy/metronic/components/ui/collapsible'
import { Label } from '@nesy/metronic/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nesy/metronic/components/ui/select'
import { Switch } from '@nesy/metronic/components/ui/switch'
import { Textarea } from '@nesy/metronic/components/ui/textarea'
import { PageSection, ProductPage } from '@/components/product'
import { ExampleChip, ToolCard, ToolHeader } from '@/components/engineering/tools/shared'
import {
  COLLECTIONS,
  COUNTRIES,
  DATABASES,
  ENVIRONMENTS,
  EXAMPLE_PROMPTS,
  PRODUCTION_NOTICE,
  QUERY_TYPES,
  SAFETY_TOGGLES,
  SCHEMA_ROWS,
  TIME_RANGES,
  WRITE_INTENT_NOTICE,
  hasWriteIntent,
  type RecentQuery,
} from '@/data/engineering/tools/mongodb-generator'
import { QueryWorkspace } from './workspace'
import { RecentQueriesTable } from './recent-queries'

const PATH = '/engineering/tools/mongodb-query-generator'

function AmberNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
      <AlertTriangle className="mt-px size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="text-xs font-medium leading-relaxed text-amber-800 dark:text-amber-300">
        {children}
      </p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}

export default function MongodbQueryGeneratorPage() {
  const [text, setText] = useState('')
  const [environment, setEnvironment] = useState('Development')
  const [database, setDatabase] = useState('nesy-delivery')
  const [collection, setCollection] = useState('deliveryRequests')
  const [queryType, setQueryType] = useState('Find')
  const [country, setCountry] = useState('HR')
  const [timeRange, setTimeRange] = useState('Son 24 saat')
  const [toggles, setToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(SAFETY_TOGGLES.map((t) => [t.id, true])),
  )
  const [schemaOpen, setSchemaOpen] = useState(false)
  const [generated, setGenerated] = useState(false)

  const writeIntent = hasWriteIntent(text)
  const isProduction = environment === 'Production'

  const resetForm = () => {
    setText('')
    setEnvironment('Development')
    setDatabase('nesy-delivery')
    setCollection('deliveryRequests')
    setQueryType('Find')
    setCountry('HR')
    setTimeRange('Son 24 saat')
    setToggles(Object.fromEntries(SAFETY_TOGGLES.map((t) => [t.id, true])))
    setGenerated(false)
  }

  const reuseQuery = (q: RecentQuery) => {
    setText(q.naturalLanguage)
    setEnvironment(q.environment)
    setCollection(q.collection)
    setQueryType(q.queryType)
    setGenerated(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <ProductPage path={PATH}>
      <ToolHeader
        path={PATH}
        icon={Database}
        title="MongoDB Query Generator"
        lead="Doğal dilde veri ihtiyacını tanımla, güvenli MongoDB sorgusunu oluştur ve sorgunun ne yaptığını adım adım doğrula."
        tone="orange"
        badges={[
          { label: 'Read-only by default', icon: ShieldCheck, tone: 'green' },
          { label: 'Production protected', icon: DatabaseZap, tone: 'amber' },
          { label: 'Query limit: 100', icon: ListChecks, tone: 'gray' },
          { label: 'Schema aware', icon: Sparkles, tone: 'gray' },
          { label: 'Last schema sync: 12 Jul 2026', icon: Clock, tone: 'gray' },
        ]}
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[42fr_58fr]">
        {/* ── Sol kolon: form ─────────────────────────────────── */}
        <ToolCard
          step="1"
          title="Veri ihtiyacını tanımla"
          description="Aradığın veriyi doğal dille yaz. Database ve collection bilgilerini biliyorsan ekleyebilirsin."
        >
          <div className="space-y-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Son 24 saatte HR ülkesinde başarısız olan ve henüz retry edilmemiş delivery request'lerini göster."
              className="min-h-[110px] text-sm"
            />
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_PROMPTS.map((p) => (
                <ExampleChip key={p.label} label={p.label} onClick={() => setText(p.text)} />
              ))}
            </div>
          </div>

          {writeIntent && <AmberNotice>{WRITE_INTENT_NOTICE}</AmberNotice>}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Environment">
              <Select value={environment} onValueChange={setEnvironment}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENVIRONMENTS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Database">
              <Select value={database} onValueChange={setDatabase}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATABASES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Collection">
              <Select value={collection} onValueChange={setCollection}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLLECTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Query type">
              <Select value={queryType} onValueChange={setQueryType}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUERY_TYPES.map((q) => (
                    <SelectItem key={q} value={q}>
                      {q}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Country">
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Time range">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_RANGES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {isProduction && <AmberNotice>{PRODUCTION_NOTICE}</AmberNotice>}

          <Collapsible open={schemaOpen} onOpenChange={setSchemaOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted/50">
              <span className="inline-flex items-center gap-1.5">
                <DatabaseZap className="size-3.5 text-muted-foreground" />
                Schema bilgisi ekle
              </span>
              <ChevronDown
                className={cn(
                  'size-3.5 text-muted-foreground transition-transform',
                  schemaOpen && 'rotate-180',
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-2">
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[440px] border-collapse text-xs">
                    <thead className="border-b bg-muted/40">
                      <tr>
                        {['Alan adı', 'Veri tipi', 'Açıklama', 'Örnek değer'].map((h) => (
                          <th
                            key={h}
                            className="px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {SCHEMA_ROWS.map((row) => (
                        <tr key={row.field} className="border-b last:border-b-0">
                          <td className="px-2.5 py-2 font-mono font-semibold text-foreground">
                            {row.field}
                          </td>
                          <td className="px-2.5 py-2 text-foreground/80">{row.type}</td>
                          <td className="px-2.5 py-2 text-muted-foreground">{row.description}</td>
                          <td className="px-2.5 py-2 font-mono text-foreground/80">{row.example}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button size="sm" variant="outline">
                  <RefreshCw className="size-3.5" />
                  Collection şemasını otomatik getir
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="space-y-2.5 rounded-lg border bg-muted/20 p-3">
            {SAFETY_TOGGLES.map((t) => {
              const icons: Record<string, typeof ListChecks> = {
                limit: ListChecks,
                mask: EyeOff,
                timeRange: CalendarClock,
                explain: Sparkles,
              }
              const Icon = icons[t.id] ?? ListChecks
              return (
                <div key={t.id} className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">{t.label}</p>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        {t.description}
                      </p>
                    </div>
                  </div>
                  <Switch
                    size="sm"
                    checked={toggles[t.id]}
                    onCheckedChange={(checked) =>
                      setToggles((prev) => ({ ...prev, [t.id]: checked }))
                    }
                  />
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <Button variant="primary" onClick={() => setGenerated(true)} disabled={!text.trim()}>
              <Sparkles className="size-4" />
              Query Oluştur
            </Button>
            <Button variant="outline" onClick={resetForm}>
              <Eraser className="size-4" />
              Formu temizle
            </Button>
          </div>
        </ToolCard>

        {/* ── Sağ kolon: workspace ────────────────────────────── */}
        <QueryWorkspace generated={generated} />
      </div>

      <PageSection
        eyebrow="Geçmiş"
        title="Recent Queries"
        icon={History}
        tone="orange"
        description="Takımın son doğrulanan sorguları — satıra tıklayınca istek, sorgu ve validasyon geçmişi açılır."
      >
        <RecentQueriesTable onReuse={reuseQuery} />
      </PageSection>
    </ProductPage>
  )
}
