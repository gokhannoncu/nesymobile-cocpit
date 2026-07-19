'use client'

// Mobile Service Atlas — the three main workspace views:
// Interaction Flow (per-screen user actions), Service Matrix (screen × domain heatmap),
// Contract List (full DataGrid). Shared cells live here and are reused by the drawer.

import { useMemo, useState } from 'react'
import { ChevronDown, CloudOff, ShieldCheck, Zap } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { toneCard, toneDot, toneText } from '@/components/product'
import {
  ATLAS_SCREENS,
  CHAIN_LAYER_META,
  CONTRACT_STATUS_META,
  DOMAIN_META,
  DOMAIN_ORDER,
  JOURNEY_META,
  matrixCounts,
  screenById,
  type AtlasContract,
  type AtlasDomain,
} from '@/data/engineering/service-atlas'

// ─── Shared cells ───────────────────────────────────────────────────────────

export function MethodBadge({ contract }: { contract: AtlasContract }) {
  const isMultipart = contract.method === 'MULTIPART'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold tracking-wide',
        isMultipart
          ? 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-300'
          : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300',
      )}
    >
      {contract.method}
    </span>
  )
}

export function StatusCell({ status }: { status: AtlasContract['status'] }) {
  const meta = CONTRACT_STATUS_META[status]
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={cn('size-2 rounded-full', toneDot[meta.tone])} />
      <span className={cn('text-xs font-semibold', toneText[meta.tone])}>{meta.label}</span>
    </span>
  )
}

function FlagIcons({ c }: { c: AtlasContract }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {c.offline && (
        <span title="Offline queue destekli">
          <CloudOff className="size-3.5 text-amber-600 dark:text-amber-400" />
        </span>
      )}
      {c.waiting && (
        <span title="120 sn undo penceresi">
          <Zap className="size-3.5 text-orange-600 dark:text-orange-400" />
        </span>
      )}
      {c.protectedKey && (
        <span title="X-Protected-Request-Key imzalı">
          <ShieldCheck className="size-3.5 text-indigo-600 dark:text-indigo-400" />
        </span>
      )}
    </span>
  )
}

// ─── View 1 — Interaction Flow ──────────────────────────────────────────────

export function FlowView({
  items,
  screenId,
  onSelect,
}: {
  items: AtlasContract[]
  screenId: string | null
  onSelect: (c: AtlasContract) => void
}) {
  if (!screenId) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        Soldaki Screen Navigator’dan bir ekran seçin — o ekrandaki kullanıcı aksiyonları ve servis
        zincirleri burada görünecek. Sayfa endpoint listesinden değil, ekrandaki aksiyondan başlar.
      </div>
    )
  }
  const screen = screenById(screenId)
  const byAction = new Map<string, AtlasContract[]>()
  for (const c of items) {
    if (!byAction.has(c.action)) byAction.set(c.action, [])
    byAction.get(c.action)!.push(c)
  }
  if (byAction.size === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        {screen?.label} için filtreye uyan servis çağrısı yok.
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {[...byAction.entries()].map(([action, contracts]) => (
        <ActionLane key={action} action={action} contracts={contracts} onSelect={onSelect} />
      ))}
    </div>
  )
}

function ActionLane({
  action,
  contracts,
  onSelect,
}: {
  action: string
  contracts: AtlasContract[]
  onSelect: (c: AtlasContract) => void
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/30"
      >
        <span className="flex items-center gap-2.5">
          <span className={cn('size-2.5 rounded-full', toneDot.orange)} />
          <span className="text-sm font-bold text-foreground">{action}</span>
          <span className="text-xs text-muted-foreground">
            {contracts.length} servis çağrısı
          </span>
        </span>
        <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="space-y-2.5 border-t px-4 py-3">
          {contracts.map((c) => (
            <FlowCard key={c.id} contract={c} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  )
}

function FlowCard({
  contract: c,
  onSelect,
}: {
  contract: AtlasContract
  onSelect: (c: AtlasContract) => void
}) {
  const domain = DOMAIN_META[c.domain]
  return (
    <button
      type="button"
      onClick={() => onSelect(c)}
      className="w-full rounded-lg border p-3 text-left transition-shadow hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/30"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <MethodBadge contract={c} />
          <code className="text-xs font-bold text-foreground">{c.path}</code>
        </span>
        <span className="flex items-center gap-2">
          <FlagIcons c={c} />
          {c.external && (
            <Badge variant="destructive" appearance="outline" size="xs">{c.external}</Badge>
          )}
          <Badge variant="secondary" appearance="outline" size="xs">{domain.label}</Badge>
          <StatusCell status={c.status} />
        </span>
      </div>
      {c.trigger && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground/70">Trigger: </span>
          {c.trigger}
        </p>
      )}
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground sm:grid-cols-4">
        <span>
          <span className="font-semibold text-foreground/70">Request: </span>
          <code>{c.requestModel}</code>
        </span>
        <span>
          <span className="font-semibold text-foreground/70">Response: </span>
          <code>{c.responseModel}</code>
        </span>
        <span>
          <span className="font-semibold text-foreground/70">Auth: </span>
          {c.auth ? 'Bearer' : 'Anonim'}
        </span>
        <span>
          <span className="font-semibold text-foreground/70">Offline: </span>
          {c.offline ? (c.waiting ? 'Queue + 120 sn undo' : 'Queue') : '—'}
        </span>
      </div>
      {c.chain && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1 text-[11px]">
          {c.chain.map((step, i) => {
            const meta = CHAIN_LAYER_META[step.layer]
            return (
              <span key={i} className="inline-flex items-center gap-1">
                {i > 0 && <span className="text-muted-foreground/50">→</span>}
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5',
                    toneCard[meta.tone],
                  )}
                  title={step.detail ?? meta.label}
                >
                  <span className={cn('size-1.5 rounded-full', toneDot[meta.tone])} />
                  <span className="max-w-44 truncate font-medium text-foreground/85">{step.label}</span>
                </span>
              </span>
            )
          })}
        </div>
      )}
    </button>
  )
}

// ─── View 2 — Service Matrix ────────────────────────────────────────────────

export function MatrixView({
  items,
  onCell,
}: {
  items: AtlasContract[]
  onCell: (screenId: string, domain: AtlasDomain) => void
}) {
  const [active, setActive] = useState<{ screen: string; domain: AtlasDomain } | null>(null)
  const counts = useMemo(() => matrixCounts(), [])
  const activeDomains = DOMAIN_ORDER.filter((d) =>
    ATLAS_SCREENS.some((s) => (counts.get(s.id)?.get(d) ?? 0) > 0),
  )
  const screens = ATLAS_SCREENS.filter((s) => (counts.get(s.id)?.size ?? 0) > 0)
  const cellContracts = active
    ? items.filter((c) => c.screen === active.screen && c.domain === active.domain)
    : []

  const th =
    'px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap'

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border bg-background">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className={cn(th, 'sticky left-0 z-10 bg-muted/40 backdrop-blur min-w-44')}>
                Screen
              </th>
              {activeDomains.map((d) => (
                <th key={d} className={cn(th, 'text-center')}>{DOMAIN_META[d].label}</th>
              ))}
              <th className={cn(th, 'text-center')}>Σ</th>
            </tr>
          </thead>
          <tbody>
            {screens.map((s) => {
              const row = counts.get(s.id)!
              const total = [...row.values()].reduce((a, b) => a + b, 0)
              return (
                <tr key={s.id} className="border-b last:border-b-0">
                  <td className="sticky left-0 z-10 bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground whitespace-nowrap">
                    {s.label}
                    <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                      {JOURNEY_META[s.journey].label}
                    </span>
                  </td>
                  {activeDomains.map((d) => {
                    const n = row.get(d) ?? 0
                    const isActive = active?.screen === s.id && active?.domain === d
                    return (
                      <td key={d} className="px-1 py-1 text-center">
                        {n > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setActive(isActive ? null : { screen: s.id, domain: d })
                              if (!isActive) onCell(s.id, d)
                            }}
                            className={cn(
                              'inline-flex size-7 items-center justify-center rounded-md text-xs font-bold tabular-nums transition-colors',
                              n >= 5 &&
                                'bg-blue-600 text-white dark:bg-blue-500',
                              n >= 3 && n < 5 &&
                                'bg-blue-200 text-blue-900 dark:bg-blue-900/70 dark:text-blue-100',
                              n < 3 &&
                                'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
                              isActive && 'ring-2 ring-orange-500',
                            )}
                          >
                            {n}
                          </button>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-2.5 py-1.5 text-center text-xs font-bold tabular-nums text-foreground">
                    {total}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {active && (
        <div className="rounded-xl border bg-background p-4">
          <div className="text-xs font-bold text-foreground">
            {screenById(active.screen)?.label} × {DOMAIN_META[active.domain].label} —{' '}
            {cellContracts.length} interaction
          </div>
          <div className="mt-2 space-y-1">
            {cellContracts.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-2 text-xs">
                <MethodBadge contract={c} />
                <code className="font-semibold text-foreground">{c.path}</code>
                <span className="text-muted-foreground">· {c.action}</span>
                <FlagIcons c={c} />
              </div>
            ))}
            {cellContracts.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Aktif filtreler bu hücredeki kayıtları gizliyor.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex size-4 items-center justify-center rounded bg-blue-50 dark:bg-blue-950/50" /> 1–2 servis
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex size-4 items-center justify-center rounded bg-blue-200 dark:bg-blue-900/70" /> 3–4 servis
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex size-4 items-center justify-center rounded bg-blue-600 dark:bg-blue-500" /> 5+ servis
        </span>
        <span>Hücreye tıklayınca eşleşen endpoint’ler listelenir; Contract List’e de aynı filtre uygulanır.</span>
      </div>
    </div>
  )
}

// ─── View 3 — Contract List ─────────────────────────────────────────────────

export function ContractTable({
  items,
  onSelect,
}: {
  items: AtlasContract[]
  onSelect: (c: AtlasContract) => void
}) {
  const th =
    'px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap'
  const td = 'px-3 py-2.5 align-middle text-xs text-foreground/85'
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        Filtreye uyan contract yok. Aramayı sadeleştirin veya hızlı filtreleri temizleyin.
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-xl border bg-background">
      <table className="w-full min-w-[1180px] border-collapse text-sm">
        <thead className="border-b bg-muted/40">
          <tr>
            <th className={cn(th, 'sticky left-0 z-10 bg-muted/40 backdrop-blur min-w-32')}>Screen</th>
            <th className={cn(th, 'sticky left-[128px] z-10 bg-muted/40 backdrop-blur min-w-40')}>Action</th>
            <th className={th}>Method</th>
            <th className={th}>Endpoint</th>
            <th className={th}>Domain</th>
            <th className={th}>Request</th>
            <th className={th}>Response</th>
            <th className={th}>Auth</th>
            <th className={th}>Offline</th>
            <th className={th}>Flags</th>
            <th className={th}>Status</th>
            <th className={th}>Owner</th>
            <th className={th}>Last checked</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr
              key={c.id}
              onClick={() => onSelect(c)}
              className="cursor-pointer border-b last:border-b-0 transition-colors hover:bg-muted/30"
            >
              <td className={cn(td, 'sticky left-0 z-10 bg-background font-semibold text-foreground whitespace-nowrap')}>
                {screenById(c.screen)?.label ?? c.screen}
              </td>
              <td className={cn(td, 'sticky left-[128px] z-10 bg-background whitespace-nowrap')}>{c.action}</td>
              <td className={td}><MethodBadge contract={c} /></td>
              <td className={cn(td, 'whitespace-nowrap')}>
                <code className="text-xs font-semibold text-foreground">{c.path}</code>
              </td>
              <td className={cn(td, 'whitespace-nowrap')}>{DOMAIN_META[c.domain].label}</td>
              <td className={cn(td, 'whitespace-nowrap')}><code>{c.requestModel}</code></td>
              <td className={cn(td, 'whitespace-nowrap')}><code>{c.responseModel}</code></td>
              <td className={td}>{c.auth ? 'Bearer' : '—'}</td>
              <td className={td}>
                {c.offline ? (
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    {c.waiting ? 'Queue+undo' : 'Queue'}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className={td}><FlagIcons c={c} /></td>
              <td className={td}><StatusCell status={c.status} /></td>
              <td className={cn(td, 'whitespace-nowrap')}>
                {c.owner ?? <span className="text-muted-foreground">—</span>}
              </td>
              <td className={cn(td, 'whitespace-nowrap tabular-nums')}>
                {c.lastChecked ?? <span className="text-muted-foreground">Hiç</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
