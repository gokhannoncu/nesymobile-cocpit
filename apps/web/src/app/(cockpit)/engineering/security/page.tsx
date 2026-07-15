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
  ok: { label: 'Solid', tone: 'green', icon: CheckCircle2 },
  warn: { label: 'Monitor', tone: 'amber', icon: AlertTriangle },
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
        title="Security posture: solid foundation, four open risks."
        lead="Combined view of repo analysis and architectural scan. Code hardening (ProGuard, signature, cleartext ban) and device security are in place; but there are four findings with production risk in TLS configuration, token management, host routing, and release configuration. This page connects each finding to an action."
        chips={['8 areas evaluated', `${risks} risks · ${oks} solid`, 'Source: repo + arch scan']}
      >
        <StatGrid cols={2}>
          <StatCard label="Open Risk" value={risks} tone="red" icon={AlertTriangle} hint="TLS · token · host · release config" />
          <StatCard label="Solid Area" value={oks} tone="green" icon={Lock} hint="Hardening · device · network basics" />
        </StatGrid>
      </HeroCallout>

      <PageSection
        eyebrow="Status"
        title="Security evaluation by area"
        icon={ShieldCheck}
        tone="orange"
        description="The action in each risk card falls within the scope of Modernization Plan Phase 0."
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
                    <span><b>Action:</b> {s.action}</span>
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
          title="Security commits (last 6 months)"
          icon={CheckCircle2}
          tone="green"
          description="Security investment +100% (3 → 6 commits) — right direction but slow compared to open risks."
        >
          <ComparisonTable
            headers={[{ label: 'Area' }, { label: 'Commit', tone: 'green' }, { label: 'Examples' }]}
            rows={SECURITY_COMMITS.map((c) => [c.area, String(c.count), <span key="e" className="text-xs">{c.examples}</span>])}
          />
        </PageSection>

        <PageSection eyebrow="Context" title="Stack and versions" icon={Info} tone="gray">
          <ComparisonTable
            headers={[{ label: 'Component' }, { label: 'Value' }]}
            rows={STACK_FACTS.map((f) => [f.label, <span key="v" className="text-xs">{f.value}</span>])}
          />
        </PageSection>
      </div>

      <Callout icon={AlertTriangle} title="Prioritization" tone="red">
        The first three of the four risks (TrustAllCerts + pin mismatch, lack of refresh token, host allowlist)
        establish the trust chain of the API layer when addressed together; removing Chucker from the release
        is a single-line fix and should be done in the first sprint. Silent mid-shift logouts
        (E20) are the field manifestation of the token risk on this page — security and operations are waiting
        for the same fix.
      </Callout>
    </ProductPage>
  )
}
