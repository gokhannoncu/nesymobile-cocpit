'use client'

import { Database, Layers, Network, Route, Workflow } from 'lucide-react'
import {
  Callout,
  ComparisonTable,
  HeroCallout,
  PageSection,
  ProductPage,
} from '@/components/product'
import { ArchitectureDiagram } from '@/components/engineering/architecture-diagram'
import { ArchitectureDataLayer } from '@/components/engineering/architecture-data-layer'
import { ArchitectureLayerMap } from '@/components/engineering/architecture-layer-map'

export default function CurrentArchitecturePage() {
  return (
    <ProductPage path="/engineering/current-architecture">
      <HeroCallout
        icon={Layers}
        eyebrow="Mimari & Modernizasyon"
        tone="orange"
        title="Mevcut mimari: single module, her şey birbirini görüyor."
        lead="Nesy Mobile, single module bir Android application (Kotlin, single-activity + 53 fragments). Layers kavramsal olarak vardır ama fiziksel sınır yok: business rules fragment/adapter/dialog'a dağılmış, data layer JSON chunks üzerinde manual state management yapıyor. Bu sayfa 'neden böyle?' ve 'neden sürdürülemez?' sorularını kanıtlarla yanıtlıyor."
        chips={['1 module', '~68K LOC', 'Room v240 · 11 tables', '527 endpoints / 1 interface']}
      />

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
        eyebrow="Katman Haritası"
        title="Katman mimarisi referansı"
        icon={Network}
        tone="gray"
        description="Altı mantıksal katmanın sorumlulukları, temel bileşenleri ve mevcut mimari değerlendirmesi. Referans akış ideal bağımlılığı gösterir; fiziksel module yapısı ters yönlü erişime izin verir."
      >
        <ArchitectureLayerMap />
      </PageSection>

      <PageSection
        eyebrow="Data Layer"
        title="JSON chunk riski ve state kopyaları"
        icon={Database}
        tone="red"
      >
        <ArchitectureDataLayer />
      </PageSection>

      <PageSection
        eyebrow="Synchronization"
        title="Offline iletim: RequestSenderService"
        icon={Workflow}
        tone="amber"
        description="1.190 satırlık foreground service; queue'yu 3 sec polling ile işliyor. happy-path'e dayanıyor."
      >
        <ComparisonTable
          headers={[{ label: 'Boyut' }, { label: 'Mevcut' }, { label: 'Sonuç' }]}
          rows={[
            ['Polling', '3 sec main loop + 1 sec pending', 'Tüm cihazlar senkron yükleniyor; FGS/Doze kısıtlarında kırılgan'],
            ['Retry', '3 attempts · no backoff/jitter', 'tryCount<3 sonrası request sessizce CompletedRequest\'e taşınıyor (E11)'],
            ['Idempotency', 'Only local uniqueKey', 'Server\'da dedup yok → double dispatch penceresi (E9)'],
            ['Ordering', 'No aggregate-based ordering', 'Delivery, cancellation\'dan önce işlenebiliyor (E10)'],
            ['Recovery', 'isProcessing=true lock can be permanent', 'Zombie request\'ler queue\'yu tıkıyor (E8)'],
            ['Hata sınıflandırması', '400/500/timeout aynı ele alınıyor', 'Teşhis zorlaşıyor; retry behavior hatalı hale geliyor'],
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
