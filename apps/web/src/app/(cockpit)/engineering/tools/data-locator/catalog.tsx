'use client'

// All Data Sources — searchable catalog table + detail Sheet drawer.

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Input } from '@nesy/metronic/components/ui/input'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@nesy/metronic/components/ui/sheet'
import { toneText } from '@/components/product'
import { TRUTH_META, type DataSource } from '@/data/engineering/tools/data-locator'
import { SourceDetailBody, SourceDetailHeader } from './source-detail'

const th =
  'px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap'
const td = 'px-3 py-2.5 align-middle text-xs text-foreground/85'

export function DataCatalog({
  sources,
  loading,
}: {
  sources: DataSource[]
  loading?: boolean
}) {
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<DataSource | null>(null)

  const sourceById = useMemo(() => {
    const map = new Map<string, DataSource>()
    for (const s of sources) map.set(s.id, s)
    return map
  }, [sources])

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return sources
    return sources.filter((s) =>
      [s.name, s.system, s.sourceType, s.owner, s.database, s.collection, ...s.domains]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [filter, sources])

  return (
    <>
      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search source, system, or domain…"
          className="ps-9"
          disabled={loading}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border bg-background">
        <table className="w-full min-w-[1180px] border-collapse text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className={cn(th, 'min-w-[180px]')}>Data source</th>
              <th className={th}>Source type</th>
              <th className={th}>Domain</th>
              <th className={th}>System</th>
              <th className={th}>Source-of-truth</th>
              <th className={th}>Owner</th>
              <th className={th}>Freshness</th>
              <th className={th}>Retention</th>
              <th className={th}>Environments</th>
              <th className={th}>Last schema update</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} className={cn(td, 'py-8 text-center text-muted-foreground')}>
                  Loading catalog…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={10} className={cn(td, 'py-8 text-center text-muted-foreground')}>
                  No sources match this filter.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((s) => {
                const truth = TRUTH_META[s.truth]
                return (
                  <tr
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className="cursor-pointer border-b transition-colors last:border-b-0 hover:bg-muted/30"
                  >
                    <td className={cn(td, 'font-mono font-semibold text-foreground')}>{s.name}</td>
                    <td className={cn(td, 'whitespace-nowrap')}>{s.sourceType}</td>
                    <td className={td}>
                      <div className="flex flex-wrap gap-1">
                        {s.domains.slice(0, 3).map((d) => (
                          <Badge key={d} variant="secondary" appearance="outline" size="xs">
                            {d}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className={cn(td, 'max-w-[220px] truncate')} title={s.system}>
                      {s.system}
                    </td>
                    <td className={cn(td, 'font-semibold', toneText[truth.tone])}>{truth.label}</td>
                    <td className={td}>{s.owner}</td>
                    <td className={cn(td, 'max-w-[180px] truncate')} title={s.freshness}>
                      {s.freshness}
                    </td>
                    <td className={cn(td, 'max-w-[160px] truncate')} title={s.retention}>
                      {s.retention}
                    </td>
                    <td className={td}>{s.environments.join(', ')}</td>
                    <td className={cn(td, 'whitespace-nowrap')}>{s.lastSchemaUpdate}</td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="sr-only">{selected?.name}</SheetTitle>
          </SheetHeader>
          <SheetBody className="space-y-5 overflow-y-auto pb-8">
            {selected && (
              <>
                <SourceDetailHeader source={selected} />
                <div className="border-t pt-5">
                  <SourceDetailBody
                    source={selected}
                    sourceById={sourceById}
                    onSelectRelated={(id) => {
                      const next = sourceById.get(id)
                      if (next) setSelected(next)
                    }}
                  />
                </div>
              </>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  )
}
