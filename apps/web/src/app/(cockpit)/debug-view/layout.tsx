'use client'

// Debug View route group layout - provides common device context and top device
// bar for all debug pages.

import type { ReactNode } from 'react'
import { DebugViewProvider } from '@/components/debug-view/debug-context'
import { DebugDeviceBar } from '@/components/debug-view/debug-device-bar'

export default function DebugViewLayout({ children }: { children: ReactNode }) {
  return (
    <DebugViewProvider>
      <div className="flex flex-col gap-4">
        <div className="container-fluid min-w-0 max-w-full">
          <DebugDeviceBar />
        </div>
        {children}
      </div>
    </DebugViewProvider>
  )
}
