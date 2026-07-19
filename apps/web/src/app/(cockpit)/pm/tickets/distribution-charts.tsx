'use client'

import { useMemo, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { barGradient, barTint, getBarColor } from '@/data/pm/ticket-chart-colors'
import type { FilterKey, Filters } from '@/data/pm/types'

interface DistributionChartsProps {
  typeEntries: [string, number][]
  screenEntries: [string, number][]
  total: number
  filters: Filters
  onToggleFilter: (key: FilterKey, value: string) => void
}

interface ChartDatum {
  name: string
  value: number
  pct: number
}

function toChartData(entries: [string, number][], total: number, maxItems?: number): ChartDatum[] {
  return entries.slice(0, maxItems ?? entries.length).map(([name, value]) => ({
    name,
    value,
    pct: total ? Math.round((value / total) * 100) : 0,
  }))
}

function shortLabel(name: string, max = 10): string {
  if (name.length <= max) return name
  return `${name.slice(0, max - 1)}…`
}

function DistributionChartCard({
  title,
  subtitle,
  entries,
  total,
  filterKey,
  filters,
  maxItems,
  onToggleFilter,
}: {
  title: string
  subtitle: string
  entries: [string, number][]
  total: number
  filterKey: FilterKey
  filters: Filters
  maxItems?: number
  onToggleFilter: (key: FilterKey, value: string) => void
}) {
  const data = useMemo(() => toChartData(entries, total, maxItems), [entries, total, maxItems])
  const activeFilter = filters[filterKey]
  const maxValue = data[0]?.value ?? 1
  const dense = data.length > 6

  return (
    <motion.div
      className={`chart-card${activeFilter ? ' chart-card-filtered' : ''}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="chart-card-head">
        <div>
          <h3>{title}</h3>
          <div className="chart-sub">{subtitle}</div>
        </div>
        {activeFilter && (
          <button
            type="button"
            className="chart-filter-badge"
            onClick={() => onToggleFilter(filterKey, activeFilter)}
            title="Filtreyi kaldır"
          >
            {activeFilter} ✕
          </button>
        )}
      </div>

      <div className={`chart-vplot${dense ? ' chart-vplot-dense' : ''}`}>
        <div className="chart-vcols" role="list">
          {data.map((item, index) => {
            const isActive = !activeFilter || item.name === activeFilter
            const isSelected = activeFilter === item.name
            const barHeight = Math.max(8, Math.round((item.value / maxValue) * 100))
            const color = getBarColor(item.name, index)
            const colStyle = {
              '--bar-from': color.from,
              '--bar-to': color.to,
              '--bar-tint': barTint(color, 0.14),
              '--bar-border': barTint(color, 0.38),
            } as CSSProperties

            return (
              <motion.button
                key={item.name}
                type="button"
                role="listitem"
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.28, delay: index * 0.025 }}
                className={`chart-vcol${isSelected ? ' selected' : ''}${!isActive ? ' muted' : ''}`}
                style={colStyle}
                onClick={() => onToggleFilter(filterKey, item.name)}
                title={`${item.name}: ${item.value} ticket (${item.pct}%)`}
              >
                <span className="chart-vcol-top">
                  <span className="chart-vcol-value">{item.value}</span>
                  <span className="chart-vcol-pct">{item.pct}%</span>
                </span>
                <span className="chart-vcol-track">
                  <span
                    className="chart-vcol-fill"
                    style={{ height: `${barHeight}%`, background: barGradient(color) }}
                    aria-hidden
                  />
                </span>
                <span className="chart-vcol-label" title={item.name}>
                  {shortLabel(item.name, dense ? 8 : 12)}
                </span>
              </motion.button>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}

export function DistributionCharts({
  typeEntries,
  screenEntries,
  total,
  filters,
  onToggleFilter,
}: DistributionChartsProps) {
  const topScreen = screenEntries[0]

  return (
    <div className="charts">
      <DistributionChartCard
        title="Tür Dağılımı"
        subtitle={`${typeEntries.length} tür`}
        entries={typeEntries}
        total={total}
        filterKey="type"
        filters={filters}
        onToggleFilter={onToggleFilter}
      />
      <DistributionChartCard
        title="Ekran Dağılımı"
        subtitle={
          topScreen
            ? `Top ${Math.min(10, screenEntries.length)} · ${topScreen[0]} (${topScreen[1]})`
            : `${screenEntries.length} ekran`
        }
        entries={screenEntries}
        total={total}
        filterKey="screen"
        filters={filters}
        maxItems={10}
        onToggleFilter={onToggleFilter}
      />
    </div>
  )
}
