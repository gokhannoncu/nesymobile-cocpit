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
} from '@/components/product'
import {
  COUNTRIES,
  MODULES,
  TOTAL_FEATURES,
  type Feature,
} from '@/data/product/nesy'

function ValueCell({ value }: { value: string }) {
  if (value === '—') {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground/60">
        <Minus className="size-3.5" /> Not yet available
      </span>
    )
  }
  if (value === 'N/A') {
    return (
      <span className="inline-flex items-center gap-1 text-red-600/80 dark:text-red-400/80">
        <X className="size-3.5" /> Out of scope
      </span>
    )
  }
  if (value === 'Same as Core' || value === 'Same as Core flow') {
    return (
      <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
        <Check className="size-3.5" /> Same as Core
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
        title="Feature × Country Matrix — single source of truth."
        lead="Every feature's country-specific behavior is maintained in this matrix. The CORE column represents the default behavior of the standard infrastructure; country columns describe only the differences."
        chips={[`${TOTAL_FEATURES} features`, `${MODULES.length} modules`, `${COUNTRIES.length - 1} countries + CORE`]}
      />

      {MODULES.map((m) => (
        <PageSection
          key={m.id}
          eyebrow="Module"
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
                            Popular
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

      <Callout icon={Info} title="Reading guide" tone="orange">
        <b>Same as Core</b> = the country uses CORE behavior without modification. <b>Out of scope (N/A)</b> ={' '}
        the feature is intentionally disabled in that country's package. <b>Not yet available (—)</b> = the country (e.g. Scale SK)
        is in the onboarding phase and behavior has not been defined yet.
      </Callout>
    </ProductPage>
  )
}
