'use client'

import {
  Activity,
  AlertTriangle,
  Bug,
  Cpu,
  Gauge,
  GitBranch,
  Layers,
  ListTodo,
  Radar,
  Route,
  ShieldCheck,
  Siren,
} from 'lucide-react'
import {
  Callout,
  CardGrid,
  HeroCallout,
  InfoCard,
  PageSection,
  ProductPage,
  StatCard,
  StatGrid,
} from '@/components/product'
import { EDGE_STATS } from '@/data/engineering/edge-cases'
import { INCIDENT_STATS } from '@/data/engineering/incidents'
import { PERF_REPORTS } from '@/data/engineering/performance'

export default function EngineeringOverviewPage() {
  const perfAboveTarget = PERF_REPORTS.filter((r) => !r.appStart.belowTarget).length

  return (
    <ProductPage path="/engineering/overview">
      <HeroCallout
        icon={Cpu}
        eyebrow="Engineering"
        tone="orange"
        title="Nesy Mobile mühendislik komuta merkezi."
        lead="Bu alan; incident müdahalesinden edge-case haritasına, mimari plandan ülke bazlı performans raporlarına kadar mühendislik operasyonunun tamamını tek yerde toplar. Her sayfa gerçek repo, ticket ve Firebase verisinden beslenir — eğitici (neden böyle?) ve takip edici (şu an ne durumda?) olacak şekilde yazılmıştır."
        chips={['515 Kotlin dosyası · ~68K LOC', '5 ülke · 11 flavor', 'Room v240 · 527 endpoint']}
      >
        <StatGrid cols={2}>
          <StatCard label="Açık Ticket" value={INCIDENT_STATS.openTickets} tone="orange" icon={Siren} hint={`${INCIDENT_STATS.totalTickets} ticket analiz edildi`} />
          <StatCard label="Edge Case" value={EDGE_STATS.total} tone="red" icon={Radar} hint={`${EDGE_STATS.critical} kritik`} />
        </StatGrid>
      </HeroCallout>

      <PageSection
        eyebrow="Sağlık Özeti"
        title="Bugünkü durum — tek bakış"
        icon={Activity}
        tone="orange"
        description="Kırmızı olan her kutu bu alandaki bir sayfaya açılır; sayı değil, gidilecek yer gösterir."
      >
        <StatGrid cols={4}>
          <StatCard label="Test Coverage" value="%0" tone="red" icon={Bug} hint="0 test dosyası · 140 bug-fix/6 ay" />
          <StatCard label="Bus Factor" value={1} tone="red" icon={GitBranch} hint="Commit'lerin %94'ü tek kişide" />
          <StatCard label="Perf Hedef Üstü" value={perfAboveTarget} suffix=" / 4 ülke" tone="amber" icon={Gauge} hint="App start > 2.0 s: BA, SI" />
          <StatCard label="Güvenlik Riski" value={4} tone="red" icon={ShieldCheck} hint="TLS, token, host, release config" />
        </StatGrid>
      </PageSection>

      <PageSection eyebrow="Bu Alan" title="Engineering haritası" icon={Layers} tone="amber">
        <CardGrid cols={3}>
          <InfoCard
            icon={Siren}
            tone="red"
            eyebrow="Reliability"
            title="Incident Command Center"
            desc="Detect → Declare → Contain → Diagnose → Recover → Learn: incident doğrulama, severity, roller, containment ve grup playbook'ları."
            href="/engineering/incident-playbook"
          />
          <InfoCard
            icon={Radar}
            tone="orange"
            eyebrow="Reliability"
            title="Edge Case Map"
            desc="E1–E33: tetikleyici → etki → hafifletme. 9 kategoride bilinen tüm uç durumlar."
            href="/engineering/edge-case-map"
          />
          <InfoCard
            icon={Bug}
            tone="amber"
            eyebrow="Reliability"
            title="Crashlytics"
            desc="Ülke bazlı crash-free oranları ve crash raporlama altyapısının durumu."
            href="/engineering/crashlytics"
          />
          <InfoCard
            icon={Gauge}
            tone="teal"
            eyebrow="Reliability"
            title="Performance Reports"
            desc="Firebase Performance CW27 — HR, BA, SI, RS için sunum formatında rapor."
            href="/engineering/performance"
          />
          <InfoCard
            icon={Layers}
            tone="blue"
            eyebrow="Architecture"
            title="Current Architecture"
            desc="6 katman haritası, god object'ler ve 'neden sürdürülebilir değil' analizi."
            href="/engineering/current-architecture"
          />
          <InfoCard
            icon={Route}
            tone="indigo"
            eyebrow="Architecture"
            title="Modernization Plan"
            desc="6 faz / ~12 ay yeni mimari planı + 6 aylık refactor alternatifi ve riskler."
            href="/engineering/modernization-plan"
          />
          <InfoCard
            icon={ListTodo}
            tone="purple"
            eyebrow="Architecture"
            title="Technical Debt"
            desc="10 anti-pattern, 9 kritik bug ve ekran sağlık skorları (46 ekran × 15 kategori)."
            href="/engineering/technical-debt"
          />
          <InfoCard
            icon={GitBranch}
            tone="green"
            eyebrow="Delivery"
            title="GitHub Pulse"
            desc="Commit amaç dağılımı, bus factor, CI pipeline'ları ve sürüm sayaçları."
            href="/engineering/github-pulse"
          />
          <InfoCard
            icon={ShieldCheck}
            tone="gray"
            eyebrow="Delivery"
            title="Security Posture"
            desc="TLS/pinning, token, host yönlendirme, release config — durum ve aksiyonlar."
            href="/engineering/security"
          />
        </CardGrid>
      </PageSection>

      <Callout icon={AlertTriangle} title="Bu alan nasıl okunur?" tone="orange">
        <b>Takip için:</b> Overview + Performance + GitHub Pulse haftalık ritimde güncellenir.{' '}
        <b>Eğitim için:</b> Edge Case Map ve Current Architecture, yeni gelen her mühendisin ilk
        haftasında okuması gereken iki sayfadır. <b>Kriz anında:</b> doğrudan Incident
        Playbook’a gidin — ilk 15 dakika protokolü oradadır.
      </Callout>
    </ProductPage>
  )
}
