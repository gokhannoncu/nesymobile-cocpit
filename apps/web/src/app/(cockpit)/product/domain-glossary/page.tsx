'use client'

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  Archive,
  Bell,
  BookOpen,
  Box,
  Building,
  Building2,
  Calendar,
  Car,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Container,
  DoorOpen,
  Euro,
  Globe,
  GraduationCap,
  Headphones,
  Info,
  Landmark,
  Layers,
  Lightbulb,
  MapPin,
  MapPinned,
  Monitor,
  Navigation,
  Package,
  PackageCheck,
  Receipt,
  Route,
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
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogOverlay, DialogPortal } from '@nesy/metronic/components/ui/dialog'
import {
  ProductPage,
  type Tone,
  toneCard,
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

const CHAIN = entities.filter((entity) => entity.parentId !== null || entity.childIds.length > 0)
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

function DialogSection({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-2.5">
      <div>
        <h3 className="text-xs font-semibold text-foreground">{title}</h3>
        {hint && <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
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
  const { label: categoryLabel } = categoryMeta(entityCategory(entity))
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
        <div className="relative shrink-0 border-b border-border/70 bg-card">
          <div className="px-5 py-4 sm:px-6 sm:py-5">
            {ctx && (
              <div className="mb-4">
                <div className="flex items-center justify-between gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <GraduationCap className="size-3" />
                    Öğrenme yolu
                  </span>
                  <span className="tabular-nums">Adım {ctx.current.step} / {ctx.total}</span>
                </div>
                <div
                  className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={ctx.current.step}
                  aria-valuemin={1}
                  aria-valuemax={ctx.total}
                  aria-label={`Öğrenme yolu ilerlemesi: adım ${ctx.current.step} / ${ctx.total}`}
                >
                  <div
                    className="h-full rounded-full bg-foreground/35 transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Domain kavramı
                </p>
                <div className="mt-2 flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-muted/40">
                    <Icon className="size-5 text-foreground/70" />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <h2 className="text-xl font-bold leading-tight tracking-tight text-foreground sm:text-[22px]">
                      {entity.name}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" appearance="outline" size="sm">
                        {categoryLabel}
                      </Badge>
                      {chainIndex >= 0 && (
                        <Badge variant="secondary" appearance="outline" size="xs">
                          Seviye {entity.level}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {aliases.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-medium text-muted-foreground">Ayrıca bilinen adlar</span>
                    {aliases.map((alias) => (
                      <span
                        key={alias}
                        className="rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-foreground/80"
                      >
                        {alias}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <DialogClose
                className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border/70 bg-background text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                aria-label="Kapat"
              >
                <X className="size-4" />
              </DialogClose>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="space-y-6 px-5 py-5 sm:px-6">
            {ctx && (
              <div className="rounded-lg border border-border/60 bg-muted/30 px-3.5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {ctx.current.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-foreground/90">{ctx.current.hint}</p>
              </div>
            )}

            <DialogSection title="Bu kavram nedir?" hint="Tek cümlelik tanım — toplantılarda bu dili kullanın.">
              <p className="text-sm leading-7 text-foreground/90">
                {entity.definition}
              </p>
            </DialogSection>

            <DialogSection title="Sahada ne anlama gelir?" hint="Kurye operasyonunda hangi rolü oynar?">
              <div className="flex gap-2.5">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p className="text-sm leading-7 text-foreground/90">{entity.businessContext}</p>
              </div>
            </DialogSection>

            {entity.antiPatterns.length > 0 && (
              <DialogSection title="Sık görülen yanlış anlamalar" hint="Karışıklığı önlemek için bunları aklınızda tutun.">
                <ul className="space-y-2.5">
                  {entity.antiPatterns.slice(0, 3).map((item) => (
                    <li
                      key={item}
                      className="flex gap-2.5 text-sm leading-6 text-foreground/85"
                    >
                      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span>{item.replace(/^[^\p{L}\p{N}]+/u, '').trim()}</span>
                    </li>
                  ))}
                </ul>
              </DialogSection>
            )}

            {(parent || children.length > 0) && onNavigate && (
              <DialogSection title="İlgili kavramlar" hint="Domain zincirindeki bağlı terimlere atlayın.">
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
              ile gezin
            </p>

            {ctx!.next ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => onNavigate!(ctx!.next!.entityId)}
                className="max-w-full gap-1.5 sm:max-w-[44%]"
              >
                Devam: {nextEntity?.name}
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

function ConceptRow({
  entity,
  tone,
  onClick,
}: {
  entity: DomainEntity
  tone: Tone
  onClick: () => void
}) {
  const Icon = ICONS[entity.icon] ?? Package

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/35 focus-visible:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30 sm:gap-4 sm:px-5"
    >
      <span className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border', toneIconBox[tone], toneCard[tone])}>
        <Icon className={cn('size-4', toneIcon[tone])} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{entity.name}</span>
          {entity.level === 0 && (
            <span className={cn('rounded border px-1.5 py-px text-[10px] font-medium', toneCard[tone], toneText[tone])}>
              Root
            </span>
          )}
        </span>
        <span className="mt-1 block text-[13px] leading-5 text-muted-foreground">
          {entity.definition}
        </span>
      </span>
      <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground" />
    </button>
  )
}

function CategoryGroupCard({
  id,
  label,
  tone,
  items,
  onRowClick,
}: {
  id: EntityCategory
  label: string
  tone: Tone
  items: DomainEntity[]
  onRowClick: (id: string) => void
}) {
  return (
    <section
      id={`glossary-${id}`}
      aria-labelledby={`glossary-heading-${id}`}
      className={cn('scroll-mt-28 overflow-hidden rounded-lg border bg-card', toneCard[tone])}
    >
      <div className={cn('flex items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-5', toneCard[tone])}>
        <div>
          <p className={cn('text-[10px] font-medium uppercase tracking-[0.16em]', toneText[tone])}>
            Kategori
          </p>
          <h2 id={`glossary-heading-${id}`} className="mt-0.5 text-base font-semibold text-foreground">
            {label}
          </h2>
        </div>
        <span className={cn('rounded-md border px-2 py-1 text-[11px] font-medium tabular-nums', toneCard[tone], toneText[tone])}>
          {items.length} kavram
        </span>
      </div>
      <ul className="divide-y divide-border/40 bg-card/80">
        {items.map((entity) => (
          <li key={entity.id}>
            <ConceptRow
              entity={entity}
              tone={entityTone(entity)}
              onClick={() => onRowClick(entity.id)}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

function GlossaryCatalog({
  entities: rows,
  onRowClick,
}: {
  entities: DomainEntity[]
  onRowClick: (id: string) => void
}) {
  const grouped = useMemo(
    () =>
      ENTITY_CATEGORIES
        .map((category) => ({
          ...category,
          items: rows.filter((entity) => entityCategory(entity) === category.id),
        }))
        .filter((group) => group.items.length > 0),
    [rows],
  )

  return (
    <div className="space-y-5">
      {grouped.map((group) => (
        <CategoryGroupCard
          key={group.id}
          id={group.id}
          label={group.label}
          tone={CATEGORY_TONE[group.id]}
          items={group.items}
          onRowClick={onRowClick}
        />
      ))}
    </div>
  )
}

function GlossaryHeaderBanner({
  onStartLearning,
}: {
  onStartLearning: () => void
}) {
  const stats = [
    { label: 'Kavram', value: entities.length },
    { label: 'Kategori', value: ENTITY_CATEGORIES.length },
    { label: 'Öğrenme adımı', value: learningPath.length },
  ]

  return (
    <header className={cn('relative overflow-hidden rounded-lg border bg-gradient-to-br p-5 sm:p-6', toneHero.indigo)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.28] dark:opacity-15 [background-image:radial-gradient(circle,currentColor_1px,transparent_1px)] [background-size:20px_20px] text-foreground/10"
      />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <div className="flex items-start gap-3.5">
            <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-lg border', toneIconBox.indigo, toneCard.indigo)}>
              <BookOpen className={cn('size-5', toneIcon.indigo)} />
            </span>
            <div className="min-w-0">
              <p className={cn('text-[11px] font-medium uppercase tracking-[0.18em]', toneText.indigo)}>
                Product Foundation
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-[28px]">
                Domain Glossary
              </h1>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-foreground/80 sm:text-[15px]">
            Kurye operasyonu için ortak dil — bir kavramı açıp tanımını, sahadaki anlamını
            ve teslimat zincirindeki yerini öğrenin.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={cn('inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium', toneCard.indigo, toneText.indigo)}>
              <Layers className="size-3" />
              Ubiquitous language
            </span>
            <span className={cn('inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium', toneCard.purple, toneText.purple)}>
              <GraduationCap className="size-3" />
              Rehberli öğrenme yolu
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end lg:flex-col lg:items-stretch">
          <dl className="grid grid-cols-3 gap-2.5 sm:min-w-[280px]">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className={cn('rounded-lg border px-3 py-2.5 text-center', toneCard.indigo)}
              >
                <dt className={cn('text-[10px] font-medium uppercase tracking-wide', toneText.indigo)}>
                  {stat.label}
                </dt>
                <dd className="mt-1 text-lg font-bold tabular-nums text-foreground">{stat.value}</dd>
              </div>
            ))}
          </dl>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onStartLearning}
            className="gap-1.5 self-start sm:self-auto"
          >
            Öğrenme yolunu başlat
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </header>
  )
}

function DictionaryView() {
  const [detailId, setDetailId] = useState<string | null>(null)
  const detailEntity = entityById(detailId)
  const firstLearningId = learningPath[0]?.entityId ?? entities[0]?.id ?? null

  return (
    <div className="space-y-6">
      <GlossaryHeaderBanner
        onStartLearning={() => {
          if (firstLearningId) setDetailId(firstLearningId)
        }}
      />
      <section aria-label="Kategoriye göre domain glossary">
        <GlossaryCatalog entities={entities} onRowClick={setDetailId} />
        <EntityDetailDialog
          entity={detailEntity ?? null}
          open={detailId !== null}
          onOpenChange={(open) => !open && setDetailId(null)}
          onNavigate={setDetailId}
        />
      </section>
    </div>
  )
}

export default function DomainGlossaryPage() {
  return (
    <ProductPage path="/product/domain-glossary" hideToolbar>
      <main>
        <DictionaryView />
      </main>
    </ProductPage>
  )
}
