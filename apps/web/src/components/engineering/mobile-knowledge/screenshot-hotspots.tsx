'use client'

// Arayüz anatomisi — placeholder mock cihaz çerçevesi + numaralı hotspot'lar.
// Gerçek screenshot'lar geldiğinde <frame> içine <img> konularak değiştirilir.

import { useState } from 'react'
import { Smartphone } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import type { Hotspot } from '@/data/engineering/mobile-knowledge/types'

export function ScreenshotHotspots({
  hotspots,
  screenTitle,
}: {
  hotspots: Hotspot[]
  screenTitle: string
}) {
  const [active, setActive] = useState<number>(hotspots[0]?.num ?? 1)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
      {/* Mock device frame */}
      <div className="mx-auto w-full max-w-[320px]">
        <div className="relative aspect-[9/19] overflow-hidden rounded-[2rem] border-4 border-foreground/80 bg-gradient-to-b from-muted to-muted/40 shadow-xl">
          <div className="absolute left-1/2 top-2 h-4 w-24 -translate-x-1/2 rounded-full bg-foreground/80" />
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <Smartphone className="size-8 text-muted-foreground/50" />
            <p className="text-xs font-medium text-muted-foreground">{screenTitle}</p>
            <p className="text-[10px] text-muted-foreground/70">Screenshot placeholder</p>
          </div>
          {hotspots.map((h) => (
            <button
              key={h.num}
              type="button"
              onClick={() => setActive(h.num)}
              style={{ left: `${h.x}%`, top: `${h.y}%` }}
              className={cn(
                'absolute -translate-x-1/2 -translate-y-1/2 flex size-6 items-center justify-center rounded-full border-2 border-white text-xs font-bold shadow-md transition-transform',
                active === h.num
                  ? 'z-10 scale-125 bg-primary text-primary-foreground'
                  : 'bg-foreground/70 text-white hover:scale-110',
              )}
              aria-label={h.label}
            >
              {h.num}
            </button>
          ))}
        </div>
      </div>

      {/* Description panel */}
      <ul className="space-y-2">
        {hotspots.map((h) => (
          <li key={h.num}>
            <button
              type="button"
              onClick={() => setActive(h.num)}
              className={cn(
                'flex w-full items-start gap-3 rounded-lg border p-3 text-start transition-colors',
                active === h.num ? 'border-primary bg-primary/5' : 'hover:bg-accent',
              )}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  active === h.num ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {h.num}
              </span>
              <span>
                <span className="block text-sm font-medium">{h.label}</span>
                <span className="block text-xs text-muted-foreground">{h.desc}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
