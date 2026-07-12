'use client'

import { useMemo, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  Calendar,
  Route,
  MapPin,
  ClipboardCheck,
  Package,
  Box,
  Wallet,
  DoorOpen,
  ChevronDown,
  ChevronRight,
  ArrowDown,
  ArrowUp,
  ArrowLeftRight,
  AlertTriangle,
  Info,
  Zap,
  Lock,
  Eye,
  EyeOff,
  Layers,
  GitBranch,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import {
  ProductPage,
  HeroCallout,
  PageSection,
  StatCard,
  StatGrid,
  Callout,
} from '@/components/product'
import {
  entities,
  relations,
  propagationRules,
  learningPath,
  type DomainEntity,
  type StatusDef,
  type StatusTransition,
} from '@/data/product/domain-glossary'

// ═══ Icon Map ═══════════════════════════════════════════════════════════════

const ICON_MAP: Record<string, LucideIcon> = {
  Calendar,
  Route,
  MapPin,
  ClipboardCheck,
  Package,
  Box,
  Wallet,
  DoorOpen,
}

const TONE_BG: Record<string, string> = {
  purple: 'bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800/50',
  blue: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800/50',
  teal: 'bg-teal-50 border-teal-200 dark:bg-teal-950/30 dark:border-teal-800/50',
  indigo: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800/50',
  orange: 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800/50',
  amber: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/50',
  green: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800/50',
  red: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800/50',
  gray: 'bg-muted/50 border-border',
}

const TONE_ICON: Record<string, string> = {
  purple: 'text-purple-600 dark:text-purple-400',
  blue: 'text-blue-600 dark:text-blue-400',
  teal: 'text-teal-600 dark:text-teal-400',
  indigo: 'text-indigo-600 dark:text-indigo-400',
  orange: 'text-orange-600 dark:text-orange-400',
  amber: 'text-amber-600 dark:text-amber-400',
  green: 'text-green-600 dark:text-green-400',
  red: 'text-red-600 dark:text-red-400',
  gray: 'text-muted-foreground',
}

const TONE_TEXT: Record<string, string> = {
  purple: 'text-purple-700 dark:text-purple-300',
  blue: 'text-blue-700 dark:text-blue-300',
  teal: 'text-teal-700 dark:text-teal-300',
  indigo: 'text-indigo-700 dark:text-indigo-300',
  orange: 'text-orange-700 dark:text-orange-300',
  amber: 'text-amber-700 dark:text-amber-300',
  green: 'text-green-700 dark:text-green-300',
  red: 'text-red-700 dark:text-red-300',
  gray: 'text-foreground',
}

const STATUS_DOT: Record<string, string> = {
  gray: 'bg-gray-400',
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  green: 'bg-green-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
  indigo: 'bg-indigo-500',
}

const EASE = [0.25, 0.1, 0.25, 1] as const

// ═══ Sub-Components ═════════════════════════════════════════════════════════

/* ─── Hierarchy Path (Breadcrumb Bar) ───────────────────────────────────── */
function HierarchyPath({
  entity,
  onSelect,
}: {
  entity: DomainEntity
  onSelect: (id: string) => void
}) {
  const chain = useMemo(() => {
    const path: DomainEntity[] = []
    let current: DomainEntity | undefined = entity
    while (current) {
      path.unshift(current)
      current = current.parentId
        ? entities.find((e) => e.id === current!.parentId)
        : undefined
    }
    return path
  }, [entity])

  return (
    <div className="flex items-center gap-1 flex-wrap text-xs">
      {chain.map((e, i) => {
        const Icon = ICON_MAP[e.icon] ?? Package
        const isLast = i === chain.length - 1
        return (
          <span key={e.id} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight className="size-3 text-muted-foreground/50" />
            )}
            <button
              onClick={() => onSelect(e.id)}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors',
                isLast
                  ? cn('font-semibold', TONE_BG[e.color], TONE_TEXT[e.color])
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              <Icon className="size-3" />
              {e.name}
            </button>
          </span>
        )
      })}
    </div>
  )
}

/* ─── Status Flow Visualization ─────────────────────────────────────────── */
function StatusFlow({
  statuses,
  transitions,
}: {
  statuses: StatusDef[]
  transitions: StatusTransition[]
}) {
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null)

  const outgoing = useMemo(() => {
    const map: Record<string, StatusTransition[]> = {}
    transitions.forEach((t) => {
      if (!map[t.from]) map[t.from] = []
      map[t.from]!.push(t)
    })
    return map
  }, [transitions])

  return (
    <div className="space-y-4">
      {/* Status nodes */}
      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => {
          const isHovered = hoveredStatus === s.code
          const isTarget = transitions.some(
            (t) => t.from === hoveredStatus && t.to === s.code,
          )
          const isSource = transitions.some(
            (t) => t.to === hoveredStatus && t.from === s.code,
          )

          return (
            <motion.button
              key={s.code}
              onMouseEnter={() => setHoveredStatus(s.code)}
              onMouseLeave={() => setHoveredStatus(null)}
              className={cn(
                'relative flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-xs font-semibold transition-all cursor-default',
                isHovered
                  ? 'ring-2 ring-offset-1 scale-105 shadow-md'
                  : '',
                isTarget
                  ? 'ring-2 ring-green-400 ring-offset-1 scale-102 shadow-sm'
                  : '',
                isSource
                  ? 'ring-2 ring-blue-400 ring-offset-1 scale-102 shadow-sm'
                  : '',
                s.isTerminal
                  ? 'border-dashed'
                  : 'border-solid',
                `border-${s.color}-300 dark:border-${s.color}-700`,
              )}
              style={{
                backgroundColor: isHovered
                  ? `var(--color-${s.color}-100, hsl(var(--muted)))`
                  : undefined,
              }}
              layout
            >
              <span
                className={cn(
                  'size-2 rounded-full',
                  STATUS_DOT[s.color] ?? 'bg-gray-400',
                  !s.isTerminal && 'animate-pulse',
                )}
              />
              <span>{s.label}</span>
              {s.isTerminal && (
                <Lock className="size-3 text-muted-foreground/60" />
              )}
            </motion.button>
          )
        })}
      </div>

      {/* Transition list */}
      <AnimatePresence mode="wait">
        {hoveredStatus && outgoing[hoveredStatus] && (
          <motion.div
            key={hoveredStatus}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Geçişler ({hoveredStatus})
              </span>
              {outgoing[hoveredStatus].map((t, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-xs leading-relaxed"
                >
                  <ChevronRight className="size-3 mt-0.5 text-muted-foreground/60 shrink-0" />
                  <div>
                    <span className="font-semibold">
                      → {t.to}
                    </span>
                    <span className="text-muted-foreground">
                      {' '}— {t.trigger}
                    </span>
                    {t.condition && (
                      <span className="text-amber-600 dark:text-amber-400">
                        {' '}⚠ {t.condition}
                      </span>
                    )}
                    {t.propagation && (
                      <span className="text-purple-600 dark:text-purple-400">
                        {' '}📡 {t.propagation}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─── Entity Detail Card ────────────────────────────────────────────────── */
function EntityDetail({
  entity,
  isExpanded,
  onToggle,
  onSelectEntity,
  unlockedIds,
}: {
  entity: DomainEntity
  isExpanded: boolean
  onToggle: () => void
  onSelectEntity: (id: string) => void
  unlockedIds: Set<string>
}) {
  const Icon = ICON_MAP[entity.icon] ?? Package
  const [activeTab, setActiveTab] = useState<'overview' | 'statuses' | 'attributes' | 'warnings'>('overview')
  const isLocked = !unlockedIds.has(entity.id)

  const childEntities = useMemo(
    () => entities.filter((e) => entity.childIds.includes(e.id)),
    [entity.childIds],
  )

  return (
    <motion.div
      id={`entity-${entity.id}`}
      className={cn(
        'rounded-2xl border-2 overflow-hidden transition-shadow',
        isExpanded ? 'shadow-lg' : 'shadow-sm hover:shadow-md',
        TONE_BG[entity.color],
        isLocked && 'opacity-60 pointer-events-none select-none',
      )}
      layout
    >
      {/* Header */}
      <button
        onClick={onToggle}
        disabled={isLocked}
        className={cn(
          'w-full flex items-center gap-3 p-4 text-left transition-colors',
          !isLocked && 'hover:bg-black/[0.03] dark:hover:bg-white/[0.03]',
        )}
      >
        {/* Level indicator */}
        <div
          className={cn(
            'flex items-center justify-center size-10 rounded-xl shrink-0',
            isExpanded
              ? `bg-${entity.color}-500 text-white shadow-md`
              : `bg-${entity.color}-100 dark:bg-${entity.color}-900/40`,
          )}
          style={
            isExpanded
              ? {
                  backgroundColor: `var(--color-${entity.color}-500, #8b5cf6)`,
                  color: 'white',
                }
              : undefined
          }
        >
          {isLocked ? (
            <Lock className="size-5" />
          ) : (
            <Icon
              className={cn(
                'size-5',
                isExpanded ? 'text-white' : TONE_ICON[entity.color],
              )}
            />
          )}
        </div>

        {/* Title area */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-[10px] font-bold uppercase tracking-wider', TONE_TEXT[entity.color])}>
              Level {entity.level}
              {entity.parentId === null && entity.level > 0 && ' · Cross-cutting'}
            </span>
            {isLocked && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                🔒 Önce {entity.prerequisiteIds[entity.prerequisiteIds.length - 1]} öğrenin
              </Badge>
            )}
          </div>
          <h3 className="text-base font-bold leading-snug">
            {entity.name}{' '}
            <span className="text-muted-foreground font-normal text-sm">
              ({entity.turkishName})
            </span>
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
            {entity.definition}
          </p>
        </div>

        {/* Expand icon */}
        {!isLocked && (
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="size-5 text-muted-foreground" />
          </motion.div>
        )}
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && !isLocked && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-5 space-y-5 border-t border-current/5">
              {/* Hierarchy breadcrumb */}
              <div className="pt-3">
                <HierarchyPath entity={entity} onSelect={onSelectEntity} />
              </div>

              {/* Aliases */}
              <div className="flex flex-wrap gap-1.5">
                {entity.aliases.map((a) => (
                  <Badge key={a} variant="secondary" className="text-[10px]">
                    {a}
                  </Badge>
                ))}
                <Badge variant="outline" className="text-[10px]">
                  {entity.cardinality} — {entity.cardinalityDesc}
                </Badge>
              </div>

              {/* Tab navigation */}
              <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
                {(
                  [
                    { key: 'overview' as const, label: 'Tanım', icon: Info },
                    { key: 'statuses' as const, label: 'Statüler', icon: GitBranch },
                    { key: 'attributes' as const, label: 'Alanlar', icon: Layers },
                    { key: 'warnings' as const, label: 'Uyarılar', icon: AlertTriangle },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                      activeTab === tab.key
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <tab.icon className="size-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === 'overview' && (
                    <div className="space-y-4">
                      <div className="rounded-xl border bg-background/60 p-4 space-y-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Tanım
                          </span>
                          <p className="text-sm leading-relaxed mt-1">
                            {entity.definition}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            İş Bağlamı
                          </span>
                          <p className="text-sm leading-relaxed text-muted-foreground mt-1">
                            {entity.businessContext}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Teknik Bağlam
                          </span>
                          <p className="text-sm leading-relaxed text-muted-foreground mt-1 font-mono text-xs">
                            {entity.technicalContext}
                          </p>
                        </div>
                      </div>

                      {/* Related screens */}
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          İlgili Ekranlar
                        </span>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {entity.screens.map((s) => (
                            <Badge
                              key={s}
                              variant="outline"
                              className="text-[10px]"
                            >
                              📱 {s}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Children links */}
                      {childEntities.length > 0 && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Alt Varlıklar
                          </span>
                          <div className="flex flex-wrap gap-2 mt-1.5">
                            {childEntities.map((c) => {
                              const CIcon = ICON_MAP[c.icon] ?? Package
                              return (
                                <button
                                  key={c.id}
                                  onClick={() => onSelectEntity(c.id)}
                                  className={cn(
                                    'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                                    TONE_BG[c.color],
                                    'hover:shadow-sm',
                                  )}
                                >
                                  <CIcon
                                    className={cn(
                                      'size-3.5',
                                      TONE_ICON[c.color],
                                    )}
                                  />
                                  <span className={TONE_TEXT[c.color]}>
                                    {c.name}
                                  </span>
                                  <ChevronRight className="size-3 text-muted-foreground/50" />
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'statuses' && (
                    <div className="space-y-4">
                      <StatusFlow
                        statuses={entity.statuses}
                        transitions={entity.transitions}
                      />
                      <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                        <Lock className="size-3" />
                        <span>Kesik çizgi = terminal durum (geri dönüşü yok)</span>
                        <span className="mx-1">·</span>
                        <span className="size-2 rounded-full bg-blue-500 animate-pulse inline-block" />
                        <span>Yanıp sönen = geçiş durumu</span>
                      </div>
                    </div>
                  )}

                  {activeTab === 'attributes' && (
                    <div className="rounded-xl border bg-background/60 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="text-left px-3 py-2 font-bold text-muted-foreground">
                              Alan
                            </th>
                            <th className="text-left px-3 py-2 font-bold text-muted-foreground">
                              Tip
                            </th>
                            <th className="text-left px-3 py-2 font-bold text-muted-foreground">
                              Açıklama
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {entity.keyAttributes.map((attr, i) => (
                            <tr
                              key={attr.name}
                              className={cn(
                                'border-b last:border-0',
                                i % 2 === 0 ? '' : 'bg-muted/10',
                              )}
                            >
                              <td className="px-3 py-2 font-mono font-medium text-foreground">
                                {attr.name}
                              </td>
                              <td className="px-3 py-2 font-mono text-muted-foreground">
                                {attr.type}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {attr.description}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activeTab === 'warnings' && (
                    <div className="space-y-2">
                      {entity.antiPatterns.map((ap, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05, duration: 0.2 }}
                          className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-3 text-xs leading-relaxed"
                        >
                          <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-red-500" />
                          <span className="text-red-800 dark:text-red-300">
                            {ap}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ─── Hierarchy Visualizer ──────────────────────────────────────────────── */
function HierarchyTree({
  onSelectEntity,
}: {
  onSelectEntity: (id: string) => void
}) {
  const hierarchyEntities = entities.filter(
    (e) => e.parentId !== null || e.childIds.length > 0,
  )
  const roots = hierarchyEntities.filter((e) => e.parentId === null)

  function renderNode(entity: DomainEntity, depth: number = 0) {
    const Icon = ICON_MAP[entity.icon] ?? Package
    const children = entities.filter((e) => entity.childIds.includes(e.id))

    return (
      <div key={entity.id} style={{ marginLeft: depth * 24 }}>
        <button
          onClick={() => onSelectEntity(entity.id)}
          className={cn(
            'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all hover:shadow-sm',
            TONE_BG[entity.color],
          )}
        >
          <Icon className={cn('size-4', TONE_ICON[entity.color])} />
          <span className={cn('font-bold', TONE_TEXT[entity.color])}>
            {entity.name}
          </span>
          <span className="text-muted-foreground">
            ({entity.turkishName})
          </span>
        </button>
        {children.length > 0 && (
          <div className="ml-5 mt-1 space-y-1 border-l-2 border-dashed border-muted-foreground/20 pl-3">
            {children.map((c) => renderNode(c, 0))}
          </div>
        )}
      </div>
    )
  }

  // Cross-cutting entities
  const crossCutting = entities.filter(
    (e) => e.parentId === null && e.childIds.length === 0,
  )

  return (
    <div className="space-y-6">
      {/* Main hierarchy */}
      <div className="space-y-1">{roots.map((r) => renderNode(r))}</div>

      {/* Cross-cutting concerns */}
      {crossCutting.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ArrowLeftRight className="size-3" />
            Cross-cutting Varlıklar
          </span>
          <div className="flex flex-wrap gap-2">
            {crossCutting.map((e) => {
              const Icon = ICON_MAP[e.icon] ?? Package
              return (
                <button
                  key={e.id}
                  onClick={() => onSelectEntity(e.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all hover:shadow-sm',
                    TONE_BG[e.color],
                  )}
                >
                  <Icon className={cn('size-4', TONE_ICON[e.color])} />
                  <span className={cn('font-bold', TONE_TEXT[e.color])}>
                    {e.name}
                  </span>
                  <span className="text-muted-foreground">
                    ({e.turkishName})
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Propagation Rules Card ────────────────────────────────────────────── */
function PropagationRulesSection() {
  const directionIcon: Record<string, LucideIcon> = {
    up: ArrowUp,
    down: ArrowDown,
    both: ArrowLeftRight,
    none: ArrowLeftRight,
  }
  const directionTone: Record<string, string> = {
    up: 'green',
    down: 'red',
    both: 'purple',
    none: 'amber',
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {propagationRules.map((rule, i) => {
        const Icon = directionIcon[rule.direction] ?? ArrowLeftRight
        const tone = directionTone[rule.direction] ?? 'gray'
        return (
          <motion.div
            key={rule.id}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05, duration: 0.3, ease: EASE }}
            className={cn(
              'rounded-xl border-2 p-4 space-y-2',
              TONE_BG[tone],
            )}
          >
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex items-center justify-center size-7 rounded-lg',
                  `bg-${tone}-100 dark:bg-${tone}-900/40`,
                )}
              >
                <Icon className={cn('size-4', TONE_ICON[tone])} />
              </div>
              <span
                className={cn(
                  'text-xs font-bold',
                  TONE_TEXT[tone],
                )}
              >
                {rule.title}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {rule.description}
            </p>
            <div className="rounded-md bg-background/60 border px-3 py-2 text-[11px] font-mono text-muted-foreground">
              💡 {rule.example}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ═══ Main Page ═══════════════════════════════════════════════════════════════

export default function DomainGlossaryPage() {
  const [expandedId, setExpandedId] = useState<string | null>('schedule')
  const [unlockedStep, setUnlockedStep] = useState(1)
  const [guidedMode, setGuidedMode] = useState(true)

  const unlockedIds = useMemo(() => {
    if (!guidedMode) return new Set(entities.map((e) => e.id))
    const set = new Set<string>()
    learningPath.forEach((step) => {
      if (step.step <= unlockedStep) set.add(step.entityId)
    })
    return set
  }, [unlockedStep, guidedMode])

  const handleSelectEntity = useCallback(
    (id: string) => {
      const target = entities.find((e) => e.id === id)
      if (!target) return

      // Auto-unlock if guided
      if (guidedMode) {
        const step = learningPath.find((s) => s.entityId === id)
        if (step && step.step > unlockedStep) {
          // Only unlock next step
          if (step.step === unlockedStep + 1) {
            setUnlockedStep(step.step)
          } else {
            return // Don't allow skipping
          }
        }
      }

      setExpandedId((prev) => (prev === id ? null : id))

      // Scroll to element
      setTimeout(() => {
        document
          .getElementById(`entity-${id}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    },
    [guidedMode, unlockedStep],
  )

  const handleUnlockNext = useCallback(() => {
    if (unlockedStep < learningPath.length) {
      const nextStep = unlockedStep + 1
      setUnlockedStep(nextStep)
      const nextEntity = learningPath.find((s) => s.step === nextStep)
      if (nextEntity) {
        setExpandedId(nextEntity.entityId)
        setTimeout(() => {
          document
            .getElementById(`entity-${nextEntity.entityId}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 200)
      }
    }
  }, [unlockedStep])

  // Stats
  const totalEntities = entities.length
  const totalStatuses = entities.reduce((s, e) => s + e.statuses.length, 0)
  const totalTransitions = entities.reduce(
    (s, e) => s + e.transitions.length,
    0,
  )

  // Current learning step
  const currentStep = learningPath.find((s) => s.step === unlockedStep)

  // Group entities: hierarchical + cross-cutting
  const hierarchicalEntities = entities.filter(
    (e) => e.parentId !== null || e.childIds.length > 0,
  )
  const crossCuttingEntities = entities.filter(
    (e) => e.parentId === null && e.childIds.length === 0,
  )

  return (
    <ProductPage path="/product/domain-glossary">
      {/* ─── Hero ────────────────────────────────────────────────────── */}
      <HeroCallout
        icon={BookOpen}
        eyebrow="Product Foundation"
        tone="amber"
        title="Domain Entity Sözlüğü"
        lead="NeSy Mobile'ın ubiquitous language'i — ekipteki herkesin aynı dili konuşması için. Hiyerarşik entity yapısı, statü geçişleri ve yayılım kuralları."
        chips={[
          'Ubiquitous Language',
          'Hiyerarşik Yapı',
          'Statü Propagation',
          `${totalEntities} Entity`,
        ]}
      >
        <StatGrid cols={4}>
          <StatCard
            label="Domain Entity"
            value={totalEntities}
            tone="amber"
            icon={Layers}
          />
          <StatCard
            label="Statü Tanımı"
            value={totalStatuses}
            tone="blue"
            icon={GitBranch}
          />
          <StatCard
            label="Geçiş Kuralı"
            value={totalTransitions}
            tone="purple"
            icon={Zap}
          />
          <StatCard
            label="Yayılım Kuralı"
            value={propagationRules.length}
            tone="green"
            icon={ArrowDown}
          />
        </StatGrid>
      </HeroCallout>

      {/* ─── Guided Mode Toggle ─────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 rounded-xl border-2 border-dashed border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-4">
        <div className="flex items-center gap-3">
          {guidedMode ? (
            <Eye className="size-5 text-amber-600 dark:text-amber-400" />
          ) : (
            <EyeOff className="size-5 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-bold">
              {guidedMode
                ? '🎓 Rehberli Öğrenme Modu'
                : '📖 Serbest Gezinme Modu'}
            </p>
            <p className="text-xs text-muted-foreground">
              {guidedMode
                ? `Adım ${unlockedStep}/${learningPath.length} — ${currentStep?.hint ?? ''}`
                : 'Tüm entity\'ler açık. Hiyerarşik sıra takip edilmiyor.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {guidedMode && unlockedStep < learningPath.length && (
            <button
              onClick={handleUnlockNext}
              className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 transition-colors shadow-sm"
            >
              Sonraki →
            </button>
          )}
          <button
            onClick={() => setGuidedMode(!guidedMode)}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {guidedMode ? 'Serbest Mod' : 'Rehberli Mod'}
          </button>
        </div>
      </div>

      {/* ─── Learning Progress (Guided Mode) ────────────────────────── */}
      {guidedMode && (
        <div className="flex items-center gap-1">
          {learningPath.map((step) => {
            const entity = entities.find((e) => e.id === step.entityId)
            if (!entity) return null
            const Icon = ICON_MAP[entity.icon] ?? Package
            const isUnlocked = step.step <= unlockedStep
            const isCurrent = step.step === unlockedStep

            return (
              <button
                key={step.entityId}
                onClick={() => isUnlocked && handleSelectEntity(step.entityId)}
                className={cn(
                  'flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition-all',
                  isUnlocked
                    ? cn(
                        TONE_BG[entity.color],
                        TONE_TEXT[entity.color],
                        isCurrent && 'ring-2 ring-offset-1 ring-amber-400 shadow-sm',
                      )
                    : 'bg-muted/30 text-muted-foreground/40 cursor-not-allowed',
                )}
              >
                {isUnlocked ? (
                  <Icon className="size-3" />
                ) : (
                  <Lock className="size-3" />
                )}
                <span className="hidden sm:inline">{entity.name}</span>
                <span className="sm:hidden">{step.step}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* ─── Hierarchy Overview ─────────────────────────────────────── */}
      <PageSection
        eyebrow="Hiyerarşi"
        title="Entity İlişki Haritası"
        description="Ana hiyerarşi: Schedule → Route → Stop → Task → Shipment → ShipmentItem. Cross-cutting: Collection, D4Me/Locker."
        icon={GitBranch}
        tone="amber"
      >
        <div className="rounded-xl border bg-card p-5">
          <HierarchyTree onSelectEntity={handleSelectEntity} />
        </div>
      </PageSection>

      {/* ─── Entity Cards (Hierarchical) ────────────────────────────── */}
      <PageSection
        eyebrow="Domain Entity'ler"
        title="Hiyerarşik Varlıklar"
        description="Ana hiyerarşi zinciri — her entity bir öncekini bilmeden anlaşılamaz."
        icon={Layers}
        tone="amber"
      >
        <div className="space-y-3">
          {hierarchicalEntities.map((entity) => (
            <EntityDetail
              key={entity.id}
              entity={entity}
              isExpanded={expandedId === entity.id}
              onToggle={() => handleSelectEntity(entity.id)}
              onSelectEntity={handleSelectEntity}
              unlockedIds={unlockedIds}
            />
          ))}
        </div>
      </PageSection>

      {/* ─── Cross-cutting Entities ─────────────────────────────────── */}
      <PageSection
        eyebrow="Cross-cutting"
        title="Yatay Kesişen Varlıklar"
        description="Ana hiyerarşi dışında, birden fazla entity ile etkileşen varlıklar."
        icon={ArrowLeftRight}
        tone="green"
      >
        <div className="space-y-3">
          {crossCuttingEntities.map((entity) => (
            <EntityDetail
              key={entity.id}
              entity={entity}
              isExpanded={expandedId === entity.id}
              onToggle={() => handleSelectEntity(entity.id)}
              onSelectEntity={handleSelectEntity}
              unlockedIds={unlockedIds}
            />
          ))}
        </div>
      </PageSection>

      {/* ─── Propagation Rules ──────────────────────────────────────── */}
      <PageSection
        eyebrow="Statü Yayılımı"
        title="Propagation Kuralları"
        description="Bir entity'nin statüsü değiştiğinde, ilişkili entity'lere nasıl yayılır?"
        icon={Zap}
        tone="purple"
      >
        <PropagationRulesSection />
      </PageSection>

      {/* ─── Guardrail ──────────────────────────────────────────────── */}
      <Callout icon={BookOpen} title="Ubiquitous Language Sözleşmesi" tone="amber">
        Bu sözlük yaşayan bir dokümandır. Yeni bir terim eklendiğinde veya mevcut
        bir terimin anlamı değiştiğinde bu sayfa güncellenmelidir. Ekipteki
        herkes — geliştirici, ürün yöneticisi, tasarımcı, QA — aynı terimleri
        aynı anlamda kullanmalıdır.
      </Callout>
    </ProductPage>
  )
}
