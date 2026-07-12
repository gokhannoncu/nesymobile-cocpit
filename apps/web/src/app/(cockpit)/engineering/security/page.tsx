'use client'

import { AlertTriangle, CheckCircle2, Info, Lock, ShieldCheck, Wrench } from 'lucide-react'
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
  type Tone,
} from '@/components/product'
import { SECURITY_COMMITS, SECURITY_POSTURE, STACK_FACTS, type SecStatus } from '@/data/engineering/security'

const statusMeta: Record<SecStatus, { label: string; tone: Tone; icon: typeof CheckCircle2 }> = {
  ok: { label: 'Sağlam', tone: 'green', icon: CheckCircle2 },
  warn: { label: 'İzle', tone: 'amber', icon: AlertTriangle },
  risk: { label: 'Risk', tone: 'red', icon: AlertTriangle },
}

export default function SecurityPage() {
  const risks = SECURITY_POSTURE.filter((s) => s.status === 'risk').length
  const oks = SECURITY_POSTURE.filter((s) => s.status === 'ok').length

  return (
    <ProductPage path="/engineering/security">
      <HeroCallout
        icon={ShieldCheck}
        eyebrow="Delivery & Security"
        tone="orange"
        title="Güvenlik durumu: sağlam temel, dört açık risk."
        lead="Repo analizi ile mimari taramanın birleşik görünümü. Kod sertleştirme (ProGuard, imza, cleartext yasağı) ve cihaz güvenliği yerinde; ancak TLS yapılandırması, token yönetimi, host yönlendirme ve release konfigürasyonunda üretim riski taşıyan dört bulgu var. Bu sayfa her bulguyu aksiyona bağlar."
        chips={['8 alan değerlendirildi', `${risks} risk · ${oks} sağlam`, 'Kaynak: repo + mimari tarama']}
      >
        <StatGrid cols={2}>
          <StatCard label="Açık Risk" value={risks} tone="red" icon={AlertTriangle} hint="TLS · token · host · release config" />
          <StatCard label="Sağlam Alan" value={oks} tone="green" icon={Lock} hint="Sertleştirme · cihaz · ağ temelleri" />
        </StatGrid>
      </HeroCallout>

      <PageSection
        eyebrow="Durum"
        title="Alan alan güvenlik değerlendirmesi"
        icon={ShieldCheck}
        tone="orange"
        description="Her risk kartındaki aksiyon, Modernization Plan Faz 0 kapsamına girer."
      >
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {SECURITY_POSTURE.map((s) => {
            const meta = statusMeta[s.status]
            return (
              <div key={s.area} className={cn('rounded-xl border p-4', toneCard[meta.tone])}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <meta.icon className={cn('size-4', s.status === 'ok' ? 'text-green-600 dark:text-green-400' : s.status === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400')} />
                    <span className="text-sm font-bold text-foreground">{s.area}</span>
                  </div>
                  <Badge variant="secondary" appearance="outline" size="xs">{meta.label}</Badge>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-foreground/85">{s.finding}</p>
                {s.action && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                    <Wrench className="mt-0.5 size-3.5 shrink-0" />
                    <span><b>Aksiyon:</b> {s.action}</span>
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </PageSection>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <PageSection
          eyebrow="Trend"
          title="Güvenlik commit'leri (son 6 ay)"
          icon={CheckCircle2}
          tone="green"
          description="Güvenlik yatırımı +100% (3 → 6 commit) — doğru yönde ama açık risklere kıyasla yavaş."
        >
          <ComparisonTable
            headers={[{ label: 'Alan' }, { label: 'Commit', tone: 'green' }, { label: 'Örnekler' }]}
            rows={SECURITY_COMMITS.map((c) => [c.area, String(c.count), <span key="e" className="text-xs">{c.examples}</span>])}
          />
        </PageSection>

        <PageSection eyebrow="Zemin" title="Stack ve sürümler" icon={Info} tone="gray">
          <ComparisonTable
            headers={[{ label: 'Bileşen' }, { label: 'Değer' }]}
            rows={STACK_FACTS.map((f) => [f.label, <span key="v" className="text-xs">{f.value}</span>])}
          />
        </PageSection>
      </div>

      <Callout icon={AlertTriangle} title="Önceliklendirme" tone="red">
        Dört riskin ilk üçü (TrustAllCerts + pin uyuşmazlığı, refresh token yokluğu, host allowlist)
        birlikte ele alındığında API katmanının güven zinciri kurulmuş olur; Chucker’ın release’ten
        çıkarılması tek satırlık kazançtır ve ilk sprintte yapılmalıdır. Vardiya ortası sessiz logout
        (E20) bu sayfadaki token riskinin sahadaki yüzüdür — güvenlik ve operasyon aynı düzeltmeyi
        bekliyor.
      </Callout>
    </ProductPage>
  )
}
