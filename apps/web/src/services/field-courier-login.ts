const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api'

export type FieldCourierLoginRecord = {
  id: string
  country: string
  environment: string
  courierUserId: string | null
  courierUsername: string | null
  courierFullName: string | null
  hubId: string | null
  hubName: string | null
  waybillNumber: string | null
  legacyBarcode: string | null
  barcode: string | null
  deviceCode: string | null
  adbDeviceId: string | null
  adminUserId: string | null
  adminUsername: string | null
  status: string
  errorMessage: string | null
  failedStep: string | null
  maestroRunId: string | null
  createdAt: string
}

export type FieldLoginStepId =
  | 'validate_device'
  | 'resolve_courier'
  | 'align_hub'
  | 'fetch_pin'
  | 'read_device_code'
  | 'register_device'
  | 'maestro_login'
  | 'restore_hub'
  | 'persist'

export type FieldLoginStep = {
  id: FieldLoginStepId
  label: string
  detail: string | null
  status: 'pending' | 'active' | 'done' | 'error' | 'skipped'
}

export type FieldLoginSession = {
  id: string
  status: 'running' | 'success' | 'failed'
  steps: FieldLoginStep[]
  errorMessage: string | null
  failedStep: FieldLoginStepId | null
  historyId: string | null
  createdAt: string
  updatedAt: string
}

export type FieldLoginSessionInput = {
  country: string
  environment: string
  trackingNumber?: string
  barcode?: string
  legacyBarcode?: string
  courierName?: string
  courierUsername?: string
}

async function readJson(res: Response) {
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      (json as { message?: string }).message ?? `Request failed (${res.status})`,
    )
  }
  return json
}

export async function fetchFieldCourierLogins(params?: {
  country?: string
  environment?: string
}): Promise<FieldCourierLoginRecord[]> {
  const search = new URLSearchParams()
  if (params?.country) search.set('country', params.country)
  if (params?.environment) search.set('environment', params.environment)
  const q = search.toString()
  const res = await fetch(`${API_BASE}/field-courier-login${q ? `?${q}` : ''}`)
  const json = await readJson(res)
  return (json.data ?? []) as FieldCourierLoginRecord[]
}

export async function deleteFieldCourierLogin(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/field-courier-login/${id}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) {
    const json = await res.json().catch(() => ({}))
    throw new Error((json as { message?: string }).message ?? 'Delete failed')
  }
}

export async function startFieldCourierLoginSession(
  input: FieldLoginSessionInput,
): Promise<FieldLoginSession> {
  const res = await fetch(`${API_BASE}/field-courier-login/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const json = await readJson(res)
  return json.data as FieldLoginSession
}

export function subscribeFieldCourierLoginSession(
  sessionId: string,
  onUpdate: (session: FieldLoginSession) => void,
  onError?: (error: Error) => void,
): () => void {
  const url = `${API_BASE}/field-courier-login/sessions/${sessionId}/events`
  const source = new EventSource(url)

  source.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as FieldLoginSession
      onUpdate(data)
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error('Invalid SSE payload'))
    }
  }

  source.addEventListener('end', () => {
    source.close()
  })

  source.onerror = () => {
    // Fall back to poll once on stream error
    void fetch(`${API_BASE}/field-courier-login/sessions/${sessionId}`)
      .then((res) => res.json())
      .then((json) => {
        if (json?.data) onUpdate(json.data as FieldLoginSession)
      })
      .catch((err) => {
        onError?.(err instanceof Error ? err : new Error('Session poll failed'))
      })
  }

  return () => source.close()
}
