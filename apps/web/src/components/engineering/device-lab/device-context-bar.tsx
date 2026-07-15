'use client'

// Device context bar — sticky at the top of Device Lab pages
// showing selected device info, selector dropdown, and shared actions.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Battery,
  BatteryCharging,
  BatteryLow,
  BatteryMedium,
  ChevronDown,
  Copy,
  Check,
  ExternalLink,
  MonitorSmartphone,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Settings,
  Smartphone,
  Usb,
  Wifi,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { EASE, toneIcon, toneText, type Tone } from '@/components/product'
import { useDeviceLab } from '@/components/engineering/device-lab/device-lab-context'
import { DeviceStatusDot, DeviceStatusBadge, BuildTypeBadge } from '@/components/engineering/device-lab/device-lab-shared'
import type { ConnectedDevice, DeviceStatus, TransportType } from '@/data/engineering/device-lab/device-lab-types'
import { DEVICE_STATUS_META } from '@/data/engineering/device-lab/mock-devices'

/* ─────────────────────── Battery Icon Helper ─────────────────────── */

function BatteryIcon({ level, className }: { level: number; className?: string }) {
  if (level <= 15) return <BatteryLow className={cn(className, 'text-red-500')} />
  if (level <= 50) return <BatteryMedium className={cn(className, 'text-amber-500')} />
  return <Battery className={cn(className, 'text-green-500')} />
}

/* ─────────────────────── Transport Badge ─────────────────────── */

function TransportBadge({ transport }: { transport: TransportType }) {
  const Icon = transport === 'usb' ? Usb : Wifi
  return (
    <Badge variant="secondary" appearance="outline" size="xs" className="gap-1">
      <Icon className="size-3" />
      {transport === 'usb' ? 'USB' : 'Wi-Fi'}
    </Badge>
  )
}

/* ─────────────────── Device Selector Dropdown ─────────────────── */

function DeviceSelector({
  devices,
  selected,
  onSelect,
  onRefresh,
}: {
  devices: ConnectedDevice[]
  selected: ConnectedDevice | null
  onSelect: (d: ConnectedDevice) => void
  onRefresh: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/60',
          open && 'ring-2 ring-primary/30',
        )}
      >
        {selected ? (
          <>
            <DeviceStatusDot status={selected.status} />
            <span className="max-w-[180px] truncate">{selected.name}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{selected.serial.slice(-8)}</span>
          </>
        ) : (
          <span className="text-muted-foreground">Select device…</span>
        )}
        <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

            <motion.div
              className="absolute left-0 top-full z-50 mt-1 w-[380px] overflow-hidden rounded-xl border bg-card shadow-xl"
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.2, ease: EASE }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                <span className="text-xs font-semibold text-foreground">Connected Devices</span>
                <Button size="xs" variant="ghost" onClick={onRefresh} className="h-6 gap-1 px-1.5 text-[10px]">
                  <RefreshCw className="size-3" />
                  Refresh
                </Button>
              </div>

              {/* Device list */}
              <div className="max-h-[320px] overflow-y-auto p-1.5">
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
                      selected?.id === device.id && 'bg-primary/5 ring-1 ring-primary/20',
                    )}
                  >
                    <div className="mt-1">
                      <DeviceStatusDot status={device.status} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{device.name}</span>
                        {!device.isPhysical && (
                          <Badge variant="secondary" size="xs">Emulator</Badge>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span className="font-mono">{device.serial}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <DeviceStatusBadge status={device.status} />
                        <TransportBadge transport={device.transport} />
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

              {/* Footer */}
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

/* ─────────────────── Copy Info Button ─────────────────── */

function CopyDeviceInfoButton({ device }: { device: ConnectedDevice }) {
  const [copied, setCopied] = useState(false)

  const info = useMemo(() => {
    const lines = [
      `Device: ${device.name}`,
      `Serial: ${device.serial}`,
      `Android ${device.androidVersion} · API ${device.apiLevel}`,
      device.appVersion ? `NesyMobile ${device.appVersion}` : 'NesyMobile: Not installed',
      device.configType ? `Config: ${device.configType}` : '',
      device.country ? `Country: ${device.country}` : '',
      `Status: ${device.status}`,
      `Transport: ${device.transport}`,
      `Battery: %${device.batteryLevel}`,
      `Debuggable: ${device.isDebuggable ? 'Yes' : 'No'}`,
    ]
    return lines.filter(Boolean).join('\n')
  }, [device])

  return (
    <Button
      size="xs"
      variant="ghost"
      className="h-7 gap-1 px-1.5 text-[10px]"
      onClick={() => {
        void navigator.clipboard?.writeText(info)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? <Check className="size-3 text-green-600" /> : <Copy className="size-3" />}
      {copied ? 'Copied' : 'Device Info'}
    </Button>
  )
}

/* ═══════════════════════ MAIN COMPONENT ═══════════════════════ */

export function DeviceContextBar() {
  const { selectedDevice, setSelectedDevice, devices, refreshDevices, bridgeConnected, navigateToLogs } = useDeviceLab()

  // Show short bar if Bridge is not connected
  if (!bridgeConnected) {
    return (
      <motion.div
        className="sticky top-0 z-30 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-2.5 backdrop-blur-sm dark:border-amber-900 dark:bg-amber-950/60"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        <MonitorSmartphone className="size-4 text-amber-600 dark:text-amber-400" />
        <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
          Nesy Device Bridge is not connected — start the bridge service on your local machine
        </span>
        <Button size="xs" variant="outline" className="ms-auto h-6 text-[10px]">
          <RefreshCw className="size-3" />
          Retry
        </Button>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="sticky top-0 z-30 rounded-xl border bg-card/95 backdrop-blur-sm"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
        {/* Device selector */}
        <DeviceSelector devices={devices} selected={selectedDevice} onSelect={setSelectedDevice} onRefresh={refreshDevices} />

        {/* Selected device info */}
        {selectedDevice && (
          <>
            {/* Separator */}
            <div className="hidden h-6 w-px bg-border lg:block" />

            {/* Quick info chips */}
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
                <Badge variant="secondary" size="xs" className="text-[10px]">
                  {selectedDevice.country}
                </Badge>
              )}

              {selectedDevice.configType && (
                <Badge
                  variant="secondary"
                  appearance="outline"
                  size="xs"
                  className={cn('text-[10px]', {
                    'border-red-200 text-red-700 dark:border-red-900 dark:text-red-400': selectedDevice.configType === 'production',
                    'border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-400': selectedDevice.configType === 'staging',
                    'border-blue-200 text-blue-700 dark:border-blue-900 dark:text-blue-400': selectedDevice.configType === 'development',
                  })}
                >
                  {selectedDevice.configType}
                </Badge>
              )}
            </div>

            {/* Separator */}
            <div className="hidden h-6 w-px bg-border lg:block" />

            {/* Battery */}
            <div className="hidden items-center gap-1.5 lg:flex">
              <BatteryIcon level={selectedDevice.batteryLevel} className="size-3.5" />
              <span className="text-[11px] font-medium text-muted-foreground">%{selectedDevice.batteryLevel}</span>
            </div>

            {/* Actions — pushed to right */}
            <div className="ms-auto flex items-center gap-0.5">
              <CopyDeviceInfoButton device={selectedDevice} />

              <Button size="xs" variant="ghost" className="h-7 gap-1 px-1.5 text-[10px]" asChild>
                <Link href="/engineering/device-lab/log-explorer">
                  <ScrollText className="size-3" />
                  <span className="hidden xl:inline">Log Explorer</span>
                </Link>
              </Button>

              <Button size="xs" variant="ghost" className="h-7 gap-1 px-1.5 text-[10px]" onClick={refreshDevices}>
                <RotateCcw className="size-3" />
                <span className="hidden xl:inline">ADB Restart</span>
              </Button>
            </div>
          </>
        )}

        {/* No device selected */}
        {!selectedDevice && (
          <span className="text-xs text-muted-foreground">
            Select a device to start
          </span>
        )}
      </div>

      {/* Debuggable warning — if selected device is not debuggable */}
      {selectedDevice && !selectedDevice.isDebuggable && selectedDevice.appInstalled && (
        <div className="border-t border-amber-200/50 bg-amber-50/40 px-4 py-1.5 dark:border-amber-900/50 dark:bg-amber-950/20">
          <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400">
            ⚠ Selected build is not debuggable — some scenarios (requiring run-as) cannot be used
          </span>
        </div>
      )}
    </motion.div>
  )
}
