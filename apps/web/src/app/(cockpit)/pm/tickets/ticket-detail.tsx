'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowUpRight,
  Boxes,
  Bug,
  Calendar,
  Check,
  ChevronRight,
  Copy,
  Crosshair,
  FileText,
  FlaskConical,
  GitBranch,
  Github,
  Hash,
  Layers,
  Link2,
  MapPin,
  Monitor,
  Package,
  Repeat,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { tickets as allTickets } from '@/data/pm/tickets'
import type { Level, Severity, StoryPhase, StoryStep, Ticket } from '@/data/pm/types'
import {
  deriveFixInfo,
  deriveRelated,
  deriveReproducibility,
  isGitea,
  resolveStory,
} from './ticket-detail-data'
import './ticket-detail.css'

interface TicketDetailProps {
  ticket: Ticket | null
  onClose: () => void
  onNavigate: (id: number) => void
}

type TabId = 'overview' | 'cause' | 'test' | 'links'

const SEV_META: Record<Severity, { label: string; cls: string }> = {
  Critical: { label: 'Critical', cls: 'sev-critical' },
  High: { label: 'High', cls: 'sev-high' },
  Medium: { label: 'Medium', cls: 'sev-medium' },
  Low: { label: 'Low', cls: 'sev-low' },
}

const PHASE_META: Record<StoryPhase, { title: string; tone: string }> = {
  symptom: { title: 'Sahada ne yaşandı', tone: 'symptom' },
  cause: { title: 'Neden oluyor', tone: 'cause' },
  fix: { title: 'Ne yapıldı', tone: 'fix' },
  why: { title: 'Neden kalıcı değil', tone: 'why' },
  state: { title: 'Şu anki hali', tone: 'state' },
  todo: { title: 'Sonraki adım', tone: 'todo' },
}

const LEVEL_LABEL: Record<Level, string> = { high: 'Yüksek', medium: 'Orta', low: 'Düşük' }

function useCopyFlash(ms = 1400) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), ms)
    return () => window.clearTimeout(t)
  }, [copied, ms])
  return [copied, () => setCopied(true)] as const
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

/** Inline `code` rendering inside analysis prose. */
function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(`[^`]+`)/g)
  return (
    <p className={cn('ntd-prose', className)}>
      {parts.map((part, i) =>
        part.startsWith('`') && part.endsWith('`') ? (
          <code key={i} className="ntd-code">
            {part.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  )
}

// Ticket detail popup — tabbed: overview / root-cause / test / version+links.
export function TicketDetail({ ticket, onClose, onNavigate }: TicketDetailProps) {
  const [tab, setTab] = useState<TabId>('overview')
  const [idCopied, flashId] = useCopyFlash()
  const [summaryCopied, flashSummary] = useCopyFlash()
  const titleId = useId()

  useEffect(() => {
    if (ticket) setTab('overview')
  }, [ticket])

  useEffect(() => {
    if (!ticket) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, ticket])

  const analysis = ticket?.analysis
  const story = useMemo(() => (ticket ? resolveStory(ticket) : []), [ticket])

  const reproducibility = useMemo(
    () => (ticket ? deriveReproducibility(ticket) : null),
    [ticket],
  )
  const fixInfo = useMemo(() => (ticket ? deriveFixInfo(ticket) : null), [ticket])
  const related = useMemo(
    () => (ticket ? deriveRelated(ticket, allTickets) : []),
    [ticket],
  )

  if (!ticket || !reproducibility || !fixInfo) return null

  const sev = SEV_META[ticket.severity] ?? SEV_META.High
  const isOpen = ticket.status === 'open'

  const stateStep = story.find((s) => s.k === 'state')
  const symptomStep = story.find((s) => s.k === 'symptom')

  const metaBits: { icon: typeof Layers; label: string }[] = [
    { icon: Layers, label: ticket.group },
    { icon: Monitor, label: ticket.screen },
    { icon: MapPin, label: ticket.country },
    { icon: Calendar, label: ticket.date },
  ]

  const giteaRefs = ticket.customer_refs.filter((r) => isGitea(r.url))
  const otherRefs = ticket.customer_refs.filter((r) => !isGitea(r.url))

  const edgeCount = analysis?.edgeCases.length ?? 0
  const linkCount = 1 + ticket.customer_refs.length + related.length

  const TABS: { id: TabId; label: string; icon: typeof FileText; badge?: number | string }[] = [
    { id: 'overview', label: 'Özet', icon: FileText },
    { id: 'cause', label: 'Kök Neden', icon: Crosshair, badge: story.length || undefined },
    { id: 'test', label: 'Test & Tekrar', icon: FlaskConical, badge: edgeCount || undefined },
    { id: 'links', label: 'Sürüm & İlişki', icon: Link2, badge: linkCount },
  ]

  const handleCopyId = async () => {
    if (await copyText(String(ticket.id))) flashId()
  }
  const handleCopySummary = async () => {
    if (await copyText(ticket.summary)) flashSummary()
  }

  return (
    <div
      className="ntd-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <motion.div
        key={ticket.id}
        className={cn('ntd-panel', sev.cls, isOpen ? 'is-open' : 'is-closed')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.99 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {/* ── Header ── */}
        <header className="ntd-head">
          <div className="ntd-head-row">
            <div className="ntd-badges">
              <span className={cn('ntd-sev', sev.cls)}>
                <ShieldAlert className="size-3" />
                {sev.label}
              </span>
              <span className={cn('ntd-status', isOpen ? 'is-open' : 'is-closed')}>
                <span className="ntd-status-dot" />
                {isOpen ? 'Açık' : 'Kapalı'}
              </span>
              <button
                type="button"
                className="ntd-id"
                onClick={handleCopyId}
                title="Ticket ID kopyala"
              >
                <Hash className="size-3" />
                {ticket.id}
                {idCopied ? <Check className="size-3" /> : <Copy className="size-3 ntd-id-copy" />}
              </button>
            </div>
            <button type="button" className="ntd-close" onClick={onClose} aria-label="Kapat">
              <X className="size-4" />
            </button>
          </div>

          <h2 id={titleId} className="ntd-title">
            {ticket.title}
          </h2>

          <div className="ntd-meta">
            {metaBits.map((bit) => (
              <span key={bit.label} className="ntd-meta-bit">
                <bit.icon className="size-3" />
                {bit.label}
              </span>
            ))}
            <span className="ntd-meta-type">{ticket.type}</span>
          </div>
        </header>

        {/* ── Tabs ── */}
        <nav className="ntd-tabs" role="tablist" aria-label="Ticket detayı">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={cn('ntd-tab', tab === t.id && 'is-active')}
              onClick={() => setTab(t.id)}
            >
              <t.icon className="size-3.5" />
              <span>{t.label}</span>
              {t.badge != null && <span className="ntd-tab-badge">{t.badge}</span>}
              {tab === t.id && <motion.span layoutId="ntd-tab-underline" className="ntd-tab-underline" />}
            </button>
          ))}
        </nav>

        {/* ── Body ── */}
        <div className="ntd-body">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16 }}
            className="ntd-panel-body"
          >
            {tab === 'overview' && (
                <OverviewTab
                  ticket={ticket}
                  reproLevel={reproducibility.level}
                  reproLabel={reproducibility.label}
                  reproDetail={reproducibility.detail}
                  summaryCopied={summaryCopied}
                  onCopySummary={handleCopySummary}
                />
              )}
              {tab === 'cause' && <CauseTab ticket={ticket} story={story} />}
              {tab === 'test' && (
                <TestTab
                  ticket={ticket}
                  symptomStep={symptomStep}
                  stateStep={stateStep}
                  reproLevel={reproducibility.level}
                  reproLabel={reproducibility.label}
                  reproDetail={reproducibility.detail}
                />
              )}
              {tab === 'links' && (
                <LinksTab
                  ticket={ticket}
                  fixInfo={fixInfo}
                  giteaRefs={giteaRefs}
                  otherRefs={otherRefs}
                  related={related}
                  onNavigate={onNavigate}
                />
              )}
          </motion.div>
        </div>

        {/* ── Footer ── */}
        <footer className="ntd-foot">
          <div className="ntd-foot-links">
            <a className="ntd-foot-btn is-primary" href={ticket.gh_url} target="_blank" rel="noreferrer">
              <Github className="size-3.5" />
              GitHub #{ticket.id}
              <ArrowUpRight className="size-3" />
            </a>
            {giteaRefs.slice(0, 1).map((ref) => (
              <a
                key={`${ref.repo}-${ref.num}`}
                className="ntd-foot-btn"
                href={ref.url}
                target="_blank"
                rel="noreferrer"
              >
                <GitBranch className="size-3.5" />
                Gitea {ref.repo}#{ref.num}
                <ArrowUpRight className="size-3" />
              </a>
            ))}
          </div>
          <button type="button" className="ntd-foot-btn is-ghost" onClick={handleCopySummary}>
            {summaryCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {summaryCopied ? 'Kopyalandı' : 'Özeti kopyala'}
          </button>
        </footer>
      </motion.div>
    </div>
  )
}

// ─── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({
  ticket,
  reproLevel,
  reproLabel,
  reproDetail,
  summaryCopied,
  onCopySummary,
}: {
  ticket: Ticket
  reproLevel: 'high' | 'medium' | 'low'
  reproLabel: string
  reproDetail: string
  summaryCopied: boolean
  onCopySummary: () => void
}) {
  const facts: { icon: typeof Layers; label: string; value: string }[] = [
    { icon: Layers, label: 'Kök Neden Grubu', value: ticket.group },
    { icon: Monitor, label: 'Ekran', value: ticket.screen },
    { icon: MapPin, label: 'Ülke', value: ticket.country },
    { icon: Calendar, label: 'Tarih', value: ticket.date },
    { icon: Bug, label: 'Tür', value: ticket.type },
    { icon: Boxes, label: 'Rapor', value: ticket.analysis?.report ?? '—' },
  ]

  return (
    <div className="ntd-stack is-compact">
      <div className={cn('ntd-repro-hero is-compact', `lvl-${reproLevel}`)}>
        <div className="ntd-repro-icon">
          <Repeat className="size-4" />
        </div>
        <div className="ntd-repro-copy">
          <span className="ntd-repro-label">Tekrarlanabilirlik · {reproLabel}</span>
          <p className="ntd-repro-detail">{reproDetail}</p>
        </div>
      </div>

      <section className="ntd-card">
        <div className="ntd-card-head">
          <FileText className="size-3.5" />
          <span>Özet</span>
          <button type="button" className="ntd-mini-btn" onClick={onCopySummary}>
            {summaryCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
          </button>
        </div>
        <p className="ntd-summary">{ticket.summary}</p>
        {ticket.original_title && ticket.original_title !== ticket.title && (
          <p className="ntd-orig">Orijinal başlık: {ticket.original_title}</p>
        )}
      </section>

      <div className="ntd-facts">
        {facts.map((f) => (
          <div key={f.label} className="ntd-fact">
            <span className="ntd-fact-ico">
              <f.icon className="size-3.5" />
            </span>
            <div className="ntd-fact-copy">
              <span className="ntd-fact-label">{f.label}</span>
              <span className="ntd-fact-value">{f.value}</span>
            </div>
          </div>
        ))}
      </div>

      {(ticket.labels.length > 0 || ticket.topics.length > 0) && (
        <div className="ntd-chip-row">
          {ticket.topics.map((t) => (
            <span key={t} className="ntd-chip is-topic">
              {t}
            </span>
          ))}
          {ticket.labels.map((l) => (
            <span key={l} className="ntd-chip">
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Cause Tab ───────────────────────────────────────────────────────────────

function CauseTab({ ticket, story }: { ticket: Ticket; story: StoryStep[] }) {
  const a = ticket.analysis
  if (!a || story.length === 0) return <Empty label="Bu ticket için analiz kaydı yok." />

  return (
    <div className="ntd-stack">
      <ol className="ntd-timeline">
        {story.map((step, i) => {
          const meta = PHASE_META[step.k]
          return (
            <li key={i} className={cn('ntd-tl-item', `tone-${meta.tone}`)}>
              <span className="ntd-tl-dot">{i + 1}</span>
              <div className="ntd-tl-content">
                <h4 className="ntd-tl-title">{meta.title}</h4>
                <RichText text={step.text} className="ntd-tl-text" />
              </div>
            </li>
          )
        })}
      </ol>

      {a.edgeCases.length > 0 && (
        <section className="ntd-card">
          <div className="ntd-card-head">
            <Sparkles className="size-3.5" />
            <span>Kenar Senaryolar</span>
          </div>
          <div className="ntd-chip-row">
            {a.edgeCases.map((ec) => (
              <span key={ec} className="ntd-chip is-edge">
                {ec}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ─── Test & Reproduction Tab ───────────────────────────────────────────────────

function TestTab({
  ticket,
  symptomStep,
  stateStep,
  reproLevel,
  reproLabel,
  reproDetail,
}: {
  ticket: Ticket
  symptomStep?: StoryStep
  stateStep?: StoryStep
  reproLevel: 'high' | 'medium' | 'low'
  reproLabel: string
  reproDetail: string
}) {
  const a = ticket.analysis
  const trigger = a?.rootCause
  const observed = symptomStep?.text ?? ticket.summary
  const hasMetrics =
    stateStep &&
    (stateStep.detectability || stateStep.fixability || stateStep.confidence != null)

  return (
    <section className="ntd-test-panel">
      <div className={cn('ntd-test-status', `lvl-${reproLevel}`)}>
        <Repeat className="size-4 shrink-0" />
        <div className="ntd-test-status-copy">
          <div className="ntd-test-status-top">
            <span className="ntd-test-status-label">Tekrarlanabilirlik</span>
            <span className={cn('ntd-test-status-pill', `lvl-${reproLevel}`)}>{reproLabel}</span>
          </div>
          <p className="ntd-test-status-detail">{reproDetail}</p>
        </div>
      </div>

      <div className="ntd-test-section">
        <h3 className="ntd-test-section-title">Nasıl tekrarlanır</h3>
        <dl className="ntd-test-steps">
          {trigger && (
            <>
              <dt>Tetikleyen</dt>
              <dd>
                <RichText text={trigger} />
              </dd>
            </>
          )}
          <dt>Belirti</dt>
          <dd>
            <RichText text={observed} />
          </dd>
        </dl>
      </div>

      {(hasMetrics || stateStep?.screenCase) && (
        <div className="ntd-test-section">
          {hasMetrics && (
            <div className="ntd-test-metrics">
              {stateStep.confidence != null && (
                <div className="ntd-test-metric">
                  <span className="ntd-test-metric-label">Analiz güveni</span>
                  <span className="ntd-test-metric-value">~%{stateStep.confidence}</span>
                  <div className="ntd-conf-bar">
                    <span className="ntd-conf-fill" style={{ width: `${stateStep.confidence}%` }} />
                  </div>
                </div>
              )}
              {stateStep.detectability && (
                <div className="ntd-test-metric">
                  <div className="ntd-test-metric-head">
                    <span className="ntd-test-metric-label">Tespit</span>
                    <LevelPill level={stateStep.detectability.level} />
                  </div>
                  <p className="ntd-test-metric-note">{stateStep.detectability.note}</p>
                </div>
              )}
              {stateStep.fixability && (
                <div className="ntd-test-metric">
                  <div className="ntd-test-metric-head">
                    <span className="ntd-test-metric-label">Çözüm</span>
                    <LevelPill level={stateStep.fixability.level} />
                  </div>
                  <p className="ntd-test-metric-note">{stateStep.fixability.note}</p>
                </div>
              )}
            </div>
          )}
          {stateStep?.screenCase && (
            <div className="ntd-test-screen">
              <Monitor className="size-3.5 shrink-0" />
              <div>
                <span className="ntd-test-screen-label">Ekran senaryosu</span>
                <RichText text={stateStep.screenCase} className="ntd-test-screen-text" />
              </div>
            </div>
          )}
        </div>
      )}

      {a?.verdict && (
        <div className="ntd-test-section ntd-test-verdict">
          <ShieldAlert className="size-3.5 shrink-0" />
          <RichText text={a.verdict} className="ntd-test-verdict-text" />
        </div>
      )}

      {a && a.edgeCases.length > 0 && (
        <div className="ntd-test-section">
          <div className="ntd-test-section-head">
            <h3 className="ntd-test-section-title">Test senaryoları</h3>
            <span className="ntd-count">{a.edgeCases.length}</span>
          </div>
          <div className="ntd-chip-row">
            {a.edgeCases.map((ec) => (
              <span key={ec} className="ntd-chip is-edge">
                {ec}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function LevelPill({ level }: { level: Level }) {
  return <span className={cn('ntd-level', `lvl-${level}`)}>{LEVEL_LABEL[level]}</span>
}

// ─── Version & Links Tab ───────────────────────────────────────────────────────

function LinksTab({
  ticket,
  fixInfo,
  giteaRefs,
  otherRefs,
  related,
  onNavigate,
}: {
  ticket: Ticket
  fixInfo: ReturnType<typeof deriveFixInfo>
  giteaRefs: Ticket['customer_refs']
  otherRefs: Ticket['customer_refs']
  related: ReturnType<typeof deriveRelated>
  onNavigate: (id: number) => void
}) {
  return (
    <div className="ntd-stack is-compact">
      {/* Fix version */}
      <section className="ntd-card is-compact">
        <div className="ntd-card-head is-tight tone-fix">
          <Package className="size-3" />
          <span>Sürüm Bilgisi</span>
        </div>
        {fixInfo.kind === 'unknown' ? (
          <p className="ntd-prose">Bu ticket için sürüm eşlemesi bulunamadı.</p>
        ) : (
          <div className="ntd-release">
            <span className={cn('ntd-release-tag', `st-${fixInfo.release.status}`)}>
              {fixInfo.kind === 'fixed' ? 'Fixlendi' : 'Hedeflenen'}
            </span>
            <div className="ntd-release-main">
              <span className="ntd-release-ver">
                v{fixInfo.release.version}
                {fixInfo.release.codename ? ` · ${fixInfo.release.codename}` : ''}
              </span>
              <span className="ntd-release-sub">
                {fixInfo.release.date} · {fixInfo.release.status}
                {fixInfo.kind === 'fixed' && fixInfo.inferred ? ' · tarihe göre tahmin' : ''}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* External links */}
      <section className="ntd-card is-compact">
        <div className="ntd-card-head is-tight">
          <Link2 className="size-3" />
          <span>Bağlantılar</span>
        </div>
        <div className="ntd-link-list">
          <LinkRow icon={Github} kind="GitHub" label={`nesy-analysis #${ticket.id}`} url={ticket.gh_url} />
          {giteaRefs.map((ref) => (
            <LinkRow
              key={`g-${ref.repo}-${ref.num}`}
              icon={GitBranch}
              kind="Gitea"
              label={`${ref.repo}#${ref.num}`}
              url={ref.url}
            />
          ))}
          {otherRefs.map((ref) => (
            <LinkRow
              key={`o-${ref.repo}-${ref.num}`}
              icon={Link2}
              kind="Müşteri"
              label={`${ref.repo}#${ref.num}`}
              url={ref.url}
            />
          ))}
        </div>
      </section>

      {/* Related tickets */}
      <section className="ntd-card is-compact">
        <div className="ntd-card-head is-tight">
          <GitBranch className="size-3" />
          <span>Benzer Ticket'lar</span>
          {related.length > 0 && <span className="ntd-count">{related.length}</span>}
        </div>
        {related.length === 0 ? (
          <p className="ntd-prose ntd-muted">Bu ticket ile eşleşen benzer kayıt bulunamadı.</p>
        ) : (
          <ul className="ntd-related">
            {related.map(({ ticket: rt, reasons }) => (
              <li key={rt.id}>
                <button type="button" className="ntd-related-row" onClick={() => onNavigate(rt.id)}>
                  <span className={cn('ntd-related-sev', SEV_META[rt.severity].cls)} />
                  <span className="ntd-related-main">
                    <span className="ntd-related-title">{rt.title}</span>
                    <span className="ntd-related-meta">
                      #{rt.id}
                      {reasons.map((r) => (
                        <span key={r} className="ntd-related-reason">
                          {r}
                        </span>
                      ))}
                    </span>
                  </span>
                  <ChevronRight className="size-3.5 ntd-related-go" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function LinkRow({
  icon: Icon,
  kind,
  label,
  url,
}: {
  icon: typeof Github
  kind: string
  label: string
  url: string
}) {
  return (
    <a className="ntd-link-row" href={url} target="_blank" rel="noreferrer">
      <span className="ntd-link-ico">
        <Icon className="size-3.5" />
      </span>
      <span className="ntd-link-copy">
        <span className="ntd-link-kind">{kind}</span>
        <span className="ntd-link-label">{label}</span>
      </span>
      <ArrowUpRight className="size-3.5 ntd-link-go" />
    </a>
  )
}

function Empty({ label }: { label: string }) {
  return <div className="ntd-empty-state">{label}</div>
}
