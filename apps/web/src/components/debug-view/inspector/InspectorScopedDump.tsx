'use client'

import { useState } from 'react'
import { Button } from '@nesy/metronic/components/ui/button'
import { Input } from '@nesy/metronic/components/ui/input'
import { Download, Search, FileJson } from 'lucide-react'

interface InspectorScopedDumpProps {
  /** ADB serial — required for real diagnostic capture. */
  serial?: string | null
}

/**
 * Explicit diagnostic capture only. Normal Inspector observe path never auto-dumps.
 */
export function InspectorScopedDump({ serial }: InspectorScopedDumpProps) {
  const [scopeQuery, setScopeQuery] = useState('')
  const [isDumping, setIsDumping] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runCapture = async (mode: 'scoped' | 'full') => {
    if (!serial) {
      setError('Select a device before diagnostic capture')
      return
    }
    setIsDumping(true)
    setError(null)
    setResult(null)
    try {
      // Explicit operator action → live screen diagnostic (not an automatic step dump).
      const response = await fetch(`/api/adb/screen?serial=${encodeURIComponent(serial)}`)
      const json = (await response.json()) as Record<string, unknown>
      if (!response.ok) {
        throw new Error(String(json.message ?? json.error ?? `HTTP ${response.status}`))
      }
      const payload =
        mode === 'scoped' && scopeQuery.trim()
          ? {
              mode: 'scoped',
              scope: scopeQuery.trim(),
              note: 'Scoped filter is client-side over the captured screen snapshot',
              match: JSON.stringify(json).includes(scopeQuery.trim()),
              snapshot: json,
            }
          : { mode: 'full', snapshot: json }
      setResult(JSON.stringify(payload, null, 2))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Diagnostic capture failed')
    } finally {
      setIsDumping(false)
    }
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
        <Button
          variant="secondary"
          onClick={() => void runCapture('scoped')}
          disabled={isDumping || !serial}
        >
          {isDumping ? 'Searching...' : 'Scoped Find'}
        </Button>
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t">
        <span className="text-xs text-slate-500 max-w-[200px]">
          Full dump requires explicit diagnostic capture to preserve bandwidth. Normal steps do
          not full-dump.
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void runCapture('full')}
          disabled={isDumping || !serial}
        >
          <Download className="w-4 h-4 mr-2" />
          Full Dump
        </Button>
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {result ? (
        <pre className="max-h-48 overflow-auto rounded border bg-slate-50 p-2 text-[10px] font-mono">
          {result}
        </pre>
      ) : null}
    </div>
  )
}
