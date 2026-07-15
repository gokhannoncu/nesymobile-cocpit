'use client'

// Device Lab shared small components — reusable badges,
// warnings, and status indicators across two pages.

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Ban,
  BatteryLow,
  Bug,
  Check,
  Info,
  Loader2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Skull,
  Unplug,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { EASE, toneIcon, toneText, type Tone } from '@/components/product'
import type { RiskLevel, BuildCompatibility, DeviceStatus, StepStatus, BuildType } from '@/data/engineering/device-lab/device-lab-types'
import { DEVICE_STATUS_META, RISK_LEVEL_META, BUILD_COMPATIBILITY_META, BUILD_TYPE_META } from '@/data/engineering/device-lab/mock-devices'

/* ─────────────────────────── Risk Badge ─────────────────────────── */

const RISK_ICON: Record<RiskLevel, LucideIcon> = {
  safe: ShieldCheck,
  caution: AlertTriangle,
  destructive: Skull,
}

export function RiskBadge({ risk, size = 'sm' }: { risk: RiskLevel; size?: 'xs' | 'sm' }) {
  const meta = RISK_LEVEL_META[risk]
  const Icon = RISK_ICON[risk]
  return (
    <Badge variant="secondary" appearance="outline" size={size} className="gap-1">
      <Icon className={cn('size-3', toneIcon[meta.tone])} />
      {meta.label}
    </Badge>
  )
}

/* ─────────────────────── Build Compatibility Badge ─────────────────────── */

const BUILD_COMPAT_ICON: Record<BuildCompatibility, LucideIcon> = {
  debug: Bug,
  internal: Lock,
  any: Check,
  root: ShieldAlert,
}

export function BuildCompatBadge({ build, size = 'sm' }: { build: BuildCompatibility; size?: 'xs' | 'sm' }) {
  const meta = BUILD_COMPATIBILITY_META[build]
  const Icon = BUILD_COMPAT_ICON[build]
  return (
    <Badge variant="secondary" appearance="outline" size={size} className="gap-1">
      <Icon className={cn('size-3', toneIcon[meta.tone])} />
      {meta.label}
    </Badge>
  )
}

/* ──────────────────────────── Build Type Badge ──────────────────────────── */

export function BuildTypeBadge({ build, size = 'sm' }: { build: BuildType; size?: 'xs' | 'sm' }) {
  const meta = BUILD_TYPE_META[build]
  return (
    <Badge variant="secondary" appearance="outline" size={size} className={cn('gap-1', toneText[meta.tone])}>
      {meta.label}
    </Badge>
  )
}

/* ──────────────────────── Device Status Dot ──────────────────────── */

export function DeviceStatusDot({ status, className }: { status: DeviceStatus; className?: string }) {
  const meta = DEVICE_STATUS_META[status]
  return (
    <span className={cn('relative flex size-2.5', className)}>
      {status === 'connected' && (
        <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-50', meta.dotClass)} />
      )}
      <span className={cn('relative inline-flex size-2.5 rounded-full', meta.dotClass)} />
    </span>
  )
}

/* ──────────────────────── Device Status Badge ──────────────────────── */

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  const meta = DEVICE_STATUS_META[status]
  return (
    <Badge variant="secondary" appearance="outline" size="xs" className="gap-1.5">
      <DeviceStatusDot status={status} />
      {meta.label}
    </Badge>
  )
}

/* ──────────────────────── Step Status Indicator ──────────────────────── */

const STEP_ICON: Record<StepStatus, LucideIcon> = {
  waiting: Info,
  running: Loader2,
  completed: Check,
  failed: X,
  skipped: Ban,
}

const STEP_TONE: Record<StepStatus, Tone> = {
  waiting: 'gray',
  running: 'blue',
  completed: 'green',
  failed: 'red',
  skipped: 'gray',
}

export function StepStatusIndicator({ status }: { status: StepStatus }) {
  const Icon = STEP_ICON[status]
  const tone = STEP_TONE[status]
  return (
    <span className={cn('flex size-5 items-center justify-center rounded-full', {
      'bg-muted': status === 'waiting' || status === 'skipped',
      'bg-blue-100 dark:bg-blue-950': status === 'running',
      'bg-green-100 dark:bg-green-950': status === 'completed',
      'bg-red-100 dark:bg-red-950': status === 'failed',
    })}>
      <Icon className={cn('size-3', toneIcon[tone], { 'animate-spin': status === 'running' })} />
    </span>
  )
}

/* ──────────────────────── Run / Session ID Badge ──────────────────────── */

export function RunIdBadge({ id, type = 'run' }: { id: string; type?: 'run' | 'session' }) {
  return (
    <Badge variant="secondary" appearance="outline" size="xs" className="gap-1 font-mono text-[10px]">
      {type === 'run' ? '▶' : '◉'} {id}
    </Badge>
  )
}

/* ──────────────────────── Debug Only Warning ──────────────────────── */

export function DebugOnlyWarning({ className }: { className?: string }) {
  return (
    <motion.div
      className={cn(
        'flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/30',
        className,
      )}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
        <span className="font-semibold">This scenario can only be run on a debug or internal test build.</span>{' '}
        Some scenarios cannot be used on release builds or production devices without root access.
      </div>
    </motion.div>
  )
}

/* ─────────────────── Connection Required State ─────────────────── */

export function ConnectionRequiredState({ className }: { className?: string }) {
  return (
    <motion.div
      className={cn('flex flex-col items-center justify-center gap-4 py-16 text-center', className)}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
        <Unplug className="size-6 text-muted-foreground" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">Nesy Device Bridge Not Connected</h3>
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
          Nesy Device Bridge application must be running for device operations.
          Start the bridge service on your local machine.
        </p>
      </div>
    </motion.div>
  )
}

/* ─────────────────── Preflight Check List ─────────────────── */

interface PreflightResult {
  id: string
  label: string
  status: 'pass' | 'warn' | 'fail'
  message?: string
}

export function PreflightCheckList({ checks, className }: { checks: PreflightResult[]; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {checks.map((check, i) => (
        <motion.div
          key={check.id}
          className="flex items-center gap-2 text-xs"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, delay: i * 0.05, ease: EASE }}
        >
          {check.status === 'pass' && <Check className="size-3.5 text-green-600 dark:text-green-400" />}
          {check.status === 'warn' && <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400" />}
          {check.status === 'fail' && <X className="size-3.5 text-red-600 dark:text-red-400" />}
          <span className={cn('text-foreground/80', { 'text-red-700 dark:text-red-400': check.status === 'fail' })}>
            {check.label}
          </span>
          {check.message && (
            <span className="text-muted-foreground">— {check.message}</span>
          )}
        </motion.div>
      ))}
    </div>
  )
}

/* ─────────────────── Empty Panel State ─────────────────── */

export function EmptyPanelState({
  icon: Icon,
  title,
  description,
  className,
  children,
}: {
  icon: LucideIcon
  title: string
  description: string
  className?: string
  children?: ReactNode
}) {
  return (
    <motion.div
      className={cn('flex flex-col items-center justify-center gap-3 py-12 text-center', className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <div className="flex size-11 items-center justify-center rounded-xl bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div>
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {children}
    </motion.div>
  )
}

/* ─────────────────── Production Protection Badge ─────────────────── */

export function ProductionProtectionBadge({ className }: { className?: string }) {
  return (
    <div className={cn(
      'flex items-center gap-2 rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 dark:border-red-900 dark:bg-red-950/30',
      className,
    )}>
      <ShieldAlert className="size-3.5 text-red-600 dark:text-red-400" />
      <span className="text-[11px] font-medium text-red-700 dark:text-red-300">
        Production config — destructive scenarios disabled
      </span>
    </div>
  )
}

/* ─────────────────── Battery Warning ─────────────────── */

export function BatteryWarning({ level, className }: { level: number; className?: string }) {
  if (level > 20) return null
  return (
    <div className={cn(
      'flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/30',
      className,
    )}>
      <BatteryLow className="size-3.5 text-amber-600 dark:text-amber-400" />
      <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
        Low battery ({level}%) — some operations may be interrupted
      </span>
    </div>
  )
}
