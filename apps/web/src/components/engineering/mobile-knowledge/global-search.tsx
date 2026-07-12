'use client'

// Birleşik arama — ekran, backend, bilinen sorun ve araçları tek kutudan arar.
// Overview'daki geniş arama alanı ve header butonu bu dialog'u açar.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, LayoutGrid, Network, Search, Wrench } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@nesy/metronic/components/ui/dialog'
import { Input } from '@nesy/metronic/components/ui/input'
import {
  SEARCH_KIND_META,
  searchDocs,
} from '@/data/engineering/mobile-knowledge/search-index'
import type { SearchDoc } from '@/data/engineering/mobile-knowledge/types'

const KIND_ICON = {
  screen: LayoutGrid,
  backend: Network,
  issue: FileText,
  tool: Wrench,
} as const

const EXAMPLES = [
  'fiscal fiş basılmıyor',
  '401 geldiğinde ne olur',
  'Delivery Failed seçenekleri',
  'teslimat tamamlanınca hangi endpoint',
]

function groupByKind(docs: SearchDoc[]) {
  const map = new Map<SearchDoc['kind'], SearchDoc[]>()
  for (const d of docs) {
    const arr = map.get(d.kind) ?? []
    arr.push(d)
    map.set(d.kind, arr)
  }
  return [...map.entries()].sort(
    (a, b) => SEARCH_KIND_META[a[0]].order - SEARCH_KIND_META[b[0]].order,
  )
}

export function GlobalSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const results = useMemo(() => searchDocs(q), [q])
  const grouped = groupByKind(results)

  const go = (href: string) => {
    onOpenChange(false)
    setQ('')
    router.push(href)
  }

  const handleOpenChange = (o: boolean) => {
    if (!o) setQ('')
    onOpenChange(o)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0" showCloseButton={false}>
        <DialogHeader className="border-b p-4">
          <DialogTitle className="sr-only">Mobile Knowledge Hub araması</DialogTitle>
          <DialogDescription className="sr-only">
            Ekran, endpoint, iş kuralı, hata kodu veya kullanıcı işlemi ara
          </DialogDescription>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ekran, endpoint, iş kuralı, hata kodu veya kullanıcı işlemi ara..."
              className="h-11 pl-9 text-base"
            />
          </div>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto p-2">
          {!q.trim() ? (
            <div className="p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Örnek aramalar
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setQ(ex)}
                    className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-accent"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ) : grouped.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              “{q}” için sonuç bulunamadı.
            </p>
          ) : (
            grouped.map(([kind, docs]) => {
              const Icon = KIND_ICON[kind]
              return (
                <div key={kind} className="mb-2">
                  <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {SEARCH_KIND_META[kind].label}
                  </p>
                  <ul>
                    {docs.map((d) => (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={() => go(d.href)}
                          className={cn(
                            'flex w-full items-start gap-3 rounded-md px-3 py-2 text-start hover:bg-accent',
                          )}
                        >
                          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{d.title}</span>
                            {d.subtitle && (
                              <span className="block truncate text-xs text-muted-foreground">
                                {d.subtitle}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Overview'da geniş, tıklanınca dialog açan arama alanı. */
export function SearchLauncher({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-start text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent',
          className,
        )}
      >
        <Search className="size-4 shrink-0" />
        Ekran, endpoint, iş kuralı, hata kodu veya kullanıcı işlemi ara...
      </button>
      <GlobalSearchDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
