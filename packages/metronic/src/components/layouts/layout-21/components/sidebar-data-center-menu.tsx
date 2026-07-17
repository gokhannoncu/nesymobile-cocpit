'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  DATA_CENTER_CONNECTION_PATH,
  DATA_CENTER_HAPPY_PATH_PATH,
  DATA_CENTER_PICKUP_PATH,
  DATA_CENTER_SHIPMENT_PATH,
  DATA_CENTER_USERS_PATH,
} from '@nesy/metronic/config/layout-21.config'
import {
  AccordionMenu,
  AccordionMenuIndicator,
  AccordionMenuItem,
  AccordionMenuLabel,
  AccordionMenuSub,
  AccordionMenuSubContent,
  AccordionMenuSubTrigger,
} from '@nesy/metronic/components/ui/accordion-menu'
import { Separator } from '@nesy/metronic/components/ui/separator'
import { Calendar, PackagePlus, Plug, Truck, Users } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { SidebarNavLink } from './navigation-feedback'

const LOCKED_OPERATION_PATHS = [
  DATA_CENTER_SHIPMENT_PATH,
  DATA_CENTER_PICKUP_PATH,
  DATA_CENTER_HAPPY_PATH_PATH,
  DATA_CENTER_USERS_PATH,
] as const

const LOCK_TITLE = 'Connect to Nesy Dashboard from the Connection page first.'

interface AuthGateSnapshot {
  ready: boolean
  connected: boolean
}

function readAuthGate(): AuthGateSnapshot {
  if (typeof window === 'undefined') {
    return { ready: false, connected: false }
  }

  try {
    const raw = localStorage.getItem('nesy-auth')
    if (!raw) {
      return { ready: true, connected: false }
    }
    const parsed = JSON.parse(raw) as { token?: string }
    return { ready: true, connected: Boolean(parsed.token) }
  } catch {
    return { ready: true, connected: false }
  }
}

const MANAGEMENT_ITEMS = [
  {
    title: 'Shipment Operations',
    path: DATA_CENTER_SHIPMENT_PATH,
    icon: Truck,
  },
  {
    title: 'Pickup Operations',
    path: DATA_CENTER_PICKUP_PATH,
    icon: Calendar,
  },
  {
    title: 'Happy Path Operations',
    path: DATA_CENTER_HAPPY_PATH_PATH,
    icon: PackagePlus,
  },
  {
    title: 'User Operations',
    path: DATA_CENTER_USERS_PATH,
    icon: Users,
  },
] as const

export function SidebarDataCenterMenu() {
  const pathname = usePathname()
  const [authGate, setAuthGate] = useState<AuthGateSnapshot>({ ready: false, connected: false })

  useEffect(() => {
    setAuthGate(readAuthGate())

    function syncAuthGate() {
      setAuthGate(readAuthGate())
    }

    window.addEventListener('storage', syncAuthGate)
    window.addEventListener('focus', syncAuthGate)
    window.addEventListener('nesy-auth-changed', syncAuthGate)
    return () => {
      window.removeEventListener('storage', syncAuthGate)
      window.removeEventListener('focus', syncAuthGate)
      window.removeEventListener('nesy-auth-changed', syncAuthGate)
    }
  }, [pathname])

  const operationsEnabled = authGate.ready && authGate.connected

  const matchPath = useCallback(
    (path: string): boolean =>
      path === pathname || (path.length > 1 && pathname.startsWith(path) && path !== '/'),
    [pathname],
  )

  return (
    <>
      <AccordionMenu
        selectedValue={pathname}
        matchPath={matchPath}
        type="single"
        collapsible
        defaultValue="data-center-root"
        className="space-y-7.5 px-2.5"
        classNames={{
          label: 'mt-2.5 text-xs font-normal text-muted-foreground mb-2',
          item: 'h-8.5 px-2.5 text-sm font-normal text-foreground hover:text-primary data-[selected=true]:bg-muted data-[selected=true]:text-foreground [&[data-selected=true]_svg]:opacity-100',
          group: '',
        }}
      >
        <AccordionMenuLabel>Data Center</AccordionMenuLabel>
        <AccordionMenuItem value={DATA_CENTER_CONNECTION_PATH}>
          <SidebarNavLink href={DATA_CENTER_CONNECTION_PATH} navigationLabel="Connection">
            <Plug />
            <span>Connection</span>
          </SidebarNavLink>
        </AccordionMenuItem>
      </AccordionMenu>

      <Separator className="my-2.5" />

      <AccordionMenu
        selectedValue={pathname}
        matchPath={matchPath}
        type="single"
        collapsible
        defaultValue="data-center-management"
        className="space-y-7.5 px-2.5"
        classNames={{
          item: 'h-8.5 px-2.5 text-sm font-normal text-foreground hover:text-primary hover:bg-muted/50 data-[selected=true]:bg-muted data-[selected=true]:text-foreground data-[selected=true]:hover:bg-muted [&[data-selected=true]_svg]:opacity-100',
          subTrigger: 'text-xs font-normal text-muted-foreground hover:bg-transparent group [&_[data-slot=accordion-menu-sub-indicator]]:hidden',
          subContent: 'ps-0',
          indicator: 'ms-auto flex items-center font-medium',
        }}
      >
        <AccordionMenuSub value="data-center-management">
          <AccordionMenuSubTrigger value="data-center-management-trigger">
            <span>Management</span>
            <AccordionMenuIndicator />
          </AccordionMenuSubTrigger>
          <AccordionMenuSubContent type="single" collapsible parentValue="data-center-management-trigger">
            {MANAGEMENT_ITEMS.map((item) => {
              const locked = LOCKED_OPERATION_PATHS.includes(item.path) && !operationsEnabled

              return (
                <AccordionMenuItem key={item.path} value={item.path}>
                  {locked ? (
                    <span
                      className="flex w-full items-center gap-2 pointer-events-none cursor-not-allowed select-none opacity-45 text-muted-foreground"
                      aria-disabled
                      title={LOCK_TITLE}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </span>
                  ) : (
                    <SidebarNavLink href={item.path} navigationLabel={item.title}>
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarNavLink>
                  )}
                </AccordionMenuItem>
              )
            })}
          </AccordionMenuSubContent>
        </AccordionMenuSub>
      </AccordionMenu>
    </>
  )
}
