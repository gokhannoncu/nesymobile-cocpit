'use client'

import { ChevronRight } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { ComparisonTable } from '@/components/product'
import { LAYER_MAP } from '@/data/engineering/architecture'

const FLOW_LAYERS = ['Application', 'Presentation', 'Business', 'Data', 'Common', 'Remote & Peripheral'] as const

const RISK_LEVEL: Record<(typeof LAYER_MAP)[number]['tone'], { label: string; className: string }> = {
  blue: {
    label: 'Bilgi',
    className: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
  },
  green: {
    label: 'Orta',
    className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
  },
  teal: {
    label: 'Yüksek',
    className: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-300',
  },
  red: {
    label: 'Kritik',
    className: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300',
  },
  purple: {
    label: 'Orta',
    className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
  },
  gray: {
    label: 'Orta',
    className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
  },
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[88px]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  )
}

export function ArchitectureLayerMap() {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-muted/20 px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Mimari değerlendirme özeti
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">
              Nesy Mobile, tek Android module içinde altı mantıksal katman olarak modellenmiştir.
              Teorik bağımlılık yukarıdan aşağıya ilerler; fiziksel module sınırı olmadığı için
              katmanlar arası doğrudan erişim mümkündür.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-border/70 pt-4 lg:border-t-0 lg:border-l lg:pl-8 lg:pt-0">
            <Metric label="Katman" value="6" />
            <Metric label="Module" value="1" />
            <Metric label="Bağımlılık" value="Üst → Alt" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card px-4 py-3.5">
        <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Referans akış
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {FLOW_LAYERS.map((name, index) => (
            <span key={name} className="inline-flex items-center gap-1.5">
              {index > 0 ? <ChevronRight className="size-3.5 text-muted-foreground/60" aria-hidden /> : null}
              <span
                className={cn(
                  'rounded-md border border-border bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-foreground/85',
                  (name === 'Common' || name === 'Application') && 'border-dashed',
                )}
              >
                {name}
              </span>
            </span>
          ))}
        </div>
        <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
          Application ve Common cross-cutting katmanlardır; operasyon akışı Presentation → Business → Data → Remote &amp; Peripheral ekseninde ilerler.
        </p>
      </div>

      <ComparisonTable
        headers={[
          { label: 'Katman' },
          { label: 'Tanım' },
          { label: 'Sorumluluklar' },
          { label: 'Ana bileşenler' },
          { label: 'Değerlendirme', tone: 'red' },
        ]}
        rows={LAYER_MAP.map((layer, index) => {
          const risk = RISK_LEVEL[layer.tone]

          return [
            <div key="layer" className="min-w-[132px]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                L{index + 1}
              </div>
              <div className="mt-1 font-semibold text-foreground">{layer.name}</div>
            </div>,
            <p key="role" className="min-w-[180px] text-sm leading-relaxed text-foreground/85">
              {layer.role}
            </p>,
            <ul key="resp" className="min-w-[220px] space-y-1.5 text-sm leading-relaxed text-foreground/85">
              {layer.responsibilities.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>,
            <div key="components" className="min-w-[180px] space-y-1">
              {layer.components.map((component) => (
                <div
                  key={component}
                  className="font-mono text-[11px] leading-relaxed text-foreground/80"
                >
                  {component}
                </div>
              ))}
            </div>,
            <div key="issue" className="min-w-[200px] space-y-2">
              <span
                className={cn(
                  'inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]',
                  risk.className,
                )}
              >
                {risk.label}
              </span>
              <p className="text-sm leading-relaxed text-foreground/85">{layer.issue}</p>
            </div>,
          ]
        })}
      />
    </div>
  )
}
