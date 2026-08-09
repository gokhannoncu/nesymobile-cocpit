/**
 * The `workflow_runs` row every Verdict run hangs off.
 *
 * Phase 8 deleted the legacy runner, and with it the only writer of this table —
 * but not its readers. Everything downstream still anchors on a row whose `id`
 * is the run id:
 *
 *   - `bridgeflow_run_runtime` and every other BridgeFlow table carry a foreign
 *     key to it, so `persistRunStart` fails on the first write without it;
 *   - `getRunDetail` and the run list join `workflow_runs` → the cockpit shows
 *     nothing for a run that has no row.
 *
 * So the row is created at run start, before the queue can pick the run up.
 *
 * `workflowRef` is a pack workflow key or an editor workflow id, not necessarily
 * a `workflows.id`. When no workflow row matches, one is provisioned for the ref
 * so the run is attributable to *something* named — an orphan run row would show
 * up in the list with no workflow name at all.
 */

import type { PrismaClient } from '@nesy/db'

export interface VerdictRunRowInput {
  runId: string
  workflowRef: string
  deviceId: string
  country?: string
  environment?: string
}

type RunRowClient = Pick<PrismaClient, 'workflow' | 'workflowVersion' | 'workflowRun'>

export interface VerdictRunRowRefs {
  workflowId: string
  versionId: string
}

export async function ensureVerdictRunRow(
  prisma: RunRowClient,
  input: VerdictRunRowInput,
): Promise<VerdictRunRowRefs> {
  const workflow = await resolveWorkflow(prisma, input.workflowRef)
  const versionId = await resolveVersionId(prisma, workflow)

  const existing = await prisma.workflowRun.findUnique({ where: { id: input.runId } })
  if (existing !== null) {
    return { workflowId: existing.workflowId, versionId: existing.versionId }
  }

  await prisma.workflowRun.create({
    data: {
      id: input.runId,
      workflowId: workflow.id,
      versionId,
      status: 'queued',
      mode: 'full',
      deviceId: input.deviceId,
      ...(input.country === undefined ? {} : { country: input.country }),
      ...(input.environment === undefined ? {} : { environment: input.environment }),
    },
  })

  return { workflowId: workflow.id, versionId }
}

async function resolveWorkflow(prisma: RunRowClient, workflowRef: string) {
  const byId = await prisma.workflow.findUnique({ where: { id: workflowRef } })
  if (byId !== null) return byId

  const bySlug = await prisma.workflow.findUnique({ where: { slug: workflowRef } })
  if (bySlug !== null) return bySlug

  // A pack workflow has no editor row. Provision one so the run carries a name
  // and the list join resolves; `status: 'published'` keeps it out of the draft
  // authoring surfaces.
  return prisma.workflow.create({
    data: {
      slug: workflowRef,
      name: workflowRef,
      status: 'published',
      category: 'verdict',
      description: 'Provisioned for a Verdict BridgeFlow run started against a compiled plan.',
    },
  })
}

async function resolveVersionId(
  prisma: RunRowClient,
  workflow: { id: string; currentVersionId: string | null },
): Promise<string> {
  if (workflow.currentVersionId !== null) return workflow.currentVersionId

  const existing = await prisma.workflowVersion.findFirst({
    where: { workflowId: workflow.id },
    orderBy: { version: 'desc' },
  })
  if (existing !== null) return existing.id

  // The authored nodes/edges live in the compiled plan, not here. This version
  // exists to satisfy run identity, and says so rather than pretending to be an
  // editor version with content.
  const created = await prisma.workflowVersion.create({
    data: {
      workflowId: workflow.id,
      version: 1,
      nodes: [],
      edges: [],
      changelog: 'Provisioned for Verdict BridgeFlow run identity; authoring lives in the compiled plan.',
    },
  })
  await prisma.workflow.update({
    where: { id: workflow.id },
    data: { currentVersionId: created.id },
  })
  return created.id
}
