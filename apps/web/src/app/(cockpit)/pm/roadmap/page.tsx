'use client'

import { useMemo } from 'react'
import { Map, AlertTriangle } from 'lucide-react'
import {
  ProductPage,
  HeroCallout,
  PageSection,
  ComparisonTable,
  Timeline,
  SegmentTabs,
  GuardrailCallout,
  DoesDontGrid,
} from '@/components/product'
import type { TimelineItem } from '@/components/product/timeline'
import type { SegmentTabItem } from '@/components/product/segment-tabs'
import { newArchPhases, refactorPhases, roadmapSummary } from '@/data/pm/roadmap'
import type { RoadmapPhase, RoadmapRiskLevel } from '@/data/pm/types'

// ═══ Helpers ════════════════════════════════════════════════════════════════

const riskTone: Record<RoadmapRiskLevel, 'red' | 'orange' | 'amber' | 'green'> = {
  critical: 'red',
  high: 'orange',
  medium: 'amber',
  low: 'green',
}

function phasesToTimeline(phases: RoadmapPhase[], isNewArch: boolean): TimelineItem[] {
  return phases.map((p) => ({
    period: p.months,
    title: `Faz ${p.phase}: ${p.title}`,
    desc: p.subtitle,
    tone: riskTone[p.riskLevel],
    status: isNewArch
      ? p.phase === 0
        ? 'done'
        : p.phase === 1
          ? 'active'
          : 'next'
      : p.phase === 1
        ? 'active'
        : 'next',
    bullets: p.objectives,
    badges: [
      p.duration,
      `${p.deliverables.length} deliverable`,
      `${p.riskLevel} risk`,
    ],
  }))
}

function phaseMetricsRows(phases: RoadmapPhase[]) {
  return phases.flatMap((p) =>
    p.metrics.map((m) => [
      <span key="faz" className="font-medium">{`Faz ${p.phase}`}</span>,
      m.label,
      m.current,
      m.target,
    ]),
  )
}

// ═══ Component ═══════════════════════════════════════════════════════════════

export default function RoadmapPage() {
  const newArchTimeline = useMemo(() => phasesToTimeline(newArchPhases, true), [])
  const refactorTimeline = useMemo(() => phasesToTimeline(refactorPhases, false), [])

  const newArchMetrics = useMemo(() => phaseMetricsRows(newArchPhases), [])
  const refactorMetrics = useMemo(() => phaseMetricsRows(refactorPhases), [])

  const comparisonRows = useMemo(
    () => [
      ['Süre', roadmapSummary.newArch.duration, roadmapSummary.refactor.duration],
      ['Ekip', roadmapSummary.newArch.teamSize, roadmapSummary.refactor.teamSize],
      ['Risk', roadmapSummary.newArch.risk, roadmapSummary.refactor.risk],
      [
        'Faz Sayısı',
        String(roadmapSummary.newArch.totalPhases),
        String(roadmapSummary.refactor.totalPhases),
      ],
      [
        'Hedef',
        'Temiz mimari, tam yeniden yazım',
        'Hızlı stabilizasyon, düşük maliyet',
      ],
      [
        'Avantaj',
        roadmapSummary.newArch.benefit,
        roadmapSummary.refactor.benefit,
      ],
      [
        'Dezavantaj',
        'Uzun süre, yüksek maliyet, büyük ekip gereksinimi',
        'Teknik borç tam temizlenmez, sınırlı iyileştirme',
      ],
    ],
    [],
  )

  const tabs: SegmentTabItem[] = useMemo(
    () => [
      {
        value: 'yeni-mimari',
        label: 'Yeni Mimariye Geçiş',
        content: (
          <div className="space-y-6">
            <Timeline items={newArchTimeline} />
            <PageSection title="Metrik Hedefleri">
              <ComparisonTable
                headers={[
                  { label: 'Faz', tone: 'purple' },
                  { label: 'Metrik', tone: 'blue' },
                  { label: 'Mevcut', tone: 'red' },
                  { label: 'Hedef', tone: 'green' },
                ]}
                rows={newArchMetrics}
              />
            </PageSection>
          </div>
        ),
      },
      {
        value: 'refactor',
        label: 'Mevcut App Refactor',
        content: (
          <div className="space-y-6">
            <Timeline items={refactorTimeline} />
            <PageSection title="Metrik Hedefleri">
              <ComparisonTable
                headers={[
                  { label: 'Faz', tone: 'purple' },
                  { label: 'Metrik', tone: 'blue' },
                  { label: 'Mevcut', tone: 'red' },
                  { label: 'Hedef', tone: 'green' },
                ]}
                rows={refactorMetrics}
              />
            </PageSection>
          </div>
        ),
      },
      {
        value: 'karsilastirma',
        label: 'Plan Karşılaştırma',
        content: (
          <div className="space-y-6">
            <ComparisonTable
              headers={[
                { label: 'Özellik', tone: 'gray' },
                { label: 'Yeni Mimari', tone: 'indigo' },
                { label: 'Mevcut Refactor', tone: 'teal' },
              ]}
              rows={comparisonRows}
              highlightCol={1}
            />
            <DoesDontGrid
              doesTitle="Yeni Mimari Avantajları"
              dontTitle="Yeni Mimari Riskleri"
              does={[
                'Temiz mimari — test edilebilirlik ve sürdürülebilirlik',
                'Compose UI ile modern, hızlı geliştirme',
                'Feature module sınırları ile paralel geliştirme',
                'Teknik borç tamamen temizlenir',
              ]}
              dont={[
                '12 ay süre — uzun delivery döngüsü',
                '3-4 kişilik ekip — yüksek maliyet',
                'Yeniden yazımda regression riski yüksek',
                'Mevcut özellikler geçiş süresince dondurulabilir',
              ]}
            />
          </div>
        ),
      },
    ],
    [newArchTimeline, refactorTimeline, newArchMetrics, refactorMetrics, comparisonRows],
  )

  return (
    <ProductPage path="/pm/roadmap" title="Yol Haritası">
      {/* 1 — Hero */}
      <HeroCallout
        icon={Map}
        eyebrow="Planning"
        tone="indigo"
        title="Yol Haritası"
        lead="NeSy Mobile mimari dönüşüm planları — iki alternatif yaklaşım."
        chips={['Yeni Mimari', 'Mevcut Refactor', '2 Plan Karşılaştırma']}
      />

      {/* 2 — Segment Tabs */}
      <SegmentTabs items={tabs} defaultValue="yeni-mimari" />

      {/* 3 — Guardrail */}
      <GuardrailCallout tone="amber" icon={AlertTriangle} title="Roadmap ≠ Sprint Planı">
        Roadmap stratejik yönlendirme aracıdır. Sprint bazlı iş dağılımı için
        Sprint Takvimi sayfasını kullanın. Roadmap değişiklikleri sadece
        Architecture Review toplantısında onaylanır.
      </GuardrailCallout>
    </ProductPage>
  )
}
