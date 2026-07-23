const AUTOMATION_API_BASE =
  process.env.NEXT_PUBLIC_AUTOMATION_API_URL ?? '/automation-api'

export interface WorkflowListItem {
  id: string
  slug: string
  name: string
  description: string | null
  status: string
  category: string | null
  icon: string
  iconClassName: string
  currentVersionId: string | null
  createdAt: string
  updatedAt: string
  latestVersion: {
    id: string
    version: number
    createdAt: string
  } | null
  lastRun: {
    id: string
    status: string
    createdAt: string
    duration: number | null
  } | null
}

export interface WorkflowDetail {
  id: string
  slug: string
  name: string
  description: string | null
  status: string
  category: string | null
  icon: string
  iconClassName: string
  currentVersionId: string | null
  createdAt: string
  updatedAt: string
  currentVersion: {
    id: string
    version: number
    nodes: unknown[]
    edges: unknown[]
    config: Record<string, unknown> | null
    createdAt: string
  } | null
  draft: WorkflowDraft | null
}

export interface WorkflowDraft {
  nodes: unknown[]
  edges: unknown[]
  config: Record<string, unknown> | null
  baseVersionId: string | null
  updatedAt: string | null
}

export interface WorkflowVersion {
  id: string
  workflowId: string
  version: number
  nodes: unknown[]
  edges: unknown[]
  config: Record<string, unknown> | null
  changelog: string | null
  createdAt: string
}

export interface RunSpan {
  name: string
  startMs: number
  durationMs: number
  attrs?: Record<string, string | number | boolean>
}

export interface WorkflowRun {
  id: string
  workflowId: string
  versionId: string
  status: string
  mode: string
  targetStepId: string | null
  deviceId: string | null
  country: string | null
  environment: string | null
  startedAt: string | null
  completedAt: string | null
  duration: number | null
  screenshotDir?: string | null
  createdAt: string
  maestroOutput?: string | null
  spans?: RunSpan[] | null
  stepResults?: WorkflowStepResult[]
  version?: { version: number; nodes?: unknown[] }
  workflow?: {
    id: string
    slug: string
    name: string
  }
  device?: {
    modelName: string
    label: string | null
  } | null
}

export interface WorkflowStepResult {
  id: string
  runId: string
  nodeId: string
  nodeType: string
  nodeTitle: string
  order: number
  status: string
  output: string | null
  errorMessage: string | null
  screenshotPath: string | null
  startedAt: string | null
  completedAt: string | null
  duration: number | null
}

export interface RunStatusResponse {
  runId: string
  runStatus: string
  currentStepId: string | null
  steps: Array<{
    nodeId: string
    nodeType: string
    status: string
    duration: number | null
    errorMessage: string | null
  }>
}

export async function fetchWorkflows(params?: {
  status?: string
  category?: string
  search?: string
}): Promise<WorkflowListItem[]> {
  const searchParams = new URLSearchParams()
  if (params?.status) searchParams.set('status', params.status)
  if (params?.category) searchParams.set('category', params.category)
  if (params?.search) searchParams.set('search', params.search)

  const query = searchParams.toString()
  const url = `${AUTOMATION_API_BASE}/workflows${query ? `?${query}` : ''}`

  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch workflows')
  const json = await res.json()
  return json.data
}

export async function createWorkflow(data: {
  name: string
  description?: string
  category?: string
}): Promise<WorkflowListItem> {
  const res = await fetch(`${AUTOMATION_API_BASE}/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? 'Failed to create workflow')
  }
  const json = await res.json()
  return json.data
}

export async function fetchWorkflow(idOrSlug: string): Promise<WorkflowDetail> {
  const res = await fetch(`${AUTOMATION_API_BASE}/workflows/${idOrSlug}`)
  if (!res.ok) throw new Error('Failed to fetch workflow')
  const json = await res.json()
  return json.data
}

export async function updateWorkflow(
  id: string,
  data: Partial<{
    name: string
    description: string
    status: string
    category: string
    icon: string
    iconClassName: string
  }>,
): Promise<WorkflowListItem> {
  const res = await fetch(`${AUTOMATION_API_BASE}/workflows/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update workflow')
  const json = await res.json()
  return json.data
}

export async function deleteWorkflow(id: string): Promise<void> {
  const res = await fetch(`${AUTOMATION_API_BASE}/workflows/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete workflow')
}

export async function fetchVersions(workflowId: string): Promise<WorkflowVersion[]> {
  const res = await fetch(`${AUTOMATION_API_BASE}/workflows/${workflowId}/versions`)
  if (!res.ok) throw new Error('Failed to fetch versions')
  const json = await res.json()
  return json.data
}

export async function saveVersion(
  workflowId: string,
  data: {
    nodes: unknown[]
    edges: unknown[]
    config?: Record<string, unknown>
    changelog?: string
  },
): Promise<WorkflowVersion> {
  const res = await fetch(`${AUTOMATION_API_BASE}/workflows/${workflowId}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to save version')
  const json = await res.json()
  return json.data
}

export async function saveWorkflowDraft(
  workflowId: string,
  data: {
    nodes: unknown[]
    edges: unknown[]
    config?: Record<string, unknown>
    baseVersionId?: string | null
  },
  options?: { signal?: AbortSignal },
): Promise<WorkflowDraft> {
  const res = await fetch(`${AUTOMATION_API_BASE}/workflows/${workflowId}/draft`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    signal: options?.signal,
  })
  if (!res.ok) throw new Error('Failed to save workflow draft')
  const json = await res.json()
  return json.data.draft
}

export async function clearWorkflowDraft(workflowId: string): Promise<void> {
  const res = await fetch(`${AUTOMATION_API_BASE}/workflows/${workflowId}/draft`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to clear workflow draft')
}

export async function startWorkflowRun(
  workflowId: string,
  data: {
    selectedDeviceId?: string
    mode?: string
    targetStepId?: string
    country?: string
    environment?: string
    /** Runtime placeholders (e.g. barcode, pickupDbIds) — substituted into {{key}} tokens. */
    runInput?: Record<string, string>
  },
): Promise<{ runId: string; status: string }> {
  const res = await fetch(`${AUTOMATION_API_BASE}/workflows/${workflowId}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const errorBody = await res.json().catch(() => null)
    console.error('[startWorkflowRun] API error:', res.status, errorBody)
    throw new Error(errorBody?.message ?? errorBody?.error ?? 'Failed to start workflow run')
  }
  const json = await res.json()
  return json.data
}

export async function startStepRun(
  workflowId: string,
  data: {
    nodeId: string
    mode?: string
    selectedDeviceId?: string
    country?: string
    environment?: string
    runInput?: Record<string, string>
  },
): Promise<{ runId: string; status: string }> {
  const res = await fetch(`${AUTOMATION_API_BASE}/workflows/${workflowId}/run-step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to start step run')
  const json = await res.json()
  return json.data
}

export async function cancelRun(workflowId: string, runId: string): Promise<void> {
  const res = await fetch(`${AUTOMATION_API_BASE}/workflows/${workflowId}/runs/${runId}/cancel`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error('Failed to cancel run')
}

export async function fetchAllRuns(params?: {
  page?: number
  limit?: number
  status?: string
  search?: string
}): Promise<{
  data: WorkflowRun[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.status) searchParams.set('status', params.status)
  if (params?.search) searchParams.set('search', params.search)

  const query = searchParams.toString()
  const res = await fetch(`${AUTOMATION_API_BASE}/workflows/runs${query ? `?${query}` : ''}`)
  if (!res.ok) throw new Error('Failed to fetch run history')
  return res.json()
}

export async function deleteRun(workflowId: string, runId: string): Promise<void> {
  const res = await fetch(`${AUTOMATION_API_BASE}/workflows/${workflowId}/runs/${runId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete run')
}

export async function deleteRuns(
  runs: Array<{ workflowId: string; runId: string }>,
): Promise<{ deleted: string[]; failed: string[] }> {
  const results = await Promise.allSettled(
    runs.map(({ workflowId, runId }) => deleteRun(workflowId, runId).then(() => runId)),
  )

  const deleted: string[] = []
  const failed: string[] = []
  results.forEach((result, index) => {
    const run = runs[index]
    if (!run) return
    if (result.status === 'fulfilled') {
      deleted.push(result.value)
    } else {
      failed.push(run.runId)
    }
  })

  return { deleted, failed }
}

export async function fetchRuns(
  workflowId: string,
  params?: { page?: number; limit?: number },
): Promise<{
  data: WorkflowRun[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.limit) searchParams.set('limit', String(params.limit))

  const query = searchParams.toString()
  const res = await fetch(`${AUTOMATION_API_BASE}/workflows/${workflowId}/runs${query ? `?${query}` : ''}`)
  if (!res.ok) throw new Error('Failed to fetch runs')
  return res.json()
}

export async function fetchLatestRun(workflowId: string): Promise<WorkflowRun | null> {
  const res = await fetch(`${AUTOMATION_API_BASE}/workflows/${workflowId}/runs/latest`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to fetch latest run')
  const json = await res.json()
  return json.data
}

export async function fetchRunDetail(workflowId: string, runId: string): Promise<WorkflowRun> {
  const res = await fetch(`${AUTOMATION_API_BASE}/workflows/${workflowId}/runs/${runId}`)
  if (!res.ok) throw new Error('Failed to fetch run detail')
  const json = await res.json()
  return json.data
}

export async function fetchRunStatus(runId: string): Promise<RunStatusResponse> {
  const res = await fetch(`${AUTOMATION_API_BASE}/workflows/runs/${runId}/status`)
  if (!res.ok) throw new Error('Failed to fetch run status')
  return res.json()
}

/** Compiles workflow graph → Maestro YAML (supports runInput token substitution). */
export async function previewWorkflowYaml(params: {
  nodes: unknown[]
  edges: unknown[]
  config?: Record<string, unknown> | null
  country?: string
  environment?: string
  runInput?: Record<string, string>
}): Promise<string> {
  const res = await fetch(`${AUTOMATION_API_BASE}/workflows/yaml-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message ?? body?.error ?? 'YAML preview failed')
  }
  const json = await res.json()
  return (json.data?.yaml as string) ?? ''
}
