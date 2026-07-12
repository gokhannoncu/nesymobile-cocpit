'use client'

// Data Locator — "Where does this data live?"
// İş sorusu → doğru kaynak → önemli alanlar → ilişkili kaynaklar → örnek sorgu.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Compass,
  Database,
  FilePlus2,
  GitBranch,
  Lightbulb,
  MapPin,
  Search,
  ShieldAlert,
  Sparkles,
  Table2,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@nesy/metronic/components/ui/accordion'
import { Checkbox } from '@nesy/metronic/components/ui/checkbox'
import { Textarea } from '@nesy/metronic/components/ui/textarea'
import {
  Callout,
  PageSection,
  ProductPage,
  toneCard,
  toneText,
} from '@/components/product'
import { ExampleChip, ToolHeader } from '@/components/engineering/tools/shared'
import {
  ALL_COUNTRIES,
  ALL_DOMAINS,
  ALL_ENVIRONMENTS,
  ALL_SOURCE_TYPES,
  GUARDRAILS,
  INVESTIGATION_RECIPES,
  LINEAGE_CHAINS,
  NO_RESULT,
  ROLE_META,
  SEARCH_INTENTS,
  SOURCE_BY_ID,
  TRUTH_META,
  resolveIntent,
  type SearchIntent,
} from '@/data/engineering/tools/data-locator'
import { DataCatalog } from './catalog'
import { SourceDetailBody, SourceDetailHeader } from './source-detail'

const HEADER_BADGES = [
  { label: 'MongoDB', icon: Database },
  { label: 'Room', icon: Database },
  { label: 'Graylog', icon: Search },
  { label: 'Backend API', icon: GitBranch },
  { label: 'Fiscal', icon: Table2 },
  { label: 'Mobile State', icon: MapPin },
  { label: 'Schema map synced', icon: Sparkles, tone: 'green' as const },
]

/** Sol filtre rail — mock checkbox filtreleri, accordion yapısında. */
function FilterRail() {
  const groups: { id: string; title: string; options: readonly string[] }[] = [
    { id: 'domain', title: 'Domain', options: ALL_DOMAINS },
    { id: 'source-type', title: 'Source type', options: ALL_SOURCE_TYPES },
    { id: 'environment', title: 'Environment', options: ALL_ENVIRONMENTS },
    { id: 'country', title: 'Country', options: ALL_COUNTRIES },
  ]
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="px-1 pb-1 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
        Business concepts
      </div>
      <Accordion type="multiple" defaultValue={['domain']}>
        {groups.map((g) => (
          <AccordionItem key={g.id} value={g.id}>
            <AccordionTrigger className="py-2.5 text-xs font-bold">{g.title}</AccordionTrigger>
            <AccordionContent className="pb-2.5">
              <div className="space-y-1.5">
                {g.options.map((o) => {
                  const key = `${g.id}:${o}`
                  return (
                    <label key={o} className="flex cursor-pointer items-center gap-2 text-xs text-foreground/80">
                      <Checkbox
                        size="sm"
                        checked={!!checked[key]}
                        onCheckedChange={(v) => setChecked((c) => ({ ...c, [key]: v === true }))}
                      />
                      {o}
                    </label>
                  )
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}

/** Yatay data lineage mini graph — node'lar tıklanabilir. */
function LineageGraph({ onSelect }: { onSelect: (sourceId: string) => void }) {
  const chain = LINEAGE_CHAINS[0]
  if (!chain) return null
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs font-bold text-foreground">{chain.title}</div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{chain.description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {chain.nodes.map((n, i) => (
          <span key={n.label} className="flex items-center gap-1.5">
            {i > 0 && <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/60" />}
            {n.sourceId ? (
              <button
                type="button"
                onClick={() => onSelect(n.sourceId!)}
                className="rounded-lg border border-orange-200 bg-orange-50/60 px-2.5 py-1.5 text-[11.5px] font-semibold text-orange-800 transition-colors hover:border-orange-300 hover:bg-orange-100/70 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300"
              >
                {n.label}
              </button>
            ) : (
              <span className="rounded-lg border bg-muted/40 px-2.5 py-1.5 text-[11.5px] font-medium text-foreground/70">
                {n.label}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function DataLocatorPage() {
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState(false)
  const [intent, setIntent] = useState<SearchIntent | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const chips = useMemo(() => SEARCH_INTENTS.filter((i) => i.chipLabel), [])
  const selected = selectedId ? (SOURCE_BY_ID.get(selectedId) ?? null) : null

  const runSearch = (text: string) => {
    const found = resolveIntent(text)
    setIntent(found)
    setSearched(true)
    setSelectedId(found?.results[0]?.sourceId ?? null)
  }

  const pickChip = (i: SearchIntent) => {
    const text = i.chipLabel ?? ''
    setQuery(text)
    setIntent(i)
    setSearched(true)
    setSelectedId(i.results[0]?.sourceId ?? null)
  }

  return (
    <ProductPage path="/engineering/tools/data-locator">
      <ToolHeader
        path="/engineering/tools/data-locator"
        icon={Compass}
        title="Data Locator"
        lead="Aradığın iş verisini doğal dille tanımla; doğru database, collection, tablo, log alanı ve ilişki yolunu bul."
        tone="orange"
        badges={HEADER_BADGES}
      />

      {/* Ana arama alanı */}
      <section className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-bold text-foreground">Hangi veriyi arıyorsun?</h2>
          <Badge variant="secondary" appearance="outline" size="xs" className="gap-1">
            <Sparkles className="size-3 text-orange-500" />
            Semantic search
          </Badge>
        </div>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Örneğin: Bir shipment'ın payment ve delivery durumlarını birlikte görmek istiyorum."
            className="min-h-[64px] flex-1 resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                runSearch(query)
              }
            }}
          />
          <Button variant="primary" className="shrink-0" onClick={() => runSearch(query)}>
            <Search className="size-4" />
            Veri Kaynağını Bul
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((i) => (
            <ExampleChip key={i.id} label={i.chipLabel!} onClick={() => pickChip(i)} />
          ))}
        </div>
      </section>

      {/* Sonuç alanı */}
      {!searched ? (
        <section className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-muted">
            <Compass className="size-6 text-muted-foreground" />
          </span>
          <div className="mt-4 text-sm font-bold text-foreground">Aradığın veri kavramını yaz</div>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
            Teknik tablo veya collection adını bilmek zorunda değilsin. İş sorusunu doğal dilde
            tanımlaman yeterli.
          </p>
        </section>
      ) : !intent ? (
        <section className="rounded-xl border bg-card p-6">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground">{NO_RESULT.title}</div>
              <ul className="mt-2 space-y-1">
                {NO_RESULT.suggestions.map((s) => (
                  <li key={s} className="flex items-start gap-1.5 text-xs leading-relaxed text-foreground/80">
                    <ChevronRight className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                    {s}
                  </li>
                ))}
              </ul>
              <Button variant="outline" size="sm" className="mt-4">
                <FilePlus2 className="size-3.5" />
                {NO_RESULT.ctaLabel}
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <>
          {/* Where should I look first? */}
          <Callout icon={Lightbulb} title="Where should I look first?" tone="orange">
            <div className="text-sm font-bold text-foreground">{intent.guidance.headline}</div>
            <p className="mt-1 text-xs leading-relaxed text-foreground/80">{intent.guidance.detail}</p>
          </Callout>

          {/* Üç kolon: filtre rail / sonuç kartları / detay paneli */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[220px_minmax(0,1fr)_430px]">
            <aside className="hidden xl:block">
              <FilterRail />
            </aside>

            <div className="min-w-0 space-y-3">
              {intent.results.map((r, i) => {
                const s = SOURCE_BY_ID.get(r.sourceId)
                if (!s) return null
                const role = ROLE_META[r.role]
                const truth = TRUTH_META[s.truth]
                const active = selectedId === s.id
                return (
                  <button
                    key={r.sourceId}
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={cn(
                      'w-full rounded-xl border bg-card p-4 text-left transition-colors',
                      active
                        ? 'border-blue-400 ring-1 ring-blue-400/40 dark:border-blue-700'
                        : 'hover:border-border hover:bg-muted/20',
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold tabular-nums text-muted-foreground">{i + 1}.</span>
                      <Badge variant="secondary" appearance="outline" size="xs" className={toneText[role.tone]}>
                        {role.label}
                      </Badge>
                      <Badge variant="secondary" appearance="outline" size="xs">
                        {s.sourceType}
                      </Badge>
                      <span className={cn('ms-auto text-[11px] font-bold', toneText[truth.tone])}>
                        {truth.label}
                      </span>
                    </div>
                    <div className="mt-2 font-mono text-sm font-bold text-foreground">{s.name}</div>
                    <p className="mt-1 text-xs leading-relaxed text-foreground/80">{s.purpose}</p>
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {s.keyFields.slice(0, 5).map((f) => (
                        <code key={f.name} className="rounded bg-muted/60 px-1.5 py-0.5 text-[10.5px] text-foreground/75">
                          {f.name}
                        </code>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>Freshness: {s.freshness}</span>
                      <span>Owner: {s.owner}</span>
                    </div>
                  </button>
                )
              })}

              <LineageGraph onSelect={(id) => setSelectedId(id)} />
            </div>

            <aside className="min-w-0">
              {selected && (
                <div className="rounded-xl border bg-card p-5 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
                  <SourceDetailHeader source={selected} />
                  <div className="mt-5 border-t pt-5">
                    <SourceDetailBody source={selected} onSelectRelated={(id) => setSelectedId(id)} />
                  </div>
                </div>
              )}
            </aside>
          </div>
        </>
      )}

      {/* Investigation recipes */}
      <PageSection
        eyebrow="Hazır tarifler"
        title="Common investigation recipes"
        icon={BookOpen}
        tone="orange"
        description="Sahada en sık karşılaşılan üç araştırma senaryosu — kontrol sırası ve ana identifier ile."
      >
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
          {INVESTIGATION_RECIPES.map((r) => (
            <div key={r.id} className="flex flex-col rounded-xl border bg-card p-4">
              <div className="text-sm font-bold text-foreground">{r.title}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{r.purpose}</p>
              <ol className="mt-3 flex-1 space-y-1.5">
                {r.checkOrder.map((step, i) => (
                  <li key={step} className="flex items-start gap-2 text-xs leading-relaxed text-foreground/85">
                    <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
              <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
                <code className="text-[10.5px] text-muted-foreground">{r.identifier}</code>
                <Button size="sm" variant="outline" asChild>
                  <Link href={r.cta.href}>
                    {r.cta.label}
                    <ArrowUpRight className="size-3.5 opacity-60" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </PageSection>

      {/* Data catalog */}
      <PageSection
        eyebrow="Katalog"
        title="All Data Sources"
        icon={Table2}
        tone="gray"
        description="Nesy ekosistemindeki tüm veri kaynakları — satıra tıklayınca detay açılır."
      >
        <div className="space-y-3">
          <DataCatalog />
        </div>
      </PageSection>

      {/* Guardrails */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {GUARDRAILS.map((g) => (
          <div key={g.title} className={cn('rounded-xl border p-4', toneCard[g.tone])}>
            <div className="flex items-center gap-2">
              <ShieldAlert className={cn('size-4', toneText[g.tone])} />
              <span className="text-xs font-bold text-foreground">{g.title}</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-foreground/80">{g.body}</p>
          </div>
        ))}
      </div>
    </ProductPage>
  )
}
