'use client'

// Sol navigasyon — aranabilir hiyerarşik ağaç. Hem Backend Handbook (domain
// listesi) hem Screen Manual (gruplu ekranlar) için kullanılır.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Circle, Search } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Input } from '@nesy/metronic/components/ui/input'

export interface NavItem {
  slug: string
  title: string
  documented: boolean
}

export interface NavGroup {
  /** Grup başlığı; tek düz liste için boş bırakılabilir. */
  label?: string
  items: NavItem[]
}

export function KnowledgeNav({
  groups,
  basePath,
  activeSlug,
}: {
  groups: NavGroup[]
  basePath: string
  activeSlug?: string
}) {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const query = q.trim().toLocaleLowerCase('tr')
    if (!query) return groups
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((it) => it.title.toLocaleLowerCase('tr').includes(query)),
      }))
      .filter((g) => g.items.length > 0)
  }, [groups, q])

  return (
    <nav className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ara..."
          className="pl-8"
        />
      </div>

      <div className="space-y-4">
        {filtered.map((group, gi) => (
          <div key={group.label ?? gi}>
            {group.label && (
              <p className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((it) => {
                const isActive = it.slug === activeSlug
                return (
                  <li key={it.slug}>
                    <Link
                      href={`${basePath}/${it.slug}`}
                      className={cn(
                        'flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                        isActive
                          ? 'bg-primary/10 font-medium text-primary'
                          : 'text-foreground/80 hover:bg-accent',
                      )}
                    >
                      <span className="truncate">{it.title}</span>
                      {!it.documented && (
                        <Circle
                          className="size-2 shrink-0 fill-amber-400/60 text-amber-400/60"
                          aria-label="Belgelenmedi"
                        />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="px-2 text-sm text-muted-foreground">Sonuç yok.</p>
        )}
      </div>
    </nav>
  )
}
