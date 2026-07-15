'use client'

// Debug View route group layout — ortak cihaz bağlamını ve üst cihaz
// çubuğunu tüm debug sayfaları için sağlar.

import type { ReactNode } from 'react'
import { DebugViewProvider } from '@/components/debug-view/debug-context'
import { DebugDeviceBar } from '@/components/debug-view/debug-device-bar'

export default function DebugViewLayout({ children }: { children: ReactNode }) {
  return (
    <DebugViewProvider>
      <div className="flex flex-col gap-4">
        <DebugDeviceBar />
        {children}
      </div>
    </DebugViewProvider>
  )
}
