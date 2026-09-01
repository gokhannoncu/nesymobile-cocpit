'use client'

import { ReactNode, useState } from 'react'
import { motion } from 'framer-motion'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@nesy/metronic/components/ui/tabs'

const PILL_SPRING = { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.85 }

export interface SegmentTabItem {
  value: string
  label: string
  icon?: LucideIcon
  /** Short helper under the label (segmented appearance). */
  description?: string
  /** Optional count/badge shown next to the label. */
  count?: number | string
  content: ReactNode
}

/**
 * Multi-segment navigation on a single page — equivalent of the Notion "tab pattern".
 * For user types, journey selector, thesis sections.
 *
 * - `tabs` — Metronic tab chrome (button / line / default)
 * - `pill` — rounded track with dark active capsule (icon optional, no descriptions)
 * - `toolbar` — compact underline tabs for dashboards (icon + label + count)
 * - `segmented` — equal-width view switcher with optional description + count
 */
export function SegmentTabs({
  items,
  defaultValue,
  value,
  onValueChange,
  variant = 'button',
  appearance = 'tabs',
  className,
}: {
  items: SegmentTabItem[]
  defaultValue?: string
  /** Controlled active tab (when set, pairs with onValueChange). */
  value?: string
  onValueChange?: (value: string) => void
  variant?: 'default' | 'button' | 'line'
  appearance?: 'tabs' | 'pill' | 'toolbar' | 'segmented'
  className?: string
}) {
  const segmented = appearance === 'segmented'
  const toolbar = appearance === 'toolbar'
  const pill = appearance === 'pill'
  const [internalValue, setInternalValue] = useState(defaultValue ?? items[0]?.value ?? '')
  const activeValue = value ?? internalValue

  const handleValueChange = (next: string) => {
    if (value === undefined) setInternalValue(next)
    onValueChange?.(next)
  }

  return (
    <Tabs
      value={activeValue}
      onValueChange={handleValueChange}
      className={cn('w-full', className)}
    >
      {pill ? (
        <div className="mb-4 overflow-x-auto pb-0.5">
          <TabsList
            variant="button"
            shape="pill"
            className="relative inline-flex h-auto min-w-min gap-1 rounded-full bg-slate-100/95 p-1.5 dark:bg-muted/60"
          >
            {items.map((item) => {
              const active = activeValue === item.value
              return (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className={cn(
                    'group relative z-10 shrink-0 gap-2 overflow-hidden rounded-full border-0 px-4 py-2 text-sm font-medium shadow-none',
                    'bg-transparent text-slate-600 hover:bg-transparent hover:text-slate-900',
                    'data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none',
                    'data-[state=active]:hover:bg-transparent data-[state=active]:hover:text-white',
                    'dark:text-muted-foreground dark:hover:text-foreground',
                    'dark:data-[state=active]:text-background',
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="segment-pill-indicator"
                      className="absolute inset-0 rounded-full bg-slate-900 dark:bg-foreground"
                      transition={PILL_SPRING}
                      aria-hidden
                    />
                  ) : null}
                  <span className="relative z-10 flex items-center gap-2">
                    {item.label}
                    {item.count != null ? (
                      <TabCountBadge count={item.count} />
                    ) : null}
                  </span>
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>
      ) : toolbar ? (
        <div className="mb-4 border-b border-border/80">
          <TabsList
            variant="line"
            size="sm"
            className="h-auto w-full justify-start gap-0 bg-transparent pb-px"
          >
            {items.map((item) => {
              const Icon = item.icon
              return (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className={cn(
                    'gap-1.5 rounded-none px-3 py-2.5 text-sm font-medium',
                    'text-muted-foreground hover:text-foreground',
                    'data-[state=active]:text-foreground',
                    '[&_svg]:opacity-60 [&[data-state=active]_svg]:opacity-100',
                    '[&[data-state=active]_svg]:text-foreground',
                    '[&[data-state=active]_span]:bg-foreground/10 [&[data-state=active]_span]:text-foreground',
                  )}
                >
                  {Icon ? <Icon className="size-4 shrink-0" /> : null}
                  {item.label}
                  {item.count != null ? (
                    <span
                      className={cn(
                        'ms-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5',
                        'text-[10px] font-semibold tabular-nums',
                        'bg-muted/80 text-muted-foreground',
                      )}
                    >
                      {item.count}
                    </span>
                  ) : null}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>
      ) : segmented ? (
        <TabsList
          variant="button"
          className={cn(
            'mb-5 grid h-auto w-full gap-1 rounded-xl border bg-muted/40 p-1',
            items.length === 2 && 'grid-cols-1 sm:grid-cols-2',
            items.length === 3 && 'grid-cols-1 sm:grid-cols-3',
            items.length === 4 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
            items.length > 4 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
          )}
        >
          {items.map((item) => {
            const Icon = item.icon
            return (
              <TabsTrigger
                key={item.value}
                value={item.value}
                className={cn(
                  'group h-auto min-h-0 flex-col items-start justify-start gap-1 rounded-lg px-3.5 py-3 text-left',
                  'border border-transparent bg-transparent shadow-none',
                  'text-muted-foreground hover:bg-background/70 hover:text-foreground',
                  'data-[state=active]:border-border data-[state=active]:bg-background',
                  'data-[state=active]:text-foreground data-[state=active]:shadow-sm',
                  '[&_svg]:text-muted-foreground [&:hover_svg]:text-foreground',
                  '[&[data-state=active]_svg]:text-primary',
                )}
              >
                <span className="flex w-full items-center gap-2">
                  {Icon && <Icon className="size-4 shrink-0" />}
                  <span className="truncate text-sm font-semibold">{item.label}</span>
                  {item.count != null && (
                    <span
                      className={cn(
                        'ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1.5',
                        'text-[11px] font-bold tabular-nums',
                        'bg-muted text-muted-foreground',
                        'group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary',
                      )}
                    >
                      {item.count}
                    </span>
                  )}
                </span>
                {item.description && (
                  <span className="w-full ps-6 text-[11px] font-normal leading-snug text-muted-foreground group-data-[state=active]:text-foreground/70">
                    {item.description}
                  </span>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>
      ) : (
        <TabsList variant={variant} className="mb-5 flex-wrap justify-start">
          {items.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.icon && <item.icon className="size-4" />}
              {item.label}
              {item.count != null && (
                <span className="ms-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-muted-foreground">
                  {item.count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      )}

      {items.map((item) => (
        <TabsContent key={item.value} value={item.value} className="mt-0 space-y-5">
          {item.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}

function TabCountBadge({ count }: { count: number | string }) {
  const label = typeof count === 'number' ? count.toLocaleString('en-US') : count
  return (
    <span
      aria-label={`${label} items`}
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5',
        'text-[10px] font-semibold leading-none tabular-nums',
        'bg-slate-900/8 text-slate-600 ring-1 ring-slate-900/10',
        'group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white group-data-[state=active]:ring-white/25',
        'dark:bg-foreground/10 dark:text-muted-foreground dark:ring-border/60',
        'dark:group-data-[state=active]:bg-background/20 dark:group-data-[state=active]:text-background dark:group-data-[state=active]:ring-background/30',
      )}
    >
      {label}
    </span>
  )
}
