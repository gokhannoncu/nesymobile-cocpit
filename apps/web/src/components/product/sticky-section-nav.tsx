'use client'

import { useEffect, useState } from 'react'
import { cn } from '@nesy/metronic/lib/utils'
import { type Tone, toneText } from './tones'

export function StickySectionNav({
  items,
  tone = 'gray',
}: {
  items: { id: string; label: string }[]
  tone?: Tone
}) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? '')

  const itemKey = items.map((item) => item.id).join('|')

  useEffect(() => {
    if (items.length === 0) return
    const elements = items
      .map((item) => document.getElementById(`feature-${item.id}`))
      .filter((el): el is HTMLElement => Boolean(el))

    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const top = visible[0]?.target.id.replace(/^feature-/, '')
        if (top) setActiveId(top)
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0.1, 0.25, 0.5] },
    )

    for (const el of elements) observer.observe(el)
    return () => observer.disconnect()
    // itemKey tracks id list; labels do not affect observation targets
    // eslint-disable-next-line react-hooks/exhaustive-deps -- items identity changes every parent render
  }, [itemKey])

  if (items.length === 0) return null

  return (
    <nav
      aria-label="Feature sections"
      className="sticky top-0 z-20 -mx-1 overflow-x-auto border-b border-border/70 bg-background/90 px-1 py-2 backdrop-blur-md"
    >
      <ul className="flex min-w-max gap-1">
        {items.map((item) => {
          const active = item.id === activeId
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  document.getElementById(`feature-${item.id}`)?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  })
                }}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                  active
                    ? cn('bg-muted text-foreground', toneText[tone])
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
