import { API_BASE } from '@/services/api'

export type EngineeringIncidentSeverity = 'SEV-1' | 'SEV-2' | 'SEV-3'
export type EngineeringIncidentStatus =
  | 'ASSESSING'
  | 'INVESTIGATING'
  | 'IDENTIFIED'
  | 'MITIGATING'
  | 'MONITORING'
  | 'RESOLVED'

export interface EngineeringIncidentEvent {
  id: string
  incidentId: string
  eventType: 'CREATED' | 'STATUS_CHANGED' | 'RESOLVED' | string
  fromStatus: EngineeringIncidentStatus | null
  toStatus: EngineeringIncidentStatus | null
  message: string
  createdBy: string | null
  metadata: Record<string, unknown> | null
  occurredAt: string
}

export interface EngineeringIncident {
  id: string
  incidentNumber: string
  title: string
  summary: string | null
  severity: EngineeringIncidentSeverity
  status: EngineeringIncidentStatus
  objective: string
  countries: string[]
  environment: 'stage' | 'prod'
  appVersion: string
  affectedScreen: string
  riskTypes: string[]
  reporterName: string
  incidentCommander: string
  operationsLead: string | null
  communicationsLead: string | null
  scribe: string | null
  affectedCouriers: number
  affectedShipments: number
  affectedPaymentRecords: number
  relatedTicket: string | null
  nextCommunicationAt: string | null
  resolutionSummary: string | null
  rootCause: string | null
  startedAt: string
  endedAt: string | null
  durationSeconds: number | null
  lastUpdateAt: string
  createdAt: string
  updatedAt: string
  events: EngineeringIncidentEvent[]
}

export interface StartEngineeringIncidentInput {
  title: string
  summary?: string
  severity: EngineeringIncidentSeverity
  objective: string
  countries: string[]
  environment: 'stage' | 'prod'
  appVersion: string
  affectedScreen: string
  riskTypes: string[]
  reporterName: string
  incidentCommander: string
  operationsLead?: string
  communicationsLead?: string
  scribe?: string
  affectedCouriers: number
  affectedShipments: number
  affectedPaymentRecords: number
  relatedTicket?: string
  nextCommunicationAt?: string
}

interface ApiErrorBody {
  message?: string
  errors?: string[]
}

async function readIncidentResponse(response: Response): Promise<EngineeringIncident> {
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody & {
    data?: EngineeringIncident
  }
  if (!response.ok || !body.data) {
    const detail = Array.isArray(body.errors) ? ` ${body.errors.join(' ')}` : ''
    throw new Error(`${body.message ?? `Incident isteği başarısız (${response.status}).`}${detail}`)
  }
  return body.data
}

export async function fetchActiveEngineeringIncident(): Promise<EngineeringIncident | null> {
  const response = await fetch(`${API_BASE}/incidents/active`, { cache: 'no-store' })
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody & {
    data?: EngineeringIncident | null
  }
  if (!response.ok) {
    throw new Error(body.message ?? `Aktif incident yüklenemedi (${response.status}).`)
  }
  return body.data ?? null
}

export async function startEngineeringIncident(
  input: StartEngineeringIncidentInput,
): Promise<EngineeringIncident> {
  const response = await fetch(`${API_BASE}/incidents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return readIncidentResponse(response)
}

export async function updateEngineeringIncidentStatus(
  id: string,
  status: Exclude<EngineeringIncidentStatus, 'RESOLVED'>,
  createdBy?: string,
): Promise<EngineeringIncident> {
  const response = await fetch(`${API_BASE}/incidents/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, createdBy }),
  })
  return readIncidentResponse(response)
}

export async function finishEngineeringIncident(
  id: string,
  input: { resolutionSummary: string; rootCause?: string; createdBy?: string },
): Promise<EngineeringIncident> {
  const response = await fetch(`${API_BASE}/incidents/${encodeURIComponent(id)}/finish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return readIncidentResponse(response)
}
