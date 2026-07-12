'use client'

import { AlertTriangle, Flag, GitCompareArrows, Route, Target, Users } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import {
  Callout,
  HeroCallout,
  PageSection,
  ProductPage,
  StatCard,
  StatGrid,
  Timeline,
  toneCard,
  toneText,
  type Tone,
} from '@/components/product'
import {
  NEW_ARCH_PHASES,
  PLAN_RISKS,
  PLAN_SUMMARY,
  REFACTOR_ALTERNATIVE,
} from '@/data/engineering/modernization'

const priorityTone: Record<string, Tone> = {
  critical: 'red',
  high: 'orange',
  medium: 'amber',
  low: 'gray',
}

export default function ModernizationPlanPage() {
  return (
    <ProductPage path="/engineering/modernization-plan">
      <HeroCallout
        icon={Route}
        eyebrow="Architecture & Modernization"
        tone="orange"
        title="Yeni mimari planı: 6 faz, ~12 ay."
        lead="Hedef: Compose+MVI, Domain UseCase katmanı, normalize Room (tek gerçek kaynak) ve Outbox/WorkManager senkronizasyonu. Plan operasyonu koruyarak ilerler — her faz ölçülebilir çıkış kriteriyle biter ve kritik yol Faz 0→1→2→3'tür."
        chips={[PLAN_SUMMARY.totalDuration, PLAN_SUMMARY.team, 'Kritik yol: Faz 0→1→2→3']}
      >
        <StatGrid cols={2}>
          <StatCard label="Faz" value={NEW_ARCH_PHASES.length} tone="orange" icon={Flag} hint="Faz 4 ve 5 paralel koşabilir" />
          <StatCard label="Plan Riski" value={PLAN_RISKS.length} tone="red" icon={AlertTriangle} hint="2'si kritik: bus factor + testsiz bölme" />
        </StatGrid>
      </HeroCallout>

      <PageSection
        eyebrow="Fazlar"
        title="Yol haritası"
        icon={Route}
        tone="orange"
        description="Her fazın metrik tablosu çıkış kriteridir: hedef değere ulaşmadan sonraki faz başlamaz."
      >
        <Timeline
          items={NEW_ARCH_PHASES.map((p, i) => ({
            period: `Faz ${i} · ${p.duration} · ${p.team}`,
            title: p.name,
            tone: priorityTone[p.priority],
            status: p.status,
            bullets: p.objectives,
            badges: p.metrics.map((m) => `${m.label}: ${m.current} → ${m.target}`),
          }))}
        />
      </PageSection>

      <PageSection
        eyebrow="Riskler"
        title="Planı tehdit eden 6 risk"
        icon={AlertTriangle}
        tone="red"
        description="Riskler faz planına gömülüdür: her risk bir faz kuralına dönüştürülmüştür (ör. 'test olmadan bölme yok')."
      >
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {PLAN_RISKS.map((r) => (
            <div key={r.title} className={cn('rounded-xl border p-4', toneCard[r.severity === 'critical' ? 'red' : r.severity === 'high' ? 'orange' : 'amber'])}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-foreground">{r.title}</div>
                <Badge variant="secondary" appearance="outline" size="xs">
                  {r.severity === 'critical' ? 'Kritik' : r.severity === 'high' ? 'Yüksek' : 'Orta'}
                </Badge>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-foreground/85">{r.detail}</p>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection
        eyebrow="Alternatif"
        title={REFACTOR_ALTERNATIVE.name}
        icon={GitCompareArrows}
        tone="gray"
        description={REFACTOR_ALTERNATIVE.duration}
      >
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          <ul className="space-y-1.5">
            {REFACTOR_ALTERNATIVE.phases.map((p) => (
              <li key={p} className="flex items-start gap-2 rounded-lg border border-border bg-background p-2.5 text-xs text-foreground/85">
                <span className="mt-[6px] size-1 shrink-0 rounded-full bg-muted-foreground" />
                <span className="leading-relaxed">{p}</span>
              </li>
            ))}
          </ul>
          <div className={cn('rounded-xl border p-4', toneCard.amber)}>
            <div className={cn('text-xs font-bold uppercase tracking-wide', toneText.amber)}>Değerlendirme</div>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">{REFACTOR_ALTERNATIVE.verdict}</p>
          </div>
        </div>
      </PageSection>

      <Callout icon={Target} title="Anahtar karar" tone="red">
        {PLAN_SUMMARY.keyDecision} Testsiz decomposition, 68K satırlık üretim uygulamasında kontrolsüz
        regresyon demektir — bu kural pazarlık konusu değildir.
      </Callout>

      <Callout icon={Users} title="Bus factor önlemi" tone="orange">
        Commit’lerin %94’ü tek geliştiricide. Faz 0’dan itibaren her faz en az iki kişiyle yürütülür,
        kritik akışlar (ödeme, offline sync, scan) için mimari kayıt (ADR) yazılır ve bu cockpit
        güncel tutulur — bilgi kişide değil, sistemde birikir.
      </Callout>
    </ProductPage>
  )
}
