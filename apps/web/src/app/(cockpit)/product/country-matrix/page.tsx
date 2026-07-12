'use client'

import { Fragment } from 'react'
import { Check, Info, Minus, Table2, X } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import {
  Callout,
  HeroCallout,
  PageSection,
  ProductPage,
  StatCard,
  StatGrid,
} from '@/components/product'
import {
  COUNTRIES,
  MODULES,
  TOTAL_FEATURES,
  isSupported,
  supportedCount,
  type Feature,
} from '@/data/product/nesy'

function ValueCell({ value }: { value: string }) {
  if (value === '—') {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground/60">
        <Minus className="size-3.5" /> Henüz yok
      </span>
    )
  }
  if (value === 'N/A') {
    return (
      <span className="inline-flex items-center gap-1 text-red-600/80 dark:text-red-400/80">
        <X className="size-3.5" /> Kapsam dışı
      </span>
    )
  }
  if (value === 'Core ile aynı' || value === 'Core ile aynı akış') {
    return (
      <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
        <Check className="size-3.5" /> Core ile aynı
      </span>
    )
  }
  return <span className="whitespace-pre-line">{value}</span>
}

function FeatureRows({ feature }: { feature: Feature }) {
  return (
    <tr className="border-b border-border/60 last:border-0 align-top hover:bg-muted/30">
      <td className="sticky left-0 z-10 min-w-52 max-w-64 bg-background px-4 py-3">
        <div className="text-sm font-semibold text-foreground">{feature.title}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{feature.desc}</div>
      </td>
      {COUNTRIES.map((c) => (
        <td
          key={c.id}
          className={cn(
            'min-w-56 max-w-72 px-4 py-3 text-xs leading-relaxed text-foreground/85',
            c.id === 'core' && 'bg-primary/5 font-medium',
          )}
        >
          <ValueCell value={feature.values[c.id]} />
        </td>
      ))}
    </tr>
  )
}

export default function CountryMatrixPage() {
  return (
    <ProductPage path="/product/country-matrix">
      <HeroCallout
        icon={Table2}
        eyebrow="Capabilities & Countries"
        tone="orange"
        title="Feature × ülke matrisi — tek gerçek kaynak."
        lead="Nesy Mobile'ın her feature'ının ülke bazlı davranışı bu matriste tutulur. CORE sütunu standart altyapının varsayılan davranışıdır; ülke sütunları yalnızca farklılıkları anlatır."
        chips={[`${TOTAL_FEATURES} feature`, `${MODULES.length} modül`, `${COUNTRIES.length - 1} ülke + CORE`]}
      />

      <StatGrid cols={4}>
        {COUNTRIES.filter((c) => c.id !== 'core').map((c) => (
          <StatCard
            key={c.id}
            label={c.name}
            value={supportedCount(c.id)}
            suffix={` / ${TOTAL_FEATURES}`}
            tone={c.status === 'Gelişmiş' ? 'purple' : c.status === 'Aktif' ? 'green' : 'gray'}
            hint={c.subtitle}
          />
        ))}
      </StatGrid>

      {MODULES.map((m) => (
        <PageSection
          key={m.id}
          eyebrow="Modül"
          title={m.title}
          description={m.desc}
          icon={Table2}
          tone="orange"
        >
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="sticky left-0 z-10 min-w-52 bg-muted px-4 py-2.5 text-start text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Feature
                  </th>
                  {COUNTRIES.map((c) => (
                    <th
                      key={c.id}
                      className={cn(
                        'min-w-56 px-4 py-2.5 text-start whitespace-nowrap',
                        c.id === 'core' && 'bg-primary/5',
                      )}
                    >
                      <div className="text-xs font-bold uppercase tracking-wide text-foreground">
                        {c.name}
                        {c.isPopular && (
                          <Badge variant="secondary" appearance="outline" size="xs" className="ms-1.5">
                            Popüler
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] font-medium normal-case tracking-normal text-muted-foreground">
                        {c.subtitle} · {c.status}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {m.features.map((f) => (
                  <Fragment key={f.id}>
                    <FeatureRows feature={f} />
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </PageSection>
      ))}

      <Callout icon={Info} title="Okuma rehberi" tone="orange">
        <b>Core ile aynı</b> = ülke, CORE davranışını değiştirmeden kullanır. <b>Kapsam dışı (N/A)</b> ={' '}
        feature o ülke paketinde bilinçli olarak kapalıdır. <b>Henüz yok (—)</b> = ülke (ör. Scale SK)
        devreye alınma aşamasındadır ve davranış henüz tanımlanmamıştır.
      </Callout>
    </ProductPage>
  )
}
