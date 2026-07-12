'use client'

// Device Lab ortak state yönetimi — iki sayfa arasında cihaz seçimi,
// bridge bağlantı durumu ve çapraz navigasyon fonksiyonlarını paylaşır.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { ConnectedDevice } from '@/data/engineering/device-lab/device-lab-types'
import { MOCK_DEVICES } from '@/data/engineering/device-lab/mock-devices'

/** İki sayfa arasında paylaşılan cihaz ve oturum bağlamı. */
interface DeviceLabContextValue {
  /** Seçili cihaz */
  selectedDevice: ConnectedDevice | null
  /** Cihaz seç */
  setSelectedDevice: (device: ConnectedDevice | null) => void
  /** Tüm bağlı cihazlar */
  devices: ConnectedDevice[]
  /** Cihaz listesini yenile */
  refreshDevices: () => void
  /** Nesy Device Bridge bağlı mı */
  bridgeConnected: boolean
  /** Aktif ADB çalışma kimliği */
  activeRunId: string | null
  setActiveRunId: (id: string | null) => void
  /** Aktif log oturum kimliği */
  activeSessionId: string | null
  setActiveSessionId: (id: string | null) => void
  /** Log Explorer'a yönlendir — opsiyonel run ID ile ilişkilendir */
  navigateToLogs: (runId?: string) => void
  /** ADB Scenario Runner'a yönlendir — opsiyonel senaryo ID ve bağlam ile */
  navigateToScenario: (scenarioId?: string, context?: Record<string, string>) => void
}

const DeviceLabContext = createContext<DeviceLabContextValue | null>(null)

/** Device Lab layout'unda sarmalayıcı olarak kullanılır. */
export function DeviceLabProvider({ children }: { children: ReactNode }) {
  const router = useRouter()

  // Cihaz durumu
  const [devices, setDevices] = useState<ConnectedDevice[]>(MOCK_DEVICES)
  const [selectedDevice, setSelectedDevice] = useState<ConnectedDevice | null>(
    MOCK_DEVICES.find((d) => d.status === 'connected') ?? null,
  )

  // Bridge durumu (mock: her zaman bağlı)
  const [bridgeConnected] = useState(true)

  // Aktif çalışma ve oturum kimlikleri
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  const refreshDevices = useCallback(() => {
    // Mock: cihaz listesini yeniden yükle
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

/** Device Lab context hook'u — layout dışında çağrılırsa hata fırlatır. */
export function useDeviceLab(): DeviceLabContextValue {
  const ctx = useContext(DeviceLabContext)
  if (!ctx) throw new Error('useDeviceLab must be used within DeviceLabProvider')
  return ctx
}
