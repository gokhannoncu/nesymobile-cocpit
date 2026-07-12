'use client'

import { getActiveWorkspace } from '@nesy/metronic/config/menu-utils'
import { MenuItem } from '@nesy/metronic/config/types'
import { Separator } from '@nesy/metronic/components/ui/separator'
import { usePathname } from 'next/navigation'
import { SidebarCollapsibleSection } from './sidebar-collapsible-section'

function toSectionId(title: string, index: number) {
  const slug = title
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return slug || `section-${index}`
}

function getCollapsibleGroups(menu: MenuItem[]) {
  return menu.flatMap((group) =>
    (group.children ?? []).filter(
      (item) => item.children && item.children.length > 0 && item.title,
    ),
  )
}

export function SidebarWorkspaceSections() {
  const pathname = usePathname()
  const workspace = getActiveWorkspace(pathname)
  const groups = workspace.menu.flatMap((group) => getCollapsibleGroups([group]))

  if (groups.length === 0) {
    return null
  }

  return (
    <>
      {groups.map((group, index) => {
        const sectionId = toSectionId(group.title!, index)
        const items =
          group.children
            ?.filter((child) => child.path && child.title)
            .map((child) => ({
              title: child.title!,
              path: child.path!,
              icon: child.icon,
            })) ?? []

        return (
          <div key={sectionId}>
            <Separator className="my-2.5" />
            <SidebarCollapsibleSection
              title={group.title!}
              sectionId={sectionId}
              items={items}
            />
          </div>
        )
      })}
    </>
  )
}
