'use client'

import { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { findWorkspaceMenuItem, getActiveWorkspace } from '@nesy/metronic/config/menu-utils'
import {
  Toolbar,
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
  children,
}: {
  /** Route path — e.g. "/product/solution-overview". Title is resolved from config. */
  path: string
  /** Fallback title if not found in config. */
  title?: string
  children: ReactNode
}) {
  const item = findWorkspaceMenuItem(path)
  // Is this a group overview page? (workspace root route = overview). Excluding home.
  const workspace = getActiveWorkspace(path)
  const isGroupOverview = workspace.path === path && path !== '/'

  return (
    <div className="container-fluid min-w-0 max-w-full">
      <Toolbar>
        <ToolbarWrapper>
          <ToolbarHeading>
            <ToolbarPageTitle>{item?.title ?? title ?? 'Product'}</ToolbarPageTitle>
          </ToolbarHeading>
          {isGroupOverview && workspace.id !== 'data-center' && (
            <div className="flex items-center gap-2">
              <GroupPdfButton workspace={workspace} />
            </div>
          )}
        </ToolbarWrapper>
      </Toolbar>
      <div className="space-y-8 pb-12">{children}</div>
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
