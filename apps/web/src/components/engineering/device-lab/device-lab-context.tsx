'use client'

// Device Lab shared state — shares the REAL connected-device selection, bridge
// status, and cross-navigation between Log Explorer and ADB Scenario Runner.
// The device list comes from /api/adb/devices (same source as Debug View), so
// both tools always see the same physical device the user picked.

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
import { useRouter } from 'next/navigation'
import type { ConnectedDevice } from '@/data/engineering/device-lab/device-lab-types'
import type { AdbDevicesResponse } from '@/data/debug-view/live-types'

interface DeviceLabContextValue {
  selectedDevice: ConnectedDevice | null
  setSelectedDevice: (device: ConnectedDevice | null) => void
  devices: ConnectedDevice[]
  refreshDevices: () => void
  /** True on first load and during a refresh. */
  devicesLoading: boolean
  /** adb reachable AND last listing succeeded. */
  bridgeConnected: boolean
  /** adb-not-found / listing error message, or null. */
  bridgeError: string | null
  activeRunId: string | null
  setActiveRunId: (id: string | null) => void
  activeSessionId: string | null
  setActiveSessionId: (id: string | null) => void
  navigateToLogs: (runId?: string) => void
  navigateToScenario: (scenarioId?: string, context?: Record<string, string>) => void
}

const DeviceLabContext = createContext<DeviceLabContextValue | null>(null)

export function DeviceLabProvider({ children }: { children: ReactNode }) {
  const router = useRouter()

  const [devices, setDevices] = useState<ConnectedDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<ConnectedDevice | null>(null)
  const [devicesLoading, setDevicesLoading] = useState(true)
  const [bridgeConnected, setBridgeConnected] = useState(false)
  const [bridgeError, setBridgeError] = useState<string | null>(null)

  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  // Read current selection without making refreshDevices depend on it.
  const selectedRef = useRef<ConnectedDevice | null>(null)
  selectedRef.current = selectedDevice

  const refreshDevices = useCallback(() => {
    setDevicesLoading(true)
    fetch('/api/adb/devices')
      .then((res) => res.json() as Promise<AdbDevicesResponse>)
      .then((data) => {
        setDevices(data.devices)
        setBridgeConnected(data.adbAvailable && !data.error)
        setBridgeError(data.error)
        const current = selectedRef.current
        if (current) {
          const still = data.devices.find((d) => d.serial === current.serial)
          setSelectedDevice(
            still ??
              data.devices.find((d) => d.status === 'connected') ??
              data.devices[0] ??
              null,
          )
        } else {
          setSelectedDevice(
            data.devices.find((d) => d.status === 'connected') ?? data.devices[0] ?? null,
          )
        }
      })
      .catch((err: unknown) => {
        setBridgeConnected(false)
        setBridgeError(err instanceof Error ? err.message : 'adb query failed')
      })
      .finally(() => setDevicesLoading(false))
  }, [])

  useEffect(refreshDevices, [refreshDevices])

  const navigateToLogs = useCallback(
    (runId?: string) => {
      if (runId) setActiveRunId(runId)
      router.push(runId ? `/debug-view/log-explorer?run=${encodeURIComponent(runId)}` : '/debug-view/log-explorer')
    },
    [router],
  )

  const navigateToScenario = useCallback(
    (scenarioId?: string, _context?: Record<string, string>) => {
      const query = scenarioId ? `?scenario=${scenarioId}` : ''
      router.push(`/debug-view/adb-scenarios${query}`)
    },
    [router],
  )

  const value = useMemo<DeviceLabContextValue>(
    () => ({
      selectedDevice,
      setSelectedDevice,
      devices,
      refreshDevices,
      devicesLoading,
      bridgeConnected,
      bridgeError,
      activeRunId,
      setActiveRunId,
      activeSessionId,
      setActiveSessionId,
      navigateToLogs,
      navigateToScenario,
    }),
    [
      selectedDevice,
      devices,
      refreshDevices,
      devicesLoading,
      bridgeConnected,
      bridgeError,
      activeRunId,
      activeSessionId,
      navigateToLogs,
      navigateToScenario,
    ],
  )

  return <DeviceLabContext.Provider value={value}>{children}</DeviceLabContext.Provider>
}

export function useDeviceLab(): DeviceLabContextValue {
  const ctx = useContext(DeviceLabContext)
  if (!ctx) throw new Error('useDeviceLab must be used within DeviceLabProvider')
  return ctx
}
