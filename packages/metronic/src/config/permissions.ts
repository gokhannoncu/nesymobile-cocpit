import { OPERATIONS_BASE_PATH } from '@nesy/metronic/config/operations.config'

/**
 * Operations / Admin erişimi.
 * Üretimde NEXT_PUBLIC_NESY_OPS_ACCESS=true ile açılır; geliştirmede varsayılan açık.
 */
export function canAccessOperations(): boolean {
  const flag = process.env.NEXT_PUBLIC_NESY_OPS_ACCESS

  if (flag === 'true') {
    return true
  }

  if (flag === 'false') {
    return false
  }

  return process.env.NODE_ENV === 'development'
}

export function isOperationsPath(pathname: string): boolean {
  return pathname === OPERATIONS_BASE_PATH || pathname.startsWith(`${OPERATIONS_BASE_PATH}/`)
}
