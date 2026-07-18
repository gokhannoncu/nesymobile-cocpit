'use client'

import {
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  Archive,
  Bell,
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

function DictionaryView() {
  const [detailId, setDetailId] = useState<string | null>(null)
  const detailEntity = entityById(detailId)

  return (
    <section aria-label="Domain glossary dictionary">
      <EntityDictionaryTable entities={entities} onRowClick={setDetailId} />
      <EntityDetailDialog
        entity={detailEntity ?? null}
        open={detailId !== null}
        onOpenChange={(open) => !open && setDetailId(null)}
        onNavigate={setDetailId}
      />
    </section>
  )
}

export default function DomainGlossaryPage() {
  return (
    <ProductPage path="/product/domain-glossary">
      <main>
        <DictionaryView />
      </main>
    </ProductPage>
  )
}
