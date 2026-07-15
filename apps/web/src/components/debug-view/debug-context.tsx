'use client'

// Debug View ortak state yönetimi — tüm debug sayfaları arasında seçili
// cihazı ve bridge bağlantı durumunu paylaşır. Cihaz modeli device-lab ile
// ortaktır (ConnectedDevice + MOCK_DEVICES yeniden kullanılır).

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { ConnectedDevice } from '@/data/engineering/device-lab/device-lab-types'
import { MOCK_DEVICES } from '@/data/engineering/device-lab/mock-devices'

interface DebugViewContextValue {
  selectedDevice: ConnectedDevice | null
  setSelectedDevice: (device: ConnectedDevice | null) => void
  devices: ConnectedDevice[]
  refreshDevices: () => void
  bridgeConnected: boolean
  /** Overview / runtime verisi olan cihaz kimlikleri (mock-runtime anahtarları). */
  runtimeAvailable: (deviceId: string) => boolean
}

const DebugViewContext = createContext<DebugViewContextValue | null>(null)

/** Runtime snapshot'ı olan cihazlar (mock-runtime.ts anahtarları). */
const RUNTIME_DEVICE_IDS = new Set([
  'dev-urovo-dt50-001',
  'dev-samsung-a13-002',
  'dev-pixel7-emu-003',
])

export function DebugViewProvider({ children }: { children: ReactNode }) {
  const [devices, setDevices] = useState<ConnectedDevice[]>(MOCK_DEVICES)
  const [selectedDevice, setSelectedDevice] = useState<ConnectedDevice | null>(
    MOCK_DEVICES.find((d) => d.status === 'connected') ?? null,
  )
  const [bridgeConnected] = useState(true)

  const value = useMemo<DebugViewContextValue>(
    () => ({
      selectedDevice,
      setSelectedDevice,
      devices,
      refreshDevices: () => setDevices([...MOCK_DEVICES]),
      bridgeConnected,
      runtimeAvailable: (id: string) => RUNTIME_DEVICE_IDS.has(id),
    }),
    [selectedDevice, devices, bridgeConnected],
  )

  return <DebugViewContext.Provider value={value}>{children}</DebugViewContext.Provider>
}

export function useDebugView(): DebugViewContextValue {
  const ctx = useContext(DebugViewContext)
  if (!ctx) throw new Error('useDebugView must be used within DebugViewProvider')
  return ctx
}
