'use client'

import { useMemo, useState } from 'react'
import {
  Boxes,
  Globe,
  Grid3x3,
  PackageCheck,
  PackageSearch,
  Route,
  Search,
  Truck,
  X,
} from 'lucide-react'
import { Input } from '@nesy/metronic/components/ui/input'
import { cn } from '@nesy/metronic/lib/utils'
import {
  Callout,
  CardGrid,
  FeatureDetailDialog,
  FeatureLibraryCard,
  HeroCallout,
  PageSection,
  ProductPage,
} from '@/components/product'
import { MODULES, TOTAL_FEATURES } from '@/data/product/nesy'
import type { Feature, Module } from '@/data/product/nesy'

const moduleIcons = [PackageCheck, PackageSearch, Route, Truck, Globe, Boxes] as const
const moduleTones = ['orange', 'amber', 'teal', 'blue', 'purple', 'indigo'] as const

export default function FeatureLibraryPage() {
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null)
  const [selectedModule, setSelectedModule] = useState<{ title: string; id: string } | undefined>()
  const [selectedTone, setSelectedTone] = useState<(typeof moduleTones)[number]>('orange')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeModule, setActiveModule] = useState('all')

  const filteredModules = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR')

    return MODULES.map((module) => ({
      ...module,
      features: module.features.filter((feature) => {
        const matchesModule = activeModule === 'all' || module.id === activeModule
        const matchesQuery =
          normalizedQuery.length === 0 ||
          `${feature.title} ${feature.desc}`.toLocaleLowerCase('tr-TR').includes(normalizedQuery)

        return matchesModule && matchesQuery
      }),
    })).filter((module) => module.features.length > 0)
  }, [activeModule, query])

  const visibleFeatureCount = filteredModules.reduce(
    (total, module) => total + module.features.length,
    0,
  )

  const handleCardClick = (feature: Feature, module: Module, toneIdx: number) => {
    setSelectedFeature(feature)
    setSelectedModule({ title: module.title, id: module.id })
    setSelectedTone(moduleTones[toneIdx % moduleTones.length]!)
    setDialogOpen(true)
  }

  return (
    <ProductPage path="/product/feature-library">
      <HeroCallout
        icon={Grid3x3}
        eyebrow="Capabilities & Countries"
        tone="orange"
        title="Nesy Mobile'ın tüm yetenekleri, modül modül."
        lead="Feature'ları arayın, modüle göre daraltın ve ülke kapsamını tek bakışta karşılaştırın. Bir feature'a tıklayarak akışını, API'lerini ve ticket'larını inceleyebilirsiniz."
        chips={[`${TOTAL_FEATURES} feature`, `${MODULES.length} modül`]}
      />

      <section aria-label="Feature filtreleri" className="rounded-2xl border bg-card p-3 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 xl:w-80 xl:shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Feature ara..."
              aria-label="Feature ara"
              className="h-10 bg-background pl-9 pr-9"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Aramayı temizle"
                className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1 xl:pb-0" role="group" aria-label="Modül filtresi">
            <button
              type="button"
              onClick={() => setActiveModule('all')}
              aria-pressed={activeModule === 'all'}
              className={cn(
                'shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
                activeModule === 'all'
                  ? 'border-orange-500 bg-orange-500 text-white'
                  : 'border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground',
              )}
            >
              Tümü · {TOTAL_FEATURES}
            </button>
            {MODULES.map((module) => (
              <button
                key={module.id}
                type="button"
                onClick={() => setActiveModule(module.id)}
                aria-pressed={activeModule === module.id}
                className={cn(
                  'shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
                  activeModule === module.id
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground',
                )}
              >
                {module.title} · {module.features.length}
              </button>
            ))}
          </div>

          <div className="hidden shrink-0 text-xs font-medium text-muted-foreground xl:block">
            {visibleFeatureCount} sonuç
          </div>
        </div>
      </section>

      {filteredModules.map((m) => {
        const mi = MODULES.findIndex((module) => module.id === m.id)
        return (
          <PageSection
            key={m.id}
            id={m.id}
            eyebrow={`Modül ${mi + 1} · ${m.features.length} feature`}
            title={m.title}
            description={m.desc}
            icon={moduleIcons[mi % moduleIcons.length]}
            tone={moduleTones[mi % moduleTones.length]}
          >
            <CardGrid cols={2} className="gap-4">
              {m.features.map((feature) => (
                <FeatureLibraryCard
                  key={feature.id}
                  feature={feature}
                  icon={moduleIcons[mi % moduleIcons.length]!}
                  index={MODULES[mi]!.features.findIndex((item) => item.id === feature.id) + 1}
                  tone={moduleTones[mi % moduleTones.length]!}
                  onClick={() => handleCardClick(feature, m, mi)}
                />
              ))}
            </CardGrid>
          </PageSection>
        )
      })}

      {visibleFeatureCount === 0 && (
        <div className="rounded-2xl border border-dashed bg-muted/20 px-6 py-14 text-center">
          <Search className="mx-auto size-8 text-muted-foreground/50" />
          <h2 className="mt-3 text-sm font-bold text-foreground">Eşleşen feature bulunamadı</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Arama ifadesini değiştirin veya farklı bir modül seçin.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setActiveModule('all')
            }}
            className="mt-4 rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background"
          >
            Filtreleri temizle
          </button>
        </div>
      )}

      <Callout icon={Grid3x3} title="Yeni feature eklerken" tone="orange">
        Feature önce CORE davranışıyla tanımlanır, sonra ülke farklılıkları matrise işlenir. Kaynak
        dosya: <code>src/data/product/nesy.ts</code> — kart ve matris sayfaları otomatik güncellenir.
        Detail verisi: <code>src/data/product/feature-details.ts</code>
      </Callout>

      {/* Feature Detay Dialog */}
      <FeatureDetailDialog
        feature={selectedFeature}
        module={selectedModule}
        tone={selectedTone}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </ProductPage>
  )
}
