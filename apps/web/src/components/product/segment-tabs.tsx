'use client'

import { ReactNode } from 'react'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@nesy/metronic/components/ui/tabs'

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
 * - `button` / `line` / `default` — Metronic tab chrome
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
  appearance?: 'tabs' | 'segmented'
  className?: string
}) {
  const segmented = appearance === 'segmented'

  return (
    <Tabs
      defaultValue={value === undefined ? (defaultValue ?? items[0]?.value) : undefined}
      value={value}
      onValueChange={onValueChange}
      className={cn('w-full', className)}
    >
      {segmented ? (
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
