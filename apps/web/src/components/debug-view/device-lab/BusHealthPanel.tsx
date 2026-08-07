'use client'

import type { ReactNode } from 'react'
import { Database, Server } from 'lucide-react'

export interface BusStats {
  lag: number
  cursorPosition: number
  deadLetterCount: number
  status?: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN'
  detail?: string
}

interface BusHealthPanelProps {
  receiptBus: BusStats
  orderedBus: BusStats
}

function BusCard({
  title,
  icon,
  stats,
}: {
  title: string
  icon: ReactNode
  stats: BusStats
}) {
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm flex flex-col gap-3">
      <h3 className="font-semibold text-sm flex items-center gap-2 border-b pb-2">
        {icon}
        {title}
        {stats.status ? (
          <span className="ml-auto text-[10px] font-mono text-muted-foreground">{stats.status}</span>
        ) : null}
      </h3>
      {stats.detail ? (
        <p className="text-[11px] text-muted-foreground">{stats.detail}</p>
      ) : null}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="text-slate-500">Lag</div>
        <div className="font-mono text-right">
          {stats.lag < 0 ? '—' : `${stats.lag} ms`}
        </div>
        <div className="text-slate-500">Cursor</div>
        <div className="font-mono text-right">{stats.cursorPosition}</div>
        <div className="text-slate-500">Dead Letters</div>
        <div
          className={`font-mono text-right ${
            stats.deadLetterCount > 0 ? 'text-red-500' : 'text-green-600'
          }`}
        >
          {stats.deadLetterCount}
        </div>
      </div>
    </div>
  )
}

export function BusHealthPanel({ receiptBus, orderedBus }: BusHealthPanelProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <BusCard
        title="Receipt Bus"
        icon={<Database className="w-4 h-4 text-blue-500" />}
        stats={receiptBus}
      />
      <BusCard
        title="Ordered Bus"
        icon={<Server className="w-4 h-4 text-indigo-500" />}
        stats={orderedBus}
      />
    </div>
  )
}
