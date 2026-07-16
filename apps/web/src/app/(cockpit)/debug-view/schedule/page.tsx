'use client'

// Debug View - Schedule Explorer
// Schedule object in the device Room DB and the Stops -> Tasks ->
// Shipments -> ShipmentItems tree under it, as expandable tables.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  Box,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Clock,
  Database,
  FoldVertical,
  HardDrive,
  Hash,
  Layers,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  Route,
  Search,
  Truck,
  UnfoldVertical,
  User,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { Input } from '@nesy/metronic/components/ui/input'
import { ProductPage, StatCard, StatGrid, EASE, toneCard, toneDot, toneIcon, toneIconBox, toneText } from '@/components/product'
import { DebugHeader, DebugCrossLinks, InfoRow, TonePill, NoDeviceState } from '@/components/debug-view/shared'
import { useDebugView } from '@/components/debug-view/debug-context'
import {
  TASK_STATUS,
  TASK_TYPE,
  SHIPMENT_STATUS,
  SHIPMENT_ITEM_STATUS,
  COLLECTION_TYPE,
  COLLECTION_STATUS,
  SERVICE_TYPE,
  SCHEDULE_STATUS,
  PACKAGE_TYPE,
  enumLabel,
} from '@/data/debug-view/enums'
import type { DbgStop, DbgTask, DbgShipment } from '@/data/debug-view/types'
import type { LiveScheduleSnapshot } from '@/data/debug-view/live-types'

type ExpandMode = 'all' | 'none' | 'auto'

function shipmentMatchesQuery(shipment: DbgShipment, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (shipment.waybillNumber.toLowerCase().includes(q)) return true
  if (shipment.sender?.toLowerCase().includes(q)) return true
  if (shipment.deliveryCode?.toLowerCase().includes(q)) return true
  return shipment.shipmentItemList.some((item) => item.barcode.toLowerCase().includes(q))
}

function taskMatchesQuery(task: DbgTask, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (task.taskId.toLowerCase().includes(q)) return true
  if (task.taskParty?.toLowerCase().includes(q)) return true
  if (task.taskAddress?.toLowerCase().includes(q)) return true
  if (task.gsm?.toLowerCase().includes(q)) return true
  return task.shipmentList.some((shipment) => shipmentMatchesQuery(shipment, q))
}

function stopMatchesQuery(stop: DbgStop, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (stop.stopId.toLowerCase().includes(q)) return true
  return stop.taskList.some((task) => taskMatchesQuery(task, q))
}

function filterTasks(stop: DbgStop, query: string): DbgTask[] {
  const q = query.trim().toLowerCase()
  if (!q || stop.stopId.toLowerCase().includes(q)) return stop.taskList
  return stop.taskList.filter((task) => taskMatchesQuery(task, q))
}

function filterShipments(task: DbgTask, query: string): DbgShipment[] {
  const q = query.trim().toLowerCase()
  if (!q) return task.shipmentList
  if (
    task.taskId.toLowerCase().includes(q) ||
    task.taskParty?.toLowerCase().includes(q) ||
    task.taskAddress?.toLowerCase().includes(q) ||
    task.gsm?.toLowerCase().includes(q)
  ) {
    return task.shipmentList
  }
  return task.shipmentList.filter((shipment) => shipmentMatchesQuery(shipment, q))
}

export default function ScheduleExplorerPage() {
  const { selectedDevice } = useDebugView()
  const [snapshot, setSnapshot] = useState<LiveScheduleSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandMode, setExpandMode] = useState<ExpandMode>('auto')
  const [activeStopId, setActiveStopId] = useState<string | null>(null)
  const requestSequence = useRef(0)
  const snapshotRef = useRef<LiveScheduleSnapshot | null>(null)
  const serial = selectedDevice?.serial ?? null

  const loadSchedule = useCallback(() => {
    const sequence = ++requestSequence.current
    if (!serial) {
      setSnapshot(null)
      snapshotRef.current = null
      setError(null)
      setLoading(false)
      return
    }

    const preserveSnapshot = snapshotRef.current != null
    setLoading(true)
    setError(null)
    fetch(`/api/adb/schedule?serial=${encodeURIComponent(serial)}`)
      .then(async (response) => {
        const body = (await response.json()) as LiveScheduleSnapshot & { error?: string }
        if (!response.ok || body.error) throw new Error(body.error ?? `HTTP ${response.status}`)
        if (sequence !== requestSequence.current) return
        snapshotRef.current = body
        setSnapshot(body)
      })
      .catch((caught: unknown) => {
        if (sequence !== requestSequence.current) return
        const message = caught instanceof Error ? caught.message : 'Failed to read Schedule over ADB'
        if (!preserveSnapshot) {
          snapshotRef.current = null
          setSnapshot(null)
        }
        setError(message)
      })
      .finally(() => {
        if (sequence === requestSequence.current) setLoading(false)
      })
  }, [serial])

  useEffect(() => {
    loadSchedule()
  }, [loadSchedule])

  const schedule = snapshot?.schedule ?? null

  const filteredStops = useMemo(() => {
    if (!schedule) return []
    return schedule.stops.filter((stop) => stopMatchesQuery(stop, searchQuery))
  }, [schedule, searchQuery])

  const totalTasks = schedule?.stops.reduce((s, st) => s + st.taskList.length, 0) ?? 0
  const totalShipments = schedule?.stops.reduce(
    (s, st) => s + st.taskList.reduce((t, tk) => t + tk.shipmentList.length, 0),
    0,
  ) ?? 0
  const totalItems = schedule?.stops.reduce(
    (s, st) => s + st.taskList.reduce((t, tk) => t + tk.shipmentList.reduce((sh, s2) => sh + s2.shipmentItemList.length, 0), 0),
    0,
  ) ?? 0

  const taskStatusCounts = useMemo(() => {
    const counts = new Map<number, number>()
    schedule?.stops.forEach((stop) => {
      stop.taskList.forEach((task) => {
        counts.set(task.taskStatus, (counts.get(task.taskStatus) ?? 0) + 1)
      })
    })
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [schedule])

  const isSearching = searchQuery.trim().length > 0
  const effectiveExpandMode: ExpandMode = isSearching ? 'all' : expandMode

  const scrollToStop = useCallback((stopId: string) => {
    setActiveStopId(stopId)
    document.getElementById(`stop-${stopId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <ProductPage path="/debug-view/schedule">
      <DebugHeader
        icon={Route}
        title="Schedule Explorer"
        lead="Live Schedule and ScheduleStopChunk data from the selected device, rendered as an expandable Stop, Task, Shipment and ShipmentItem tree."
        tone="orange"
        badges={[
          { label: snapshot ? `${snapshot.databaseName} · ${snapshot.scheduleRowCount} schedule` : 'Room: Schedule' },
          { label: snapshot ? `${snapshot.stopChunkCount} stop chunks` : 'ScheduleStopChunk' },
          { label: 'Live ADB snapshot' },
        ]}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={loadSchedule} disabled={!serial || loading}>
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Refresh
            </Button>
            <DebugCrossLinks currentPath="/debug-view/schedule" />
          </>
        }
      />

      {!selectedDevice ? (
        <NoDeviceState />
      ) : loading && !snapshot ? (
        <ScheduleLoadingState deviceName={selectedDevice.name} />
      ) : error && !snapshot ? (
        <ScheduleErrorState deviceName={selectedDevice.name} message={error} onRetry={loadSchedule} />
      ) : !schedule ? (
        <ScheduleEmptyState databaseName={snapshot?.databaseName ?? 'aras_kurye'} onRetry={loadSchedule} />
      ) : (
        <>
          {snapshot ? <ScheduleMetaStrip snapshot={snapshot} loading={loading} /> : null}

          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50/60 px-4 py-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 flex-1 break-all">{error}</div>
              <Button size="sm" variant="outline" className="shrink-0" onClick={loadSchedule}>
                Retry
              </Button>
            </div>
          ) : null}

          {snapshot?.warnings.length ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50/60 px-4 py-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>{snapshot.warnings.join(' ')}</div>
            </div>
          ) : null}

          {/* Schedule header */}
          <motion.section
            className={cn('relative overflow-hidden rounded-2xl border p-5', toneCard.orange)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <span className={cn('absolute inset-x-0 top-0 h-0.5', toneDot.orange)} />
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className={cn('text-[11px] font-bold uppercase tracking-wider', toneIcon.orange)}>Schedule</div>
                <h2 className="font-mono text-lg font-bold text-foreground">{schedule.scheduleId}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDeviceDateTime(schedule.timeStamp)} · id={schedule.id}
                </p>
              </div>
              <TonePill label={enumLabel(SCHEDULE_STATUS, schedule.status).label} tone={enumLabel(SCHEDULE_STATUS, schedule.status).tone} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-6 sm:grid-cols-4">
              <InfoRow label="Courier" value={schedule.courierName} />
              <InfoRow label="Courier ID" value={schedule.courierId} mono />
              <InfoRow label="License Plate" value={schedule.vehiclePlate} mono />
              <InfoRow label="Branch" value={schedule.branchCode} mono />
            </div>
            {taskStatusCounts.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-orange-500/15 pt-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Task breakdown</span>
                {taskStatusCounts.map(([status, count]) => {
                  const meta = enumLabel(TASK_STATUS, status)
                  return (
                    <Badge key={status} variant="secondary" appearance="outline" size="xs" className={toneText[meta.tone]}>
                      {meta.label} <span className="ms-1 font-mono font-bold">{count}</span>
                    </Badge>
                  )
                })}
              </div>
            ) : null}
          </motion.section>

          <StatGrid cols={4}>
            <StatCard icon={MapPin} label="Stops" value={schedule.stops.length} tone="orange" />
            <StatCard icon={Truck} label="Tasks" value={totalTasks} tone="orange" />
            <StatCard icon={Package} label="Shipments" value={totalShipments} tone="amber" />
            <StatCard icon={Box} label="Items" value={totalItems} tone="orange" />
          </StatGrid>

          {schedule.stops.length > 0 ? (
            <RouteTimeline
              stops={schedule.stops}
              activeStopId={activeStopId}
              onSelectStop={scrollToStop}
              activeQuery={searchQuery}
            />
          ) : null}

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-orange-50/40 px-4 py-3 dark:bg-orange-950/15">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg border border-orange-500/20 bg-orange-500/10">
                  <Layers className="size-4 text-orange-600 dark:text-orange-400" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-foreground">Route tree</div>
                  <div className="text-[11px] text-muted-foreground">
                    {isSearching
                      ? `${filteredStops.length} of ${schedule.stops.length} stops match`
                      : `${schedule.stops.length} stops in delivery order`}
                  </div>
                </div>
              </div>
              {loading ? (
                <span className="flex items-center gap-1.5 text-[11px] text-orange-600 dark:text-orange-400">
                  <Loader2 className="size-3.5 animate-spin" />
                  Refreshing
                </span>
              ) : null}
            </div>

            <div className="space-y-4 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="relative min-w-0 flex-1 sm:max-w-md">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search stopId, task, party, address, waybill or barcode..."
                    className="h-9 border-border/80 bg-background pl-8 text-xs focus-visible:ring-orange-500/30"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 text-xs"
                    onClick={() => setExpandMode('all')}
                    disabled={schedule.stops.length === 0}
                  >
                    <UnfoldVertical className="size-3.5" />
                    Expand all
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 text-xs"
                    onClick={() => setExpandMode('none')}
                    disabled={schedule.stops.length === 0}
                  >
                    <FoldVertical className="size-3.5" />
                    Collapse all
                  </Button>
                  {isSearching ? (
                    <span className="flex items-center gap-1 text-[11px] text-orange-600 dark:text-orange-400">
                      <ChevronsUpDown className="size-3.5" />
                      Auto-expanded while filtering
                    </span>
                  ) : expandMode !== 'auto' ? (
                    <Button size="sm" variant="ghost" className="h-9 text-xs" onClick={() => setExpandMode('auto')}>
                      <ChevronsDownUp className="size-3.5" />
                      Reset layout
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className={cn('space-y-3', loading && 'opacity-80')}>
                {filteredStops.map((stop, index) => (
                  <StopCard
                    key={stop.stopId}
                    stop={stop}
                    index={index}
                    searchQuery={searchQuery}
                    expandMode={effectiveExpandMode}
                    isActive={activeStopId === stop.stopId}
                    onManualToggle={() => setExpandMode('auto')}
                    onActivate={() => setActiveStopId(stop.stopId)}
                  />
                ))}
                {filteredStops.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted/20 px-5 py-10 text-center">
                    <Search className="mx-auto size-6 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-semibold text-foreground">No matching stops</h3>
                    <p className="mx-auto mt-1 max-w-lg text-xs leading-relaxed text-muted-foreground">
                      Try a different stopId, task party, address, waybill number or item barcode.
                    </p>
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => setSearchQuery('')}>
                      Clear search
                    </Button>
                  </div>
                ) : null}
                {schedule.stops.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted/20 px-5 py-10 text-center">
                    <Database className="mx-auto size-6 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-semibold text-foreground">Schedule loaded; no stop chunks yet</h3>
                    <p className="mx-auto mt-1 max-w-lg text-xs leading-relaxed text-muted-foreground">
                      The Schedule row is present, but ScheduleStopChunk has no rows for this schedule. Stops will appear here automatically after the app stores them.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}
    </ProductPage>
  )
}

function ScheduleMetaStrip({ snapshot, loading }: { snapshot: LiveScheduleSnapshot; loading: boolean }) {
  const totalBytes = snapshot.sizeBytes + snapshot.walSizeBytes + snapshot.shmSizeBytes
  const items = [
    { icon: Database, label: 'Database', value: snapshot.databaseName },
    { icon: Hash, label: 'Schedule rows', value: String(snapshot.scheduleRowCount) },
    { icon: MapPin, label: 'Stop chunks', value: String(snapshot.stopChunkCount) },
    { icon: HardDrive, label: 'Snapshot size', value: formatBytes(totalBytes) },
    { icon: Clock, label: 'Captured', value: new Date(snapshot.capturedAt).toLocaleTimeString('en-US') },
  ]

  return (
    <motion.div
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-orange-50/40 px-4 py-2.5 dark:bg-orange-950/15">
        <div className="flex items-center gap-2">
          <span className={cn('flex size-7 items-center justify-center rounded-lg', toneIconBox.orange)}>
            <Database className={cn('size-3.5', toneIcon.orange)} />
          </span>
          <span className="text-[11px] font-semibold text-foreground">ADB snapshot metadata</span>
        </div>
        {loading ? (
          <span className="flex items-center gap-1 text-[10px] text-orange-600 dark:text-orange-400">
            <Loader2 className="size-3 animate-spin" />
            Updating
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 xl:grid-cols-5">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5 transition-colors hover:border-orange-500/25">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <item.icon className={cn('size-3', toneIcon.orange)} />
              {item.label}
            </div>
            <div className="mt-1 truncate font-mono text-sm font-semibold text-foreground">{item.value}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border/70 px-4 py-3 text-[10px] text-muted-foreground">
        <Badge variant="secondary" appearance="outline" size="xs" className="font-mono text-orange-700 dark:text-orange-300">
          {snapshot.packageName}
        </Badge>
        <span>
          Source <code className="text-foreground">Schedule + ScheduleStopChunk</code>
        </span>
        <code className="ms-auto hidden max-w-sm truncate font-mono xl:block">{snapshot.databasePath}</code>
      </div>
    </motion.div>
  )
}

function RouteTimeline({
  stops,
  activeStopId,
  onSelectStop,
  activeQuery,
}: {
  stops: DbgStop[]
  activeStopId: string | null
  onSelectStop: (stopId: string) => void
  activeQuery: string
}) {
  const q = activeQuery.trim().toLowerCase()

  return (
    <motion.div
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/80 bg-orange-50/40 px-4 py-3 dark:bg-orange-950/15">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg border border-orange-500/20 bg-orange-500/10">
            <Route className="size-4 text-orange-600 dark:text-orange-400" />
          </span>
          <div>
            <div className="text-sm font-semibold text-foreground">Route overview</div>
            <p className="text-[11px] text-muted-foreground">Jump to a stop · ETA and task count at a glance</p>
          </div>
        </div>
        <Badge variant="secondary" appearance="outline" size="xs" className="text-orange-700 dark:text-orange-300">
          {stops.length} stops
        </Badge>
      </div>
      <div className="flex gap-0 overflow-x-auto p-4 pb-3">
        {stops.map((stop, index) => {
          const matches = !q || stopMatchesQuery(stop, q)
          const taskCount = stop.taskList.length
          const isActive = activeStopId === stop.stopId
          const isMatch = matches && q
          return (
            <div key={stop.stopId} className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => onSelectStop(stop.stopId)}
                className={cn(
                  'group flex min-w-[140px] flex-col rounded-xl border px-3 py-2.5 text-left transition-all',
                  'hover:border-orange-500/40 hover:bg-orange-500/5',
                  isActive
                    ? 'border-orange-500/50 bg-orange-500/8 shadow-[inset_0_-2px_0_0_rgb(249,115,22)] ring-1 ring-orange-500/25'
                    : isMatch
                      ? 'border-orange-500/35 bg-orange-500/5 ring-1 ring-orange-500/15'
                      : 'border-border/70 bg-muted/15',
                  !matches && q && 'opacity-40',
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold',
                      isActive
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
                    )}
                  >
                    {stop.stopOrder}
                  </span>
                </div>
                <span className="mt-2 truncate font-mono text-[10px] font-semibold text-foreground">{stop.stopId}</span>
                <span className="mt-0.5 text-[10px] text-muted-foreground">
                  ETA {formatDeviceTime(stop.estimatedTimeOfArrival)}
                </span>
                <span className="mt-1 text-[10px] text-muted-foreground">
                  {taskCount} task{taskCount === 1 ? '' : 's'}
                  {stop.orderChanged ? ' · reordered' : ''}
                </span>
              </button>
              {index < stops.length - 1 ? (
                <ChevronRight className="mx-1 size-4 shrink-0 text-orange-400/50 dark:text-orange-500/40" />
              ) : null}
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

function ScheduleLoadingState({ deviceName }: { deviceName: string }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-orange-300/60 bg-orange-50/30 py-16 text-center dark:border-orange-900/50 dark:bg-orange-950/15"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <span className={cn('flex size-12 items-center justify-center rounded-2xl', toneIconBox.orange)}>
        <Loader2 className="size-6 animate-spin text-orange-500" />
      </span>
      <div>
        <h3 className="text-sm font-semibold text-foreground">Reading {deviceName}&apos;s schedule...</h3>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
          Pulling a live Room DB, WAL and SHM copy without stopping the app, then parsing ScheduleStopChunk rows.
        </p>
      </div>
    </motion.div>
  )
}

function ScheduleErrorState({
  deviceName,
  message,
  onRetry,
}: {
  deviceName: string
  message: string
  onRetry: () => void
}) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-red-300 bg-red-50/40 py-14 text-center dark:border-red-900 dark:bg-red-950/20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <AlertTriangle className="size-6 text-red-500" />
      <div>
        <h3 className="text-sm font-semibold text-foreground">Could not read the schedule on {deviceName}</h3>
        <p className="mt-1 max-w-lg break-all text-xs leading-relaxed text-muted-foreground">{message}</p>
      </div>
      <Button size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw className="size-3.5" />
        Try again
      </Button>
    </motion.div>
  )
}

function ScheduleEmptyState({ databaseName, onRetry }: { databaseName: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-orange-300/60 bg-orange-50/30 py-14 text-center dark:border-orange-900/50 dark:bg-orange-950/15">
      <span className={cn('flex size-12 items-center justify-center rounded-2xl', toneIconBox.orange)}>
        <Route className={cn('size-6', toneIcon.orange)} />
      </span>
      <div>
        <h3 className="text-sm font-semibold text-foreground">No Schedule row found</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          The <code>{databaseName}</code> database is accessible, but its Schedule table is empty.
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw className="size-3.5" />
        Refresh
      </Button>
    </div>
  )
}

function formatDeviceDateTime(value: string): string {
  if (!value) return '-'
  const deviceFormat = value.match(/^(\d{2})-(\d{2})-(\d{4})-(\d{2}):(\d{2}):(\d{2})$/)
  const date = deviceFormat
    ? new Date(`${deviceFormat[3]}-${deviceFormat[2]}-${deviceFormat[1]}T${deviceFormat[4]}:${deviceFormat[5]}:${deviceFormat[6]}`)
    : new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-US')
}

function formatDeviceTime(value: string): string {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function StopCard({
  stop,
  index,
  searchQuery,
  expandMode,
  isActive,
  onManualToggle,
  onActivate,
}: {
  stop: DbgStop
  index: number
  searchQuery: string
  expandMode: ExpandMode
  isActive: boolean
  onManualToggle: () => void
  onActivate: () => void
}) {
  const [open, setOpen] = useState(stop.stopOrder === 1)
  const tasks = filterTasks(stop, searchQuery)
  const taskCount = tasks.length
  const isOpen =
    expandMode === 'all' ? true : expandMode === 'none' ? false : open

  return (
    <motion.div
      id={`stop-${stop.stopId}`}
      className={cn(
        'scroll-mt-24 overflow-hidden rounded-xl border bg-card transition-all',
        isActive
          ? 'border-orange-500/40 shadow-[inset_3px_0_0_0_rgb(249,115,22)] ring-1 ring-orange-500/15'
          : 'border-border',
      )}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.24), ease: EASE }}
    >
      <button
        type="button"
        onClick={() => {
          onManualToggle()
          onActivate()
          setOpen(!isOpen)
        }}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
          isOpen ? 'bg-orange-500/[0.04]' : 'hover:bg-muted/30',
        )}
        aria-expanded={isOpen}
      >
        <ChevronRight
          className={cn(
            'size-4 shrink-0 transition-transform',
            isOpen ? 'rotate-90 text-orange-600 dark:text-orange-400' : 'text-muted-foreground',
          )}
        />
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
            isActive
              ? 'bg-orange-500 text-white shadow-sm'
              : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
          )}
        >
          {stop.stopOrder}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-foreground">{stop.stopId}</span>
            {stop.orderChanged ? (
              <Badge variant="secondary" size="xs" className="text-amber-700 dark:text-amber-400">
                order changed
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {stop.timeWindow.startTime}–{stop.timeWindow.endTime}
            </span>
            <span className="text-border">·</span>
            <span>ETA {formatDeviceTime(stop.estimatedTimeOfArrival)}</span>
            <span className="text-border">·</span>
            <span>
              {stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}
            </span>
          </div>
        </div>
        <Badge variant="secondary" appearance="outline" size="sm">
          {taskCount} task{taskCount === 1 ? '' : 's'}
        </Badge>
      </button>
      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-orange-500/10 bg-orange-500/[0.02] p-3 dark:bg-orange-950/10">
              {tasks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                  No tasks match the current filter in this stop.
                </div>
              ) : (
                tasks.map((task) => <TaskCard key={task.taskId} task={task} searchQuery={searchQuery} />)
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}

function TaskCard({ task, searchQuery }: { task: DbgTask; searchQuery: string }) {
  const [open, setOpen] = useState(false)
  const status = enumLabel(TASK_STATUS, task.taskStatus)
  const type = enumLabel(TASK_TYPE, task.taskType)
  const shipments = filterShipments(task, searchQuery)

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors',
          open ? 'bg-orange-500/[0.04]' : 'hover:bg-muted/30',
        )}
        aria-expanded={open}
      >
        <ChevronRight
          className={cn(
            'size-3.5 shrink-0 transition-transform',
            open ? 'rotate-90 text-orange-600 dark:text-orange-400' : 'text-muted-foreground',
          )}
        />
        <User className={cn('size-4 shrink-0', open ? toneIcon.orange : 'text-muted-foreground')} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-foreground">{task.taskId}</span>
            <span className="truncate text-xs text-foreground/80">{task.taskParty}</span>
          </div>
          <div className="truncate text-[11px] text-muted-foreground">{task.taskAddress}</div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          <TonePill label={type.label} tone={type.tone} />
          <TonePill label={status.label} tone={status.tone} />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-border p-3">
              <div className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">
                <InfoRow label="lastStopId" value={task.lastStopId ?? '-'} mono />
                <InfoRow label="waveNumber" value={task.waveNumber} />
                <InfoRow label="gsm" value={task.gsm ?? '-'} mono />
                <InfoRow label="streetTag" value={task.streetTag ?? '-'} />
                <InfoRow label="consigneeAtAddress" value={task.isConsigneeAtTheAddress ? 'true' : 'false'} />
                <InfoRow label="dropAtTheDoor" value={task.isDropAtTheDoor ? 'true' : 'false'} />
              </div>
              {task.remarkText ? (
                <div className="mt-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-[11px] italic text-muted-foreground">
                  &ldquo;{task.remarkText}&rdquo;
                </div>
              ) : null}

              <div className="mt-3 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Shipments ({shipments.length})
                </div>
                {shipments.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">
                    No shipments match the current filter.
                  </div>
                ) : (
                  shipments.map((shipment) => <ShipmentBlock key={shipment.waybillNumber} shipment={shipment} searchQuery={searchQuery} />)
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function ShipmentBlock({ shipment: sh, searchQuery }: { shipment: DbgShipment; searchQuery: string }) {
  const status = enumLabel(SHIPMENT_STATUS, sh.shipmentStatus)
  const q = searchQuery.trim().toLowerCase()
  const showAllItems =
    !q ||
    sh.waybillNumber.toLowerCase().includes(q) ||
    sh.sender?.toLowerCase().includes(q) ||
    sh.deliveryCode?.toLowerCase().includes(q)
  const items = showAllItems ? sh.shipmentItemList : sh.shipmentItemList.filter((item) => item.barcode.toLowerCase().includes(q))

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 transition-colors hover:border-orange-500/20">
      <div className="flex flex-wrap items-center gap-2">
        <Package className={cn('size-4', toneIcon.orange)} />
        <span className="font-mono text-xs font-semibold text-foreground">{sh.waybillNumber}</span>
        <Badge variant="secondary" size="xs">{PACKAGE_TYPE[sh.packageType] ?? `pkg#${sh.packageType}`}</Badge>
        <TonePill label={status.label} tone={status.tone} />
        {sh.marketPlace ? <Badge variant="secondary" appearance="outline" size="xs">{sh.marketPlace}</Badge> : null}
        <span className="ms-auto text-[10px] text-muted-foreground">
          {sh.activeShipmentItemCount}/{sh.shipmentItemCount} active items
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-6 sm:grid-cols-3">
        <InfoRow label="sender" value={sh.sender ?? '-'} />
        <InfoRow label="deliveryCode" value={sh.deliveryCode ?? '-'} mono />
        <InfoRow label="consigneeGsm" value={sh.consigneeGsm ?? '-'} mono />
      </div>

      {sh.collections.length > 0 ? (
        <div className="mt-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Collections</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {sh.collections.map((c, i) => {
              const ct = enumLabel(COLLECTION_TYPE, c.collectionType)
              const cs = enumLabel(COLLECTION_STATUS, c.collectionStatus)
              const st = enumLabel(SERVICE_TYPE, c.serviceType)
              return (
                <div key={i} className="rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px]">
                  <span className="font-bold text-foreground">
                    {c.collectionAmount.toFixed(2)} {c.currency}
                  </span>
                  <span className="ms-2 text-muted-foreground">
                    <span className={toneText[ct.tone]}>{ct.label}</span>
                    <span className="mx-1 text-border">·</span>
                    <span className={toneText[cs.tone]}>{cs.label}</span>
                    <span className="mx-1 text-border">·</span>
                    <span className={toneText[st.tone]}>{st.label}</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-2 overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[520px] text-left">
          <thead className="border-b border-border bg-orange-500/[0.06]">
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-2.5 py-1.5 font-semibold">barcode</th>
              <th className="px-2.5 py-1.5 font-semibold">deci/weight</th>
              <th className="px-2.5 py-1.5 font-semibold">status</th>
              <th className="px-2.5 py-1.5 font-semibold">flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-2.5 py-4 text-center text-[11px] text-muted-foreground">
                  No items match the current filter.
                </td>
              </tr>
            ) : (
              items.map((it) => {
                const st = enumLabel(SHIPMENT_ITEM_STATUS, it.shipmentItemStatus)
                return (
                  <tr key={it.barcode} className="hover:bg-muted/30">
                    <td className="px-2.5 py-1.5">
                      <code className="text-[11px] text-foreground">{it.barcode}</code>
                      {it.legacySystemShortBarcode ? (
                        <div className="text-[9px] text-muted-foreground">{it.legacySystemShortBarcode}</div>
                      ) : null}
                    </td>
                    <td className="px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
                      {it.deci} / {it.weight}kg
                    </td>
                    <td className="px-2.5 py-1.5">
                      <TonePill label={st.label} tone={st.tone} />
                    </td>
                    <td className="px-2.5 py-1.5 text-[10px] text-muted-foreground">
                      {it.isOverSize ? (
                        <Badge variant="secondary" size="xs" className="me-1 text-amber-700 dark:text-amber-400">
                          oversize
                        </Badge>
                      ) : null}
                      loc={it.itemCurrentLocation}
                      {it.deliveryFailureReason > 0 ? (
                        <span className="ms-1 text-red-600 dark:text-red-400">fail#{it.deliveryFailureReason}</span>
                      ) : null}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
