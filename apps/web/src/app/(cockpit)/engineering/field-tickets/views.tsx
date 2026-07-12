'use client'

// Field Ticket Intelligence — Overview / Patterns / Actions / Knowledge Base görünümleri.

import { useMemo } from 'react'
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  GitPullRequestArrow,
  Landmark,
  Scale,
  ShieldAlert,
  Wrench,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Callout, PageSection, toneCard, toneDot, toneText } from '@/components/product'
import {
  ACTIONS,
  ACTION_STATUS_META,
  ACTION_TYPE_LABEL,
  FIELD_TICKETS,
  RC_STATUS_META,
  RISK_META,
  ROOT_CAUSES,
  actionTickets,
  primaryTicketsOf,
  type ActionStatus,
  type FieldTicket,
} from '@/data/engineering/field-tickets'

// ── Ortak mini bar ───────────────────────────────────────────────

function Bar({ value, max, tone = 'blue' }: { value: number; max: number; tone?: string }) {
  return (
    <span className="block h-2 w-full overflow-hidden rounded-full bg-muted">
      <span
        className={cn('block h-full rounded-full', toneDot[tone as keyof typeof toneDot] ?? 'bg-blue-500')}
        style={{ width: `${Math.max((value / max) * 100, 3)}%` }}
      />
    </span>
  )
}

// ── Overview ─────────────────────────────────────────────────────

export function OverviewView({
  onOpenRc,
  onJumpPool,
}: {
  onOpenRc: (rcId: string) => void
  onJumpPool: (query: string) => void
}) {
  const highRisk = ROOT_CAUSES.filter((rc) => rc.repeatRisk === 'high')
    .map((rc) => ({ rc, n: primaryTicketsOf(rc.id).length }))
    .sort((a, b) => b.n - a.n)
  const waDebt = FIELD_TICKETS.filter((t) => t.status === 'closed' && t.fixType === 'workaround')
  const verifQueue = FIELD_TICKETS.filter((t) => t.pastAttempt && t.repeatRisk !== 'low')

  return (
    <div className="space-y-8">
      <PageSection
        eyebrow={`${highRisk.length} kök neden`}
        title="Aktif yüksek tekrar riski"
        description="Bu kök nedenler mevcut mimaride yeniden ticket üretmesi beklenen kayıtlardır. Ticket'ın kapalı olması riski ortadan kaldırmaz."
        icon={ShieldAlert}
        tone="red"
      >
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          {highRisk.map(({ rc, n }) => (
            <button
              key={rc.id}
              type="button"
              onClick={() => onOpenRc(rc.id)}
              className={cn('rounded-xl border p-4 text-left transition-shadow hover:shadow-md', toneCard.red)}
            >
              <div className="flex items-center justify-between gap-2">
                <span>
                  <code className="text-xs font-bold text-red-600 dark:text-red-400">{rc.id}</code>
                  <span className="ml-2 text-sm font-bold text-foreground">{rc.title}</span>
                </span>
                <Badge variant="secondary" appearance="outline" size="xs">{n} ticket</Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-foreground/80">{rc.summary}</p>
              <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
                {rc.family} · {rc.mechanism} · {RC_STATUS_META[rc.status].label}
              </p>
            </button>
          ))}
        </div>
      </PageSection>

      <PageSection
        eyebrow={`${waDebt.length} ticket`}
        title="Closed ≠ Eliminated — workaround borcu"
        description="Bu ticket'lar kapalı ancak kök neden yapısal olarak kapanmadı; teknik borç olarak izlenir."
        icon={Scale}
        tone="amber"
      >
        <div className="flex flex-wrap gap-1.5">
          {waDebt.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onJumpPool(t.id)}
              className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
              title={t.title}
            >
              {t.id} · {t.rootCause}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onJumpPool('status:closed workaround:true')}
          className="mt-3 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          Pool&apos;da aç: status:closed workaround:true →
        </button>
      </PageSection>

      <PageSection
        eyebrow={`${verifQueue.length} kayıt`}
        title="Verification Queue"
        description="Müdahale uygulanmış ancak race/regression doğrulaması tamamlanmamış kayıtlar. Fix Implemented ≠ Verified."
        icon={CheckCircle2}
        tone="blue"
      >
        <button
          type="button"
          onClick={() => onJumpPool('')}
          className="hidden"
        />
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-bold text-muted-foreground">Ticket</th>
                <th className="px-3 py-2 font-bold text-muted-foreground">Uygulanan müdahale</th>
                <th className="px-3 py-2 font-bold text-muted-foreground">Tekrar riski</th>
              </tr>
            </thead>
            <tbody>
              {verifQueue.slice(0, 10).map((t) => (
                <tr
                  key={t.id}
                  className="cursor-pointer border-b last:border-b-0 hover:bg-muted/30"
                  onClick={() => onJumpPool(t.id)}
                >
                  <td className="whitespace-nowrap px-3 py-2 font-bold">{t.id}</td>
                  <td className="px-3 py-2 text-foreground/80">
                    <span className="line-clamp-1">{t.pastAttempt}</span>
                  </td>
                  <td className={cn('whitespace-nowrap px-3 py-2 font-semibold', toneText[RISK_META[t.repeatRisk].tone])}>
                    {RISK_META[t.repeatRisk].label}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {verifQueue.length > 10 && (
          <p className="mt-2 text-xs text-muted-foreground">
            +{verifQueue.length - 10} kayıt daha — Saved View: Verification Queue
          </p>
        )}
      </PageSection>
    </div>
  )
}

// ── Patterns ─────────────────────────────────────────────────────

export function PatternsView({ onOpenRc }: { onOpenRc: (rcId: string) => void }) {
  const pareto = useMemo(
    () =>
      ROOT_CAUSES
        .map((rc) => ({ rc, n: primaryTicketsOf(rc.id).length }))
        .sort((a, b) => b.n - a.n),
    [],
  )
  const max = pareto[0]?.n ?? 1

  const byKey = (key: (t: FieldTicket) => string) => {
    const m = new Map<string, number>()
    for (const t of FIELD_TICKETS) m.set(key(t), (m.get(key(t)) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }
  const groups = byKey((t) => t.group)
  const screens = byKey((t) => t.screen).slice(0, 8)
  const countries = byKey((t) => t.country)

  // Repeat Risk Matrix: occurrence (x) × repeat risk (y)
  const matrix = pareto.map(({ rc, n }) => ({ rc, n }))

  return (
    <div className="space-y-8">
      <PageSection
        eyebrow="Pareto"
        title="En fazla ticket üreten kök nedenler"
        description="Ticket'ların çoğu az sayıda kanonik kök nedenden geliyor — mimari yatırım önceliği bu sıradan okunur."
        icon={BarChart3}
        tone="indigo"
      >
        <div className="space-y-2">
          {pareto.filter(({ n }) => n > 0).map(({ rc, n }) => (
            <button
              key={rc.id}
              type="button"
              onClick={() => onOpenRc(rc.id)}
              className="grid w-full grid-cols-[130px_1fr_40px] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/40"
            >
              <span className="truncate text-xs font-semibold text-foreground" title={rc.title}>
                <code className="mr-1 font-bold text-indigo-600 dark:text-indigo-400">{rc.id}</code>
                {rc.family}
              </span>
              <Bar value={n} max={max} tone={RISK_META[rc.repeatRisk].tone} />
              <span className="text-right text-xs font-bold tabular-nums">{n}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Bar rengi tekrar riskini gösterir: kırmızı yüksek · amber orta · yeşil düşük.
        </p>
      </PageSection>

      <PageSection
        eyebrow="Risk matrisi"
        title="Occurrence × Tekrar Riski"
        description="Sağ üst köşe (çok ticket + yüksek tekrar riski) en acil mimari yatırım alanıdır."
        icon={AlertTriangle}
        tone="red"
      >
        <div className="grid grid-cols-[60px_1fr] gap-2">
          {(['high', 'medium', 'low'] as const).map((risk) => (
            <div key={risk} className="contents">
              <div className={cn('flex items-center text-[11px] font-bold', toneText[RISK_META[risk].tone])}>
                {RISK_META[risk].label}
              </div>
              <div className="flex min-h-14 flex-wrap items-center gap-1.5 rounded-lg border border-dashed p-2">
                {matrix
                  .filter(({ rc, n }) => rc.repeatRisk === risk && n > 0)
                  .map(({ rc, n }) => (
                    <button
                      key={rc.id}
                      type="button"
                      onClick={() => onOpenRc(rc.id)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors hover:shadow-sm',
                        toneCard[RISK_META[risk].tone],
                      )}
                      title={rc.title}
                    >
                      {rc.id} · {n}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Chip içindeki sayı = bağlı ticket sayısı.</p>
      </PageSection>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {[
          { title: 'Mühendislik alanı', data: groups, tone: 'blue' },
          { title: 'Ekran / Flow', data: screens, tone: 'purple' },
          { title: 'Ülke', data: countries, tone: 'teal' },
        ].map(({ title, data, tone }) => {
          const m = data[0]?.[1] ?? 1
          return (
            <div key={title} className="rounded-xl border bg-background p-4">
              <h3 className="text-sm font-bold text-foreground">{title}</h3>
              <div className="mt-3 space-y-2">
                {data.map(([label, n]) => (
                  <div key={label} className="grid grid-cols-[110px_1fr_28px] items-center gap-2">
                    <span className="truncate text-xs text-foreground/80" title={label}>{label}</span>
                    <Bar value={n} max={m} tone={tone} />
                    <span className="text-right text-xs font-bold tabular-nums">{n}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Actions (Kanban) ─────────────────────────────────────────────

const KANBAN_COLS: ActionStatus[] = ['proposed', 'planned', 'in-progress', 'verification', 'completed']

export function ActionsView({ onOpenRc }: { onOpenRc: (rcId: string) => void }) {
  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <div className="grid min-w-[1100px] grid-cols-5 gap-3">
          {KANBAN_COLS.map((col) => {
            const meta = ACTION_STATUS_META[col]
            const items = ACTIONS.filter((a) => a.status === col)
            return (
              <div key={col} className="rounded-xl border bg-muted/20">
                <div className="flex items-center justify-between border-b px-3 py-2.5">
                  <span className={cn('text-xs font-bold uppercase tracking-wide', toneText[meta.tone])}>
                    {meta.label}
                  </span>
                  <Badge variant="secondary" appearance="outline" size="xs">{items.length}</Badge>
                </div>
                <div className="space-y-2 p-2.5">
                  {items.length === 0 && (
                    <p className="p-2 text-center text-[11px] text-muted-foreground">—</p>
                  )}
                  {items.map((a) => {
                    const n = actionTickets(a.id).length
                    return (
                      <div key={a.id} className="rounded-lg border bg-background p-3 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-[11px] font-bold">{a.id}</code>
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            {ACTION_TYPE_LABEL[a.type]}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs font-semibold leading-snug text-foreground">
                          {a.title}
                        </p>
                        <p className="mt-1.5 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
                          {a.summary}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {a.rootCauses.map((rid) => (
                            <button
                              key={rid}
                              type="button"
                              onClick={() => onOpenRc(rid)}
                              className="rounded border px-1.5 py-0.5 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                            >
                              {rid}
                            </button>
                          ))}
                        </div>
                        <p className="mt-2 border-t pt-2 text-[10px] text-muted-foreground">
                          <Wrench className="mr-1 inline size-3" />
                          {n} bağlı ticket · Ref: {a.ref}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Callout icon={GitPullRequestArrow} title="Aksiyon doğrulama kuralı" tone="blue">
        Bir aksiyon <strong>Completed</strong> kolonuna yalnızca <em>verification</em> kriteri
        kanıtla (regression testi, production metriği veya QA kaydı) karşılandığında taşınır.
        Kod değişikliğinin merge edilmesi tek başına yeterli değildir — Fix Implemented ≠ Verified.
      </Callout>
    </div>
  )
}

// ── Knowledge Base ───────────────────────────────────────────────

export function KnowledgeView({ onOpenRc }: { onOpenRc: (rcId: string) => void }) {
  const families = [...new Set(ROOT_CAUSES.map((rc) => rc.family))]
  return (
    <div className="space-y-8">
      {families.map((family) => {
        const items = ROOT_CAUSES.filter((rc) => rc.family === family)
        return (
          <PageSection
            key={family}
            eyebrow={`${items.length} kanonik kayıt`}
            title={family}
            icon={Landmark}
            tone="indigo"
          >
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
              {items.map((rc) => {
                const n = primaryTicketsOf(rc.id).length
                const statusMeta = RC_STATUS_META[rc.status]
                return (
                  <button
                    key={rc.id}
                    type="button"
                    onClick={() => onOpenRc(rc.id)}
                    className="rounded-xl border bg-background p-4 text-left transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>
                        <code className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{rc.id}</code>
                        <span className="ml-2 text-sm font-bold text-foreground">{rc.title}</span>
                      </span>
                      <span className={cn('shrink-0 text-[11px] font-bold', toneText[statusMeta.tone])}>
                        {statusMeta.label}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-foreground/80">
                      {rc.summary}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                      <span>{n} occurrence</span>
                      <span>· confidence: {rc.confidence}</span>
                      <span className={toneText[RISK_META[rc.repeatRisk].tone]}>
                        · tekrar riski {RISK_META[rc.repeatRisk].label.toLowerCase()}
                      </span>
                      {rc.edgeCases.length > 0 && <span>· {rc.edgeCases.join(', ')}</span>}
                      <span>· {rc.adrRefs.join(', ')}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </PageSection>
        )
      })}

      <PageSection
        eyebrow="Guardrails"
        title="Yorumlama kuralları"
        description="Bu sayfadaki veriler aşağıdaki kurallarla okunur; kural ihlali yanlış mühendislik kararına yol açar."
        icon={BookOpen}
        tone="gray"
      >
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          {[
            ['Symptom ≠ Root Cause', 'Kullanıcının gördüğü davranış teknik kök neden değildir; ticket önce belirti olarak kaydedilir, kanonik nedene analizle bağlanır.'],
            ['Hypothesis ≠ Confirmed', "Confidence 65 altındaki teşhisler hipotezdir; 'Confirmed' statüsü olmadan kesin dil kullanılmaz."],
            ['Workaround ≠ Permanent Fix', 'Ticket kapanması mimari riskin kapandığını göstermez; workaround ile kapanan kayıtlar borç olarak izlenir.'],
            ['Closed Ticket ≠ Eliminated Risk', 'Aynı kök neden altında tekrar riski devam edebilir; risk kök neden seviyesinde okunur.'],
            ['Correlation ≠ Causation', "Bir release ile zaman yakınlığı tek başına nedensellik kanıtı değildir; release bağlantısı evidence ister."],
            ['Fix Implemented ≠ Verified', 'Kod değişikliği regression/production doğrulaması olmadan Verified yapılmaz.'],
          ].map(([title, body]) => (
            <Callout key={title} icon={AlertTriangle} title={title} tone="gray">
              {body}
            </Callout>
          ))}
        </div>
      </PageSection>
    </div>
  )
}
