'use client'

// Debug View device context bar — sticky at the top of all debug pages.
// Selected device + selector dropdown + quick info chips + bridge status.

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Battery,
  BatteryLow,
  BatteryMedium,
  Bug,
  ChevronDown,
  RefreshCw,
  Usb,
  Wifi,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { DebugDeviceBarShimmer } from '@/components/debug-view/shared'
import { EASE } from '@/components/product'
import { useDebugView } from '@/components/debug-view/debug-context'
import {
  DeviceStatusDot,
  DeviceStatusBadge,
  BuildTypeBadge,
} from '@/components/engineering/device-lab/device-lab-shared'
import type { ConnectedDevice } from '@/data/engineering/device-lab/device-lab-types'

function BatteryIcon({ level, className }: { level: number; className?: string }) {
  if (level <= 15) return <BatteryLow className={cn(className, 'text-red-500')} />
  if (level <= 50) return <BatteryMedium className={cn(className, 'text-amber-500')} />
  return <Battery className={cn(className, 'text-green-500')} />
}

function DeviceSelector({
  devices,
  selected,
  onSelect,
  onRefresh,
  loading,
  emptyMessage,
}: {
  devices: ConnectedDevice[]
  selected: ConnectedDevice | null
  onSelect: (d: ConnectedDevice) => void
  onRefresh: () => void
  loading?: boolean
  emptyMessage?: string | null
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative ms-1.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex max-w-[240px] min-w-0 items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/60',
          open && 'ring-2 ring-teal-500/30',
        )}
      >
        {selected ? (
          <>
            <DeviceStatusDot status={selected.status} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">{selected.name}</span>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{selected.serial.slice(-8)}</span>
          </>
        ) : (
          <span className="truncate text-muted-foreground">Select device…</span>
        )}
        <ChevronDown className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              className="absolute left-0 top-full z-50 mt-1 w-[380px] overflow-hidden rounded-xl border bg-card shadow-xl"
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.2, ease: EASE }}
            >
              <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                <span className="text-xs font-semibold text-foreground">Connected Devices</span>
                <Button size="sm" variant="ghost" onClick={onRefresh} className="h-6 gap-1 px-1.5 text-[10px]">
                  <RefreshCw className={cn('size-3', loading && 'animate-spin')} />
                  Refresh
                </Button>
              </div>
              <div className="max-h-[320px] overflow-y-auto p-1.5">
                {devices.length === 0 && (
                  <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                    {loading
                      ? 'Querying adb…'
                      : emptyMessage ?? 'No connected devices found. Connect a device via USB and press "Refresh".'}
                  </div>
                )}
                {devices.map((device) => (
                  <button
                    key={device.id}
                    type="button"
                    onClick={() => {
                      onSelect(device)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/60',
                      selected?.id === device.id && 'bg-teal-500/5 ring-1 ring-teal-500/20',
                    )}
                  >
                    <div className="mt-1">
                      <DeviceStatusDot status={device.status} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{device.name}</span>
                        {!device.isPhysical && <Badge variant="secondary" size="xs">Emulator</Badge>}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{device.serial}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <DeviceStatusBadge status={device.status} />
                        <Badge variant="secondary" appearance="outline" size="xs" className="gap-1">
                          {device.transport === 'usb' ? <Usb className="size-3" /> : <Wifi className="size-3" />}
                          {device.transport === 'usb' ? 'USB' : 'Wi-Fi'}
                        </Badge>
                        {device.buildType && <BuildTypeBadge build={device.buildType} size="xs" />}
                      </div>
                      {device.appInstalled && device.appVersion && (
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          Android {device.androidVersion} · API {device.apiLevel} · NesyMobile {device.appVersion}
                        </div>
                      )}
                    </div>
                    {device.status === 'connected' && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <BatteryIcon level={device.batteryLevel} className="size-3" />
                        <span>%{device.batteryLevel}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <div className="border-t bg-muted/30 px-3 py-2 text-[10px] text-muted-foreground">
                {devices.filter((d) => d.status === 'connected').length} / {devices.length} devices connected
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export function DebugDeviceBar() {
  const { selectedDevice, setSelectedDevice, devices, refreshDevices, bridgeConnected, bridgeError, devicesLoading } =
    useDebugView()

  return (
    <motion.div
      className="sticky top-0 z-30 inline-flex w-max max-w-full rounded-xl border bg-card/95 backdrop-blur-sm"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <div className="inline-flex flex-wrap items-center gap-3 px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
          <Bug className="size-3.5" />
          Debug
        </span>
        <div className="h-6 w-px bg-border" />

        {devicesLoading && !selectedDevice ? (
          <DebugDeviceBarShimmer />
        ) : (
          <>
            <DeviceSelector
              devices={devices}
              selected={selectedDevice}
              onSelect={setSelectedDevice}
              onRefresh={refreshDevices}
              loading={devicesLoading}
              emptyMessage={bridgeError}
            />

            {selectedDevice && (
              <>
                <div className="hidden h-6 w-px bg-border lg:block" />
                <div className="hidden flex-wrap items-center gap-1.5 lg:flex">
                  <Badge variant="secondary" size="xs" className="font-mono text-[10px]">
                    Android {selectedDevice.androidVersion} · API {selectedDevice.apiLevel}
                  </Badge>
                  {selectedDevice.appVersion && (
                    <Badge variant="secondary" size="xs" className="text-[10px]">
                      NesyMobile {selectedDevice.appVersion}
                    </Badge>
                  )}
                  {selectedDevice.country && (
                    <Badge variant="secondary" size="xs" className="text-[10px]">{selectedDevice.country}</Badge>
                  )}
                </div>
                <div className="hidden h-6 w-px bg-border lg:block" />
                <div className="flex items-center gap-1.5">
                  <BatteryIcon level={selectedDevice.batteryLevel} className="size-3.5" />
                  <span className="text-[11px] font-medium text-muted-foreground">%{selectedDevice.batteryLevel}</span>
                  <div className="h-6 w-px bg-border" />
                  <span className="flex items-center gap-1.5 text-[11px] font-medium">
                    <span className={cn('size-2 rounded-full', bridgeConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500')} />
                    <span className="text-muted-foreground">
                      Bridge {bridgeConnected ? 'connected' : 'closed'}
                    </span>
                  </span>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </motion.div>
  )
}
