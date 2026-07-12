'use client'

import { useParams, notFound } from 'next/navigation'
import { findWorkspaceMenuItem } from '@nesy/metronic/config/menu-utils'
import { Skeleton } from '@nesy/metronic/components/ui/skeleton'
import { Button } from '@nesy/metronic/components/ui/button'
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
  ToolbarPageTitle,
  ToolbarWrapper,
} from '@nesy/metronic/layout-21/components/toolbar'
import { ExternalLink } from 'lucide-react'

export default function NotionPlaceholderPage() {
  const params = useParams()
  const slug = params.slug
  const segments = Array.isArray(slug) ? slug : slug ? [slug] : []
  const path = '/' + segments.join('/')

  const item = findWorkspaceMenuItem(path)

  if (!item) {
    notFound()
  }

  return (
    <div className="container-fluid">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle>{item.title}</ToolbarPageTitle>
        </ToolbarHeading>
        {item.notionUrl && (
          <ToolbarWrapper>
            <ToolbarActions>
              <Button size="sm" variant="outline" asChild>
                <a href={item.notionUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink />
                  Notion&apos;da Aç
                </a>
              </Button>
            </ToolbarActions>
          </ToolbarWrapper>
        )}
      </Toolbar>
      <Skeleton className="h-96 grow rounded-lg" />
    </div>
  )
}
