'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Search, X } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { Input, InputWrapper } from '@nesy/metronic/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nesy/metronic/components/ui/select'
import { toneCard, toneDot, toneText, type Tone } from '@/components/product'
import type { Filters, Severity, Status, Ticket } from '@/data/pm/types'

interface FiltersBarProps {
  tickets: Ticket[]
  filters: Filters
  search: string
  resultCount: number
  totalCount: number
  onSearchChange: (value: string) => void
  onToggleFilter: (key: keyof Filters, value: string) => void
  onSetFilter: (key: keyof Filters, value: string) => void
  onClear: () => void
}

const severities: { key: Severity; tone: Tone }[] = [
  { key: 'Critical', tone: 'red' },
  { key: 'High', tone: 'orange' },
  { key: 'Medium', tone: 'amber' },
  { key: 'Low', tone: 'green' },
]

const statuses: { key: Status; label: string; tone: Tone }[] = [
  { key: 'open', label: 'Açık', tone: 'red' },
  { key: 'closed', label: 'Kapalı', tone: 'green' },
]

const ALL_VALUE = '__all__'

function FilterSelect({
  label,
  value,
  options,
  onChange,
  active,
}: {
  label: string
  value: string | null
  options: string[]
  onChange: (value: string) => void
  active?: boolean
}) {
  return (
    <Select
      value={value ?? ALL_VALUE}
      onValueChange={(next) => onChange(next === ALL_VALUE ? '' : next)}
    >
      <SelectTrigger
        size="sm"
        aria-label={label}
        className={cn(
          'h-7 min-w-[7.5rem] max-w-[11rem] shrink-0 justify-start gap-0 rounded-none border-zinc-200/90 bg-background px-2 shadow-none',
          'hover:bg-zinc-50/80 dark:border-zinc-800/80 dark:hover:bg-muted/20',
          '[&_svg]:ms-auto [&_svg]:size-3.5 [&_svg]:opacity-40',
          '[&_svg]:transition-transform [&_svg]:duration-200 data-[state=open]:[&_svg]:rotate-180 data-[state=open]:[&_svg]:opacity-70',
          'focus-visible:border-zinc-300 focus-visible:ring-0 dark:focus-visible:border-zinc-700',
          'data-[state=open]:border-zinc-300 dark:data-[state=open]:border-zinc-700',
          active && 'border-nesy/40 bg-nesy-soft/15 text-foreground dark:bg-nesy-soft/10',
        )}
      >
        <span className="me-1 shrink-0 text-[10px] font-normal text-muted-foreground/80">{label}</span>
        <span className="me-1.5 shrink-0 text-[10px] text-muted-foreground/30" aria-hidden>
          /
        </span>
        <SelectValue
          placeholder="Tümü"
          className="min-w-0 truncate text-[11px] font-medium text-foreground"
        />
      </SelectTrigger>
      <SelectContent align="start" className="max-h-64 rounded-none border-zinc-200/90 shadow-none dark:border-zinc-800/80">
        <SelectItem value={ALL_VALUE} className="rounded-none text-[11px]">
          Tümü
        </SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option} className="rounded-none text-[11px]">
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function FiltersBar({
  tickets,
  filters,
  search,
  resultCount,
  totalCount,
  onSearchChange,
  onToggleFilter,
  onSetFilter,
  onClear,
}: FiltersBarProps) {
  const types = [...new Set(tickets.map((t) => t.type))].sort()
  const screens = [...new Set(tickets.map((t) => t.screen))].sort((a, b) => a.localeCompare(b, 'tr'))

  const activeChips: { key: keyof Filters | 'search'; label: string; clear: () => void }[] = []
  if (search) {
    activeChips.push({
      key: 'search',
      label: `“${search.length > 20 ? `${search.slice(0, 20)}…` : search}”`,
      clear: () => onSearchChange(''),
    })
  }
  if (filters.severity) {
    activeChips.push({
      key: 'severity',
      label: filters.severity,
      clear: () => onToggleFilter('severity', filters.severity!),
    })
  }
  if (filters.status) {
    activeChips.push({
      key: 'status',
      label: filters.status === 'open' ? 'Açık' : 'Kapalı',
      clear: () => onToggleFilter('status', filters.status!),
    })
  }
  if (filters.type) {
    activeChips.push({
      key: 'type',
      label: filters.type,
      clear: () => onToggleFilter('type', filters.type!),
    })
  }
  if (filters.screen) {
    activeChips.push({
      key: 'screen',
      label: filters.screen,
      clear: () => onToggleFilter('screen', filters.screen!),
    })
  }
  if (filters.group) {
    activeChips.push({
      key: 'group',
      label: filters.group,
      clear: () => onToggleFilter('group', filters.group!),
    })
  }

  const hasActive = activeChips.length > 0

  return (
    <motion.div
      layout
      className={cn(
        'border border-zinc-200/90 bg-card p-2.5 space-y-2 dark:border-zinc-800/80',
        hasActive && 'border-nesy/30 bg-nesy-soft/10 dark:bg-nesy-soft/5',
      )}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <InputWrapper
          variant="sm"
          className="min-w-[12rem] flex-1 basis-[14rem] rounded-none border-zinc-200/90 bg-background shadow-none dark:border-zinc-800/80"
        >
          <Search className="size-3.5" aria-hidden />
          <Input
            variant="sm"
            type="search"
            placeholder="Ara: başlık, ID, özet…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          {search ? (
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              onClick={() => onSearchChange('')}
              aria-label="Aramayı temizle"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </InputWrapper>

        <FilterSelect
          label="Tür"
          value={filters.type}
          options={types}
          active={Boolean(filters.type)}
          onChange={(v) => onSetFilter('type', v)}
        />

        <FilterSelect
          label="Ekran"
          value={filters.screen}
          options={screens}
          active={Boolean(filters.screen)}
          onChange={(v) => onSetFilter('screen', v)}
        />

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
            <strong className="text-foreground">{resultCount}</strong> / {totalCount}
          </span>
          {hasActive && (
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onClear}>
              Temizle
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {severities.map(({ key, tone }) => {
          const active = filters.severity === key
          return (
            <motion.button
              key={key}
              type="button"
              layout
              whileTap={{ scale: 0.94 }}
              onClick={() => onToggleFilter('severity', key)}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-none border px-2 text-[11px] font-semibold transition-colors',
                active
                  ? cn(toneCard[tone], toneText[tone], 'border-current/25')
                  : 'border-zinc-200/90 bg-background text-muted-foreground hover:border-zinc-300 hover:text-foreground dark:border-zinc-800/80',
              )}
            >
              <span className={cn('size-1.5 rounded-full', toneDot[tone])} />
              {key}
            </motion.button>
          )
        })}

        <span className="mx-0.5 h-4 w-px bg-zinc-200/90 dark:bg-zinc-800/80" aria-hidden />

        {statuses.map(({ key, label, tone }) => {
          const active = filters.status === key
          return (
            <motion.button
              key={key}
              type="button"
              layout
              whileTap={{ scale: 0.94 }}
              onClick={() => onToggleFilter('status', key)}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-none border px-2 text-[11px] font-semibold transition-colors',
                active
                  ? cn(toneCard[tone], toneText[tone], 'border-current/25')
                  : 'border-zinc-200/90 bg-background text-muted-foreground hover:border-zinc-300 hover:text-foreground dark:border-zinc-800/80',
              )}
            >
              <span className={cn('size-1.5 rounded-full', toneDot[tone])} />
              {label}
            </motion.button>
          )
        })}
      </div>

      <AnimatePresence>
        {hasActive && (
          <motion.div
            key="active-tags"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-wrap items-center gap-1.5 overflow-hidden"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Aktif
            </span>
            {activeChips.map((chip) => (
              <motion.button
                key={`${chip.key}-${chip.label}`}
                type="button"
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={chip.clear}
                className="inline-flex"
                title="Kaldır"
              >
                <Badge variant="secondary" size="sm" className="gap-1 pr-1 font-medium">
                  {chip.label}
                  <X className="size-3 opacity-60" />
                </Badge>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
