'use client'

import { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { findWorkspaceMenuItem, getActiveWorkspace } from '@nesy/metronic/config/menu-utils'
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
  ToolbarPageTitle,
  ToolbarWrapper,
} from '@nesy/metronic/layout-21/components/toolbar'
import { EASE, type Tone, toneIcon } from './tones'

const GroupPdfButton = dynamic(
  () => import('./group-pdf-button').then((m) => ({ default: m.GroupPdfButton })),
  { ssr: false },
)

/**
 * Product area standard page shell.
 * Title comes from sidebar config (findWorkspaceMenuItem) — single source of truth.
 */
export function ProductPage({
  path,
  title,
  hideToolbar = false,
  toolbarHeading,
  toolbarActions,
  children,
}: {
  /** Route path — e.g. "/product/solution-overview". Title is resolved from config. */
  path: string
  /** Fallback title if not found in config. */
  title?: string
  /** Hide the default page title toolbar when the page provides its own header banner. */
  hideToolbar?: boolean
  /** Custom toolbar heading — e.g. back link + breadcrumb on detail pages. */
  toolbarHeading?: ReactNode
  /** Optional right-side toolbar content. */
  toolbarActions?: ReactNode
  children: ReactNode
}) {
  const item = findWorkspaceMenuItem(path)
  // Is this a group overview page? (workspace root route = overview). Excluding home.
  const workspace = getActiveWorkspace(path)
  const isGroupOverview = workspace.path === path && path !== '/'
  // Debug View / Data Center use their own page headers; skip the generic toolbar.
  const showToolbar =
    (!hideToolbar || toolbarHeading != null) &&
    workspace.id !== 'data-center' &&
    workspace.id !== 'debug-view'

  return (
    <div className="container-fluid min-w-0 max-w-full">
      {showToolbar && (
      <Toolbar>
        <ToolbarWrapper>
          <ToolbarHeading>
            {toolbarHeading ?? (
              <ToolbarPageTitle>{item?.title ?? title ?? 'Product'}</ToolbarPageTitle>
            )}
          </ToolbarHeading>
          {toolbarActions ? (
            <ToolbarActions>{toolbarActions}</ToolbarActions>
          ) : (
            isGroupOverview &&
            workspace.id !== 'product' &&
            workspace.id !== 'data-center' &&
            workspace.id !== 'automation' &&
            workspace.id !== 'debug-view' && (
              <div className="flex items-center gap-2">
                <GroupPdfButton workspace={workspace} />
              </div>
            )
          )}
        </ToolbarWrapper>
      </Toolbar>
      )}
      <div className={showToolbar ? 'space-y-8 pb-12' : 'space-y-8 pb-12 pt-2'}>{children}</div>
    </div>
  )
}

/** Section heading — eyebrow + title + optional description, with icon. */
export function PageSection({
  eyebrow,
  title,
  description,
  icon: Icon,
  tone = 'gray',
  children,
  className,
  id,
  slide,
  slideOrder,
}: {
  eyebrow?: string
  title: string
  description?: string
  icon?: LucideIcon
  tone?: Tone
  children: ReactNode
  className?: string
  /** In-page anchor target. */
  id?: string
  /** In scheduled PDF export, places this section on its own slide (own page). */
  slide?: boolean
  /** Scheduled PDF export slide order (default: DOM order). */
  slideOrder?: number
}) {
  return (
    <motion.section
      id={id}
      data-pdf-slide={slide ? '' : undefined}
      data-pdf-slide-order={slide && slideOrder != null ? slideOrder : undefined}
      className={cn('space-y-4', className)}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <header>
        {eyebrow && (
          <div className={cn('text-[11px] font-bold uppercase tracking-[0.18em]', toneIcon[tone])}>
            {eyebrow}
          </div>
        )}
        <div className="mt-1 flex items-center gap-2">
          {Icon && <Icon className={cn('size-5 shrink-0', toneIcon[tone])} />}
          <h2 className="text-lg lg:text-xl font-bold text-foreground">{title}</h2>
        </div>
        {description && (
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </header>
      {children}
    </motion.section>
  )
}
