'use client'

// Device Lab shared state management — shares device selection,
// bridge connection status, and cross-navigation functions between two pages.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { ConnectedDevice } from '@/data/engineering/device-lab/device-lab-types'
import { MOCK_DEVICES } from '@/data/engineering/device-lab/mock-devices'

/** Device and session context shared between two pages. */
interface DeviceLabContextValue {
  /** Selected device */
  selectedDevice: ConnectedDevice | null
  /** Select device */
  setSelectedDevice: (device: ConnectedDevice | null) => void
  /** All connected devices */
  devices: ConnectedDevice[]
  /** Refresh device list */
  refreshDevices: () => void
  /** Is Nesy Device Bridge connected */
  bridgeConnected: boolean
  /** Active ADB run ID */
  activeRunId: string | null
  setActiveRunId: (id: string | null) => void
  /** Active log session ID */
  activeSessionId: string | null
  setActiveSessionId: (id: string | null) => void
  /** Redirect to Log Explorer — associate with optional run ID */
  navigateToLogs: (runId?: string) => void
  /** Redirect to ADB Scenario Runner — with optional scenario ID and context */
  navigateToScenario: (scenarioId?: string, context?: Record<string, string>) => void
}

const DeviceLabContext = createContext<DeviceLabContextValue | null>(null)

/** Used as wrapper in Device Lab layout. */
export function DeviceLabProvider({ children }: { children: ReactNode }) {
  const router = useRouter()

  // Device status
  const [devices, setDevices] = useState<ConnectedDevice[]>(MOCK_DEVICES)
  const [selectedDevice, setSelectedDevice] = useState<ConnectedDevice | null>(
    MOCK_DEVICES.find((d) => d.status === 'connected') ?? null,
  )

  // Bridge status (mock: always connected)
  const [bridgeConnected] = useState(true)

  // Active run and session IDs
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  const refreshDevices = useCallback(() => {
    // Mock: reload device list
    setDevices([...MOCK_DEVICES])
  }, [])

  const navigateToLogs = useCallback(
    (runId?: string) => {
      if (runId) setActiveRunId(runId)
      router.push('/engineering/device-lab/log-explorer')
    },
    [router],
  )

  const navigateToScenario = useCallback(
    (scenarioId?: string, _context?: Record<string, string>) => {
      const query = scenarioId ? `?scenario=${scenarioId}` : ''
      router.push(`/engineering/device-lab/adb-scenarios${query}`)
    },
    [router],
  )

  const value = useMemo<DeviceLabContextValue>(
    () => ({
      selectedDevice,
      setSelectedDevice,
      devices,
      refreshDevices,
      bridgeConnected,
      activeRunId,
      setActiveRunId,
      activeSessionId,
      setActiveSessionId,
      navigateToLogs,
      navigateToScenario,
    }),
    [selectedDevice, devices, refreshDevices, bridgeConnected, activeRunId, activeSessionId, navigateToLogs, navigateToScenario],
  )

  return <DeviceLabContext.Provider value={value}>{children}</DeviceLabContext.Provider>
}

/** Device Lab context hook — throws error if called outside layout. */
export function useDeviceLab(): DeviceLabContextValue {
  const ctx = useContext(DeviceLabContext)
  if (!ctx) throw new Error('useDeviceLab must be used within DeviceLabProvider')
  return ctx
}
