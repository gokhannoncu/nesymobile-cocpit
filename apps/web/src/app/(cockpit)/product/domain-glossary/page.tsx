'use client'

import {
  Fragment,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Archive,
  Bell,
  BookOpen,
  Box,
  Building,
  Building2,
  Calendar,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Code2,
  Container,
  DoorOpen,
  Euro,
  GitBranch,
  Globe,
  GraduationCap,
  Headphones,
  Info,
  Landmark,
  Lightbulb,
  MapPin,
  MapPinned,
  Monitor,
  Navigation,
  Network,
  Package,
  PackageCheck,
  Receipt,
  Route,
  Search,
  Store,
  Truck,
  User,
  UserCheck,
  Wallet,
  Warehouse,
  Webhook,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogOverlay, DialogPortal } from '@nesy/metronic/components/ui/dialog'
import { Input } from '@nesy/metronic/components/ui/input'
import {
  EASE,
  ProductPage,
  type Tone,
  toneCard,
  toneDot,
  toneHero,
  toneIcon,
  toneIconBox,
  toneText,
} from '@/components/product'
import {
  entities,
  ENTITY_CATEGORIES,
  ENTITY_CATEGORY,
  learningPath,
  propagationRules,
  relations,
  type DomainEntity,
  type EntityCategory,
  type PropagationRule,
} from '@/data/product/domain-glossary'

type GlossaryView = 'dictionary' | 'hierarchy' | 'rules'
type CategoryFilter = 'all' | EntityCategory
type DirectionFilter = 'all' | 'up' | 'down' | 'horizontal'

const ICONS: Record<string, LucideIcon> = {
  Calendar,
  Route,
  MapPin,
  ClipboardCheck,
  Package,
  Box,
  Wallet,
  DoorOpen,
  // New entity icons
  Warehouse,
  Building2,
  Container,
  Truck,
  Navigation,
  Zap,
  Globe,
  Monitor,
  Bell,
  Webhook,
  UserCheck,
  Building,
  User,
  Car,
  Headphones,
  Store,
  MapPinned,
  Receipt,
  Landmark,
  Euro,
  PackageCheck,
  Archive,
}

const VIEWS: { id: GlossaryView; label: string; icon: LucideIcon; tone: Tone }[] = [
  { id: 'dictionary', label: 'Dictionary', icon: BookOpen, tone: 'indigo' },
  { id: 'hierarchy', label: 'Hierarchy', icon: GitBranch, tone: 'teal' },
  { id: 'rules', label: 'State Rules', icon: ArrowLeftRight, tone: 'amber' },
]

const CATEGORY_TONE: Record<EntityCategory, Tone> = {
  planning: 'purple',
  tour: 'blue',
  delivery: 'orange',
  finance: 'green',
  locker: 'red',
  transfer: 'purple',
  integration: 'amber',
  organization: 'teal',
  fiscal: 'green',
}
const ENTITY_TONE: Record<string, Tone> = {
  schedule: 'purple',
  route: 'blue',
  stop: 'teal',
  task: 'indigo',
  shipment: 'orange',
  'shipment-item': 'amber',
  collection: 'green',
  locker: 'red',
  // Transfer & Linehaul
  hub: 'blue',
  branch: 'teal',
  'transfer-center': 'gray',
  linehaul: 'purple',
  trip: 'indigo',
  // Integration & Notification
  'event-tower': 'amber',
  eurodis: 'green',
  ebranch: 'teal',
  notification: 'red',
  webhook: 'orange',
  // Organization & Infrastructure
  courier: 'blue',
  customer: 'green',
  consignee: 'teal',
  vehicle: 'gray',
  dispatcher: 'indigo',
  'parcel-shop': 'orange',
  'counter-location': 'red',
  // Fiscal & Payment
  'fiscal-invoice': 'green',
  'cash-desk': 'amber',
  sepa: 'blue',
  commissioning: 'teal',
  inventory: 'gray',
}

function entityCategory(entity: DomainEntity): EntityCategory {
  return ENTITY_CATEGORY[entity.id] ?? 'delivery'
}

function categoryMeta(category: EntityCategory) {
  const label = ENTITY_CATEGORIES.find((item) => item.id === category)?.label ?? category
  const tone = CATEGORY_TONE[category]
  return { label, tone }
}

const STATUS_CHIP: Record<string, string> = {
  gray: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  blue: 'border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  green: 'border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-950/50 dark:text-green-300',
  amber: 'border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  orange: 'border-orange-200 bg-orange-100 text-orange-800 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-300',
  red: 'border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300',
  indigo: 'border-indigo-200 bg-indigo-100 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300',
}

const TONE_RING: Record<Tone, string> = {
  purple: 'ring-purple-400/70',
  blue: 'ring-blue-400/70',
  green: 'ring-green-400/70',
  orange: 'ring-orange-400/70',
  red: 'ring-red-400/70',
  amber: 'ring-amber-400/70',
  teal: 'ring-teal-400/70',
  indigo: 'ring-indigo-400/70',
  gray: 'ring-border',
}

const TECHNICAL_MAP: Record<string, { model: string; database: string; viewModel: string; api: string }> = {
  schedule: { model: 'ScheduleEntity', database: 'schedule', viewModel: 'ScheduleViewModel', api: '/schedules' },
  route: { model: 'RouteEntity', database: 'route', viewModel: 'RouteViewModel', api: '/routes' },
  stop: { model: 'StopEntity', database: 'stop', viewModel: 'StopListViewModel', api: '/stops' },
  task: { model: 'TaskEntity', database: 'task', viewModel: 'TaskListViewModel', api: '/tasks' },
  shipment: { model: 'ShipmentEntity', database: 'shipment', viewModel: 'DeliveryViewModel', api: '/shipments' },
  'shipment-item': { model: 'ShipmentItemEntity', database: 'shipment_item', viewModel: 'DeliveryViewModel', api: '/shipment-items' },
  collection: { model: 'CollectionEntity', database: 'collection', viewModel: 'CollectionViewModel', api: '/collections' },
  locker: { model: 'LockerEntity', database: 'locker', viewModel: 'LockerViewModel', api: '/lockers' },
  // New entities — WebAPI microservice models
  hub: { model: 'UnitModel', database: 'unit', viewModel: '—', api: '/geocode/units' },
  branch: { model: 'UnitModel', database: 'unit', viewModel: '—', api: '/geocode/units' },
  'transfer-center': { model: 'TransferCenterModel', database: 'transfer_center', viewModel: '—', api: '/transfer-center' },
  linehaul: { model: 'LinehaulTour', database: 'linehaul', viewModel: '—', api: '/shipments/linehaul' },
  trip: { model: 'TripModel', database: 'trip', viewModel: '—', api: '/transfer-center/trips' },
  'event-tower': { model: 'EventModel', database: 'event', viewModel: '—', api: '/events' },
  eurodis: { model: 'EurodisShipment', database: 'eurodis_shipment', viewModel: '—', api: '/eurodis' },
  ebranch: { model: 'EBranchModel', database: 'ebranch', viewModel: '—', api: '/tracking/ebranch' },
  notification: { model: 'NotificationModel', database: 'notification', viewModel: '—', api: '/notifications' },
  webhook: { model: 'WebhookModel', database: 'webhook', viewModel: '—', api: '/notifications/webhooks' },
  courier: { model: 'CourierModel', database: 'courier', viewModel: '—', api: '/tasks/couriers' },
  customer: { model: 'CustomerModel', database: 'customer', viewModel: '—', api: '/customers' },
  consignee: { model: 'ConsigneeModel', database: 'consignee', viewModel: '—', api: '/tracking/consignee' },
  vehicle: { model: 'VehicleModel', database: 'vehicle', viewModel: '—', api: '/transfer-center/vehicles' },
  dispatcher: { model: 'DispatcherModel', database: 'dispatcher', viewModel: '—', api: '/dispatchers' },
  'parcel-shop': { model: 'CounterLocationModel', database: 'counter_location', viewModel: '—', api: '/lockers/counter-locations' },
  'counter-location': { model: 'CounterLocationModel', database: 'counter_location', viewModel: '—', api: '/lockers/counter-locations' },
  'fiscal-invoice': { model: 'FiscalInvoiceDocument', database: 'fiscal_invoice', viewModel: '—', api: '/shipments/fiscal-invoice' },
  'cash-desk': { model: 'CashDeskModel', database: 'cash_desk', viewModel: '—', api: '/cash-desk' },
  sepa: { model: 'SepaConverterModel', database: 'sepa', viewModel: '—', api: '/sepa' },
  commissioning: { model: 'CommissioningModel', database: 'commissioning', viewModel: '—', api: '/commissioning' },
  inventory: { model: 'InventoryModel', database: 'inventory', viewModel: '—', api: '/inventory' },
}

const CHAIN = entities.filter((entity) => entity.parentId !== null || entity.childIds.length > 0)
const CROSS_CUTTING = entities.filter((entity) => entity.parentId === null && entity.childIds.length === 0)

function entityTone(entity: DomainEntity): Tone {
  return ENTITY_TONE[entity.id] ?? 'indigo'
}

function entitySurface(entity: DomainEntity) {
  return toneCard[entityTone(entity)]
}

function directionMeta(direction: PropagationRule['direction']) {
  if (direction === 'up') return { label: 'Upward', icon: ArrowUp, className: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-900' }
  if (direction === 'down') return { label: 'Downward', icon: ArrowDown, className: 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-950/30 dark:border-rose-900' }
  return { label: 'Horizontal', icon: ArrowLeftRight, className: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/30 dark:border-amber-900' }
}

function entityById(id: string | null) {
  return entities.find((entity) => entity.id === id)
}

const TURKISH_ALIAS_WORDS = new Set([
  'nakit', 'teslim', 'tur', 'rota', 'durak', 'gorev', 'gonderi', 'kurye', 'sube',
  'alici', 'musteri', 'sefer', 'kasaya', 'guzergah', 'adres', 'teslimat', 'kargo',
  'paket', 'parca', 'tahsilat', 'odeme', 'dolap', 'kasa', 'gonderen', 'subeden',
  'dagitim', 'aktarma', 'sube', 'gunluk', 'plan', 'islem', 'emri', 'noktasi',
])

function displayAliases(entity: DomainEntity) {
  const seen = new Set<string>()
  const aliases: string[] = []

  for (const alias of entity.aliases) {
    if (!/^[\x20-\x7E]+$/.test(alias)) continue
    if (alias === entity.name) continue
    const words = alias.toLocaleLowerCase('en').split(/[\s\-/]+/)
    if (!words.every((word) => {
      const normalized = word.replace(/[^a-z]/g, '')
      return normalized.length === 0 || !TURKISH_ALIAS_WORDS.has(normalized)
    })) continue

    const key = alias.toLocaleLowerCase('en')
    if (seen.has(key)) continue
    seen.add(key)
    aliases.push(alias)
    if (aliases.length >= 4) break
  }

  return aliases
}

function relationFor(entity: DomainEntity) {
  return relations.find((relation) => relation.from === entity.id)
}

function normalize(value: string) {
  return value.toLocaleLowerCase('en')
}

function searchableEntity(entity: DomainEntity) {
  const entityRelations = relations.filter((relation) => relation.from === entity.id || relation.to === entity.id)
  const category = categoryMeta(entityCategory(entity)).label
  return normalize([
    entity.name,
    entity.id,
    category,
    ...entity.aliases,
    entity.definition,
    entity.businessContext,
    entity.technicalContext,
    ...entity.statuses.flatMap((status) => [status.code, status.label, status.description]),
    ...entity.antiPatterns,
    ...entityRelations.flatMap((relation) => [relation.label, relation.description, relation.cardinality]),
  ].join(' '))
}

function entityMatches(entity: DomainEntity, query: string) {
  return !query || searchableEntity(entity).includes(normalize(query))
}

function ruleMatches(rule: PropagationRule, query: string) {
  const from = entityById(rule.fromEntity)
  const to = entityById(rule.toEntity)
  return !query || normalize([
    rule.title,
    rule.description,
    rule.example,
    rule.direction,
    from?.name,
    to?.name,
  ].join(' ')).includes(normalize(query))
}

function relationshipRows(entity: DomainEntity) {
  const parent = entityById(entity.parentId)
  const children = entity.childIds.map((id) => entityById(id)).filter(Boolean) as DomainEntity[]
  const related = relations
    .filter((relation) => relation.from === entity.id || relation.to === entity.id)
    .filter((relation) => relation.from !== parent?.id && !children.some((child) => child.id === relation.to))
  return { parent, children, related }
}

function GlossaryChrome({
  query,
  onQueryChange,
  view,
  onViewChange,
}: {
  query: string
  onQueryChange: (query: string) => void
  view: GlossaryView
  onViewChange: (view: GlossaryView) => void
}) {
  const activeTone = VIEWS.find((item) => item.id === view)?.tone ?? 'indigo'
  const chainLevels = new Set(CHAIN.map((entity) => entity.level)).size

  return (
    <motion.section
      className={cn('sticky top-0 z-20 overflow-hidden rounded-xl border bg-gradient-to-br shadow-sm', toneHero.indigo)}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.28] dark:opacity-15 [background-image:radial-gradient(circle,currentColor_1px,transparent_1px)] [background-size:18px_18px] text-foreground/10"
      />

      <div className="relative space-y-3 p-3.5 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm', toneIconBox.indigo)}>
              <BookOpen className={cn('size-5', toneIcon.indigo)} />
            </span>
            <div className="min-w-0">
              <p className={cn('text-[10px] font-bold uppercase tracking-[0.2em]', toneIcon.indigo)}>Product backbone</p>
              <h1 className="mt-0.5 text-lg font-bold tracking-tight text-foreground sm:text-xl">Domain glossary</h1>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
                Concepts, hierarchy, and state propagation rules in one place — so everyone at Nesy Mobile speaks the same language.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { icon: Package, label: `${entities.length} concepts`, tone: 'indigo' as Tone },
              { icon: GitBranch, label: `${chainLevels} levels`, tone: 'teal' as Tone },
              { icon: Network, label: `${propagationRules.length} propagation rules`, tone: 'amber' as Tone },
              { icon: Clock, label: 'Jul 13, 2026', tone: 'gray' as Tone },
            ].map(({ icon: Icon, label, tone }) => (
              <span
                key={label}
                className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold', toneCard[tone], toneText[tone])}
              >
                <Icon className="size-3" />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-indigo-200/50 bg-background/80 p-1.5 backdrop-blur-sm dark:border-indigo-900/40 dark:bg-background/70 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-indigo-500 dark:text-indigo-400" />
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Concept name, alias, status code, or description…"
              aria-label="Search domain glossary"
              className="h-9 rounded-lg border-indigo-100/80 bg-indigo-50/40 ps-9 pe-9 text-xs shadow-none focus-visible:ring-1 focus-visible:ring-indigo-500/50 dark:border-indigo-900/40 dark:bg-indigo-950/25"
            />
            {query && (
              <button
                type="button"
                onClick={() => onQueryChange('')}
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-indigo-600 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div
            className="relative grid shrink-0 grid-cols-3 rounded-lg border border-indigo-100/80 bg-gradient-to-r from-indigo-50/60 via-violet-50/30 to-amber-50/40 p-0.5 dark:border-indigo-900/40 dark:from-indigo-950/30 dark:via-violet-950/15 dark:to-amber-950/15 sm:w-[min(100%,24rem)]"
            role="tablist"
            aria-label="View selector"
          >
            <motion.span
              aria-hidden
              layoutId="glossary-tab-indicator"
              className={cn('absolute inset-y-0.5 rounded-md shadow-sm ring-1 ring-black/5 dark:ring-white/10', toneCard[activeTone])}
              style={{ left: `calc(${VIEWS.findIndex((item) => item.id === view) * (100 / 3)}% + 2px)`, width: 'calc(33.333% - 4px)' }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
            {VIEWS.map(({ id, label, icon: Icon, tone }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                onClick={() => onViewChange(id)}
                className={cn(
                  'relative z-10 flex min-w-0 items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-[11px] font-semibold transition-colors',
                  view === id ? toneText[tone] : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className={cn('size-3.5 shrink-0', view === id ? toneIcon[tone] : 'opacity-55')} />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  )
}

function FilterButton({ active, tone = 'indigo', children, onClick }: { active: boolean; tone?: Tone; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all',
        active
          ? cn(toneCard[tone], toneText[tone], 'shadow-sm ring-1 ring-black/5 dark:ring-white/10')
          : 'border-border/70 bg-background text-muted-foreground hover:border-indigo-300/60 hover:bg-indigo-50/40 hover:text-foreground dark:hover:border-indigo-800 dark:hover:bg-indigo-950/20',
      )}
    >
      {children}
    </button>
  )
}

function learningContext(entityId: string) {
  const index = learningPath.findIndex((item) => item.entityId === entityId)
  if (index < 0) return null
  const current = learningPath[index]!
  const previous = index > 0 ? learningPath[index - 1] : null
  const next = index < learningPath.length - 1 ? learningPath[index + 1] : null
  return { current, previous, next, index, total: learningPath.length }
}

function DialogSection({
  title,
  hint,
  tone = 'indigo',
  children,
}: {
  title: string
  hint?: string
  tone?: Tone
  children: ReactNode
}) {
  return (
    <section className="space-y-2.5">
      <div>
        <h3 className={cn('flex items-center gap-2 text-xs font-bold', toneText[tone])}>
          <span aria-hidden className={cn('h-3.5 w-1 rounded-full', toneDot[tone])} />
          {title}
        </h3>
        {hint && <p className="mt-1 ps-3 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function EntityDetailDialog({
  entity,
  open,
  onOpenChange,
  onNavigate,
}: {
  entity: DomainEntity | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate?: (id: string) => void
}) {
  useEffect(() => {
    if (!open || !onNavigate || !entity) return
    const context = learningContext(entity.id)
    if (!context) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && context.previous) onNavigate(context.previous.entityId)
      if (event.key === 'ArrowRight' && context.next) onNavigate(context.next.entityId)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onNavigate, entity])

  if (!entity) return null

  const ctx = learningContext(entity.id)
  const Icon = ICONS[entity.icon] ?? Package
  const tone = entityTone(entity)
  const { label: categoryLabel, tone: categoryTone } = categoryMeta(entityCategory(entity))
  const chainIndex = CHAIN.findIndex((item) => item.id === entity.id)
  const hasNav = onNavigate && ctx && (ctx.previous || ctx.next)
  const aliases = displayAliases(entity)
  const { parent, children } = relationshipRows(entity)
  const progressPct = ctx ? ((ctx.index + 1) / ctx.total) * 100 : 0
  const nextEntity = ctx?.next ? entityById(ctx.next.entityId) : null
  const prevEntity = ctx?.previous ? entityById(ctx.previous.entityId) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-slate-900/55 backdrop-blur-sm" />
      </DialogPortal>
      <DialogContent
        overlay={false}
        showCloseButton={false}
        className="fixed top-1/2 left-1/2 z-50 flex h-[min(90vh,720px)] max-h-[min(90vh,720px)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-hidden rounded-xl border border-border/80 bg-card p-0 shadow-2xl"
      >
        <div className={cn('relative shrink-0 overflow-hidden border-b', toneHero[tone])}>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.22] dark:opacity-10 [background-image:radial-gradient(circle,currentColor_1px,transparent_1px)] [background-size:16px_16px] text-foreground/10"
          />
          <span aria-hidden className={cn('pointer-events-none absolute inset-x-0 top-0 h-0.5', toneDot[tone])} />

          <div className="relative px-5 py-4 sm:px-6 sm:py-5">
            {ctx && (
              <div className="mb-4">
                <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <GraduationCap className="size-3" />
                    Learning path
                  </span>
                  <span className="tabular-nums">Step {ctx.current.step} / {ctx.total}</span>
                </div>
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10"
                  role="progressbar"
                  aria-valuenow={ctx.current.step}
                  aria-valuemin={1}
                  aria-valuemax={ctx.total}
                  aria-label={`Learning path progress: step ${ctx.current.step} of ${ctx.total}`}
                >
                  <div
                    className={cn('h-full rounded-full transition-all duration-300', toneDot[tone])}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className={cn('text-[10px] font-bold uppercase tracking-[0.2em]', toneText[tone])}>
                  Domain term
                </p>
                <div className="mt-2 flex items-start gap-3">
                  <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl border shadow-sm', toneIconBox[tone])}>
                    <Icon className={cn('size-5', toneIcon[tone])} />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <h2 className="text-xl font-bold leading-tight tracking-tight text-foreground sm:text-[22px]">
                      {entity.name}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" appearance="outline" size="sm" className={cn(toneCard[categoryTone], toneText[categoryTone])}>
                        {categoryLabel}
                      </Badge>
                      {chainIndex >= 0 && (
                        <Badge variant="secondary" appearance="outline" size="xs" className={cn(toneCard[tone], toneText[tone])}>
                          Level {entity.level}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {aliases.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-medium text-muted-foreground">Also known as</span>
                    {aliases.map((alias) => (
                      <span
                        key={alias}
                        className="rounded-full border border-border/70 bg-background/80 px-2 py-0.5 text-[11px] font-medium text-foreground/80"
                      >
                        {alias}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <DialogClose
                className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border/70 bg-background/80 text-muted-foreground outline-none transition-colors hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                aria-label="Close"
              >
                <X className="size-4" />
              </DialogClose>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="space-y-5 px-5 py-5 sm:px-6">
            {ctx && (
              <div className={cn('rounded-xl border p-3.5', toneCard.indigo)}>
                <p className={cn('text-[10px] font-bold uppercase tracking-wide', toneText.indigo)}>
                  {ctx.current.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-foreground/90">{ctx.current.hint}</p>
              </div>
            )}

            <DialogSection title="What is this concept?" hint="One-sentence definition — use this in meetings." tone={tone}>
              <p className="rounded-lg border border-border/60 bg-muted/25 px-3.5 py-3 text-sm leading-7 text-foreground/90">
                {entity.definition}
              </p>
            </DialogSection>

            <DialogSection title="What does it mean in the field?" hint="What role does it play in courier operations?" tone="blue">
              <div className="flex gap-2.5 rounded-lg border border-blue-200/70 bg-blue-50/50 px-3.5 py-3 dark:border-blue-900/50 dark:bg-blue-950/20">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <p className="text-sm leading-7 text-foreground/90">{entity.businessContext}</p>
              </div>
            </DialogSection>

            {entity.antiPatterns.length > 0 && (
              <DialogSection title="Common misconceptions" hint="Keep these in mind to avoid misunderstandings." tone="amber">
                <ul className="space-y-2">
                  {entity.antiPatterns.slice(0, 3).map((item) => (
                    <li
                      key={item}
                      className="flex gap-2.5 rounded-lg border border-amber-200/70 bg-amber-50/50 px-3.5 py-2.5 text-sm leading-6 text-foreground/85 dark:border-amber-900/50 dark:bg-amber-950/20"
                    >
                      <Info className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>{item.replace(/^[^\p{L}\p{N}]+/u, '').trim()}</span>
                    </li>
                  ))}
                </ul>
              </DialogSection>
            )}

            {(parent || children.length > 0) && onNavigate && (
              <DialogSection title="Related concepts" hint="Jump to connected terms in the domain chain." tone="teal">
                <div className="flex flex-wrap gap-2">
                  {parent && <EntityNavChip entityId={parent.id} onNavigate={onNavigate} />}
                  {children.map((child) => (
                    <EntityNavChip key={child.id} entityId={child.id} onNavigate={onNavigate} />
                  ))}
                </div>
              </DialogSection>
            )}
          </div>
        </div>

        {hasNav && (
          <div className="flex shrink-0 flex-col gap-2 border-t bg-muted/20 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            {ctx!.previous ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onNavigate!(ctx!.previous!.entityId)}
                className="max-w-full justify-start gap-1.5 sm:max-w-[44%]"
              >
                <ChevronLeft className="size-3.5 shrink-0" />
                <span className="truncate">{prevEntity?.name}</span>
              </Button>
            ) : (
              <span className="hidden sm:block" />
            )}

            <p className="text-center text-[10px] text-muted-foreground sm:order-none">
              <kbd className="rounded border border-border/70 bg-background px-1 py-0.5 font-mono text-[9px]">←</kbd>
              {' '}
              <kbd className="rounded border border-border/70 bg-background px-1 py-0.5 font-mono text-[9px]">→</kbd>
              {' '}
              to navigate
            </p>

            {ctx!.next ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => onNavigate!(ctx!.next!.entityId)}
                className="max-w-full gap-1.5 sm:max-w-[44%]"
              >
                Continue to {nextEntity?.name}
                <ChevronRight className="size-3.5 shrink-0" />
              </Button>
            ) : (
              <span className="hidden sm:block" />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function EntityDictionaryTable({
  entities: rows,
  onRowClick,
}: {
  entities: DomainEntity[]
  onRowClick: (id: string) => void
}) {
  const th = 'border border-indigo-200/60 bg-indigo-50/70 px-2.5 py-2 text-[10px] font-bold uppercase tracking-wide text-indigo-900/80 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-200'
  const td = 'h-9 max-h-9 max-w-0 border border-indigo-200/50 px-2.5 py-0 align-middle dark:border-indigo-900/40'
  const clip = 'block min-w-0 truncate whitespace-nowrap text-xs'

  return (
    <div className="overflow-hidden rounded-lg border border-indigo-200/50 bg-card shadow-sm dark:border-indigo-900/40">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] table-fixed border-collapse text-left">
          <thead>
            <tr>
              <th className={cn(th, 'w-9 text-center')}>#</th>
              <th className={cn(th, 'w-[30%]')}>Concept</th>
              <th className={cn(th, 'w-[20%]')}>Category</th>
              <th className={cn(th, 'w-[46%]')}>Definition</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entity, index) => {
              const tone = entityTone(entity)
              const Icon = ICONS[entity.icon] ?? Package
              const { label: categoryLabel, tone: categoryTone } = categoryMeta(entityCategory(entity))

              return (
                <tr
                  key={entity.id}
                  onClick={() => onRowClick(entity.id)}
                  title={entity.name}
                  className="group cursor-pointer transition-colors hover:bg-indigo-50/60 dark:hover:bg-indigo-950/25"
                >
                  <td className={cn(td, 'w-9 text-center')}>
                    <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{index + 1}</span>
                  </td>
                  <td className={td}>
                    <div className="flex min-w-0 items-center gap-2">
                      <Icon className={cn('size-3.5 shrink-0', toneIcon[tone])} />
                      <span className={cn(clip, 'font-semibold text-foreground')}>{entity.name}</span>
                    </div>
                  </td>
                  <td className={td}>
                    <span className={cn(clip, 'font-semibold', toneText[categoryTone])} title={categoryLabel}>
                      {categoryLabel}
                    </span>
                  </td>
                  <td className={td}>
                    <span className={cn(clip, 'text-muted-foreground')} title={entity.definition}>
                      {entity.definition}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-indigo-200/50 bg-muted/20 px-3 py-1.5 text-[10px] text-muted-foreground dark:border-indigo-900/40">
        {rows.length} concepts · click a row for details
      </div>
    </div>
  )
}

function DetailSection({
  title,
  hint,
  tone = 'indigo',
  children,
}: {
  title: string
  hint?: string
  tone?: Tone
  children: ReactNode
}) {
  return (
    <section className="space-y-2 border-t border-border/50 pt-4 first:border-0 first:pt-0">
      <div>
        <h3 className={cn('flex items-center gap-2 text-xs font-bold', toneText[tone])}>
          <span aria-hidden className={cn('h-3.5 w-1 rounded-full', toneDot[tone])} />
          {title}
        </h3>
        {hint && <p className="mt-1 ps-3 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function LearningPathBanner({ entity }: { entity: DomainEntity }) {
  const ctx = learningContext(entity.id)
  const { label: categoryLabel, tone: categoryTone } = categoryMeta(entityCategory(entity))
  if (!ctx) {
    return (
      <div className={cn('rounded-xl border p-3', toneCard[categoryTone])}>
        <p className={cn('text-[10px] font-bold uppercase tracking-wider', toneText[categoryTone])}>{categoryLabel}</p>
        <p className="mt-1 text-xs leading-relaxed text-foreground/85">This concept operates in a cross-cutting context; it intersects the main chain during specific operations.</p>
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl border bg-gradient-to-r p-3.5', toneHero.indigo)}>
      <div className="flex items-start gap-3">
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', toneIconBox.indigo)}>
          <GraduationCap className={cn('size-4', toneIcon.indigo)} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', toneCard.indigo, toneText.indigo)}>
              Step {ctx.current.step}/{ctx.total}
            </span>
            <span className="text-xs font-bold text-foreground">{ctx.current.title}</span>
            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', toneCard[categoryTone], toneText[categoryTone])}>
              {categoryLabel}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">{ctx.current.hint}</p>
        </div>
      </div>
    </div>
  )
}

function ChainBreadcrumb({ entity }: { entity: DomainEntity }) {
  const chainIndex = CHAIN.findIndex((item) => item.id === entity.id)
  if (chainIndex < 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-teal-200/60 bg-teal-50/40 px-3 py-2 dark:border-teal-900/50 dark:bg-teal-950/20">
      <GitBranch className="size-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
      {CHAIN.map((item, index) => (
        <Fragment key={item.id}>
          {index > 0 && <ChevronRight className="size-3 text-muted-foreground/50" />}
          <span
            className={cn(
              'rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
              item.id === entity.id
                ? 'bg-teal-600 text-white dark:bg-teal-500'
                : 'text-muted-foreground',
            )}
          >
            {item.name}
          </span>
        </Fragment>
      ))}
    </div>
  )
}

function EntityNavChip({
  entityId,
  onNavigate,
}: {
  entityId: string
  onNavigate?: (id: string) => void
}) {
  const target = entityById(entityId)
  if (!target) return null
  const tone = entityTone(target)
  const content = <span className="font-semibold">{target.name}</span>

  if (!onNavigate) {
    return (
      <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-[11px]', toneCard[tone], toneText[tone])}>
        {content}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onNavigate(entityId)}
      className={cn('inline-flex rounded-full border px-2.5 py-1 text-[11px] transition-colors hover:shadow-sm', toneCard[tone], toneText[tone])}
    >
      {content}
    </button>
  )
}

function EntityDetailPanel({
  entity,
  onNavigate,
}: {
  entity: DomainEntity
  onNavigate?: (id: string) => void
}) {
  const Icon = ICONS[entity.icon] ?? Package
  const tone = entityTone(entity)
  const [technicalOpen, setTechnicalOpen] = useState(false)
  const { parent, children, related } = relationshipRows(entity)
  const technical = TECHNICAL_MAP[entity.id]
  const relevantRules = propagationRules.filter((rule) => rule.fromEntity === entity.id || rule.toEntity === entity.id)
  const isCross = CROSS_CUTTING.some((item) => item.id === entity.id)
  const ctx = learningContext(entity.id)
  const { label: categoryLabel, tone: categoryTone } = categoryMeta(entityCategory(entity))
  const hasRulesTab = entity.prerequisiteIds.length > 0 || relevantRules.length > 0

  const headerBlock = (
    <header className="flex items-start gap-3">
      <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl border shadow-sm', toneIconBox[tone])}>
        <Icon className={cn('size-5', toneIcon[tone])} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h2 className="text-xl font-bold tracking-tight text-foreground">{entity.name}</h2>
          <Badge variant="secondary" appearance="outline" size="sm" className={cn(toneCard[categoryTone], toneText[categoryTone])}>
            {categoryLabel}
          </Badge>
          {!isCross && (
            <Badge variant="secondary" appearance="outline" size="xs" className={cn(toneCard[tone], toneText[tone])}>
              L{entity.level}
            </Badge>
          )}
        </div>
        {entity.aliases.length > 0 && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Also known in the field as: {entity.aliases.slice(0, 3).join(', ')}
          </p>
        )}
      </div>
    </header>
  )

  const definitionBlock = (
    <>
      <DetailSection title="What is this concept?" hint="One-sentence definition — use this in meetings." tone={tone}>
        <p className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm leading-6 text-foreground/90">
          {entity.definition}
        </p>
      </DetailSection>

      <DetailSection title="What does it mean in the field?" hint="What role does it play in courier operations?" tone="blue">
        <div className="flex gap-2.5 rounded-lg border border-blue-200/70 bg-blue-50/50 px-3 py-2.5 dark:border-blue-900/50 dark:bg-blue-950/20">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-sm leading-6 text-foreground/90">{entity.businessContext}</p>
        </div>
      </DetailSection>

      <DetailSection title="Common misconceptions" hint="Keep these in mind to avoid misunderstandings." tone="amber">
        <ul className="space-y-2">
          {entity.antiPatterns.slice(0, 3).map((item) => (
            <li key={item} className="flex gap-2 rounded-lg border border-amber-200/70 bg-amber-50/50 px-3 py-2 text-sm leading-6 text-foreground/85 dark:border-amber-900/50 dark:bg-amber-950/20">
              <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <span>{item.replace(/^[^\p{L}\p{N}]+/u, '').trim()}</span>
            </li>
          ))}
        </ul>
      </DetailSection>
    </>
  )

  const structureBlock = (
    <>
      <DetailSection title="Position in the chain" hint="How does it connect to parent and child concepts?" tone="teal">
        <ChainBreadcrumb entity={entity} />
        <dl className="mt-2 grid gap-2 rounded-lg border border-teal-200/60 bg-teal-50/40 p-3 text-sm dark:border-teal-900/50 dark:bg-teal-950/20 sm:grid-cols-1">
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Parent concept</dt>
            <dd className="mt-0.5 font-semibold">{parent?.name ?? 'Root — no parent'}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Child concepts</dt>
            <dd className="mt-0.5 font-semibold">
              {children.length > 0 ? children.map((child) => child.name).join(', ') : 'Leaf — no children'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Relationship type</dt>
            <dd className="mt-0.5 font-semibold">{entity.cardinalityDesc}</dd>
          </div>
        </dl>
        {related.length > 0 && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Horizontal link: {related.map((relation) => relation.description).join(' ')}
          </p>
        )}
      </DetailSection>
    </>
  )

  const statusesBlock = (
    <DetailSection title="Possible states" hint="These are system enum values — use them as code, not display labels." tone="purple">
      <div className="grid gap-2 sm:grid-cols-2">
        {entity.statuses.map((status) => (
          <div
            key={status.code}
            className={cn('rounded-lg border px-2.5 py-2', STATUS_CHIP[status.color] ?? STATUS_CHIP.gray)}
          >
            <div className="flex items-center justify-between gap-2">
              <code className="text-xs font-bold">{status.code}</code>
              {status.isTerminal && (
                <span className="text-[9px] font-bold uppercase tracking-wide opacity-70">Terminal</span>
              )}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed opacity-90">{status.description}</p>
          </div>
        ))}
      </div>
    </DetailSection>
  )

  const rulesBlock = (
    <>
      {entity.prerequisiteIds.length > 0 && (
        <DetailSection title="Prerequisites" hint="What you need to know before moving on to this concept." tone="indigo">
          <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
            Without understanding the concepts below, it is difficult to fully grasp the context of {entity.name}. Review them first.
          </p>
          <div className="flex flex-wrap gap-2">
            {entity.prerequisiteIds.map((id) => (
              <EntityNavChip key={id} entityId={id} onNavigate={onNavigate} />
            ))}
          </div>
        </DetailSection>
      )}

      {relevantRules.length > 0 && (
        <DetailSection title="Automatic rules" hint="What does the system do when a state changes?" tone="green">
          <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
            These rules run in the background without requiring courier action — critical for understanding status propagation.
          </p>
          <ul className="space-y-2">
            {relevantRules.map((rule) => (
              <li key={rule.id} className="flex gap-2 rounded-lg border border-green-200/70 bg-green-50/40 px-3 py-2 text-sm leading-6 dark:border-green-900/50 dark:bg-green-950/20">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
                <span>{rule.description}</span>
              </li>
            ))}
          </ul>
        </DetailSection>
      )}

      {!hasRulesTab && (
        <p className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
          No specific prerequisites or propagation rules are defined for this concept.
        </p>
      )}
    </>
  )

  const continueBlock = (
    <>
      {ctx?.next && (
        <div className={cn('rounded-xl border p-3', toneCard.teal)}>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Next concept</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            The next step in the learning path — continue to complete the context.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-foreground">{entityById(ctx.next.entityId)?.name ?? ctx.next.entityId}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{ctx.next.hint}</p>
            </div>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate(ctx.next!.entityId)}
                className="inline-flex items-center gap-1 rounded-lg border border-teal-300/70 bg-background px-3 py-1.5 text-xs font-semibold text-teal-700 shadow-sm hover:bg-teal-50 dark:border-teal-800 dark:text-teal-300 dark:hover:bg-teal-950/30"
              >
                Continue
                <ChevronRight className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {!ctx?.next && (
        <p className="rounded-lg border border-teal-200/60 bg-teal-50/40 px-3 py-3 text-xs leading-relaxed text-foreground/85 dark:border-teal-900/50 dark:bg-teal-950/20">
          This concept is one of the final steps in the learning path — or it operates in a cross-cutting context. If you have completed the main chain, explore the other cross-cutting concepts.
        </p>
      )}

      <DetailSection title="Developer note" hint="Code equivalent — for the curious." tone="gray">
        <button
          type="button"
          onClick={() => setTechnicalOpen((open) => !open)}
          className="flex w-full items-center justify-between rounded-lg border border-border/70 bg-muted/25 px-3 py-2.5 text-left text-sm font-semibold hover:bg-muted/40"
          aria-expanded={technicalOpen}
        >
          <span className="flex items-center gap-2 text-muted-foreground">
            <Code2 className="size-4" />
            Technical details {technicalOpen ? 'hide' : 'show'}
          </span>
          <ChevronDown className={cn('size-4 transition-transform', technicalOpen && 'rotate-180')} />
        </button>
        {technicalOpen && technical && (
          <dl className="mt-2 grid gap-x-5 gap-y-3 rounded-lg bg-slate-950 p-4 font-mono text-xs text-slate-300 sm:grid-cols-2">
            <div><dt className="text-slate-500">Model</dt><dd className="mt-0.5 text-slate-100">{technical.model}</dd></div>
            <div><dt className="text-slate-500">Database</dt><dd className="mt-0.5 text-slate-100">{technical.database}</dd></div>
            <div><dt className="text-slate-500">ViewModel</dt><dd className="mt-0.5 text-slate-100">{technical.viewModel}</dd></div>
            <div><dt className="text-slate-500">API</dt><dd className="mt-0.5 text-slate-100">{technical.api}</dd></div>
          </dl>
        )}
        {technicalOpen && (
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{entity.technicalContext}</p>
        )}
      </DetailSection>
    </>
  )

  const stackedContent = (
    <div className="space-y-4">
      {definitionBlock}
      {structureBlock}
      {statusesBlock}
      {rulesBlock}
      {continueBlock}
    </div>
  )

  return (
    <article className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div aria-hidden className={cn('pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent opacity-70', toneHero[tone])} />
      <span aria-hidden className={cn('pointer-events-none absolute inset-x-0 top-0 h-0.5', toneDot[tone])} />

      <div className="relative space-y-4">
        <LearningPathBanner entity={entity} />
        {headerBlock}
        {stackedContent}
      </div>
    </article>
  )
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-indigo-300/60 bg-gradient-to-br from-indigo-50/60 via-background to-violet-50/40 px-6 py-14 text-center dark:border-indigo-800 dark:from-indigo-950/30 dark:to-violet-950/20">
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-950/50">
        <Search className="size-7 text-indigo-600 dark:text-indigo-400" />
      </span>
      <p className="mt-4 text-sm font-bold text-foreground">No matches found for "{query}"</p>
      <p className="mt-1 text-xs text-muted-foreground">Try a different keyword or filter.</p>
    </div>
  )
}

function DictionaryView({ query }: { query: string }) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [detailId, setDetailId] = useState<string | null>(null)

  const filtered = useMemo(() => entities.filter((entity) => {
    const category = entityCategory(entity)
    const categoryMatches = categoryFilter === 'all' || category === categoryFilter
    return categoryMatches && entityMatches(entity, query)
  }), [categoryFilter, query])

  const detailEntity = entityById(detailId)

  return (
    <section aria-labelledby="dictionary-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="dictionary-title" className="flex items-center gap-1.5 text-sm font-bold">
          <BookOpen className="size-4 text-indigo-600 dark:text-indigo-400" />
          All concepts
          <span className="text-xs font-medium text-muted-foreground">({filtered.length})</span>
        </h2>
      </div>

      <div className="rounded-lg border border-indigo-200/50 bg-gradient-to-r from-indigo-50/30 via-background to-violet-50/20 p-2 dark:border-indigo-900/40 dark:from-indigo-950/15 dark:to-violet-950/10">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('mr-1 text-[11px] font-bold uppercase tracking-wider', toneText.indigo)}>Category</span>
          <FilterButton active={categoryFilter === 'all'} tone="indigo" onClick={() => setCategoryFilter('all')}>All</FilterButton>
          {ENTITY_CATEGORIES.map(({ id, label }) => (
            <FilterButton key={id} active={categoryFilter === id} tone={CATEGORY_TONE[id]} onClick={() => setCategoryFilter(id)}>
              {label}
            </FilterButton>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState query={query || 'selected filters'} />
      ) : (
        <EntityDictionaryTable entities={filtered} onRowClick={setDetailId} />
      )}

      <EntityDetailDialog
        entity={detailEntity ?? null}
        open={detailId !== null}
        onOpenChange={(open) => !open && setDetailId(null)}
        onNavigate={setDetailId}
      />
    </section>
  )
}

function HierarchyNode({ entity, selectedId, onSelect }: { entity: DomainEntity; selectedId: string; onSelect: (id: string) => void }) {
  const Icon = ICONS[entity.icon] ?? Package
  const tone = entityTone(entity)
  const { label: categoryLabel, tone: categoryTone } = categoryMeta(entityCategory(entity))
  const selectedIndex = CHAIN.findIndex((item) => item.id === selectedId)
  const index = CHAIN.findIndex((item) => item.id === entity.id)
  const distance = selectedIndex < 0 ? 0 : Math.abs(selectedIndex - index)
  const isSelected = selectedId === entity.id
  const relation = relationFor(entity)
  return (
    <button
      type="button"
      onClick={() => onSelect(entity.id)}
      className={cn(
        'w-full rounded-lg border p-2.5 text-left transition-all hover:shadow-md lg:min-h-28',
        entitySurface(entity),
        isSelected && cn('shadow-lg ring-2 ring-offset-2 ring-offset-background', TONE_RING[tone]),
        selectedIndex >= 0 && distance > 1 && 'opacity-45',
      )}
    >
      <span className={cn('text-[10px] font-bold uppercase tracking-widest', toneText[tone])}>L{entity.level}</span>
      <span className={cn('mt-3 flex size-9 items-center justify-center rounded-xl border shadow-sm', toneIconBox[tone])}>
        <Icon className={cn('size-4', toneIcon[tone])} />
      </span>
      <span className="mt-2 block text-sm font-bold">{entity.name}</span>
      <span className={cn('block text-xs font-medium', toneText[categoryTone])}>{categoryLabel}</span>
      <span className="mt-2 block text-[11px] leading-4 text-muted-foreground line-clamp-2">{relation?.description ?? entity.definition}</span>
    </button>
  )
}

function HierarchyConnector({ highlighted }: { highlighted: boolean }) {
  return (
    <div className={cn('flex shrink-0 items-center justify-center transition-colors', highlighted ? 'text-teal-600 dark:text-teal-400' : 'text-muted-foreground/50')}>
      <div className="hidden flex-col items-center lg:flex">
        <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold font-mono', highlighted ? 'bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300' : 'bg-muted text-muted-foreground')}>1:N</span>
        <ChevronRight className={cn('size-4', highlighted && 'animate-pulse')} />
      </div>
      <div className="flex items-center gap-2 py-1 lg:hidden">
        <ArrowDown className={cn('size-4', highlighted && 'text-teal-600')} />
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono">1:N</span>
      </div>
    </div>
  )
}

function HierarchyView({ query, selectedId, onSelect }: { query: string; selectedId: string; onSelect: (id: string) => void }) {
  const selected = entityById(selectedId) ?? CHAIN[0]!
  const selectedIndex = CHAIN.findIndex((entity) => entity.id === selected.id)
  const visibleChain = query ? CHAIN.filter((entity) => entityMatches(entity, query)) : CHAIN

  return (
    <section aria-labelledby="hierarchy-title" className="space-y-3">
      <h2 id="hierarchy-title" className="flex items-center gap-1.5 text-sm font-bold">
        <GitBranch className="size-4 text-teal-600 dark:text-teal-400" />
        Entity chain
      </h2>
      {visibleChain.length === 0 ? <EmptyState query={query} /> : (
        <>
          <div className="rounded-xl border border-teal-200/60 bg-gradient-to-br from-teal-50/50 via-background to-indigo-50/30 p-3 shadow-sm dark:border-teal-900/50 dark:from-teal-950/20 dark:to-indigo-950/15 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className={cn('text-xs font-bold uppercase tracking-wider', toneText.teal)}>Main chain</p>
              <p className="hidden rounded-full border border-teal-200/70 bg-teal-50/60 px-2.5 py-1 text-xs font-medium text-teal-800 dark:border-teal-900/50 dark:bg-teal-950/30 dark:text-teal-300 sm:block">
                {entityById('schedule')?.name} → {entityById('shipment-item')?.name}
              </p>
            </div>
            <div className="flex flex-col lg:grid lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-center lg:gap-1.5">
              {CHAIN.map((entity, index) => (
                <Fragment key={entity.id}>
                  {index > 0 && <HierarchyConnector highlighted={selectedIndex >= 0 && (index === selectedIndex || index - 1 === selectedIndex)} />}
                  <HierarchyNode entity={entity} selectedId={selected.id} onSelect={onSelect} />
                </Fragment>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-amber-300/60 bg-gradient-to-br from-amber-50/40 via-background to-green-50/30 p-4 dark:border-amber-800/50 dark:from-amber-950/20 dark:to-green-950/15 sm:p-5">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <ArrowLeftRight className="size-4 text-amber-600" />
              Cross-cutting entities
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">Entities such as collections and smart lockers intersect the main chain horizontally during operations.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {CROSS_CUTTING.map((entity) => {
                const rel = relations.find((relation) => relation.from === entity.id || relation.to === entity.id)
                const peer = entityById(rel?.from === entity.id ? rel.to : rel?.from ?? null)
                const tone = entityTone(entity)
                return (
                  <button
                    key={entity.id}
                    type="button"
                    onClick={() => onSelect(entity.id)}
                    className={cn('rounded-xl border p-4 text-left transition-all hover:shadow-md', entitySurface(entity), selected.id === entity.id && cn('shadow-lg ring-2', TONE_RING[tone]))}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <ArrowLeftRight className={cn('size-4', toneIcon[tone])} />
                      {entity.name} <span className="text-muted-foreground">— {peer?.name}</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{rel?.description}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <EntityDetailPanel key={`hierarchy-${selected.id}`} entity={selected} />
        </>
      )}
    </section>
  )
}

function ruleEntities(rule: PropagationRule) {
  const from = entityById(rule.fromEntity)
  const to = entityById(rule.toEntity)
  const source = rule.id === 'prop-up-completed' || rule.id === 'prop-cancel' ? `All ${from?.name ?? rule.fromEntity}s` : from?.name ?? rule.fromEntity
  const trigger = rule.id === 'prop-up-completed' ? 'Final state' : rule.id === 'prop-up-progress' ? 'IN_PROGRESS' : rule.id === 'prop-down-delivered' ? 'DELIVERED' : rule.id === 'prop-down-failed' ? 'FAILED' : rule.id === 'prop-cancel' ? 'CANCELLED' : 'PENDING'
  const affected = rule.id.startsWith('prop-up') ? 'Stop, Route, Schedule' : rule.id === 'prop-down-delivered' || rule.id === 'prop-down-failed' ? 'Shipment, ShipmentItem' : to?.name ?? rule.toEntity
  const result = rule.id === 'prop-up-completed' ? 'COMPLETED' : rule.id === 'prop-up-progress' ? 'IN_PROGRESS' : rule.id === 'prop-down-delivered' ? 'DELIVERED' : rule.id === 'prop-down-failed' ? 'FAILED' : rule.id === 'prop-cancel' ? 'CANCELLED' : 'DELIVERED blocked'
  return { source, trigger, affected, result }
}

function RuleFlow({ rule }: { rule: PropagationRule }) {
  const ids = rule.direction === 'up'
    ? CHAIN.slice(CHAIN.findIndex((entity) => entity.id === rule.toEntity), CHAIN.findIndex((entity) => entity.id === rule.fromEntity) + 1).reverse()
    : rule.direction === 'down'
      ? CHAIN.slice(CHAIN.findIndex((entity) => entity.id === rule.fromEntity), CHAIN.findIndex((entity) => entity.id === rule.toEntity) + 1)
      : [entityById(rule.fromEntity), entityById(rule.toEntity)].filter(Boolean) as DomainEntity[]
  const meta = directionMeta(rule.direction)
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {ids.map((entity, index) => {
        const tone = entityTone(entity)
        return (
          <Fragment key={entity.id}>
            {index > 0 && <meta.icon className={cn('size-4', toneIcon[tone])} />}
            <span className={cn('rounded-lg border px-3 py-2 text-xs shadow-sm', toneCard[tone])}>
              <strong className={toneText[tone]}>{entity.name}</strong>
              <span className="ml-1 text-muted-foreground">{ruleEntities(rule).result}</span>
            </span>
          </Fragment>
        )
      })}
    </div>
  )
}

function RuleDetail({ rule }: { rule: PropagationRule }) {
  const detailBg =
    rule.direction === 'up'
      ? 'border-t border-emerald-200/60 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20'
      : rule.direction === 'down'
        ? 'border-t border-rose-200/60 bg-rose-50/40 dark:border-rose-900/50 dark:bg-rose-950/20'
        : 'border-t border-amber-200/60 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20'
  return (
    <div className={cn('p-4 sm:p-5', detailBg)}>
      <h3 className="text-sm font-bold">{rule.title.replace(/\s*\([^)]*\)$/, '')}</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/85">{rule.description}</p>
      <p className="mt-2 text-xs text-muted-foreground">This operation occurs automatically without requiring user action.</p>
      <RuleFlow rule={rule} />
    </div>
  )
}

function StateRulesView({ query }: { query: string }) {
  const [direction, setDirection] = useState<DirectionFilter>('all')
  const [openId, setOpenId] = useState<string | null>(propagationRules[1]?.id ?? null)
  const filtered = propagationRules.filter((rule) => {
    const normalizedDirection = rule.direction === 'up' ? 'up' : rule.direction === 'down' ? 'down' : 'horizontal'
    return (direction === 'all' || direction === normalizedDirection) && ruleMatches(rule, query)
  })

  return (
    <section aria-labelledby="rules-title" className="space-y-3">
      <h2 id="rules-title" className="flex items-center gap-1.5 text-sm font-bold">
        <ArrowLeftRight className="size-4 text-amber-600 dark:text-amber-400" />
        Status propagation
      </h2>
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-amber-200/50 bg-gradient-to-r from-amber-50/40 via-background to-emerald-50/30 p-2 dark:border-amber-900/40 dark:from-amber-950/15 dark:to-emerald-950/10">
        <FilterButton active={direction === 'all'} tone="amber" onClick={() => setDirection('all')}>All</FilterButton>
        <FilterButton active={direction === 'up'} tone="green" onClick={() => setDirection('up')}>↑ Upward</FilterButton>
        <FilterButton active={direction === 'down'} tone="red" onClick={() => setDirection('down')}>↓ Downward</FilterButton>
        <FilterButton active={direction === 'horizontal'} tone="purple" onClick={() => setDirection('horizontal')}>↔ Horizontal</FilterButton>
      </div>
      {filtered.length === 0 ? <EmptyState query={query || 'selected direction'} /> : (
        <div className="overflow-hidden rounded-2xl border border-amber-200/50 bg-card shadow-md dark:border-amber-900/40">
          <table className="hidden w-full table-fixed text-left text-sm md:table">
            <thead className="border-b border-amber-200/50 bg-gradient-to-r from-amber-50/70 via-orange-50/40 to-emerald-50/50 text-[11px] uppercase tracking-wide dark:border-amber-900/40 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-emerald-950/20">
              <tr>
                <th className="w-[19%] px-4 py-3 font-bold text-amber-900/80 dark:text-amber-200">Source entity</th>
                <th className="w-[18%] px-4 py-3 font-bold text-amber-900/80 dark:text-amber-200">Trigger state</th>
                <th className="w-[13%] px-4 py-3 font-bold text-amber-900/80 dark:text-amber-200">Direction</th>
                <th className="w-[27%] px-4 py-3 font-bold text-amber-900/80 dark:text-amber-200">Affected entity</th>
                <th className="px-4 py-3 font-bold text-amber-900/80 dark:text-amber-200">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map((rule) => {
                const cells = ruleEntities(rule)
                const meta = directionMeta(rule.direction)
                const Icon = meta.icon
                const open = openId === rule.id
                return (
                  <Fragment key={rule.id}>
                    <tr onClick={() => setOpenId(open ? null : rule.id)} className={cn('cursor-pointer transition-colors hover:bg-amber-50/30 dark:hover:bg-amber-950/15', open && 'bg-amber-50/40 dark:bg-amber-950/20')}>
                      <td className="px-4 py-3 font-semibold">{cells.source}</td>
                      <td className="px-4 py-3"><code className="rounded-md border border-blue-200/70 bg-blue-50/60 px-1.5 py-0.5 text-xs font-bold text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">{cells.trigger}</code></td>
                      <td className="px-4 py-3"><span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold', meta.className)}><Icon className="size-3" />{meta.label}</span></td>
                      <td className="px-4 py-3 text-muted-foreground">{cells.affected}</td>
                      <td className="px-4 py-3"><span className="flex items-center justify-between gap-2"><code className="rounded-md border border-green-200/70 bg-green-50/60 px-1.5 py-0.5 text-xs font-bold text-green-800 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300">{cells.result}</code><ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} /></span></td>
                    </tr>
                    {open && <tr><td colSpan={5} className="p-0"><RuleDetail rule={rule} /></td></tr>}
                  </Fragment>
                )
              })}
            </tbody>
          </table>

          <div className="divide-y md:hidden">
            {filtered.map((rule) => {
              const cells = ruleEntities(rule)
              const meta = directionMeta(rule.direction)
              const Icon = meta.icon
              const open = openId === rule.id
              return (
                <div key={rule.id}>
                  <button type="button" onClick={() => setOpenId(open ? null : rule.id)} className="w-full p-4 text-left">
                    <div className="flex items-center justify-between gap-3"><strong className="text-sm">{cells.source} → {cells.trigger}</strong><ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} /></div>
                    <span className={cn('mt-3 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium', meta.className)}><Icon className="size-3" />{meta.label} propagation</span>
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-muted-foreground">Affected</dt><dd className="mt-0.5 font-medium">{cells.affected}</dd></div><div><dt className="text-muted-foreground">Result</dt><dd className="mt-0.5 font-mono font-medium">{cells.result}</dd></div></dl>
                  </button>
                  {open && <RuleDetail rule={rule} />}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

function DomainGlossaryContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedView = searchParams.get('view')
  const initialView: GlossaryView = requestedView === 'hierarchy' || requestedView === 'rules' ? requestedView : 'dictionary'
  const [view, setView] = useState<GlossaryView>(initialView)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('schedule')

  useEffect(() => {
    const next = searchParams.get('view')
    setView(next === 'hierarchy' || next === 'rules' ? next : 'dictionary')
  }, [searchParams])

  const changeView = useCallback((nextView: GlossaryView) => {
    setView(nextView)
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', nextView)
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  return (
    <ProductPage path="/product/domain-glossary">
      <GlossaryChrome query={query} onQueryChange={setQuery} view={view} onViewChange={changeView} />
      <main className="pt-3">
        {view === 'dictionary' && <DictionaryView query={query} />}
        {view === 'hierarchy' && <HierarchyView query={query} selectedId={selectedId} onSelect={setSelectedId} />}
        {view === 'rules' && <StateRulesView query={query} />}
      </main>
    </ProductPage>
  )
}

export default function DomainGlossaryPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] animate-pulse rounded-2xl bg-muted/30" />}>
      <DomainGlossaryContent />
    </Suspense>
  )
}
