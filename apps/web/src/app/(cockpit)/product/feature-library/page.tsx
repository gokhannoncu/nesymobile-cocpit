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
  Table2,
  Truck,
  X,
} from 'lucide-react'
import { Input } from '@nesy/metronic/components/ui/input'
import { cn } from '@nesy/metronic/lib/utils'
import {
  BoardGrid,
  Callout,
  DataTable,
  HeroCallout,
  PageSection,
  ProductPage,
  TagBadge,
} from '@/components/product'
import { COUNTRIES, MODULES, TOTAL_FEATURES, isSupported } from '@/data/product/nesy'
import { toFeatureSlug } from '@/data/product/feature-slug'

const moduleIcons = [PackageCheck, PackageSearch, Route, Truck, Globe, Boxes] as const
const moduleTones = ['orange', 'amber', 'teal', 'blue', 'purple', 'indigo'] as const

export default function FeatureLibraryPage() {
  const activeCountries = COUNTRIES.filter((country) => country.id !== 'core')
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

  return (
    <ProductPage path="/product/feature-library">
      <HeroCallout
        icon={Grid3x3}
        eyebrow="Capabilities & Countries"
        tone="orange"
        title="Her ürün yeteneği tek bir envanterde yaşar."
        lead="Feature board, Nesy Mobile'ın tüm kabiliyetlerini modülleriyle birlikte tek yerde toplar. Ülke kapsamını karşılaştırın; karta tıklayarak akışı, API'leri, riskleri ve ticket'ları inceleyin."
        chips={[
          `${TOTAL_FEATURES} feature`,
          `${MODULES.length} modül`,
          `${activeCountries.length} ülke`,
          'Tek envanter',
        ]}
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

      <PageSection
        eyebrow="Yetenek Envanteri"
        title="Feature board — modüllere göre tüm kabiliyetler"
        icon={Grid3x3}
        tone="orange"
        description="Her sütun bir ürün modülünü, her kart ise kullanıcıya dokunan tek bir feature'ı temsil eder. Kart üzerindeki rozetler CORE durumunu ve ülke kapsamını özetler."
      >
        {visibleFeatureCount > 0 ? (
          <BoardGrid
            columns={filteredModules.map((module) => {
              const moduleIndex = MODULES.findIndex((item) => item.id === module.id)
              const tone = moduleTones[moduleIndex % moduleTones.length]!

              return {
                title: module.title,
                tone,
                icon: moduleIcons[moduleIndex % moduleIcons.length],
                cards: module.features.map((feature) => {
                  const supportedCountryCount = activeCountries.filter((country) =>
                    isSupported(feature.values[country.id]),
                  ).length
                  const detail = feature.detail
                  const highRisk = detail ? detail.score.bugProneness >= 4 : false
                  const ticketCount = detail?.tickets.length ?? 0

                  return {
                    title: feature.title,
                    desc: feature.desc,
                    icon: moduleIcons[moduleIndex % moduleIcons.length],
                    badges: [
                      {
                        label: isSupported(feature.values.core) ? 'CORE' : 'CORE yok',
                        tone: isSupported(feature.values.core) ? ('indigo' as const) : ('gray' as const),
                      },
                      {
                        label: `${supportedCountryCount}/${activeCountries.length} ülke`,
                        tone:
                          supportedCountryCount === activeCountries.length
                            ? ('teal' as const)
                            : supportedCountryCount > 0
                              ? ('amber' as const)
                              : ('gray' as const),
                      },
                      ...(highRisk
                        ? [{ label: `Risk ${detail!.score.bugProneness}/5`, tone: 'red' as const }]
                        : []),
                    ],
                    meta: ticketCount > 0 ? `${ticketCount} ticket · Detayı aç` : 'Detayı aç',
                    href: `/product/feature-library/${toFeatureSlug(feature.id)}`,
                  }
                }),
              }
            })}
          />
        ) : (
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
      </PageSection>

      <PageSection
        eyebrow="Kart Şeması"
        title="Bir feature kartı hangi alanları taşır?"
        icon={Table2}
        tone="blue"
        description="Feature kartı hızlı tarama için yalnızca karar verdiren sinyalleri gösterir; operasyonel detay karta tıklandığında açılır."
      >
        <DataTable
          columns={[
            { key: 'field', label: 'Alan', className: 'min-w-40' },
            { key: 'card', label: 'Kart Üzerinde', className: 'min-w-48' },
            { key: 'detail', label: 'Detay Görünümünde', className: 'min-w-56' },
            { key: 'purpose', label: 'Amaç', className: 'min-w-64' },
          ]}
          rows={[
            {
              field: <b>Feature kimliği</b>,
              card: 'Başlık, kısa açıklama, modül',
              detail: 'Nedir, nasıl çalışır, ekranlar',
              purpose: 'Feature’ın ne olduğunu ve ürün içindeki yerini tanımlar.',
            },
            {
              field: <b>Ülke kapsamı</b>,
              card: <TagBadge label={`${activeCountries.length} ülkeye kadar`} tone="amber" />,
              detail: 'CORE ve ülke bazlı davranışların tamamı',
              purpose: 'Global standart ile ülke özelleştirmelerini ayırır.',
            },
            {
              field: <b>Teknik bağlam</b>,
              card: 'Risk ve açık ticket sayısı',
              detail: 'API’ler, parametreler, uzmanlar ve test kapsamı',
              purpose: 'Değişikliğin maliyetini ve operasyonel riskini görünür kılar.',
            },
            {
              field: <b>Akış</b>,
              card: <TagBadge label="Detayı aç" tone="teal" />,
              detail: 'Adımlar, akış diyagramı ve uygulama ipuçları',
              purpose: 'Feature bilgisini dağınık dokümanlar yerine tek kayıtta tutar.',
            },
          ]}
        />
      </PageSection>

      <Callout icon={Grid3x3} title="Yeni feature eklerken" tone="orange">
        Feature önce CORE davranışıyla tanımlanır, sonra ülke farklılıkları matrise işlenir. Kaynak
        dosya: <code>src/data/product/nesy.ts</code> — kart ve matris sayfaları otomatik güncellenir.
        Detail verisi: <code>src/data/product/feature-details.ts</code>
      </Callout>

    </ProductPage>
  )
}
