'use client'

import {
  AlertTriangle,
  ArrowRight,
  Braces,
  ChevronRight,
  Database,
  FileJson,
  HardDrive,
  MemoryStick,
  RefreshCw,
  Settings2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'

const JSON_CYCLE = [
  { label: 'read', desc: 'Room chunk okuma' },
  { label: 'parse', desc: 'JSON deserialize' },
  { label: 'modify in memory', desc: 'Bellekte değiştir' },
  { label: 're-serialize', desc: 'JSON serialize' },
  { label: 'write', desc: 'Chunk yazma' },
] as const

const TRUTH_SOURCES = [
  {
    icon: Database,
    title: 'Room chunks',
    subtitle: 'local DB',
    fields: ['ScheduleStopChunk.stopJson', 'RequestDao', 'ParcelDao'],
    tone: 'border-blue-200 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/25',
    iconTone: 'text-blue-600 dark:text-blue-400',
  },
  {
    icon: MemoryStick,
    title: 'SharedViewModel',
    subtitle: 'memory state',
    fields: ['currentTask', 'paidShipments', 'scheduleSession'],
    tone: 'border-orange-200 bg-orange-50/60 dark:border-orange-900/50 dark:bg-orange-950/25',
    iconTone: 'text-orange-600 dark:text-orange-400',
  },
  {
    icon: Settings2,
    title: 'SharedPreferences',
    subtitle: 'key-value cache',
    fields: ['scheduleId', 'isOfflineMode', 'lastSyncAt'],
    tone: 'border-purple-200 bg-purple-50/60 dark:border-purple-900/50 dark:bg-purple-950/25',
    iconTone: 'text-purple-600 dark:text-purple-400',
  },
] as const

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3.5 sm:px-5">
        <h3 className="text-sm font-bold text-foreground sm:text-base">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}

function ComponentBox({
  icon: Icon,
  label,
  sub,
  className,
}: {
  icon: LucideIcon
  label: string
  sub?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex min-w-[120px] flex-col items-center rounded-lg border border-border bg-background px-3 py-2.5 text-center shadow-sm',
        className,
      )}
    >
      <Icon className="size-4 text-muted-foreground" aria-hidden />
      <div className="mt-1.5 font-mono text-[11px] font-semibold leading-tight text-foreground">{label}</div>
      {sub ? <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div> : null}
    </div>
  )
}

function RiskChip({ children, tone = 'red' }: { children: React.ReactNode; tone?: 'red' | 'amber' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold leading-tight',
        tone === 'red'
          ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300'
          : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
      )}
    >
      <AlertTriangle className="size-3 shrink-0" aria-hidden />
      {children}
    </span>
  )
}

function FlowArrow() {
  return <ChevronRight className="size-4 shrink-0 text-muted-foreground/70" aria-hidden />
}

export function ArchitectureDataLayer() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel
        title="Room = JSON chunk store"
        subtitle="Schedule verisi relational model yerine JSON blob olarak persist ediliyor"
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <div className="rounded-lg border border-dashed border-muted-foreground/25 bg-muted/20 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Beklenen
            </div>
            <ComponentBox
              icon={Database}
              label="Relational model"
              sub="StopEntity · row update"
              className="mt-2 w-full"
            />
            <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
              <li>• index / query / transaction</li>
              <li>• row-based update</li>
            </ul>
          </div>

          <div className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
            <span className="hidden lg:inline">≠</span>
            <ArrowRight className="size-4 rotate-90 lg:rotate-0" aria-hidden />
          </div>

          <div className="rounded-lg border border-red-200/80 bg-red-50/40 p-3 dark:border-red-900/40 dark:bg-red-950/15">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-red-700 dark:text-red-400">
              Mevcut
            </div>
            <ComponentBox
              icon={FileJson}
              label="ScheduleStopChunk.stopJson"
              sub="JSON blob in Room"
              className="mt-2 w-full border-red-200 dark:border-red-900/50"
            />
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-muted/15 p-3.5">
          <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Güncelleme döngüsü
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {JSON_CYCLE.map((step, index) => (
              <span key={step.label} className="inline-flex items-center gap-1.5">
                {index > 0 ? <FlowArrow /> : null}
                <span className="rounded-md border border-border bg-background px-2 py-1.5 text-center">
                  <span className="block font-mono text-[10px] font-bold text-foreground">{step.label}</span>
                  <span className="mt-0.5 block text-[9px] text-muted-foreground">{step.desc}</span>
                </span>
              </span>
            ))}
            <FlowArrow />
            <RefreshCw className="size-4 text-red-500" aria-hidden />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <RiskChip>row-based update yok</RiskChip>
          <RiskChip>offline kırılgan</RiskChip>
          <RiskChip tone="amber">fallbackToDestructiveMigration() · E3</RiskChip>
        </div>
      </Panel>

      <Panel
        title="Single source of truth yok"
        subtitle="Aynı operasyonel gerçek üç bağımsız store'da tutuluyor"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {TRUTH_SOURCES.map((source) => {
            const Icon = source.icon
            return (
              <div key={source.title} className={cn('rounded-lg border p-3', source.tone)}>
                <div className="flex items-center gap-2">
                  <Icon className={cn('size-4 shrink-0', source.iconTone)} aria-hidden />
                  <div>
                    <div className="text-xs font-bold text-foreground">{source.title}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{source.subtitle}</div>
                  </div>
                </div>
                <div className="mt-2.5 space-y-1">
                  {source.fields.map((field) => (
                    <div
                      key={field}
                      className="rounded border border-border/70 bg-background/80 px-2 py-1 font-mono text-[10px] text-foreground/85"
                    >
                      {field}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="relative mt-4 flex flex-col items-center">
          <div className="grid w-full max-w-md grid-cols-3 gap-2" aria-hidden>
            <div className="flex justify-center">
              <span className="h-6 w-px bg-border" />
            </div>
            <div className="flex justify-center">
              <span className="h-6 w-px bg-border" />
            </div>
            <div className="flex justify-center">
              <span className="h-6 w-px bg-border" />
            </div>
          </div>
          <div className="flex w-full max-w-md items-center justify-center">
            <div className="h-px flex-1 bg-border" />
            <div className="mx-2 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 px-4 py-2.5 text-center dark:border-amber-800 dark:bg-amber-950/30">
              <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-700 dark:text-amber-400">
                Çakışan gerçek
              </div>
              <div className="mt-0.5 text-xs font-medium text-foreground">
                &quot;Doğru değer hangisi?&quot;
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">çağrı sırasına bağımlı</div>
            </div>
            <div className="h-px flex-1 bg-border" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/15 px-3 py-2.5">
          <HardDrive className="size-4 text-muted-foreground" aria-hidden />
          <span className="text-xs text-muted-foreground">Edge case sonuçları:</span>
          {(['E5', 'E6', 'E7'] as const).map((code) => (
            <span
              key={code}
              className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 font-mono text-[10px] font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
            >
              {code}
            </span>
          ))}
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2.5 dark:border-amber-900/40 dark:bg-amber-950/15">
          <Braces className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <p className="text-xs leading-relaxed text-foreground/85">
            UI, SharedViewModel ve Room aynı anda farklı snapshot taşıyabilir; senkronizasyon manuel
            refresh ve çağrı sırasına bağlı kalır.
          </p>
        </div>
      </Panel>
    </div>
  )
}
