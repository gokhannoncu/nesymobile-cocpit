'use client'

import { useCallback } from 'react'
import { type LucideIcon } from 'lucide-react'
import {
  AccordionMenu,
  AccordionMenuIndicator,
  AccordionMenuItem,
  AccordionMenuSub,
  AccordionMenuSubContent,
  AccordionMenuSubTrigger,
} from '@nesy/metronic/components/ui/accordion-menu'
import { usePathname } from 'next/navigation'
import { SidebarNavLink } from './navigation-feedback'

export interface CollapsibleSectionItem {
  title: string
  path: string
  icon?: LucideIcon
}

interface SidebarCollapsibleSectionProps {
  title: string
  sectionId: string
  items: CollapsibleSectionItem[]
  defaultOpen?: boolean
}

export function SidebarCollapsibleSection({
  title,
  sectionId,
  items,
  defaultOpen = true,
}: SidebarCollapsibleSectionProps) {
  const pathname = usePathname()
  const triggerId = `${sectionId}-trigger`

  const matchPath = useCallback(
    (path: string): boolean =>
      path === pathname || (path.length > 1 && pathname.startsWith(path) && path !== '/'),
    [pathname],
  )

  return (
    <AccordionMenu
      type="single"
      collapsible
      defaultValue={defaultOpen ? sectionId : undefined}
      selectedValue={pathname}
      matchPath={matchPath}
      className="space-y-7.5 px-2.5"
      classNames={{
        item: 'h-8 px-2.5 text-2sm font-normal text-foreground hover:text-primary data-[selected=true]:bg-muted data-[selected=true]:text-foreground [&[data-selected=true]_svg]:opacity-100 [&_svg:not([class*=size-])]:size-3.5',
        subTrigger: 'text-xs font-normal text-muted-foreground hover:bg-transparent',
        subContent: 'ps-0',
      }}
    >
      <AccordionMenuSub value={sectionId}>
        <AccordionMenuSubTrigger>
          <span>{title}</span>
          <AccordionMenuIndicator />
        </AccordionMenuSubTrigger>
        <AccordionMenuSubContent type="single" collapsible parentValue={triggerId}>
          {items.map((item, index) => (
            <AccordionMenuItem key={item.path || index} value={item.path}>
              <SidebarNavLink href={item.path} navigationLabel={item.title}>
                {item.icon && <item.icon />}
                <span>{item.title}</span>
              </SidebarNavLink>
            </AccordionMenuItem>
          ))}
        </AccordionMenuSubContent>
      </AccordionMenuSub>
    </AccordionMenu>
  )
}
