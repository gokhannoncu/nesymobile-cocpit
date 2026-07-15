'use client'

// Debug View — Schedule Explorer
// Cihaz Room DB'sindeki Schedule objesi ve altındaki Stops → Tasks →
// Shipments → ShipmentItems ağacı, açılır tablolar halinde.

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Box,
  ChevronRight,
  MapPin,
  Package,
  Route,
  Truck,
  User,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { ProductPage, StatCard, StatGrid, EASE, toneCard, toneIcon, toneText } from '@/components/product'
import { DebugHeader, DebugCrossLinks, InfoRow, TonePill, NoDeviceState } from '@/components/debug-view/shared'
import { useDebugView } from '@/components/debug-view/debug-context'
import { MOCK_SCHEDULE } from '@/data/debug-view/mock-schedule'
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

export default function ScheduleExplorerPage() {
  const { selectedDevice } = useDebugView()
  const schedule = MOCK_SCHEDULE

  const totalTasks = schedule.stops.reduce((s, st) => s + st.taskList.length, 0)
  const totalShipments = schedule.stops.reduce(
    (s, st) => s + st.taskList.reduce((t, tk) => t + tk.shipmentList.length, 0),
    0,
  )
  const totalItems = schedule.stops.reduce(
    (s, st) => s + st.taskList.reduce((t, tk) => t + tk.shipmentList.reduce((sh, s2) => sh + s2.shipmentItemList.length, 0), 0),
    0,
  )
  const scheduleStatus = enumLabel(SCHEDULE_STATUS, schedule.status)

  return (
    <ProductPage path="/debug-view/schedule">
      <DebugHeader
        icon={Route}
        title="Schedule Explorer"
        lead="Cihazdaki Schedule objesi ve altındaki Stops, Tasks, Shipments ve ShipmentItems ağacı — Room entity alanlarıyla birebir, açılır tablolar halinde."
        tone="teal"
        badges={[{ label: 'Room: Schedule' }, { label: 'Stop → Task → Shipment' }, { label: 'HR rotası' }]}
        actions={<DebugCrossLinks currentPath="/debug-view/schedule" />}
      />

      {!selectedDevice ? (
        <NoDeviceState />
      ) : (
        <>
          {/* Schedule başlığı */}
          <motion.section
            className={cn('rounded-2xl border p-5', toneCard.teal)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">Schedule</div>
                <h2 className="font-mono text-lg font-bold text-foreground">{schedule.scheduleId}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(schedule.timeStamp).toLocaleString('tr-TR')} · id={schedule.id}
                </p>
              </div>
              <TonePill label={scheduleStatus.label} tone={scheduleStatus.tone} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-6 sm:grid-cols-4">
              <InfoRow label="Kurye" value={schedule.courierName} />
              <InfoRow label="Kurye ID" value={schedule.courierId} mono />
              <InfoRow label="Plaka" value={schedule.vehiclePlate} mono />
              <InfoRow label="Şube" value={schedule.branchCode} mono />
            </div>
          </motion.section>

          <StatGrid cols={4}>
            <StatCard icon={MapPin} label="Duraklar" value={schedule.stops.length} tone="blue" />
            <StatCard icon={Truck} label="Görevler" value={totalTasks} tone="purple" />
            <StatCard icon={Package} label="Gönderiler" value={totalShipments} tone="teal" />
            <StatCard icon={Box} label="Parçalar" value={totalItems} tone="amber" />
          </StatGrid>

          {/* Stop ağacı */}
          <div className="space-y-3">
            {schedule.stops.map((stop) => (
              <StopCard key={stop.stopId} stop={stop} />
            ))}
          </div>
        </>
      )}
    </ProductPage>
  )
}

function StopCard({ stop }: { stop: DbgStop }) {
  const [open, setOpen] = useState(stop.stopOrder === 1)
  const taskCount = stop.taskList.length
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
      >
        <ChevronRight className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          {stop.stopOrder}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-foreground">{stop.stopId}</span>
            {stop.orderChanged && <Badge variant="secondary" size="xs" className="text-amber-700 dark:text-amber-400">sıra değişti</Badge>}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Pencere {stop.timeWindow.startTime}–{stop.timeWindow.endTime} · ETA{' '}
            {new Date(stop.estimatedTimeOfArrival).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} ·{' '}
            {stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}
          </div>
        </div>
        <Badge variant="secondary" appearance="outline" size="sm">{taskCount} görev</Badge>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-border bg-muted/20 p-3">
              {stop.taskList.map((task) => (
                <TaskCard key={task.taskId} task={task} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TaskCard({ task }: { task: DbgTask }) {
  const [open, setOpen] = useState(false)
  const status = enumLabel(TASK_STATUS, task.taskStatus)
  const type = enumLabel(TASK_TYPE, task.taskType)
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/30">
        <ChevronRight className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
        <User className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-foreground">{task.taskId}</span>
            <span className="truncate text-xs text-foreground/80">{task.taskParty}</span>
          </div>
          <div className="truncate text-[11px] text-muted-foreground">{task.taskAddress}</div>
        </div>
        <div className="flex shrink-0 gap-1">
          <TonePill label={type.label} tone={type.tone} />
          <TonePill label={status.label} tone={status.tone} />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-border p-3">
              {/* Task alanları */}
              <div className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">
                <InfoRow label="lastStopId" value={task.lastStopId ?? '—'} mono />
                <InfoRow label="waveNumber" value={task.waveNumber} />
                <InfoRow label="gsm" value={task.gsm ?? '—'} mono />
                <InfoRow label="streetTag" value={task.streetTag ?? '—'} />
                <InfoRow label="consigneeAtAddress" value={task.isConsigneeAtTheAddress ? 'true' : 'false'} />
                <InfoRow label="dropAtTheDoor" value={task.isDropAtTheDoor ? 'true' : 'false'} />
              </div>
              {task.remarkText && (
                <div className="mt-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-[11px] italic text-muted-foreground">“{task.remarkText}”</div>
              )}

              {/* Shipments */}
              <div className="mt-3 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Shipments ({task.shipmentList.length})
                </div>
                {task.shipmentList.map((sh) => (
                  <ShipmentBlock key={sh.waybillNumber} shipment={sh} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ShipmentBlock({ shipment: sh }: { shipment: DbgShipment }) {
  const status = enumLabel(SHIPMENT_STATUS, sh.shipmentStatus)
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Package className={cn('size-4', toneIcon.teal)} />
        <span className="font-mono text-xs font-semibold text-foreground">{sh.waybillNumber}</span>
        <Badge variant="secondary" size="xs">{PACKAGE_TYPE[sh.packageType] ?? `pkg#${sh.packageType}`}</Badge>
        <TonePill label={status.label} tone={status.tone} />
        {sh.marketPlace && <Badge variant="secondary" appearance="outline" size="xs">{sh.marketPlace}</Badge>}
        <span className="ms-auto text-[10px] text-muted-foreground">{sh.activeShipmentItemCount}/{sh.shipmentItemCount} aktif parça</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-6 sm:grid-cols-3">
        <InfoRow label="sender" value={sh.sender ?? '—'} />
        <InfoRow label="deliveryCode" value={sh.deliveryCode ?? '—'} mono />
        <InfoRow label="consigneeGsm" value={sh.consigneeGsm ?? '—'} mono />
      </div>

      {/* Collections */}
      {sh.collections.length > 0 && (
        <div className="mt-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Collections</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {sh.collections.map((c, i) => {
              const ct = enumLabel(COLLECTION_TYPE, c.collectionType)
              const cs = enumLabel(COLLECTION_STATUS, c.collectionStatus)
              const st = enumLabel(SERVICE_TYPE, c.serviceType)
              return (
                <div key={i} className="rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px]">
                  <span className="font-bold text-foreground">{c.collectionAmount.toFixed(2)} {c.currency}</span>
                  <span className="ms-2 text-muted-foreground">
                    <span className={toneText[ct.tone]}>{ct.label}</span> · <span className={toneText[cs.tone]}>{cs.label}</span> · <span className={toneText[st.tone]}>{st.label}</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ShipmentItems tablosu */}
      <div className="mt-2 overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[520px] text-left">
          <thead className="border-b border-border bg-muted/50">
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-2.5 py-1.5 font-semibold">barcode</th>
              <th className="px-2.5 py-1.5 font-semibold">deci/weight</th>
              <th className="px-2.5 py-1.5 font-semibold">status</th>
              <th className="px-2.5 py-1.5 font-semibold">flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {sh.shipmentItemList.map((it) => {
              const st = enumLabel(SHIPMENT_ITEM_STATUS, it.shipmentItemStatus)
              return (
                <tr key={it.barcode} className="hover:bg-muted/30">
                  <td className="px-2.5 py-1.5">
                    <code className="text-[11px] text-foreground">{it.barcode}</code>
                    {it.legacySystemShortBarcode && <div className="text-[9px] text-muted-foreground">{it.legacySystemShortBarcode}</div>}
                  </td>
                  <td className="px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">{it.deci} / {it.weight}kg</td>
                  <td className="px-2.5 py-1.5"><TonePill label={st.label} tone={st.tone} /></td>
                  <td className="px-2.5 py-1.5 text-[10px] text-muted-foreground">
                    {it.isOverSize && <Badge variant="secondary" size="xs" className="me-1 text-amber-700 dark:text-amber-400">oversize</Badge>}
                    loc={it.itemCurrentLocation}
                    {it.deliveryFailureReason > 0 && <span className="ms-1 text-red-600 dark:text-red-400">fail#{it.deliveryFailureReason}</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
