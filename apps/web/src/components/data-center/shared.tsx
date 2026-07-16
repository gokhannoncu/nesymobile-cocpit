'use client'

import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { type LucideIcon, Lock } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import {
  DATA_CENTER_CONNECTION_PATH,
  DATA_CENTER_HAPPY_PATH_PATH,
  DATA_CENTER_PICKUP_PATH,
  DATA_CENTER_SHIPMENT_PATH,
} from '@nesy/metronic/config/layout-21.config'
import { EASE, toneIcon, toneIconBox, type Tone } from '@/components/product'

export const DATA_CENTER_LINKS = [
  { path: DATA_CENTER_CONNECTION_PATH, title: 'Connection' },
  { path: DATA_CENTER_SHIPMENT_PATH, title: 'Shipment Operations' },
  { path: DATA_CENTER_PICKUP_PATH, title: 'Pickup Operations' },
  { path: DATA_CENTER_HAPPY_PATH_PATH, title: 'Happy Path Operations' },
] as const

export function DataCenterHeader({
  icon: Icon,
  title,
  lead,
  tone = 'indigo',
  badges,
  actions,
}: {
  icon: LucideIcon
  title: string
  lead: string
  tone?: Tone
  badges?: { label: string; tone?: Tone }[]
  actions?: ReactNode
}) {
  return (
    <motion.section
      className="rounded-2xl border bg-card p-5 lg:p-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4 min-w-0">
          <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', toneIconBox[tone])}>
            <Icon className={cn('size-5.5', toneIcon[tone])} />
          </span>
          <div className="min-w-0">
            <div className={cn('text-[11px] font-bold uppercase tracking-[0.18em]', toneIcon[tone])}>
              Data Center
            </div>
            <h1 className="mt-0.5 text-xl lg:text-2xl font-bold text-foreground">{title}</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{lead}</p>
            {badges && badges.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {badges.map((b) => (
                  <Badge key={b.label} variant="secondary" appearance="outline" size="sm">
                    {b.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 [&_[data-slot=button]]:h-10 [&_[data-slot=button]]:min-h-10">
            {actions}
          </div>
        )}
      </div>
    </motion.section>
  )
}

export function DataCenterAuthRequired({
  title = 'Dashboard connection required',
  lead = 'Connect to Nesy Dashboard from the Connection page to unlock Management operations.',
}: {
  title?: string
  lead?: string
}) {
  return (
    <motion.section
      className="rounded-2xl border border-dashed bg-muted/20 p-8 text-center"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted">
        <Lock className="size-5 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{lead}</p>
      <Button asChild className="mt-5" variant="outline">
        <Link href={DATA_CENTER_CONNECTION_PATH}>Go to Connection</Link>
      </Button>
    </motion.section>
  )
}

export function DataCenterPlaceholder({
  title,
  lead,
}: {
  title: string
  lead: string
}) {
  return (
    <motion.section
      className="rounded-2xl border bg-card p-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{lead}</p>
      <div className="mt-5 h-48 rounded-xl border border-dashed bg-muted/30" />
    </motion.section>
  )
}
