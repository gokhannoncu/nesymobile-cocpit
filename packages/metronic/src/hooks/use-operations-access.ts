'use client'

import { canAccessOperations } from '@nesy/metronic/config/permissions'

export function useOperationsAccess(): boolean {
  return canAccessOperations()
}
