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
        title="Mevcut mimari: tek modül, her şey her şeyi görüyor."
        lead="Nesy Mobile tek modüllü bir Android uygulamasıdır (Kotlin, single-activity + 53 fragment). Katmanlar kavramsal olarak var ama fiziksel sınır yok: iş kuralları fragment/adapter/dialog'a dağılmış, veri katmanı JSON chunk'lar üzerinde manuel state yönetimi yapıyor. Bu sayfa 'neden böyle' ve 'neden sürdürülemez' sorularını kanıtla cevaplar."
        chips={['1 modül', '~68K LOC', 'Room v240 · 11 tablo', '527 endpoint / 1 interface']}
      />

      <PageSection
        eyebrow="Kanıtlarla"
        title="Mevcut durum metrikleri"
        icon={Database}
        tone="orange"
        description="Her metrik, mimari sağlık taramasından doğrudan alınmıştır."
      >
        <StatGrid cols={4}>
          {INFRA_METRICS.map((m) => (
            <StatCard key={m.label} label={m.label} value={m.value} tone={m.tone} hint={m.hint} />
          ))}
        </StatGrid>
      </PageSection>

      <PageSection
        eyebrow="Mimari Akış"
        title="Mevcut ve hedef mimari"
        icon={Workflow}
        tone="orange"
        description="Event kaynağından backend yanıtının UI'a dönüşüne kadar senkronizasyon hattı. Hareketli nokta, akış boyunca sağlıklı, dikkat ve kritik durakları gösterir."
      >
        <ArchitectureDiagram />
      </PageSection>

      <PageSection
        eyebrow="Katman Haritası"
        title="Altı katman — kavramsal olarak ayrı, fiziksel olarak tek"
        icon={Network}
        tone="amber"
        description="Bağımlılık yönü yukarıdan aşağıya; ancak modül sınırı olmadığı için her katman her katmana erişebiliyor."
      >
        <div className="space-y-2">
          {LAYER_MAP.map((l, i) => (
            <div key={l.name} className={cn('flex items-start gap-3 rounded-xl border p-3.5', toneCard[l.tone])}>
              <span className={cn('mt-0.5 text-[11px] font-bold uppercase tracking-wide', toneText[l.tone])}>
                Katman {i + 1}
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
        eyebrow="Yoğunlaşma"
        title="God object'ler — uygulama mantığının %41'i 14 dosyada"
        icon={AlertTriangle}
        tone="red"
        description="533 Kotlin dosyasının 14'ü 1.000+ satır; kritik iş akışları bu dosyalarda toplandıkça her değişikliğin etki alanı ve regresyon riski büyür."
      >
        <ComparisonTable
          headers={[{ label: 'Dosya' }, { label: 'Satır', tone: 'red' }, { label: 'Sorun' }]}
          rows={GOD_OBJECTS.map((g) => [
            <code key="n" className="text-xs font-semibold">{g.name}</code>,
            <span key="l" className="font-bold tabular-nums text-red-600 dark:text-red-400">{g.lines.toLocaleString('tr-TR')}</span>,
            <span key="d" className="text-xs">{g.note}</span>,
          ])}
        />
      </PageSection>

      <PageSection
        eyebrow="Veri Katmanı"
        title="JSON chunk riski ve state kopyaları"
        icon={Database}
        tone="red"
      >
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          <div className={cn('rounded-xl border p-4', toneCard.red)}>
            <div className="text-sm font-bold text-foreground">Room = JSON chunk deposu</div>
            <p className="mt-2 text-xs leading-relaxed text-foreground/85">
              Schedule verisi ilişkisel model yerine JSON chunk’lar üzerinde taşınıyor
              (ScheduleStopChunk.stopJson). Her güncelleme <b>oku → parse et → memory’de değiştir →
              yeniden serialize et → yaz</b> döngüsüdür: satır bazlı update yok, index/query/transaction
              avantajı kullanılamıyor, offline senaryolar kırılganlaşıyor. Üstüne
              fallbackToDestructiveMigration() açık — migration hatasında saha verisi silinir (E3).
            </p>
          </div>
          <div className={cn('rounded-xl border p-4', toneCard.red)}>
            <div className="text-sm font-bold text-foreground">Tek gerçek veri kaynağı yok</div>
            <p className="mt-2 text-xs leading-relaxed text-foreground/85">
              Aynı operasyonel gerçek üç yerde yaşayabiliyor: <b>Room chunk’ları</b> (lokal DB),{' '}
              <b>SharedViewModel memory state’i</b> (currentTask, paidShipments…) ve{' '}
              <b>SharedPreferences</b> (scheduleId, isOfflineMode…). "Doğru değer hangisi?" sorusu
              çağrı sırasına bağlı hale geliyor — E5/E6/E7 bu ayrışmanın doğrudan sonuçları.
            </p>
          </div>
        </div>
      </PageSection>

      <PageSection
        eyebrow="Senkronizasyon"
        title="Offline gönderim: RequestSenderService"
        icon={Workflow}
        tone="amber"
        description="1.190 satırlık foreground service; 3 sn polling ile kuyruğu işler. Happy-path'e bağlıdır."
      >
        <ComparisonTable
          headers={[{ label: 'Boyut' }, { label: 'Mevcut' }, { label: 'Sonuç' }]}
          rows={[
            ['Polling', '3 sn ana döngü + 1 sn bekleyenler', 'Tüm cihazlar senkron yüklenir; FGS/Doze kısıtlarıyla kırılgan'],
            ['Retry', '3 deneme · backoff/jitter yok', 'tryCount<3 sonrası istek sessizce CompletedRequest’e taşınır (E11)'],
            ['Idempotency', 'Yalnız lokal uniqueKey', 'Sunucuda dedup yok → çift gönderim penceresi (E9)'],
            ['Sıralama', 'Aggregate bazlı ordering yok', 'Teslim, iptalden önce işlenebilir (E10)'],
            ['Recovery', 'isProcessing=true kilidi kalıcı olabilir', 'Zombi istekler kuyruğu tıkar (E8)'],
            ['Hata sınıflandırma', '400/500/timeout aynı ele alınıyor', 'Teşhis zorlaşır, retry davranışı yanlışlaşır'],
          ]}
        />
      </PageSection>

      <Callout icon={Route} title="Buradan nereye?" tone="orange">
        Hedef mimari: <b>Compose+MVI · Domain UseCase · normalize Room (SSoT) · Outbox/WorkManager</b>{' '}
        (idempotencyKey + backoff + jitter). Fazlara bölünmüş geçiş planı ve riskleri{' '}
        <b>Modernization Plan</b> sayfasındadır; bu sayfadaki her kırmızı kutu orada bir faza
        bağlanır.
      </Callout>
    </ProductPage>
  )
}
