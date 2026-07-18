'use client'

import { Fragment, useEffect, useState, type ReactNode } from 'react'
import {
  Archive,
  ArrowLeftRight,
  Bell,
  Box,
  Building,
  Building2,
  Calendar,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
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
import {
  filterEntities,
  resolveSelection,
  type CategoryFilter,
} from './domain-model-filters'
import { motion } from 'framer-motion'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
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
} from '@/data/product/domain-glossary'

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
  nesy: 'ring-nesy/70',
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

function relationshipRows(entity: DomainEntity) {
  const parent = entityById(entity.parentId)
  const children = entity.childIds.map((id) => entityById(id)).filter(Boolean) as DomainEntity[]
  const related = relations
    .filter((relation) => relation.from === entity.id || relation.to === entity.id)
    .filter((relation) => relation.from !== parent?.id && !children.some((child) => child.id === relation.to))
  return { parent, children, related }
}

function learningContext(entityId: string) {
  const index = learningPath.findIndex((item) => item.entityId === entityId)
  if (index < 0) return null
  const current = learningPath[index]!
  const previous = index > 0 ? learningPath[index - 1] : null
  const next = index < learningPath.length - 1 ? learningPath[index + 1] : null
  return { current, previous, next, index, total: learningPath.length }
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

function ChainNavRow({
  entity,
  selectedId,
  onSelect,
}: {
  entity: DomainEntity
  selectedId: string
  onSelect: (id: string) => void
}) {
  const Icon = ICONS[entity.icon] ?? Package
  const tone = entityTone(entity)
  const { label: categoryLabel, tone: categoryTone } = categoryMeta(entityCategory(entity))
  const isSelected = selectedId === entity.id
  const selectedIndex = CHAIN.findIndex((item) => item.id === selectedId)
  const index = CHAIN.findIndex((item) => item.id === entity.id)
  const distance = selectedIndex < 0 ? 0 : Math.abs(selectedIndex - index)

  return (
    <button
      type="button"
      onClick={() => onSelect(entity.id)}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors',
        isSelected
          ? cn('border-transparent shadow-sm ring-2 ring-offset-1 ring-offset-background', TONE_RING[tone], toneCard[tone])
          : 'border-border/60 bg-card hover:bg-muted/30',
        selectedIndex >= 0 && distance > 1 && !isSelected && 'opacity-50',
      )}
    >
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg border', toneIconBox[tone])}>
        <Icon className={cn('size-3.5', toneIcon[tone])} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-foreground">{entity.name}</span>
          <span className={cn('text-[10px] font-bold uppercase tracking-wide', toneText[tone])}>L{entity.level}</span>
        </span>
        <span className={cn('block truncate text-[11px]', toneText[categoryTone])}>{categoryLabel}</span>
      </span>
    </button>
  )
}

function CrossCuttingNavRow({
  entity,
  selectedId,
  onSelect,
}: {
  entity: DomainEntity
  selectedId: string
  onSelect: (id: string) => void
}) {
  const Icon = ICONS[entity.icon] ?? Package
  const tone = entityTone(entity)
  const rel = relations.find((relation) => relation.from === entity.id || relation.to === entity.id)
  const peer = entityById(rel?.from === entity.id ? rel.to : rel?.from ?? null)
  const isSelected = selectedId === entity.id

  return (
    <button
      type="button"
      onClick={() => onSelect(entity.id)}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors',
        isSelected
          ? cn('border-transparent shadow-sm ring-2', TONE_RING[tone], toneCard[tone])
          : 'border-border/60 bg-card hover:bg-muted/30',
      )}
    >
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg border', toneIconBox[tone])}>
        <Icon className={cn('size-3.5', toneIcon[tone])} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{entity.name}</span>
        {peer && (
          <span className="block truncate text-[11px] text-muted-foreground">— {peer.name}</span>
        )}
      </span>
    </button>
  )
}

function ChainPill({
  entity,
  selectedId,
  onSelect,
}: {
  entity: DomainEntity
  selectedId: string
  onSelect: (id: string) => void
}) {
  const tone = entityTone(entity)
  const isSelected = selectedId === entity.id
  return (
    <button
      type="button"
      onClick={() => onSelect(entity.id)}
      className={cn(
        'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold',
        isSelected ? cn(toneCard[tone], toneText[tone], 'ring-2', TONE_RING[tone]) : 'border-border/70 bg-card text-foreground',
      )}
    >
      {entity.name}
    </button>
  )
}

function emptyStateLabel(query: string, category: CategoryFilter) {
  if (query.trim()) return query
  if (category === 'all') return 'your filters'
  return ENTITY_CATEGORIES.find((item) => item.id === category)?.label ?? category
}

function DomainModelSplitView({
  query,
  category,
  selectedId,
  onSelect,
}: {
  query: string
  category: CategoryFilter
  selectedId: string
  onSelect: (id: string) => void
}) {
  const visibleChain = filterEntities(CHAIN, query, category, entityMatches, entityCategory)
  const visibleCrossCutting = filterEntities(CROSS_CUTTING, query, category, entityMatches, entityCategory)
  const selected = entityById(selectedId) ?? visibleChain[0] ?? visibleCrossCutting[0]
  const hasResults = visibleChain.length > 0 || visibleCrossCutting.length > 0

  if (!hasResults) return <EmptyState query={emptyStateLabel(query, category)} />

  const nav = (
    <div className="space-y-4">
      <div>
        <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <GitBranch className="size-3.5 text-teal-600 dark:text-teal-400" />
          Main chain
        </h2>
        <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
          {visibleChain.map((entity) => (
            <ChainPill key={entity.id} entity={entity} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
        <div className="hidden space-y-1.5 lg:block">
          {visibleChain.map((entity) => (
            <ChainNavRow key={entity.id} entity={entity} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card/50 p-3">
        <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <ArrowLeftRight className="size-3.5 text-amber-600" />
          Cross-cutting
          <span className="font-mono text-[10px] text-muted-foreground/80">({visibleCrossCutting.length})</span>
        </h2>
        {visibleCrossCutting.length === 0 ? (
          <p className="text-xs text-muted-foreground">No cross-cutting entities match the current filters.</p>
        ) : (
          <div className="space-y-1.5">
            {visibleCrossCutting.map((entity) => (
              <CrossCuttingNavRow key={entity.id} entity={entity} selectedId={selectedId} onSelect={onSelect} />
            ))}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] lg:items-start">
      <aside className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
        {nav}
      </aside>
      <div className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
        {selected && (
          <EntityDetailPanel key={`detail-${selected.id}`} entity={selected} onNavigate={onSelect} />
        )}
      </div>
    </div>
  )
}

function DomainModelChrome({
  query,
  onQueryChange,
  category,
  onCategoryChange,
}: {
  query: string
  onQueryChange: (query: string) => void
  category: CategoryFilter
  onCategoryChange: (category: CategoryFilter) => void
}) {
  const chainLevels = new Set(CHAIN.map((entity) => entity.level)).size

  return (
    <motion.section
      className={cn('sticky top-0 z-20 overflow-hidden rounded-xl border bg-gradient-to-br shadow-sm', toneHero.teal)}
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
            <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm', toneIconBox.teal)}>
              <Network className={cn('size-5', toneIcon.teal)} />
            </span>
            <div className="min-w-0">
              <p className={cn('text-[10px] font-bold uppercase tracking-[0.2em]', toneIcon.teal)}>Product backbone</p>
              <h1 className="mt-0.5 text-lg font-bold tracking-tight text-foreground sm:text-xl">Domain model</h1>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
                The main entity chain and cross-cutting concepts — how Schedule flows down to Shipment Item in Nesy Mobile.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { icon: GitBranch, label: `${chainLevels} levels`, tone: 'teal' as Tone },
              { icon: Package, label: `${CHAIN.length} chain entities`, tone: 'indigo' as Tone },
              { icon: ArrowLeftRight, label: `${CROSS_CUTTING.length} cross-cutting`, tone: 'amber' as Tone },
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

        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-teal-600 dark:text-teal-400" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Filter entities in the chain…"
            aria-label="Search domain model"
            className="h-9 rounded-lg border-teal-100/80 bg-teal-50/40 ps-9 pe-9 text-xs shadow-none focus-visible:ring-1 focus-visible:ring-teal-500/50 dark:border-teal-900/40 dark:bg-teal-950/25"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-teal-700 hover:bg-teal-100 dark:text-teal-400 dark:hover:bg-teal-950/50"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
          <button
            type="button"
            onClick={() => onCategoryChange('all')}
            className={cn(
              'rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors',
              category === 'all'
                ? cn(toneCard.teal, toneText.teal)
                : 'border-border/70 bg-background text-muted-foreground hover:bg-muted/40',
            )}
          >
            All
          </button>
          {ENTITY_CATEGORIES.map((item) => {
            const tone = CATEGORY_TONE[item.id]
            const active = category === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onCategoryChange(item.id)}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  active ? cn(toneCard[tone], toneText[tone]) : 'border-border/70 bg-background text-muted-foreground hover:bg-muted/40',
                )}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </div>
    </motion.section>
  )
}

export default function DomainModelPage() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [selectedId, setSelectedId] = useState('schedule')

  useEffect(() => {
    const chain = filterEntities(CHAIN, query, category, entityMatches, entityCategory)
    const cross = filterEntities(CROSS_CUTTING, query, category, entityMatches, entityCategory)
    const next = resolveSelection(selectedId, chain, cross)
    if (next && next !== selectedId) setSelectedId(next)
  }, [query, category, selectedId])

  return (
    <ProductPage path="/product/domain-model">
      <DomainModelChrome
        query={query}
        onQueryChange={setQuery}
        category={category}
        onCategoryChange={setCategory}
      />
      <main className="pt-3">
        <DomainModelSplitView
          query={query}
          category={category}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </main>
    </ProductPage>
  )
}
