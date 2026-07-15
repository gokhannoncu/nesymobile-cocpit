'use client'

// Device Lab route group layout — ortak cihaz bağlamını ve
// üst cihaz çubuğunu her iki sayfa için sağlar.

import type { ReactNode } from 'react'
import { DeviceLabProvider } from '@/components/engineering/device-lab/device-lab-context'
import { DeviceContextBar } from '@/components/engineering/device-lab/device-context-bar'

export default function DeviceLabLayout({ children }: { children: ReactNode }) {
  return (
    <DeviceLabProvider>
      <div className="flex flex-col gap-4">
        <DeviceContextBar />
        {children}
      </div>
    </DeviceLabProvider>
  )
}
