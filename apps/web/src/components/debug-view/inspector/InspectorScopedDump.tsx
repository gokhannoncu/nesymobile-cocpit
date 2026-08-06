'use client'

import { useState } from 'react'
import { Button } from '@nesy/metronic/components/ui/button'
import { Input } from '@nesy/metronic/components/ui/input'
import { Download, Search, FileJson } from 'lucide-react'

export function InspectorScopedDump() {
  const [scopeQuery, setScopeQuery] = useState('')
  const [isDumping, setIsDumping] = useState(false)

  const handleDump = () => {
    setIsDumping(true)
    setTimeout(() => setIsDumping(false), 1000)
  }

  return (
    <div className="flex flex-col gap-3 p-4 border rounded-lg bg-white">
      <h3 className="font-semibold text-sm flex items-center gap-2 border-b pb-2">
        <FileJson className="w-4 h-4" />
        Diagnostic Data
      </h3>
      
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-2 top-2.5 text-slate-400" />
          <Input 
            value={scopeQuery}
            onChange={(e) => setScopeQuery(e.target.value)}
            placeholder="Scope (e.g. xpath, id, text)" 
            className="pl-8 text-sm"
          />
        </div>
        <Button variant="secondary" onClick={handleDump} disabled={isDumping}>
          {isDumping ? 'Searching...' : 'Scoped Find'}
        </Button>
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t">
        <span className="text-xs text-slate-500 max-w-[200px]">
          Full dump requires explicit diagnostic capture to preserve bandwidth. Normal steps do not full-dump.
        </span>
        <Button variant="outline" size="sm" onClick={handleDump} disabled={isDumping}>
          <Download className="w-4 h-4 mr-2" />
          Full Dump
        </Button>
      </div>
    </div>
  )
}
