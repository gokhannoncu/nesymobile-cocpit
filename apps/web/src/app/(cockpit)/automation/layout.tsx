'use client'

import type { ReactNode } from 'react'
import { NesyAuthProvider } from '@/contexts/nesy-auth-context'

export default function AutomationLayout({ children }: { children: ReactNode }) {
  return <NesyAuthProvider>{children}</NesyAuthProvider>
}
