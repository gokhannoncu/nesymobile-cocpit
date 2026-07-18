// Graylog Query Generator — UI constants and presentation helpers.
// Fields + recent queries come from /api/graylog-query.

import type { Tone } from '@/components/product'

// ── Query context options ────────────────────────────────────

export type SelectOption = { value: string; label: string }

export const ENVIRONMENTS: SelectOption[] = [
  { value: 'uat', label: 'UAT' },
  { value: 'production', label: 'Production' },
]

export const COUNTRIES: SelectOption[] = [
  { value: 'HR', label: 'HR — Croatia' },
  { value: 'SI', label: 'SI — Slovenia' },
  { value: 'RS', label: 'RS — Serbia' },
  { value: 'BA', label: 'BA — Bosnia and Herzegovina' },
  { value: 'ME', label: 'ME — Montenegro' },
  { value: 'SK', label: 'SK — Slovakia' },
  { value: 'AZ', label: 'AZ — Azerbaijan' },
  { value: 'BG', label: 'BG — Bulgaria' },
]

export const APPLICATIONS: SelectOption[] = [
  { value: 'nesy-mobile', label: 'nesy-mobile' },
  { value: 'nesy-backend', label: 'nesy-backend' },
  { value: 'nesy-fiscal', label: 'nesy-fiscal' },
  { value: 'nesy-d4me', label: 'nesy-d4me' },
]

export const SERVICES: SelectOption[] = [
  { value: 'any', label: 'All' },
  { value: 'RequestSenderService', label: 'RequestSenderService' },
  { value: 'DeliveryService', label: 'DeliveryService' },
  { value: 'FiscalService', label: 'FiscalService' },
  { value: 'AuthService', label: 'AuthService' },
  { value: 'LocationService', label: 'LocationService' },
  { value: 'NotificationService', label: 'NotificationService' },
]

export const LOG_LEVELS: SelectOption[] = [
  { value: 'any', label: 'All' },
  { value: 'error', label: 'ERROR' },
  { value: 'warn', label: 'WARN' },
  { value: 'info', label: 'INFO' },
  { value: 'debug', label: 'DEBUG' },
]

export const TIME_RANGES: SelectOption[] = [
  { value: '15m', label: 'Last 15 minutes' },
  { value: '1h', label: 'Last 1 hour' },
  { value: '6h', label: 'Last 6 hours' },
  { value: '24h', label: 'Last 24 hours' },
  { value: 'custom', label: 'Custom' },
]

/** Default time range in Production — limits broad search costs. */
export const PRODUCTION_DEFAULT_TIME_RANGE = '1h'

export const DEVICES: SelectOption[] = [
  { value: 'any', label: 'All' },
  { value: 'NX-4412', label: 'NX-4412' },
  { value: 'NX-2087', label: 'NX-2087' },
  { value: 'NX-3155', label: 'NX-3155' },
]

export const APP_VERSIONS: SelectOption[] = [
  { value: 'any', label: 'All' },
  { value: '4.12.0', label: '4.12.0' },
  { value: '4.11.2', label: '4.11.2' },
  { value: '4.10.5', label: '4.10.5' },
]

// ── Known identifiers ────────────────────────────────────────────

export type IdentifierField = {
  key: string
  label: string
  placeholder: string
}

export const IDENTIFIER_FIELDS: IdentifierField[] = [
  { key: 'shipmentId', label: 'Shipment ID', placeholder: '45-40-20251224-1' },
  { key: 'courierId', label: 'Courier ID', placeholder: '3021' },
  { key: 'scheduleId', label: 'Schedule ID', placeholder: 'SCH-2025-8841' },
  { key: 'requestId', label: 'Request ID', placeholder: 'req_9f3c1a72' },
  { key: 'deviceId', label: 'Device ID', placeholder: 'NX-4412' },
  { key: 'fiscalId', label: 'Fiscal ID', placeholder: 'FIS-HR-338291' },
  { key: 'errorCode', label: 'Error code', placeholder: 'FISCAL_TIMEOUT' },
  { key: 'customerTicketId', label: 'Customer ticket ID', placeholder: 'CT-10592' },
]

// ── Log sources ───────────────────────────────────────────────

export type LogSource = { id: string; label: string }

export const LOG_SOURCES: LogSource[] = [
  { id: 'mobile', label: 'Mobile application' },
  { id: 'backend', label: 'Backend API' },
  { id: 'fiscal', label: 'Fiscal service' },
  { id: 'd4me', label: 'D4Me / Locker' },
  { id: 'notification', label: 'Notification' },
  { id: 'location', label: 'Location service' },
  { id: 'offline-queue', label: 'Offline queue' },
  { id: 'auth', label: 'Authentication' },
]

// ── Guardrail messages ──────────────────────────────────────────

export const GUARDRAIL_BROAD_SCOPE =
  'This search can generate a very broad log volume. Narrow the scope by adding a service, country, or identifier.'

export const GUARDRAIL_SOFT_HINTS = [
  'The query can work, but it looks very broad.',
  'For faster results, add one of the shipmentId, requestId, or service fields.',
]

// ── Recent history helpers ────────────────────────────────────

export type RecentQueryStatus = 'validated' | 'warning'

export const RECENT_STATUS_META: Record<RecentQueryStatus, { label: string; tone: Tone }> = {
  validated: { label: 'Validated', tone: 'green' },
  warning: { label: 'Warning', tone: 'amber' },
}

export function normalizeRecentStatus(status: string): RecentQueryStatus {
  return status === 'warning' ? 'warning' : 'validated'
}

export function formatLastUsed(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
