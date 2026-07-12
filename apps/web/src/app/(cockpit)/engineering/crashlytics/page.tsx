'use client'

import { AlertTriangle, Bug, CheckCircle2, Info, Wrench } from 'lucide-react'
import {
  Callout,
  CardGrid,
  ComparisonTable,
  HeroCallout,
  InfoCard,
  PageSection,
  ProductPage,
  StatCard,
  StatGrid,
} from '@/components/product'

export default function CrashlyticsPage() {
  return (
    <ProductPage path="/engineering/crashlytics">
      <HeroCallout
        icon={Bug}
        eyebrow="Reliability & Operations"
        tone="orange"
        title="Crash görünürlüğü: neredeyiz, neyi göremiyoruz?"
        lead="Firebase Crashlytics tüm flavor'larda aktif ve release mapping upload açık — stack trace'ler okunabilir. Ancak crash raporlama merkezî değil: recordException çağrıları ~30 dosyaya dağılmış durumda ve iki ekranda yanlış Crashlytics sabiti kullanılıyor. Bu sayfa hem mevcut sayıları hem altyapı borcunu izler."
        chips={['Firebase BOM 32.7.4', 'Mapping upload: açık', 'CW27 verisi']}
      />

      <PageSection
        eyebrow="Güncel Durum"
        title="Ülke bazlı crash görünümü (CW27)"
        icon={Bug}
        tone="orange"
        description="Crashlytics verisi performans bülteninde yalnızca HR ve SI için raporlandı; BA ve RS için haftalık crash raporu henüz bültene dahil değil — ilk kapatılacak görünürlük boşluğu."
      >
        <StatGrid cols={4}>
          <StatCard label="HR · Crash-free" value="%95.99" tone="red" icon={Bug} hint="24 crash / 23 kullanıcı (7 gün) · −2.6 puan · 29 Haziran'da 9 crash" />
          <StatCard label="SI · Crash-free" value="%100" tone="green" icon={CheckCircle2} hint="7 günde tek crash (24 Haziran)" />
          <StatCard label="BA · Crash-free" value="—" tone="gray" icon={Info} hint="Bültende raporlanmıyor" />
          <StatCard label="RS · Crash-free" value="—" tone="gray" icon={Info} hint="Bültende raporlanmıyor" />
        </StatGrid>
      </PageSection>

      <PageSection
        eyebrow="Altyapı"
        title="Crash raporlama altyapısının durumu"
        icon={Wrench}
        tone="amber"
      >
        <ComparisonTable
          headers={[{ label: 'Bileşen' }, { label: 'Durum' }, { label: 'Not' }]}
          rows={[
            ['Crashlytics SDK', '✅ Aktif', 'firebase-crashlytics-ktx · tüm flavor’larda, flavor başına google-services.json (13 dosya)'],
            ['Mapping upload', '✅ Açık', 'firebaseCrashlytics.mappingFileUploadEnabled true — release stack trace’leri deobfuscate edilir'],
            ['Performance Monitoring', '✅ Aktif', 'firebase-perf — haftalık bültenin veri kaynağı'],
            ['Merkezî crash wrapper', '❌ Yok', 'recordException(e) ~30 dosyada elle çağrılıyor; standart bağlam anahtarı yok'],
            ['Custom keys', '⚠️ Kısmi', 'LoginFragment username/fullName/unitName set ediyor — diğer ekranlarda yok'],
            ['Doğru ekran etiketi', '❌ 2 hata', 'CreateKTF ve LeanLocker yanlış Crashlytics sabiti kullanıyor → loglar başka ekrana yazılıyor'],
            ['ANR görünürlüğü', '⚠️ Riskli', 'allowMainThreadQueries + Gson parse (E4) ANR üretir; ANR’ler crash sayısına yansımaz, ayrı izlenmeli'],
          ]}
        />
      </PageSection>

      <PageSection eyebrow="Bilinen Kaynaklar" title="Crash üreten bilinen desenler" icon={AlertTriangle} tone="red">
        <CardGrid cols={3}>
          <InfoCard
            icon={Bug}
            tone="red"
            title="@AndroidEntryPoint eksik"
            desc="QuestionFragment ve AskQuestionFragment @Inject kullanıyor ama anotasyon yok → açılışta runtime crash."
            badges={[{ label: 'Faz 0 hedefi' }]}
          />
          <InfoCard
            icon={Bug}
            tone="orange"
            title="observeForever sızıntıları"
            desc="Camera (L735), Damage (L124/L214), CaseDetection, PudoLocker — uzun oturumda bellek şişmesi ve crash."
            badges={[{ label: 'Faz 0 hedefi' }]}
          />
          <InfoCard
            icon={Bug}
            tone="amber"
            title="Bildirim + scan yarışı"
            desc="Ticket 4484: bildirim sonrası barkod tarama sırasında çökme — E15/E31 desenleriyle ilişkili, repro adımı playbook'ta."
            badges={[{ label: 'Açık ticket' }]}
          />
        </CardGrid>
      </PageSection>

      <Callout icon={Wrench} title="İyileştirme sırası" tone="orange">
        (1) BA ve RS crash-free oranları haftalık bültene eklenir — dört ülke tek tabloda izlenir.
        (2) Merkezî CrashReporter wrapper’ı: ekran adı + shipment/schedule ID custom key olarak
        standartlaşır. (3) Yanlış sabit kullanan 2 ekran düzeltilir. (4) ANR izleme (Firebase
        vitals) bülten kapsamına alınır.
      </Callout>
    </ProductPage>
  )
}
