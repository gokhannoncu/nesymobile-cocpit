import { API_BASE } from '@/services/api'
import type { NesyCountry, NesyEnvironment } from '@/services/nesy-auth'
import type { NesyMobileCountry, NesyMobileEnvironment } from '@/services/nesy-mobile-env'

export interface NesyDashboardEnvironmentEntry {
  apiUrl: string
  dashboardUrl: string
  configured: boolean
  loginEndpoint: string
}

export interface NesyMobileEnvironmentEntry {
  apiUrl: string
  applicationId: string
  selectable: boolean
}

export interface NesyEnvironmentsResponse {
  dashboard: Record<string, Record<string, NesyDashboardEnvironmentEntry>>
  mobile: Record<string, Record<string, NesyMobileEnvironmentEntry>>
}

export async function fetchNesyEnvironments(): Promise<NesyEnvironmentsResponse> {
  const response = await fetch(`${API_BASE}/nesy/environments`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('Failed to fetch Nesy environment configuration.')
  }

  return response.json() as Promise<NesyEnvironmentsResponse>
}

export function buildShipmentDetailUrl(
  dashboardUrl: string,
  shipmentId: string,
): string {
  const base = dashboardUrl.replace(/\/$/, '')
  return `${base}/main/shipment-detail/${encodeURIComponent(shipmentId)}`
}

export type NesyScope = {
  country: NesyCountry | NesyMobileCountry
  environment: NesyEnvironment | NesyMobileEnvironment
}
