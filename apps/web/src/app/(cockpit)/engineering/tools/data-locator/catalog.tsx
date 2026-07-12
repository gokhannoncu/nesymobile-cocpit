'use client'

// All Data Sources — aranabilir katalog tablosu + detay Sheet drawer'ı.

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
import {
  DATA_SOURCES,
  TRUTH_META,
  type DataSource,
} from '@/data/engineering/tools/data-locator'
import { SourceDetailBody, SourceDetailHeader } from './source-detail'

const th =
  'px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap'
const td = 'px-3 py-2.5 align-middle text-xs text-foreground/85'

export function DataCatalog() {
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<DataSource | null>(null)

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return DATA_SOURCES
    return DATA_SOURCES.filter((s) =>
      [s.name, s.system, s.sourceType, s.owner, ...s.domains].join(' ').toLowerCase().includes(q),
    )
  }, [filter])

  return (
    <>
      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Kaynak, sistem veya domain ara…"
          className="ps-9"
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
            {rows.map((s) => {
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
                    <span className="flex flex-wrap gap-1">
                      {s.domains.slice(0, 3).map((d) => (
                        <Badge key={d} variant="secondary" appearance="outline" size="xs">
                          {d}
                        </Badge>
                      ))}
                    </span>
                  </td>
                  <td className={cn(td, 'whitespace-nowrap')}>{s.system}</td>
                  <td className={cn(td, 'whitespace-nowrap')}>
                    <span className={cn('text-xs font-semibold', toneText[truth.tone])}>{truth.label}</span>
                  </td>
                  <td className={cn(td, 'whitespace-nowrap')}>{s.owner}</td>
                  <td className={cn(td, 'whitespace-nowrap')}>{s.freshness}</td>
                  <td className={cn(td, 'whitespace-nowrap')}>{s.retention}</td>
                  <td className={cn(td, 'whitespace-nowrap')}>{s.environments.join(' · ')}</td>
                  <td className={cn(td, 'whitespace-nowrap tabular-nums')}>{s.lastSchemaUpdate}</td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td className={cn(td, 'py-8 text-center text-muted-foreground')} colSpan={10}>
                  Filtreyle eşleşen kaynak yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-hidden p-0 sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader className="border-b px-5 py-4">
                <SheetTitle className="sr-only">{selected.name}</SheetTitle>
                <SourceDetailHeader source={selected} />
              </SheetHeader>
              <SheetBody className="h-[calc(100vh-150px)] overflow-y-auto px-5 py-5">
                <SourceDetailBody
                  source={selected}
                  onSelectRelated={(id) => {
                    const rel = DATA_SOURCES.find((s) => s.id === id)
                    if (rel) setSelected(rel)
                  }}
                />
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
