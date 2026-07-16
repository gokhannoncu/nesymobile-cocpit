'use client'

import dynamic from 'next/dynamic'
import { Fragment } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbSeparator,
  BreadcrumbLink,
  BreadcrumbPage,
} from '@nesy/metronic/components/ui/breadcrumb'
import { getActiveWorkspace, getBreadcrumbs } from '@nesy/metronic/config/menu-utils'
import { useLayout } from './context'
import { Button } from '@nesy/metronic/components/ui/button'
import { PanelRight } from 'lucide-react'

const PdfButton = dynamic(
  () => import('./pdf-button').then((m) => ({ default: m.PdfButton })),
  { ssr: false },
)

export function HeaderBreadcrumbs() {
  const { isMobile, sidebarToggle } = useLayout()
  const pathname = usePathname()
  const workspace = getActiveWorkspace(pathname)
  const crumbs = getBreadcrumbs(pathname)
  const hideCrumbs = workspace.id === 'data-center'

  return (
    // data-pdf-exclude: rendered inside main on mobile, so exclude it from PDF capture
    <div
      data-pdf-exclude
      className="grow flex flex-row items-center flex-wrap gap-1 mb-5 lg:mb-0 px-4 pt-3.5 lg:pt-0 lg:px-0"
    >
      {!isMobile && (
        <Button variant="ghost" mode="icon" onClick={sidebarToggle} className="hidden in-data-[sidebar-open=false]:inline-flex">
          <PanelRight className="opacity-100" />
        </Button>
      )}
      {!hideCrumbs && (
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((crumb, index) => (
            <Fragment key={`${crumb.title}-${index}`}>
              {index > 0 && (
                <BreadcrumbSeparator className="text-xs text-muted-foreground">/</BreadcrumbSeparator>
              )}
              <BreadcrumbItem>
                {crumb.path ? (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.path}>{crumb.title}</Link>
                  </BreadcrumbLink>
                ) : index === crumbs.length - 1 ? (
                  <BreadcrumbPage>{crumb.title}</BreadcrumbPage>
                ) : (
                  <span className="text-muted-foreground">{crumb.title}</span>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      )}
      <PdfButton className="ms-auto" />
    </div>
  )
}
