'use client'

// Debug View shared state management — selected device and bridge connection status
// shared across all debug pages. Device list is read from real adb via
// /api/adb/devices; device model is shared with device-lab.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { ConnectedDevice } from '@/data/engineering/device-lab/device-lab-types'
import type { AdbDevicesResponse } from '@/data/debug-view/live-types'

interface DebugViewContextValue {
  selectedDevice: ConnectedDevice | null
  setSelectedDevice: (device: ConnectedDevice | null) => void
  devices: ConnectedDevice[]
  refreshDevices: () => void
  /** Device list is loading for the first time or via refresh. */
  devicesLoading: boolean
  /** adb is accessible and last listing was successful. */
  bridgeConnected: boolean
  /** adb not found / listing error — message to be shown to the user. */
  bridgeError: string | null
  /** Live runtime can only be obtained on connected (adb state=device) devices. */
  runtimeAvailable: (deviceId: string) => boolean
}

const DebugViewContext = createContext<DebugViewContextValue | null>(null)

export function DebugViewProvider({ children }: { children: ReactNode }) {
  const [devices, setDevices] = useState<ConnectedDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<ConnectedDevice | null>(null)
  const [devicesLoading, setDevicesLoading] = useState(true)
  const [bridgeConnected, setBridgeConnected] = useState(false)
  const [bridgeError, setBridgeError] = useState<string | null>(null)
  const selectedRef = useRef<ConnectedDevice | null>(null)
  selectedRef.current = selectedDevice

  const refreshDevices = useCallback(() => {
    setDevicesLoading(true)
    fetch('/api/adb/devices')
      .then((r) => r.json() as Promise<AdbDevicesResponse>)
      .then((data) => {
        setDevices(data.devices)
        setBridgeConnected(data.adbAvailable && !data.error)
        setBridgeError(data.error)
        const current = selectedRef.current
        const stillPresent = current && data.devices.find((d) => d.serial === current.serial)
        if (stillPresent) {
          setSelectedDevice(stillPresent)
        } else if (!current) {
          setSelectedDevice(
            data.devices.find((d) => d.status === 'connected') ?? data.devices[0] ?? null,
          )
        } else {
          setSelectedDevice(null)
        }
      })
      .catch((err: unknown) => {
        setBridgeConnected(false)
        setBridgeError(err instanceof Error ? err.message : 'adb query failed')
      })
      .finally(() => setDevicesLoading(false))
  }, [])

  useEffect(() => {
    refreshDevices()
  }, [refreshDevices])

  const value = useMemo<DebugViewContextValue>(
    () => ({
      selectedDevice,
      setSelectedDevice,
      devices,
      refreshDevices,
      devicesLoading,
      bridgeConnected,
      bridgeError,
      runtimeAvailable: (id: string) =>
        devices.some((d) => d.id === id && (d.status === 'connected' || d.status === 'app-not-installed')),
    }),
    [selectedDevice, devices, refreshDevices, devicesLoading, bridgeConnected, bridgeError],
  )

  return <DebugViewContext.Provider value={value}>{children}</DebugViewContext.Provider>
}

export function useDebugView(): DebugViewContextValue {
  const ctx = useContext(DebugViewContext)
  if (!ctx) throw new Error('useDebugView must be used within DebugViewProvider')
  return ctx
}
