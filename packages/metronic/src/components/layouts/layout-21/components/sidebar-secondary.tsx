'use client'

import { ScrollArea } from '@nesy/metronic/components/ui/scroll-area'
import { getActiveWorkspace } from '@nesy/metronic/config/menu-utils'
import { usePathname } from 'next/navigation'
import { SidebarPrimaryMenu } from './sidebar-primary-menu'
import { SidebarWorkspaceSections } from './sidebar-workspace-sections'
import { SidebarSearch } from './sidebar-search'
import { SidebarHeader } from './sidebar-header'
import { SidebarDataCenterMenu } from './sidebar-data-center-menu'

export function SidebarSecondary() {
  const pathname = usePathname()
  const workspace = getActiveWorkspace(pathname)
  const isDataCenter = workspace.id === 'data-center'

  return (
    <div className="lg:rounded-s-xl bg-background overflow-hidden border border-border">
      <SidebarHeader />
      <ScrollArea className="shrink-0 h-[calc(100vh-4.5rem)] lg:h-[calc(100vh-5.5rem)] mt-0 mb-2.5">
        <SidebarSearch />
        {isDataCenter ? (
          <SidebarDataCenterMenu />
        ) : (
          <>
            <SidebarPrimaryMenu />
            <SidebarWorkspaceSections />
          </>
        )}
      </ScrollArea>
    </div>
  )
}
