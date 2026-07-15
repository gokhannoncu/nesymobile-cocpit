'use client'

// Device Lab route group layout — provides common device context and
// upper device bar for both pages.

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
