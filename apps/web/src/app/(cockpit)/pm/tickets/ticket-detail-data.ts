// Derives detail-view fields for the ticket popup from existing ticket +
// release data. Nothing here is stored — every value is computed on demand so
// the underlying dataset stays the single source of truth.

import { releases } from '@/data/pm/releases'
import type { Release, StoryStep, Ticket } from '@/data/pm/types'

// ── Story timeline ───────────────────────────────────────────────────────────
// 15 tickets ship a hand-written phased narrative; the rest only carry the flat
// analysis fields. To render the same 5-phase timeline for every ticket we fold
// those flat fields into the phase shape when no explicit story exists. Nothing
// is invented — each phase reuses an existing field verbatim.
//   symptom → summary (field report)   cause → rootCause (+ location)
//   fix     → pastAttempts (done)       state → verdict
//   todo    → fix (recommended next step)

export function resolveStory(ticket: Ticket): StoryStep[] {
  const explicit = ticket.analysis?.story
  if (explicit && explicit.length > 0) return explicit

  const a = ticket.analysis
  if (!a) return []

  const steps: StoryStep[] = []
  const push = (k: StoryStep['k'], text?: string) => {
    const clean = (text ?? '').trim()
    if (clean && clean !== '—') steps.push({ k, text: clean })
  }

  push('symptom', ticket.summary)
  push('cause', [a.rootCause, a.location].filter(Boolean).join(' '))
  push('fix', a.pastAttempts)
  push('state', a.verdict)
  push('todo', a.fix)

  return steps
}

// ── Fix / target release ─────────────────────────────────────────────────────
// The dataset has no explicit ticket→version link, so we infer it from dates:
// a closed ticket is attributed to the first *released* build shipped on or
// after its date; an open ticket points at the next planned/staging build.

export type FixInfo =
  | { kind: 'fixed'; release: Release; inferred: boolean }
  | { kind: 'target'; release: Release }
  | { kind: 'unknown' }

const byDateAsc = [...releases].sort((a, b) => a.date.localeCompare(b.date))

export function deriveFixInfo(ticket: Ticket): FixInfo {
  if (ticket.status === 'closed') {
    const released = byDateAsc.filter((r) => r.status === 'released')
    const explicit = released.find((r) => r.ticketIds.includes(ticket.id))
    if (explicit) return { kind: 'fixed', release: explicit, inferred: false }
    const shipped = released.find((r) => r.date >= ticket.date) ?? released.at(-1)
    return shipped ? { kind: 'fixed', release: shipped, inferred: true } : { kind: 'unknown' }
  }
  const upcoming = byDateAsc.find(
    (r) => (r.status === 'planned' || r.status === 'staging') && r.date >= ticket.date,
  )
  const fallback = byDateAsc.filter((r) => r.status === 'planned').at(0)
  const target = upcoming ?? fallback
  return target ? { kind: 'target', release: target } : { kind: 'unknown' }
}

// ── Reproducibility ──────────────────────────────────────────────────────────

export type Reproducibility = {
  level: 'high' | 'medium' | 'low'
  label: string
  detail: string
}

const REPRO: Record<Reproducibility['level'], Omit<Reproducibility, 'level'>> = {
  high: {
    label: 'Tekrarlanabilir',
    detail: 'Aynı koşullar altında güvenilir şekilde yeniden üretilebilir.',
  },
  medium: {
    label: 'Koşullu tekrar',
    detail: 'Belirli zamanlama / kenar senaryolarında yeniden ortaya çıkar.',
  },
  low: {
    label: 'İzole',
    detail: 'Tek seferlik gözlem; sistematik tekrar beklenmez.',
  },
}

export function deriveReproducibility(ticket: Ticket): Reproducibility {
  const level = ticket.analysis?.recurrenceRisk ?? 'medium'
  return { level, ...REPRO[level] }
}

// ── Related / similar tickets ────────────────────────────────────────────────
// Scored by shared root-cause group, edge scenarios, topics and screen.

export interface RelatedTicket {
  ticket: Ticket
  score: number
  reasons: string[]
}

export function deriveRelated(ticket: Ticket, all: Ticket[], limit = 5): RelatedTicket[] {
  const myEdges = new Set(ticket.analysis?.edgeCases ?? [])
  const myTopics = new Set(ticket.topics ?? [])

  return all
    .filter((t) => t.id !== ticket.id)
    .map((t) => {
      const reasons: string[] = []
      let score = 0
      if (t.group === ticket.group) {
        score += 3
        reasons.push(t.group)
      }
      const sharedEdges = (t.analysis?.edgeCases ?? []).filter((e) => myEdges.has(e))
      if (sharedEdges.length) {
        score += sharedEdges.length * 2
        reasons.push(...sharedEdges)
      }
      const sharedTopics = (t.topics ?? []).filter((x) => myTopics.has(x))
      score += sharedTopics.length
      if (t.screen === ticket.screen) {
        score += 1
        reasons.push(t.screen)
      }
      return { ticket: t, score, reasons: [...new Set(reasons)].slice(0, 3) }
    })
    .filter((r) => r.score >= 3)
    .sort((a, b) => b.score - a.score || b.ticket.id - a.ticket.id)
    .slice(0, limit)
}

// ── Gitea / customer detection ───────────────────────────────────────────────
// customer_refs point at the self-hosted Gitea instance; gh_url is the internal
// GitHub analysis issue.

export function isGitea(url: string): boolean {
  return /arasdx\.com|gitea/i.test(url)
}
