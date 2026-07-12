'use client'

import {
  AlertTriangle,
  CalendarDays,
  Flame,
  GitBranch,
  GitPullRequest,
  Info,
  Users,
  Workflow,
} from 'lucide-react'
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
  toneText,
  type Tone,
} from '@/components/product'
import {
  CI_GAPS,
  CI_PIPELINES,
  CODE_HEALTH,
  COMMIT_PURPOSE,
  HOT_FILES,
  PULSE_HEADLINES,
  PULSE_PERIOD,
  TEAM_DISTRIBUTION,
  VERSION_COUNTERS,
  YEAR_STATS,
} from '@/data/engineering/github'

const headlineTone: Record<'red' | 'green' | 'amber' | 'blue', Tone> = {
  red: 'red',
  green: 'green',
  amber: 'amber',
  blue: 'blue',
}

export default function GithubPulsePage() {
  const maxWeekday = Math.max(...YEAR_STATS.weekdays.map((w) => w.commits))
  const maxPurpose = Math.max(...COMMIT_PURPOSE.map((p) => p.current))

  return (
    <ProductPage path="/engineering/github-pulse">
      <HeroCallout
        icon={GitBranch}
        eyebrow="Delivery & Security"
        tone="orange"
        title="GitHub Pulse: kod tabanının nabzı."
        lead={`Son 12 ayda ${YEAR_STATS.totalCommits} commit (${YEAR_STATS.period}). Bu sayfa commit amaçlarını, ekip dağılımını, sıcak dosyaları ve CI pipeline'larını izler — sayılar yalnızca aktiviteyi değil, kapasitenin nereye aktığını gösterir.`}
        chips={[PULSE_PERIOD, `En yoğun ay: ${YEAR_STATS.busiestMonth}`]}
      >
        <StatGrid cols={2}>
          <StatCard label="Commit (6 ay)" value={516} tone="orange" icon={GitBranch} hint="Önceki 6 ay: 515" />
          <StatCard label="PR (6 ay)" value={220} tone="amber" icon={GitPullRequest} hint="−13% · revert %0.6 · hotfix 0" />
        </StatGrid>
      </HeroCallout>

      <PageSection eyebrow="Manşetler" title="Sekiz manşet" icon={Flame} tone="orange">
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {PULSE_HEADLINES.map((h) => (
            <div key={h.text} className={cn('flex items-start gap-2 rounded-xl border p-3', toneCard[headlineTone[h.tone]])}>
              <span className={cn('mt-[7px] size-1.5 shrink-0 rounded-full bg-current', toneText[headlineTone[h.tone]])} />
              <span className="text-sm leading-relaxed text-foreground/90">{h.text}</span>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection
        eyebrow="Amaç Dağılımı"
        title="Commit'ler nereye gidiyor?"
        icon={GitBranch}
        tone="orange"
        description="Son 6 ay, önceki 6 ay ile karşılaştırmalı. Bar genişliği mevcut dönemi gösterir."
      >
        <div className="space-y-2">
          {COMMIT_PURPOSE.map((p) => (
            <div key={p.label} className="flex items-center gap-3 rounded-lg border border-border bg-background p-2.5">
              <div className="w-44 shrink-0 text-xs font-semibold text-foreground">{p.label}</div>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-orange-500"
                  style={{ width: `${Math.max((p.current / maxPurpose) * 100, 2)}%` }}
                />
              </div>
              <div className="w-24 shrink-0 text-end text-xs tabular-nums text-muted-foreground">
                <b className="text-foreground">{p.current}</b> · {p.prev}
              </div>
              <Badge
                variant="secondary"
                appearance="outline"
                size="xs"
                className={cn('w-16 justify-center', p.delta.startsWith('+') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}
              >
                {p.delta}
              </Badge>
            </div>
          ))}
        </div>
      </PageSection>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <PageSection eyebrow="Kod Sağlığı" title="Büyüme ve teslimat" icon={Info} tone="amber">
          <StatGrid cols={2}>
            {CODE_HEALTH.map((c) => (
              <StatCard key={c.label} label={c.label} value={c.value} tone="gray" hint={c.note} />
            ))}
          </StatGrid>
        </PageSection>

        <PageSection
          eyebrow="Ekip"
          title="Katkı dağılımı — bus factor alarmı"
          icon={Users}
          tone="red"
          description="Tek geliştirici %93.8 — plan ve bilgi aktarımı için en kritik organizasyonel risk."
        >
          <ComparisonTable
            headers={[{ label: 'Katkıcı' }, { label: 'Son 6 ay', tone: 'orange' }, { label: 'Önceki' }, { label: 'Pay' }]}
            rows={TEAM_DISTRIBUTION.map((t) => [t.name, String(t.current), String(t.prev), t.share])}
          />
        </PageSection>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <PageSection
          eyebrow="Sıcak Dosyalar"
          title="En çok değişen dosyalar (12 ay)"
          icon={Flame}
          tone="orange"
          description="Sıcaklık listesi god object listesiyle birebir örtüşüyor — değişiklik riski en büyük dosyalarda birikiyor."
        >
          <ComparisonTable
            headers={[{ label: 'Dosya' }, { label: 'Commit', tone: 'orange' }, { label: '+ / −' }]}
            rows={HOT_FILES.map((f) => [<code key="n" className="text-xs">{f.name}</code>, String(f.commits), f.churn])}
          />
        </PageSection>

        <PageSection eyebrow="Ritim" title="Haftalık çalışma deseni" icon={CalendarDays} tone="amber">
          <div className="flex items-end gap-2 rounded-xl border border-border bg-background p-4" style={{ height: 180 }}>
            {YEAR_STATS.weekdays.map((w) => (
              <div key={w.day} className="flex flex-1 flex-col items-center justify-end gap-1 self-stretch">
                <span className="text-[10px] tabular-nums text-muted-foreground">{w.commits}</span>
                <div
                  className="w-full rounded-t-md bg-orange-500/80"
                  style={{ height: `${(w.commits / maxWeekday) * 100}%`, minHeight: 4 }}
                />
                <span className="text-[10px] font-semibold text-muted-foreground">{w.day}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Salı–Çarşamba zirvesi; hafta sonu commit’leri düşük (Cmt 12). {YEAR_STATS.busiestMonth}; en sakin {YEAR_STATS.quietestMonth}.
          </p>
        </PageSection>
      </div>

      <PageSection
        eyebrow="CI/CD"
        title="Pipeline'lar ve boşluklar"
        icon={Workflow}
        tone="orange"
        description="Üç workflow (self-hosted, JDK 17). Sürüm sayaçları ülke bazlı tutulur."
      >
        <div className="space-y-2.5">
          {CI_PIPELINES.map((p) => (
            <div key={p.file} className="rounded-xl border border-border bg-background p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-foreground">{p.name}</span>
                <code className="text-[11px] text-muted-foreground">{p.file}</code>
                <Badge variant="secondary" appearance="outline" size="xs">{p.trigger}</Badge>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.detail}</p>
            </div>
          ))}
        </div>
        <div className={cn('mt-3.5 rounded-xl border p-4', toneCard.red)}>
          <div className={cn('text-xs font-bold uppercase tracking-wide', toneText.red)}>
            <AlertTriangle className="me-1 inline size-3.5" /> Boşluklar
          </div>
          <ul className="mt-2 space-y-1 text-xs text-foreground/85">
            {CI_GAPS.map((g) => (
              <li key={g} className="flex gap-1.5">
                <span className="mt-[7px] size-1 shrink-0 rounded-full bg-red-500" />
                <span className="leading-relaxed">{g}</span>
              </li>
            ))}
          </ul>
        </div>
      </PageSection>

      <PageSection eyebrow="Sürümler" title="Ülke bazlı sürüm sayaçları" icon={GitBranch} tone="amber">
        <ComparisonTable
          headers={[{ label: 'Kanal' }, { label: 'HR' }, { label: 'SI' }, { label: 'RS' }, { label: 'BA' }, { label: 'ME' }]}
          rows={[
            ['Production', String(VERSION_COUNTERS.prod.hr), String(VERSION_COUNTERS.prod.si), String(VERSION_COUNTERS.prod.rs), String(VERSION_COUNTERS.prod.ba), String(VERSION_COUNTERS.prod.me)],
            ['Test', String(VERSION_COUNTERS.test.hr), String(VERSION_COUNTERS.test.si), String(VERSION_COUNTERS.test.rs), String(VERSION_COUNTERS.test.ba), String(VERSION_COUNTERS.test.me)],
          ]}
        />
        <p className="mt-2 text-xs text-muted-foreground">{VERSION_COUNTERS.note}</p>
      </PageSection>

      <Callout icon={Info} title="Nasıl okumalı?" tone="orange">
        Version/Dependency (+282%) ve CI/CD (+543%) artışı altyapı yatırımını gösterir — iyi. Ancak
        aynı dönemde refactor −69% ve yeni feature −51%: kapasite bakım + sürüm yönetimine kilitlenmiş
        durumda. Bu tablo, Modernization Plan’ın "neden şimdi" gerekçesidir.
      </Callout>
    </ProductPage>
  )
}
