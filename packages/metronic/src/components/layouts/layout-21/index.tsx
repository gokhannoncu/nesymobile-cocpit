'use client'

import { Wrapper } from './components/wrapper'
import { LayoutProvider } from './components/context'

export function Layout21({ children }: { children: React.ReactNode }) {
  return (
    <LayoutProvider
      bodyClassName="bg-background lg:h-dvh lg:min-h-0 lg:overflow-hidden lg:[&_.container-fluid]:px-7.5"
      style={
        {
          '--page-margin': '0px',
          '--sidebar-width': '300px',
          '--sidebar-collapsed-width': '60px',
          '--sidebar-header-height': '54px',
          '--header-height': '60px',
          '--header-height-mobile': '60px',
        } as React.CSSProperties
      }
    >
      <Wrapper>{children}</Wrapper>
    </LayoutProvider>
  )
}
