'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Globe2,
  Loader2,
  Lock,
  MapPin,
  PackagePlus,
  ShieldCheck,
  Truck,
  XCircle,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Alert, AlertContent, AlertDescription, AlertIcon, AlertTitle } from '@nesy/metronic/components/ui/alert'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { Label } from '@nesy/metronic/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nesy/metronic/components/ui/select'
import {
  DATA_CENTER_HAPPY_PATH_PATH,
  DATA_CENTER_PICKUP_PATH,
  DATA_CENTER_SHIPMENT_PATH,
} from '@nesy/metronic/config/layout-21.config'
import { EASE, toneDot, toneHero, toneIcon, toneIconBox } from '@/components/product'
import { useNesyAuth } from '@/contexts/nesy-auth-context'
import {
  NESY_DASHBOARD_TOOLBAR_COUNTRIES,
  type NesyAuthResponse,
  type NesyDashboardToolbarCountry,
  type NesyEnvironment,
} from '@/services/nesy-auth'

type NesyUser = NonNullable<NonNullable<NesyAuthResponse['result']['payload']>['user']>

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'failed'

function getUserInitials(user: NesyUser): string {
  const name = user.fullName?.trim() || user.username || '?'
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function SessionCard({
  user,
  country,
  environment,
  embedded = false,
}: {
  user: NesyUser
  country: NesyDashboardToolbarCountry
  environment: NesyEnvironment
  embedded?: boolean
}) {
  const displayName = user.fullName?.trim() || user.username || 'Dashboard user'
  const hubName = user.hubName?.trim()

  const content = (
    <div className={cn('flex flex-wrap items-center gap-3', embedded ? 'ps-1' : 'flex-col gap-4 p-4 ps-5 sm:flex-row sm:items-start sm:justify-between')}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <motion.span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full bg-indigo-600 font-bold text-white shadow-sm',
            embedded ? 'size-9 text-xs' : 'size-11 text-sm',
          )}
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.08 }}
        >
          {getUserInitials(user)}
        </motion.span>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-600 dark:text-indigo-400">
              Active session
            </span>
            <span className="hidden text-border sm:inline">·</span>
            <span className="text-sm font-semibold text-foreground">{displayName}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {user.username && <span className="font-medium text-foreground/75">{user.username}</span>}
            {hubName && (
              <>
                {user.username && <span className="text-border">·</span>}
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3 shrink-0 opacity-70" />
                  {hubName}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="info" appearance="light" size="sm">
          {country}
        </Badge>
        <Badge variant="warning" appearance="light" size="sm">
          {environment.toUpperCase()}
        </Badge>
        {user.role && (
          <Badge variant="secondary" appearance="outline" size="sm" className="font-mono text-[11px]">
            {user.role}
          </Badge>
        )}
        <motion.span
          className="inline-flex items-center gap-1 rounded-full border border-green-200/80 bg-green-50/80 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-400"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.12, duration: 0.25, ease: EASE }}
        >
          <ShieldCheck className="size-3" />
          Token active
        </motion.span>
      </div>
    </div>
  )

  if (embedded) {
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        {content}
      </motion.div>
    )
  }

  return (
    <motion.div
      key="session-card"
      className="relative overflow-hidden rounded-xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50/90 via-background to-background dark:border-indigo-900/50 dark:from-indigo-950/40"
      initial={{ opacity: 0, y: 10, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -6, height: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <div className="absolute inset-y-0 start-0 w-1 bg-green-500/80" />
      {content}
    </motion.div>
  )
}

const MANAGEMENT_ROUTES = [
  {
    title: 'Shipment Operations',
    path: DATA_CENTER_SHIPMENT_PATH,
    icon: Truck,
    description: 'Create and manage shipments',
  },
  {
    title: 'Pickup Operations',
    path: DATA_CENTER_PICKUP_PATH,
    icon: Calendar,
    description: 'Schedule pickup requests',
  },
  {
    title: 'Happy Path Operations',
    path: DATA_CENTER_HAPPY_PATH_PATH,
    icon: PackagePlus,
    description: 'Run end-to-end happy path flows',
  },
] as const

function getStatusMeta(status: ConnectionStatus) {
  switch (status) {
    case 'connected':
      return { label: 'Connected', variant: 'success' as const, tone: 'green' as const }
    case 'failed':
      return { label: 'Failed', variant: 'destructive' as const, tone: 'red' as const }
    case 'connecting':
      return { label: 'Connecting', variant: 'warning' as const, tone: 'amber' as const }
    default:
      return { label: 'Not connected', variant: 'secondary' as const, tone: 'gray' as const }
  }
}

const STATUS_SHELL: Record<ConnectionStatus, string> = {
  idle: 'border-border/80 bg-background/85',
  connecting: 'border-amber-200/90 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/25',
  connected: 'border-green-200/90 bg-green-50/55 dark:border-green-900/50 dark:bg-green-950/25',
  failed: 'border-red-200/90 bg-red-50/55 dark:border-red-900/50 dark:bg-red-950/25',
}

function ConnectionStatusBadge({ status }: { status: ConnectionStatus }) {
  const meta = getStatusMeta(status)
  const isLive = status === 'connected' || status === 'connecting'

  return (
    <div
      className={cn(
        'flex h-7 shrink-0 items-center gap-2 rounded-full border px-2.5 shadow-sm backdrop-blur-sm',
        STATUS_SHELL[status],
      )}
    >
      <span className="relative flex size-3.5 shrink-0 items-center justify-center">
        <motion.span
          className={cn('size-2 rounded-full', toneDot[meta.tone])}
          animate={
            isLive
              ? { y: [0, -2.5, 0], scale: [1, 1.12, 1] }
              : { y: 0, scale: 1 }
          }
          transition={
            isLive
              ? { duration: 0.85, repeat: Infinity, ease: [0.42, 0, 0.58, 1] }
              : { duration: 0.2 }
          }
        />
      </span>

      <span className="min-w-[5.75rem] text-xs font-medium leading-none">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={meta.label}
            className="block text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {meta.label}
          </motion.span>
        </AnimatePresence>
      </span>
    </div>
  )
}

export function NesyConnectionPanel() {
  const [clientReady, setClientReady] = useState(false)
  useEffect(() => setClientReady(true), [])

  const {
    country,
    environment,
    availableEnvironments,
    status,
    isHydrated,
    user,
    error,
    setCountry,
    setEnvironment,
    connect,
    logout,
  } = useNesyAuth()

  const authUiReady = clientReady && isHydrated
  const displayStatus = authUiReady ? status : 'idle'
  const displayUser = authUiReady ? user : null
  const displayError = authUiReady ? error : null
  const isConnected = displayStatus === 'connected'

  return (
    <motion.div
      className={cn('w-full overflow-hidden rounded-2xl border bg-card', toneHero.indigo)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      {/* Hero */}
      <div className="relative border-b border-indigo-200/60 bg-gradient-to-r from-indigo-50/80 via-background to-background px-5 py-5 lg:px-6 dark:border-indigo-900/50 dark:from-indigo-950/30">
        <div className="flex items-start gap-4 min-w-0 pe-28 sm:pe-32">
          <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', toneIconBox.indigo)}>
            <Globe2 className={cn('size-5.5', toneIcon.indigo)} />
          </span>
          <div className="min-w-0">
            <div className={cn('text-[11px] font-bold uppercase tracking-[0.18em]', toneIcon.indigo)}>
              Data Center
            </div>
            <h1 className="mt-0.5 text-xl font-bold text-foreground lg:text-2xl">Dashboard Connection</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Select a country and environment, then connect to Nesy Dashboard. Management operations unlock once a
              valid session token is stored.
            </p>
          </div>
        </div>

        <div className="absolute end-5 top-5 lg:end-6 lg:top-5">
          <ConnectionStatusBadge status={displayStatus} />
        </div>
      </div>

      <div className="px-5 pb-5 lg:px-6 lg:pb-6">
        <div className="overflow-hidden rounded-xl border border-border/80 bg-muted/20">
          <div className="grid lg:grid-cols-2">
            {/* Left: target + action */}
            <section className="space-y-3 border-b border-border/70 p-4 lg:border-b-0 lg:border-e">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Target environment
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isConnected
                    ? 'Log out to switch country or environment.'
                    : 'Pick where shipment and pickup data will be created.'}
                </p>
              </div>

              <div className="rounded-lg border border-border/60 bg-background/70 p-3 space-y-3">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="dc-country" className="text-[11px] text-muted-foreground">
                      Country
                    </Label>
                    <Select
                      value={country}
                      onValueChange={(value) => setCountry(value as NesyDashboardToolbarCountry)}
                      disabled={isConnected || displayStatus === 'connecting'}
                    >
                      <SelectTrigger id="dc-country" className="h-9 w-full">
                        <SelectValue placeholder="Country" />
                      </SelectTrigger>
                      <SelectContent>
                        {NESY_DASHBOARD_TOOLBAR_COUNTRIES.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="dc-environment" className="text-[11px] text-muted-foreground">
                      Environment
                    </Label>
                    <Select
                      value={environment}
                      onValueChange={(value) => setEnvironment(value as NesyEnvironment)}
                      disabled={isConnected || displayStatus === 'connecting'}
                    >
                      <SelectTrigger id="dc-environment" className="h-9 w-full">
                        <SelectValue placeholder="Environment" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableEnvironments.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={isConnected ? 'outline' : 'primary'}
                    onClick={() => {
                      if (isConnected) {
                        logout()
                      } else {
                        void connect()
                      }
                    }}
                    disabled={displayStatus === 'connecting'}
                  >
                    {displayStatus === 'connecting' ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Connecting…
                      </>
                    ) : isConnected ? (
                      'Log out'
                    ) : (
                      'Connect to Dashboard'
                    )}
                  </Button>

                  {!isConnected && displayStatus !== 'connecting' && (
                    <span className="text-[11px] text-muted-foreground">
                      Server-side credentials for selected target.
                    </span>
                  )}
                </div>
              </div>

              {displayStatus === 'failed' && displayError && (
                <Alert variant="destructive" appearance="light" size="sm">
                  <AlertIcon>
                    <XCircle />
                  </AlertIcon>
                  <AlertContent>
                    <AlertTitle>Connection failed</AlertTitle>
                    <AlertDescription>{displayError}</AlertDescription>
                  </AlertContent>
                </Alert>
              )}
            </section>

            {/* Right: management access */}
            <section className="space-y-3 p-4">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Management access
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isConnected
                    ? 'Operations unlocked — open from here or the sidebar.'
                    : 'Connect first to unlock shipment, pickup and happy path tools.'}
                </p>
              </div>

              <div className="space-y-1.5">
                {MANAGEMENT_ROUTES.map((route, index) => {
                  const Icon = route.icon
                  const unlocked = isConnected

                  return (
                    <AnimatePresence mode="wait" key={route.path}>
                      {unlocked ? (
                        <motion.div
                          key={`${route.path}-unlocked`}
                          initial={{ opacity: 0, x: 6 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -6 }}
                          transition={{ duration: 0.22, delay: index * 0.05, ease: EASE }}
                        >
                          <Link
                            href={route.path}
                            className="group flex items-center gap-2.5 rounded-lg border border-green-200/50 bg-background/80 px-2.5 py-2 transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-green-900/35 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/20"
                          >
                            <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', toneIconBox.indigo)}>
                              <Icon className={cn('size-3.5', toneIcon.indigo)} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-foreground">{route.title}</span>
                                <CheckCircle2 className="size-3 shrink-0 text-green-600" />
                              </div>
                              <p className="text-[11px] leading-tight text-muted-foreground">{route.description}</p>
                            </div>
                            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-600" />
                          </Link>
                        </motion.div>
                      ) : (
                        <motion.div
                          key={`${route.path}-locked`}
                          className="flex items-center gap-2.5 rounded-lg border border-dashed bg-muted/15 px-2.5 py-2 opacity-75"
                          aria-disabled
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                            <Icon className="size-3.5 text-muted-foreground" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-muted-foreground">{route.title}</span>
                              <Lock className="size-3 shrink-0 text-muted-foreground" />
                            </div>
                            <p className="text-[11px] leading-tight text-muted-foreground">{route.description}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )
                })}
              </div>
            </section>
          </div>

          <AnimatePresence mode="wait">
            {isConnected && displayUser && (
              <div className="border-t border-border/70 bg-indigo-50/30 px-4 py-3 dark:bg-indigo-950/15">
                <SessionCard
                  embedded
                  user={displayUser}
                  country={country}
                  environment={environment}
                />
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
