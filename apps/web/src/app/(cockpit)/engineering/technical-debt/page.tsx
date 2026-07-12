'use client'

import { AlertTriangle, Bug, Gauge, Info, ListTodo, Microscope } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import {
  Callout,
  ComparisonTable,
  HeroCallout,
  PageSection,
  ProductPage,
  StatCard,
  StatGrid,
  toneCard,
} from '@/components/product'
import {
  ANTI_PATTERNS,
  CRITICAL_BUGS,
  HEALTH_SCORE_NOTE,
  SCREEN_HEALTH,
} from '@/data/engineering/architecture'

const sevBadge = { critical: 'Kritik', high: 'Yüksek', medium: 'Orta' } as const

export default function TechnicalDebtPage() {
  return (
    <ProductPage path="/engineering/technical-debt">
      <HeroCallout
        icon={ListTodo}
        eyebrow="Architecture & Modernization"
        tone="orange"
        title="Teknik borç: envanter, kanıt ve geri ödeme sırası."
        lead="Teknik borç burada söylenti değil envanterdir: 10 anti-pattern, satır numarasıyla 9 doğrulanmış kritik bug ve 46 ekranın 15 kategoride sağlık skorları. Geri ödeme sırası Modernization Plan fazlarına bağlıdır; refactor commit'leri son 6 ayda −69% düştüğü için bu envanter aktif olarak büyüyor."
        chips={['10 anti-pattern', '9 kritik bug', '46 ekran skorlandı', 'Refactor trendi: −69%']}
      >
        <StatGrid cols={2}>
          <StatCard label="Refactor Commit" value="4" tone="red" icon={Gauge} hint="Önceki 6 ay: 13 (−69%) — borç ödemesi durdu" />
          <StatCard label="Net Kod Büyümesi" value="+109K" tone="orange" icon={AlertTriangle} hint="6 ayda +33% — silme azalıyor" />
        </StatGrid>
      </HeroCallout>

      <PageSection
        eyebrow="Desenler"
        title="10 anti-pattern"
        icon={AlertTriangle}
        tone="red"
        description="Tekil hatalar değil, sistematik desenler — her biri birden çok ekranı etkiler."
      >
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {ANTI_PATTERNS.map((a) => (
            <div
              key={a.title}
              className={cn(
                'rounded-xl border p-4',
                toneCard[a.severity === 'critical' ? 'red' : a.severity === 'high' ? 'orange' : 'amber'],
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-foreground">{a.title}</div>
                <Badge variant="secondary" appearance="outline" size="xs">{sevBadge[a.severity]}</Badge>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-foreground/85">{a.detail}</p>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection
        eyebrow="Doğrulanmış"
        title="Kritik bug listesi — satır numarasıyla"
        icon={Bug}
        tone="red"
        description="Kod incelemesinde doğrulanmış, davranışı bilinen buglar. Faz 0'ın (Acil Müdahale) doğrudan girdisidir."
      >
        <ComparisonTable
          headers={[{ label: '#' }, { label: 'Konum' }, { label: 'Bulgu' }, { label: 'Önem', tone: 'red' }]}
          rows={CRITICAL_BUGS.map((b) => [
            b.id,
            <code key="w" className="text-xs">{b.where}</code>,
            <span key="x" className="text-xs">{b.what}</span>,
            sevBadge[b.severity],
          ])}
        />
      </PageSection>

      <PageSection
        eyebrow="Ekran Sağlığı"
        title="En riskli ekranlar (sağlık skoru 10 üzerinden)"
        icon={Microscope}
        tone="orange"
        description={HEALTH_SCORE_NOTE}
      >
        <ComparisonTable
          headers={[
            { label: 'Ekran' },
            { label: 'Satır', tone: 'orange' },
            { label: 'Skor', tone: 'red' },
            { label: 'Öne çıkan bulgu' },
          ]}
          rows={SCREEN_HEALTH.map((s) => [
            <code key="n" className="text-xs font-semibold">{s.name}</code>,
            <span key="l" className="tabular-nums">{s.lines.toLocaleString('tr-TR')}</span>,
            <span key="s" className={cn('font-bold tabular-nums', s.score < 2.5 ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400')}>
              {s.score.toFixed(1)}
            </span>,
            <span key="f" className="text-xs">{s.finding}</span>,
          ])}
        />
      </PageSection>

      <Callout icon={Info} title="Borç nasıl kapanır?" tone="orange">
        Bu envanterdeki her madde Modernization Plan’da bir faza eşlenir: kritik buglar + güvenlik →{' '}
        <b>Faz 0</b>; sıfır test → <b>Faz 1</b>; duplication + ülke dallanması → <b>Faz 2</b>; god
        object’ler → <b>Faz 3</b>; deprecated API + polling → <b>Faz 4</b>; UI borcu → <b>Faz 5</b>.
        Envantere eklenen her yeni madde bir faza bağlanmadan "kabul edilmiş" sayılmaz.
      </Callout>
    </ProductPage>
  )
}
