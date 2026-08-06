'use client'

import { Database, Server } from 'lucide-react'

interface BusStats {
  lag: number
  cursorPosition: number
  deadLetterCount: number
}

interface BusHealthPanelProps {
  receiptBus: BusStats
  orderedBus: BusStats
}

export function BusHealthPanel({ receiptBus, orderedBus }: BusHealthPanelProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Receipt Bus */}
      <div className="border rounded-lg p-4 bg-white shadow-sm flex flex-col gap-3">
        <h3 className="font-semibold text-sm flex items-center gap-2 border-b pb-2">
          <Database className="w-4 h-4 text-blue-500" />
          Receipt Bus
        </h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-slate-500">Lag</div>
          <div className="font-mono text-right">{receiptBus.lag} ms</div>
          
          <div className="text-slate-500">Cursor</div>
          <div className="font-mono text-right">{receiptBus.cursorPosition}</div>
          
          <div className="text-slate-500">Dead Letters</div>
          <div className={`font-mono text-right ${receiptBus.deadLetterCount > 0 ? 'text-red-500' : 'text-green-600'}`}>
            {receiptBus.deadLetterCount}
          </div>
        </div>
      </div>

      {/* Ordered Bus */}
      <div className="border rounded-lg p-4 bg-white shadow-sm flex flex-col gap-3">
        <h3 className="font-semibold text-sm flex items-center gap-2 border-b pb-2">
          <Server className="w-4 h-4 text-indigo-500" />
          Ordered Bus
        </h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-slate-500">Lag</div>
          <div className="font-mono text-right">{orderedBus.lag} ms</div>
          
          <div className="text-slate-500">Cursor</div>
          <div className="font-mono text-right">{orderedBus.cursorPosition}</div>
          
          <div className="text-slate-500">Dead Letters</div>
          <div className={`font-mono text-right ${orderedBus.deadLetterCount > 0 ? 'text-red-500' : 'text-green-600'}`}>
            {orderedBus.deadLetterCount}
          </div>
        </div>
      </div>
    </div>
  )
}
