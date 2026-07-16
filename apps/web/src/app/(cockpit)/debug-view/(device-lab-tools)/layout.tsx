'use client'

import type { ReactNode } from 'react'
import { DeviceLabProvider } from '@/components/engineering/device-lab/device-lab-context'

export default function DeviceLabToolsLayout({ children }: { children: ReactNode }) {
  return <DeviceLabProvider>{children}</DeviceLabProvider>
}
