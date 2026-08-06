'use client'

import React from 'react'
import { DomainPackState } from '@/lib/verdict-runtime/types'
import { cn } from '@nesy/metronic/lib/utils'

interface DomainPackStateBadgeProps {
  state: DomainPackState
  className?: string
}

export function DomainPackStateBadge({ state, className }: DomainPackStateBadgeProps) {
  const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium'
  
  const stateClasses = {
    DRAFT: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
    PUBLISHED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
    ARCHIVED: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  }

  return (
    <span className={cn(baseClasses, stateClasses[state], className)}>
      {state}
    </span>
  )
}
