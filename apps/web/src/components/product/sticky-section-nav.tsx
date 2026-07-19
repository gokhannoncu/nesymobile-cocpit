'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@nesy/metronic/lib/utils'
import { EASE, type Tone, toneDot } from './tones'

export function StickySectionNav({
  items,
  tone = 'gray',
}: {
  items: { id: string; label: string }[]
  tone?: Tone
}) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? '')
  const listRef = useRef<HTMLUListElement>(null)

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
      { rootMargin: '-18% 0px -62% 0px', threshold: [0.12, 0.3, 0.55] },
    )

    for (const el of elements) observer.observe(el)
    return () => observer.disconnect()
    // itemKey tracks id list; labels do not affect observation targets
    // eslint-disable-next-line react-hooks/exhaustive-deps -- items identity changes every parent render
  }, [itemKey])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const activeButton = list.querySelector<HTMLButtonElement>(`[data-section-id="${activeId}"]`)
    activeButton?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeId])

  if (items.length === 0) return null

  return (
    <nav
      aria-label="Sayfa bölümleri"
      className="sticky top-0 z-20 -mx-1 border-b border-border/60 bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/75"
    >
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-4 bg-gradient-to-r from-background to-transparent sm:w-6"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-4 bg-gradient-to-l from-background to-transparent sm:w-6"
        />

        <ul
          ref={listRef}
          className="relative flex min-w-0 gap-0 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => {
            const active = item.id === activeId
            return (
              <li key={item.id} className="shrink-0">
                <button
                  type="button"
                  data-section-id={item.id}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => {
                    setActiveId(item.id)
                    document.getElementById(`feature-${item.id}`)?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    })
                  }}
                  className={cn(
                    'relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors duration-200',
                    'outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80',
                  )}
                >
                  {item.label}
                  {active && (
                    <motion.span
                      layoutId="feature-section-nav-indicator"
                      className={cn('absolute inset-x-3 -bottom-px h-0.5 rounded-full', toneDot[tone])}
                      transition={{ duration: 0.28, ease: EASE }}
                    />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
