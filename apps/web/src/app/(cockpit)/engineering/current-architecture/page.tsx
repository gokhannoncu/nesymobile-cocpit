'use client'

import { AlertTriangle, Database, Layers, Network, Route, Workflow } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import {
  Callout,
  ComparisonTable,
  HeroCallout,
  PageSection,
  ProductPage,
  StatCard,
  StatGrid,
  toneCard,
  toneText,
} from '@/components/product'
import { GOD_OBJECTS, INFRA_METRICS, LAYER_MAP } from '@/data/engineering/architecture'
import { ArchitectureDiagram } from '@/components/engineering/architecture-diagram'

export default function CurrentArchitecturePage() {
  return (
    <ProductPage path="/engineering/current-architecture">
      <HeroCallout
        icon={Layers}
        eyebrow="Architecture & Modernization"
        tone="orange"
        title="Current architecture: single module, everything sees everything."
        lead="Nesy Mobile is a single module Android application (Kotlin, single-activity + 53 fragments). Layers conceptually exist but no physical boundaries: business rules are scattered to fragment/adapter/dialog, data layer does manual state management over JSON chunks. This page answers 'why is it like this' and 'why is it unsustainable' with evidence."
        chips={['1 module', '~68K LOC', 'Room v240 · 11 tables', '527 endpoints / 1 interface']}
      />

      <PageSection
        eyebrow="With Evidence"
        title="Current status metrics"
        icon={Database}
        tone="orange"
        description="Every metric is directly fetched from the architecture health scan."
      >
        <StatGrid cols={4}>
          {INFRA_METRICS.map((m) => (
            <StatCard key={m.label} label={m.label} value={m.value} tone={m.tone} hint={m.hint} />
          ))}
        </StatGrid>
      </PageSection>

      <PageSection
        eyebrow="Architecture Flow"
        title="Current and target architecture"
        icon={Workflow}
        tone="orange"
        description="Synchronization pipeline from event source until backend response returns to UI. The moving point shows healthy, warning, and critical stops along the flow."
      >
        <ArchitectureDiagram />
      </PageSection>

      <PageSection
        eyebrow="Layer Map"
        title="Six layers — conceptually separate, physically single"
        icon={Network}
        tone="amber"
        description="Dependency direction is top-down; but since there are no module boundaries, every layer can access every layer."
      >
        <div className="space-y-2">
          {LAYER_MAP.map((l, i) => (
            <div key={l.name} className={cn('flex items-start gap-3 rounded-xl border p-3.5', toneCard[l.tone])}>
              <span className={cn('mt-0.5 text-[11px] font-bold uppercase tracking-wide', toneText[l.tone])}>
                Layer {i + 1}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-bold text-foreground">{l.name}</div>
                <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{l.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection
        eyebrow="Concentration"
        title="God objects — 41% of app logic in 14 files"
        icon={AlertTriangle}
        tone="red"
        description="14 of 533 Kotlin files have 1,000+ lines; as critical workflows accumulate in these files, the impact area and regression risk of each change grows."
      >
        <ComparisonTable
          headers={[{ label: 'File' }, { label: 'Lines', tone: 'red' }, { label: 'Issue' }]}
          rows={GOD_OBJECTS.map((g) => [
            <code key="n" className="text-xs font-semibold">{g.name}</code>,
            <span key="l" className="font-bold tabular-nums text-red-600 dark:text-red-400">{g.lines.toLocaleString('tr-TR')}</span>,
            <span key="d" className="text-xs">{g.note}</span>,
          ])}
        />
      </PageSection>

      <PageSection
        eyebrow="Data Layer"
        title="JSON chunk risk and state copies"
        icon={Database}
        tone="red"
      >
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          <div className={cn('rounded-xl border p-4', toneCard.red)}>
            <div className="text-sm font-bold text-foreground">Room = JSON chunk store</div>
            <p className="mt-2 text-xs leading-relaxed text-foreground/85">
              Schedule data is carried over JSON chunks instead of a relational model
              (ScheduleStopChunk.stopJson). Every update is a <b>read → parse → modify in memory →
              re-serialize → write</b> cycle: no row-based updates, index/query/transaction
              advantages cannot be used, offline scenarios become fragile. On top of that,
              fallbackToDestructiveMigration() is enabled — field data is deleted on migration failure (E3).
            </p>
          </div>
          <div className={cn('rounded-xl border p-4', toneCard.red)}>
            <div className="text-sm font-bold text-foreground">No single source of truth</div>
            <p className="mt-2 text-xs leading-relaxed text-foreground/85">
              The same operational truth can live in three places: <b>Room chunks</b> (local DB),{' '}
              <b>SharedViewModel memory state</b> (currentTask, paidShipments…) and{' '}
              <b>SharedPreferences</b> (scheduleId, isOfflineMode…). The question "Which is the correct value?"
              becomes dependent on the call order — E5/E6/E7 are direct results of this separation.
            </p>
          </div>
        </div>
      </PageSection>

      <PageSection
        eyebrow="Synchronization"
        title="Offline transmission: RequestSenderService"
        icon={Workflow}
        tone="amber"
        description="1,190-line foreground service; processes the queue with 3 sec polling. Relies on happy-path."
      >
        <ComparisonTable
          headers={[{ label: 'Dimension' }, { label: 'Current' }, { label: 'Result' }]}
          rows={[
            ['Polling', '3 sec main loop + 1 sec pending', 'All devices loaded synchronously; fragile with FGS/Doze constraints'],
            ['Retry', '3 attempts · no backoff/jitter', 'After tryCount<3, request is silently moved to CompletedRequest (E11)'],
            ['Idempotency', 'Only local uniqueKey', 'No dedup on server → double dispatch window (E9)'],
            ['Ordering', 'No aggregate-based ordering', 'Delivery can be processed before cancellation (E10)'],
            ['Recovery', 'isProcessing=true lock can be permanent', 'Zombie requests clog the queue (E8)'],
            ['Error classification', '400/500/timeout handled the same', 'Diagnosis becomes harder, retry behavior becomes incorrect'],
          ]}
        />
      </PageSection>

      <Callout icon={Route} title="Where to from here?" tone="orange">
        Target architecture: <b>Compose+MVI · Domain UseCase · normalize Room (SSoT) · Outbox/WorkManager</b>{' '}
        (idempotencyKey + backoff + jitter). The phased transition plan and risks are on the{' '}
        <b>Modernization Plan</b> page; every red box on this page maps to a phase there.
      </Callout>
    </ProductPage>
  )
}
