'use client'

// Senaryo Havuzu — sol panel.
// Aranabilir, filtrelenebilir senaryo listesi. Kategori gruplaması
// ve hızlı-görünüm filtreleri ile birlikte gelir.

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Search, Star } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Input } from '@nesy/metronic/components/ui/input'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { ScrollArea } from '@nesy/metronic/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@nesy/metronic/components/ui/tooltip'
import { EASE } from '@/components/product'
import { RiskBadge, BuildCompatBadge } from '@/components/engineering/device-lab/device-lab-shared'
import {
  SCENARIO_PACKAGES,
  SCENARIO_CATEGORIES,
  QUICK_VIEW_FILTERS,
  filterScenarios,
} from '@/data/engineering/device-lab/adb-scenarios'
import type { ScenarioPackage, ScenarioCategory } from '@/data/engineering/device-lab/device-lab-types'

/* ─── Kategori renklerinin tonu ─── */
const CATEGORY_TONE: Record<ScenarioCategory, string> = {
  schedule: 'bg-blue-500',
  auth: 'bg-purple-500',
  'shared-prefs': 'bg-amber-500',
  'room-db': 'bg-teal-500',
  'offline-sync': 'bg-indigo-500',
  lifecycle: 'bg-green-500',
  permission: 'bg-orange-500',
  diagnostic: 'bg-red-500',
}

/* ─── Süre formatla ─── */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `~${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `~${m}m ${s}s` : `~${m}m`
}

/* ─── Bileşen Props ─── */
interface ScenarioPoolProps {
  selectedId: string | null
  onSelect: (scenario: ScenarioPackage) => void
}

export function ScenarioPool({ selectedId, onSelect }: ScenarioPoolProps) {
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState<ScenarioCategory | null>(null)

  // Filtrelenmiş senaryolar
  const filtered = useMemo(
    () => filterScenarios(search, activeFilter, selectedCategory),
    [search, activeFilter, selectedCategory],
  )

  return (
    <motion.section
      className="flex flex-col overflow-hidden rounded-xl border border-border bg-card"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      {/* ─── Header ─── */}
      <div className="space-y-2.5 border-b border-border p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">Scenario Pool</h2>
          <Badge variant="secondary" appearance="outline" size="xs" className="font-mono text-[10px]">
            {SCENARIO_PACKAGES.length} senaryo
          </Badge>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Senaryo ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* ─── Hızlı filtreler ─── */}
      <div className="flex flex-wrap gap-1 border-b border-border px-3 py-2">
        {QUICK_VIEW_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setActiveFilter(f.key)}
            className={cn(
              'rounded-full border px-2 py-0.5 text-[10.5px] font-medium transition-all',
              activeFilter === f.key
                ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
                : 'border-border bg-muted/40 text-muted-foreground hover:border-border hover:bg-muted/80 hover:text-foreground',
            )}
          >
            <span className="mr-0.5">{f.icon}</span> {f.label}
          </button>
        ))}
      </div>

      {/* ─── Kategori filtreleri ─── */}
      <div className="flex flex-wrap gap-1 border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={() => setSelectedCategory(null)}
          className={cn(
            'rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-all',
            !selectedCategory
              ? 'border-foreground/20 bg-foreground/5 text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Tümü
        </button>
        {SCENARIO_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
            className={cn(
              'flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-all',
              selectedCategory === cat.id
                ? 'border-foreground/20 bg-foreground/5 text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <span className={cn('inline-block size-1.5 rounded-full', CATEGORY_TONE[cat.id])} />
            {cat.label}
          </button>
        ))}
      </div>

      {/* ─── Senaryo listesi ─── */}
      <ScrollArea className="h-[520px]">
        <div className="divide-y divide-border/60">
          <AnimatePresence mode="popLayout">
            {filtered.length === 0 && (
              <motion.div
                className="flex flex-col items-center justify-center gap-2 py-16 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Search className="size-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Eşleşen senaryo bulunamadı</p>
              </motion.div>
            )}
            {filtered.map((scenario, i) => (
              <motion.button
                key={scenario.id}
                type="button"
                onClick={() => onSelect(scenario)}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25, delay: i * 0.02, ease: EASE }}
                className={cn(
                  'group relative flex w-full flex-col gap-1.5 border-l-[3px] px-3 py-2.5 text-left transition-colors',
                  selectedId === scenario.id
                    ? 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                    : 'border-l-transparent hover:bg-muted/50',
                )}
              >
                {/* Üst satır: isim + favori */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className={cn('mt-0.5 inline-block size-2 shrink-0 rounded-full', CATEGORY_TONE[scenario.category])} />
                    <span className="truncate text-[12.5px] font-semibold text-foreground">
                      {scenario.name}
                    </span>
                  </div>
                  {scenario.isFavorite && (
                    <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" />
                  )}
                </div>

                {/* Açıklama */}
                <p className="line-clamp-1 text-[11px] leading-relaxed text-muted-foreground">
                  {scenario.description}
                </p>

                {/* Alt satır: rozetler */}
                <div className="flex flex-wrap items-center gap-1">
                  <RiskBadge risk={scenario.riskLevel} size="xs" />
                  <BuildCompatBadge build={scenario.buildCompatibility} size="xs" />
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="secondary" appearance="outline" size="xs" className="gap-0.5 text-[9px]">
                          <Clock className="size-2.5" />
                          {formatDuration(scenario.estimatedDuration)}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        Tahmini süre: {formatDuration(scenario.estimatedDuration)}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {scenario.executionCount > 0 && (
                    <Badge variant="secondary" appearance="outline" size="xs" className="gap-0.5 text-[9px] text-muted-foreground">
                      {scenario.executionCount}x
                    </Badge>
                  )}
                </div>

                {/* Seçili göstergesi */}
                {selectedId === scenario.id && (
                  <motion.div
                    className="absolute inset-y-0 left-0 w-[3px] rounded-r bg-blue-500"
                    layoutId="scenario-indicator"
                    transition={{ duration: 0.25, ease: EASE }}
                  />
                )}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* ─── Footer ─── */}
      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <span className="text-[10.5px] text-muted-foreground">
          {filtered.length} / {SCENARIO_PACKAGES.length} senaryo gösteriliyor
        </span>
        {selectedCategory && (
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className="text-[10.5px] font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Filtreyi temizle
          </button>
        )}
      </div>
    </motion.section>
  )
}
