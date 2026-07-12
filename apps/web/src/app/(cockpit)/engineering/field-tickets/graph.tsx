'use client'

// Root Cause Graph — katmanlı ilişki haritası (SVG).
// Sol: Ticket'lar · Orta: Kanonik Root Cause'lar · Sağ: Kalıcı Aksiyonlar.
// Edge'ler ilişki tipini taşır: caused_by (ticket→RC) ve fixed_by (RC→action).
// Node rengi durumu anlatır: kırmızı = aktif yüksek risk, amber = doğrulama bekliyor,
// yeşil = doğrulanmış/kalıcı, gri = düşük risk/arşiv.

import { useMemo, useState } from 'react'
import { cn } from '@nesy/metronic/lib/utils'
import {
  ACTIONS,
  ACTION_STATUS_META,
  ROOT_CAUSES,
  SEVERITY_META,
  primaryTicketsOf,
  type FieldTicket,
} from '@/data/engineering/field-tickets'

const ROW = 30 // ticket satır yüksekliği
const RC_MIN_H = 64
const PAD_TOP = 28

const TICKET_X = 10
const TICKET_W = 190
const RC_X = 320
const RC_W = 280
const ACT_X = 720
const ACT_W = 300
const WIDTH = ACT_X + ACT_W + 10

type NodeSel =
  | { kind: 'ticket'; id: string }
  | { kind: 'rc'; id: string }
  | { kind: 'action'; id: string }
  | null

function riskColor(risk: 'high' | 'medium' | 'low') {
  return risk === 'high'
    ? 'stroke-red-500'
    : risk === 'medium'
      ? 'stroke-amber-500'
      : 'stroke-emerald-500'
}

export function RootCauseGraph({
  tickets,
  onOpenTicket,
  onOpenRc,
}: {
  tickets: FieldTicket[]
  onOpenTicket: (t: FieldTicket) => void
  onOpenRc: (rcId: string) => void
}) {
  const [hover, setHover] = useState<NodeSel>(null)

  const layout = useMemo(() => {
    const visible = new Set(tickets.map((t) => t.id))
    // Occurrence'a göre sıralı RC listesi; filtre sonrası boş kalan RC'ler gizlenir.
    const rcs = ROOT_CAUSES
      .map((rc) => ({ rc, items: primaryTicketsOf(rc.id).filter((t) => visible.has(t.id)) }))
      .filter((g) => g.items.length > 0)
      .sort((a, b) => b.items.length - a.items.length)

    let y = PAD_TOP
    const ticketPos = new Map<string, { x: number; y: number; t: FieldTicket }>()
    const rcPos = new Map<string, { x: number; y: number; h: number }>()
    for (const g of rcs) {
      const blockH = Math.max(g.items.length * ROW, RC_MIN_H)
      const start = y
      g.items.forEach((t, i) => {
        ticketPos.set(t.id, { x: TICKET_X, y: start + i * ROW + (blockH - g.items.length * ROW) / 2, t })
      })
      rcPos.set(g.rc.id, { x: RC_X, y: start + blockH / 2 - 26, h: 52 })
      y = start + blockH + 18
    }
    const height = y + 10

    // Aksiyonlar: bağlı RC'lerin ortalama y'sine göre sırala, min aralıkla yerleştir.
    const visibleRcIds = new Set(rcs.map((g) => g.rc.id))
    const acts = ACTIONS
      .map((a) => {
        const ys = a.rootCauses
          .filter((rid) => visibleRcIds.has(rid))
          .map((rid) => rcPos.get(rid)!.y + 26)
        return { a, wish: ys.length > 0 ? ys.reduce((s, v) => s + v, 0) / ys.length : -1 }
      })
      .filter((x) => x.wish >= 0)
      .sort((x, z) => x.wish - z.wish)
    const actPos = new Map<string, { x: number; y: number }>()
    let cursor = PAD_TOP
    const ACT_H = 46
    for (const { a, wish } of acts) {
      const yy = Math.max(wish - ACT_H / 2, cursor)
      actPos.set(a.id, { x: ACT_X, y: yy })
      cursor = yy + ACT_H + 10
    }

    return { rcs, ticketPos, rcPos, actPos, height: Math.max(height, cursor + 10) }
  }, [tickets])

  const isDim = (sel: NodeSel, kind: string, id: string, links: Set<string>) => {
    if (!hover) return false
    if (hover.kind === kind && hover.id === id) return false
    return !links.has(`${hover.kind}:${hover.id}`)
  }

  // hover bağlantı kümeleri
  const linksFor = useMemo(() => {
    const map = new Map<string, Set<string>>()
    const add = (a: string, b: string) => {
      if (!map.has(a)) map.set(a, new Set())
      map.get(a)!.add(b)
      if (!map.has(b)) map.set(b, new Set())
      map.get(b)!.add(a)
    }
    for (const t of tickets) add(`ticket:${t.id}`, `rc:${t.rootCause}`)
    for (const act of ACTIONS)
      for (const rid of act.rootCauses) add(`rc:${rid}`, `action:${act.id}`)
    return map
  }, [tickets])

  const connected = (kind: string, id: string) => linksFor.get(`${kind}:${id}`) ?? new Set<string>()

  return (
    <div className="rounded-xl border bg-background">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-2.5 text-[11px] font-semibold text-muted-foreground">
        <span>■ Ticket (rectangle)</span>
        <span className="text-indigo-600 dark:text-indigo-400">⬢ Root Cause (hexagon)</span>
        <span>▢ Kalıcı Aksiyon</span>
        <span className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="h-2 w-4 rounded bg-red-500/70" /> yüksek tekrar riski</span>
          <span className="flex items-center gap-1"><span className="h-2 w-4 rounded bg-amber-500/70" /> doğrulama bekliyor</span>
          <span className="flex items-center gap-1"><span className="h-2 w-4 rounded bg-emerald-500/70" /> düşük risk / tamam</span>
        </span>
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${layout.height}`}
          width={WIDTH}
          height={layout.height}
          className="min-w-full"
          onMouseLeave={() => setHover(null)}
        >
          {/* kolon başlıkları */}
          <text x={TICKET_X} y={16} className="fill-muted-foreground text-[11px] font-bold uppercase">
            Tickets — shows / caused_by
          </text>
          <text x={RC_X} y={16} className="fill-muted-foreground text-[11px] font-bold uppercase">
            Canonical Root Causes
          </text>
          <text x={ACT_X} y={16} className="fill-muted-foreground text-[11px] font-bold uppercase">
            Permanent Actions — fixed_by
          </text>

          {/* edges: ticket → rc */}
          {tickets.map((t) => {
            const tp = layout.ticketPos.get(t.id)
            const rp = layout.rcPos.get(t.rootCause)
            if (!tp || !rp) return null
            const x1 = TICKET_X + TICKET_W
            const y1 = tp.y + 11
            const x2 = RC_X
            const y2 = rp.y + 26
            const dim =
              hover &&
              !(hover.kind === 'ticket' && hover.id === t.id) &&
              !(hover.kind === 'rc' && hover.id === t.rootCause)
            return (
              <path
                key={`e-${t.id}`}
                d={`M ${x1} ${y1} C ${x1 + 50} ${y1}, ${x2 - 50} ${y2}, ${x2} ${y2}`}
                fill="none"
                className={cn(
                  'transition-opacity',
                  riskColor(t.repeatRisk),
                  dim ? 'opacity-10' : 'opacity-45',
                )}
                strokeWidth={1.2}
              />
            )
          })}

          {/* edges: rc → action */}
          {ACTIONS.map((a) =>
            a.rootCauses.map((rid) => {
              const rp = layout.rcPos.get(rid)
              const ap = layout.actPos.get(a.id)
              if (!rp || !ap) return null
              const x1 = RC_X + RC_W
              const y1 = rp.y + 26
              const x2 = ACT_X
              const y2 = ap.y + 23
              const dim =
                hover &&
                !(hover.kind === 'action' && hover.id === a.id) &&
                !(hover.kind === 'rc' && hover.id === rid)
              return (
                <path
                  key={`e-${a.id}-${rid}`}
                  d={`M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x2 - 60} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  strokeDasharray="4 3"
                  className={cn(
                    'stroke-indigo-400 transition-opacity dark:stroke-indigo-500',
                    dim ? 'opacity-10' : 'opacity-50',
                  )}
                  strokeWidth={1.2}
                />
              )
            }),
          )}

          {/* ticket nodes */}
          {tickets.map((t) => {
            const tp = layout.ticketPos.get(t.id)
            if (!tp) return null
            const sev = SEVERITY_META[t.severity]
            const dim = isDim(hover, 'ticket', t.id, connected('ticket', t.id))
            return (
              <g
                key={t.id}
                transform={`translate(${tp.x}, ${tp.y})`}
                className={cn('cursor-pointer transition-opacity', dim && 'opacity-20')}
                onMouseEnter={() => setHover({ kind: 'ticket', id: t.id })}
                onClick={() => onOpenTicket(t)}
              >
                <rect
                  width={TICKET_W}
                  height={22}
                  rx={4}
                  className={cn(
                    'fill-background',
                    t.repeatRisk === 'high'
                      ? 'stroke-red-400 dark:stroke-red-600'
                      : t.status === 'open'
                        ? 'stroke-blue-300 dark:stroke-blue-700'
                        : 'stroke-border',
                  )}
                  strokeWidth={1.2}
                />
                <circle cx={11} cy={11} r={3.5} className={cn(
                  sev.tone === 'red' ? 'fill-red-500' : sev.tone === 'orange' ? 'fill-orange-500' : 'fill-amber-500',
                )} />
                <text x={20} y={15} className="fill-foreground text-[10px] font-bold">
                  {t.id}
                </text>
                <text x={82} y={15} className="fill-muted-foreground text-[10px]">
                  {t.country} · {t.status === 'open' ? 'açık' : 'kapalı'}
                </text>
              </g>
            )
          })}

          {/* rc nodes — hexagon hissi için kırpılmış köşeli path */}
          {layout.rcs.map(({ rc, items }) => {
            const rp = layout.rcPos.get(rc.id)!
            const dim = isDim(hover, 'rc', rc.id, connected('rc', rc.id))
            const h = 52
            const cut = 12
            const d = `M ${cut} 0 H ${RC_W - cut} L ${RC_W} ${h / 2} L ${RC_W - cut} ${h} H ${cut} L 0 ${h / 2} Z`
            return (
              <g
                key={rc.id}
                transform={`translate(${rp.x}, ${rp.y})`}
                className={cn('cursor-pointer transition-opacity', dim && 'opacity-20')}
                onMouseEnter={() => setHover({ kind: 'rc', id: rc.id })}
                onClick={() => onOpenRc(rc.id)}
              >
                <path
                  d={d}
                  className={cn(
                    'fill-indigo-50/80 dark:fill-indigo-950/40',
                    rc.repeatRisk === 'high'
                      ? 'stroke-red-500'
                      : rc.status === 'verified' || rc.status === 'fixed'
                        ? 'stroke-emerald-500'
                        : 'stroke-amber-500',
                  )}
                  strokeWidth={1.6}
                />
                <text x={18} y={19} className="fill-indigo-700 text-[11px] font-bold dark:fill-indigo-300">
                  {rc.id}
                </text>
                <text x={58} y={19} className="fill-muted-foreground text-[10px] font-semibold">
                  {items.length} ticket · {rc.mechanism}
                </text>
                <text x={18} y={36} className="fill-foreground text-[11px] font-semibold">
                  {rc.title.length > 40 ? `${rc.title.slice(0, 39)}…` : rc.title}
                </text>
              </g>
            )
          })}

          {/* action nodes */}
          {ACTIONS.map((a) => {
            const ap = layout.actPos.get(a.id)
            if (!ap) return null
            const meta = ACTION_STATUS_META[a.status]
            const dim = isDim(hover, 'action', a.id, connected('action', a.id))
            return (
              <g
                key={a.id}
                transform={`translate(${ap.x}, ${ap.y})`}
                className={cn('transition-opacity', dim && 'opacity-20')}
                onMouseEnter={() => setHover({ kind: 'action', id: a.id })}
              >
                <rect
                  width={ACT_W}
                  height={46}
                  rx={10}
                  className={cn(
                    'fill-background',
                    a.status === 'completed'
                      ? 'stroke-emerald-500'
                      : a.status === 'in-progress' || a.status === 'verification'
                        ? 'stroke-amber-500'
                        : 'stroke-border',
                  )}
                  strokeWidth={1.4}
                />
                <text x={12} y={18} className="fill-foreground text-[10px] font-bold">
                  {a.id}
                </text>
                <text x={60} y={18} className={cn('text-[10px] font-semibold', {
                  'fill-emerald-600': meta.tone === 'green',
                  'fill-amber-600': meta.tone === 'amber',
                  'fill-indigo-600': meta.tone === 'indigo',
                  'fill-blue-600': meta.tone === 'blue',
                  'fill-gray-500': meta.tone === 'gray',
                  'fill-purple-600': meta.tone === 'purple',
                })}>
                  {meta.label}
                </text>
                <text x={12} y={36} className="fill-muted-foreground text-[10px]">
                  {a.title.length > 52 ? `${a.title.slice(0, 51)}…` : a.title}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
