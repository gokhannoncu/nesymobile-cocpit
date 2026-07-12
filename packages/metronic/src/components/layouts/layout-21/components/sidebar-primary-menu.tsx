import { useCallback } from "react";
import { getActiveWorkspace } from "@nesy/metronic/config/menu-utils";
import { MenuConfig, MenuItem } from "@nesy/metronic/config/types";
import {
  AccordionMenu,
  AccordionMenuGroup,
  AccordionMenuItem,
  AccordionMenuLabel,
} from '@nesy/metronic/components/ui/accordion-menu';
import { Badge } from '@nesy/metronic/components/ui/badge';
import { usePathname } from 'next/navigation';
import { SidebarNavLink } from './navigation-feedback';

function renderLeafItems(items: MenuConfig) {
  return items
    .filter((item) => !item.children?.length)
    .map((item: MenuItem, index: number) => (
      <AccordionMenuItem key={item.path || index} value={item.path || '#'}>
        <SidebarNavLink href={item.path || '#'} navigationLabel={item.title}>
          {item.icon && <item.icon />}
          <span>{item.title}</span>
          {item.badge == 'Beta' && (
            <Badge size="sm" variant="destructive" appearance="light">{item.badge}</Badge>
          )}
        </SidebarNavLink>
      </AccordionMenuItem>
    ));
}

export function SidebarPrimaryMenu() {
  const pathname = usePathname();
  const activeWorkspace = getActiveWorkspace(pathname);

  const matchPath = useCallback(
    (path: string): boolean =>
      path === pathname || (path.length > 1 && pathname.startsWith(path) && path !== '/'),
    [pathname],
  );

  return (
    <AccordionMenu
      selectedValue={pathname}
      matchPath={matchPath}
      type="multiple"
      className="space-y-7.5 px-2.5"
      classNames={{
        label: 'mt-2.5 text-xs font-normal text-muted-foreground mb-2',
        item: 'h-8.5 px-2.5 text-sm font-normal text-foreground hover:text-primary data-[selected=true]:bg-muted data-[selected=true]:text-foreground [&[data-selected=true]_svg]:opacity-100',
        group: '',
      }}
    >
      {activeWorkspace.menu.map((item, index) => {
        return (
          <AccordionMenuGroup key={index}>
            {item.title && (
              <AccordionMenuLabel>
                {item.title}
              </AccordionMenuLabel>
            )}
            {item.children && renderLeafItems(item.children)}
          </AccordionMenuGroup>
        )
      })}
    </AccordionMenu>
  );
}
