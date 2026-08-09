import { describe, expect, it } from 'vitest'

import { ensureVerdictRunRow } from './verdict-run-row.js'

interface WorkflowRow {
  id: string
  slug: string
  name: string
  currentVersionId: string | null
}
interface VersionRow {
  id: string
  workflowId: string
  version: number
}
interface RunRow {
  id: string
  workflowId: string
  versionId: string
  status: string
  deviceId?: string | null
}

function fakePrisma(seed: { workflows?: WorkflowRow[]; versions?: VersionRow[] } = {}) {
  const workflows: WorkflowRow[] = [...(seed.workflows ?? [])]
  const versions: VersionRow[] = [...(seed.versions ?? [])]
  const runs: RunRow[] = []
  let sequence = 0

  const client = {
    workflow: {
      findUnique: async ({ where }: { where: { id?: string; slug?: string } }) =>
        workflows.find(
          (row) =>
            (where.id !== undefined && row.id === where.id) ||
            (where.slug !== undefined && row.slug === where.slug),
        ) ?? null,
      create: async ({ data }: { data: { slug: string; name: string } }) => {
        const row: WorkflowRow = {
          id: `wf-${++sequence}`,
          slug: data.slug,
          name: data.name,
          currentVersionId: null,
        }
        workflows.push(row)
        return row
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string }
        data: { currentVersionId: string }
      }) => {
        const row = workflows.find((candidate) => candidate.id === where.id)!
        row.currentVersionId = data.currentVersionId
        return row
      },
    },
    workflowVersion: {
      findFirst: async ({ where }: { where: { workflowId: string } }) =>
        versions.filter((row) => row.workflowId === where.workflowId).at(-1) ?? null,
      create: async ({ data }: { data: { workflowId: string; version: number } }) => {
        const row: VersionRow = { id: `ver-${++sequence}`, workflowId: data.workflowId, version: data.version }
        versions.push(row)
        return row
      },
    },
    workflowRun: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        runs.find((row) => row.id === where.id) ?? null,
      create: async ({ data }: { data: RunRow }) => {
        runs.push({ ...data })
        return data
      },
    },
  }

  return { client, workflows, versions, runs }
}

describe('verdict run row', () => {
  it('creates the workflow_runs row every BridgeFlow write and read depends on', async () => {
    const { client, runs } = fakePrisma()

    const refs = await ensureVerdictRunRow(client as never, {
      runId: 'run_1',
      workflowRef: 'nesy.workflow.full-courier-golden',
      deviceId: 'device-1',
    })

    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({ id: 'run_1', status: 'queued', deviceId: 'device-1' })
    expect(refs.workflowId).toBe(runs[0]!.workflowId)
    expect(refs.versionId).toBe(runs[0]!.versionId)
  })

  it('reuses an existing editor workflow and its current version instead of provisioning a duplicate', async () => {
    const { client, workflows, versions } = fakePrisma({
      workflows: [{ id: 'wf-existing', slug: 'courier-login', name: 'Courier login', currentVersionId: 'ver-7' }],
    })

    const refs = await ensureVerdictRunRow(client as never, {
      runId: 'run_2',
      workflowRef: 'courier-login',
      deviceId: 'device-1',
    })

    expect(refs).toEqual({ workflowId: 'wf-existing', versionId: 'ver-7' })
    expect(workflows).toHaveLength(1)
    expect(versions).toHaveLength(0)
  })

  it('is idempotent for a repeated start of the same run', async () => {
    const { client, runs } = fakePrisma()
    const first = await ensureVerdictRunRow(client as never, {
      runId: 'run_3',
      workflowRef: 'nesy.workflow.login',
      deviceId: 'device-1',
    })
    const second = await ensureVerdictRunRow(client as never, {
      runId: 'run_3',
      workflowRef: 'nesy.workflow.login',
      deviceId: 'device-1',
    })

    expect(second).toEqual(first)
    expect(runs).toHaveLength(1)
  })
})
