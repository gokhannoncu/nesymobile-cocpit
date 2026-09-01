'use client'

import React from 'react'
import { DomainPackState } from '@/lib/verdict-runtime/types'
import { cn } from '@nesy/metronic/lib/utils'

interface DomainPackStateBadgeProps {
  state: DomainPackState
  className?: string
}

export function DomainPackStateBadge({ state, className }: DomainPackStateBadgeProps) {
  const baseClasses =
    'inline-flex items-center rounded-[4px] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide'

  const stateClasses = {
    DRAFT: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
    PUBLISHED: 'bg-emerald-600 text-white dark:bg-emerald-600 dark:text-white',
    ARCHIVED: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  }

  return (
    <span className={cn(baseClasses, stateClasses[state], className)}>
      {state}
    </span>
  )
}
