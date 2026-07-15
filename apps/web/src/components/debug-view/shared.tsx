'use client'

// Debug View shared visual parts — all debug pages get the same language from here.

import { ReactNode, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Check, Copy, type LucideIcon } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { Skeleton } from '@nesy/metronic/components/ui/skeleton'
import { EASE, toneIcon, toneIconBox, toneText, type Tone } from '@/components/product'

/** Single source of truth for Debug View pages — header cross links from here. */
export const DEBUG_LINKS: { path: string; title: string; icon: string }[] = [
  { path: '/debug-view/overview', title: 'Device Overview', icon: 'MonitorSmartphone' },
  { path: '/debug-view/screen-state', title: 'Screen State', icon: 'LayoutDashboard' },
  { path: '/debug-view/interactions', title: 'User Interactions', icon: 'MousePointerClick' },
  { path: '/debug-view/network-inspector', title: 'Network Inspector', icon: 'Wifi' },
  { path: '/debug-view/schedule', title: 'Schedule Explorer', icon: 'Route' },
  { path: '/debug-view/database', title: 'Database Access', icon: 'Table2' },
]

/**
 * Compact debug page header — icon + title + single sentence purpose + badges.
 */
export function DebugHeader({
  icon: Icon,
  title,
  lead,
  tone = 'teal',
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
              Debug View
            </div>
            <h1 className="mt-0.5 text-xl lg:text-2xl font-bold text-foreground">{title}</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{lead}</p>
            {badges && badges.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {badges.map((b) => (
                  <Badge key={b.label} variant="secondary" appearance="outline" size="sm" className={cn(b.tone && toneText[b.tone])}>
                    {b.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </motion.section>
  )
}

/** Copyable code / JSON block. */
export function CodeBlock({ code, label, className }: { code: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className={cn('overflow-hidden rounded-lg border border-border bg-muted/30', className)}>
      {label && (
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <button
            type="button"
            className="flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => {
              void navigator.clipboard?.writeText(code)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
          >
            {copied ? <Check className="size-3 text-green-600" /> : <Copy className="size-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground/85">
        {code}
      </pre>
    </div>
  )
}

/** Small label-value row. */
export function InfoRow({
  label,
  value,
  mono,
  tone,
}: {
  label: string
  value: ReactNode
  mono?: boolean
  tone?: Tone
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={cn('min-w-0 break-words text-right text-xs font-medium text-foreground', mono && 'font-mono text-[11px]', tone && toneText[tone])}>
        {value}
      </span>
    </div>
  )
}

/** Toned status badge (for enum labels). */
export function TonePill({ label, tone, className }: { label: string; tone: Tone; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
        toneText[tone],
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full bg-current')} />
      {label}
    </span>
  )
}

/** Empty state shown when no device is selected. */
export function NoDeviceState({ className }: { className?: string }) {
  return (
    <motion.div
      className={cn('flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 py-16 text-center', className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
        <span className="text-2xl">📱</span>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">No Device Selected</h3>
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
          Select a connected device from the top bar to view debug data.
        </p>
      </div>
    </motion.div>
  )
}

/** When a device without a runtime snapshot is selected. */
export function NoRuntimeState({ deviceName, className }: { deviceName: string; className?: string }) {
  return (
    <motion.div
      className={cn('flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-amber-300 bg-amber-50/40 py-14 text-center dark:border-amber-900 dark:bg-amber-950/20', className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <span className="text-2xl">⚠️</span>
      <div>
        <h3 className="text-sm font-semibold text-foreground">No live data for {deviceName}</h3>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
          This device is not connected or NesyMobile debug/internal build is not installed. When you select a connected debuggable
          device, the snapshot will be loaded automatically.
        </p>
      </div>
    </motion.div>
  )
}

/** Quick access cards to other debug pages (header right side). */
export function DebugCrossLinks({ currentPath }: { currentPath: string }) {
  const others = DEBUG_LINKS.filter((l) => l.path !== currentPath).slice(0, 3)
  return (
    <>
      {others.map((l) => (
        <Button key={l.path} size="sm" variant="outline" asChild>
          <Link href={l.path}>{l.title}</Link>
        </Button>
      ))}
    </>
  )
}

/** Shimmer placeholder for the device context bar while adb listing is in flight. */
export function DebugDeviceBarShimmer() {
  return (
    <div className="inline-flex flex-wrap items-center gap-3" role="status" aria-label="Loading devices">
      <span className="sr-only">Loading devices</span>
      <Skeleton className="h-8 w-[240px] rounded-lg" />
      <div className="hidden h-6 w-px bg-border lg:block" />
      <div className="hidden flex-wrap items-center gap-1.5 lg:flex">
        <Skeleton className="h-5 w-28 rounded-full" />
        <Skeleton className="h-5 w-32 rounded-full" />
      </div>
      <div className="hidden h-6 w-px bg-border lg:block" />
      <div className="flex items-center gap-2">
        <Skeleton className="size-3.5 rounded" />
        <Skeleton className="h-3.5 w-8" />
        <div className="h-6 w-px bg-border" />
        <Skeleton className="h-3.5 w-28" />
      </div>
    </div>
  )
}

/** Shimmer skeleton for Device Overview while the ADB runtime snapshot is loading. */
export function DebugOverviewShimmer() {
  return (
    <div className="space-y-8" role="status" aria-label="Loading device overview">
      <span className="sr-only">Loading device overview</span>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-3 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="size-4 rounded" />
            </div>
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-2 rounded-xl border p-4">
              <Skeleton className="h-4 w-24" />
              {Array.from({ length: 6 }, (_, j) => (
                <div key={j} className="flex items-center justify-between gap-3 py-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-28" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-6 w-56" />
        </div>
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          <div className="space-y-2 rounded-xl border p-4">
            <Skeleton className="h-4 w-28" />
            {Array.from({ length: 8 }, (_, j) => (
              <div key={j} className="flex items-center justify-between gap-3 py-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-36" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div className="space-y-2 rounded-xl border p-4">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
            </div>
            <div className="space-y-2 rounded-xl border p-4">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
            </div>
            <div className="space-y-2 rounded-xl border p-4 sm:col-span-2">
              <Skeleton className="h-4 w-36" />
              {Array.from({ length: 5 }, (_, j) => (
                <div key={j} className="flex items-center justify-between gap-3 py-1">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </div>
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-2 rounded-xl border p-4">
              <Skeleton className="h-4 w-32" />
              {Array.from({ length: 4 }, (_, j) => (
                <div key={j} className="flex items-center justify-between gap-3 py-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ))}
              <Skeleton className="mt-2 h-16 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
