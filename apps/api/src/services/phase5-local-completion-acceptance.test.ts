import { describe, expect, it, vi } from 'vitest'
import {
  BridgeFlowExecutor,
  InMemoryExecutionPersistence,
  createInMemoryMutationAdmission,
} from '@nesy/bridgeflow-executor'
import { decideSchedulerRecovery } from '@nesy/execution-contract'
import { createDeviceCommandAdmission } from './device-command-admission.js'
import { DomainPackAdminService } from './domain-pack-admin.service.js'
import {
  createStubRemoteAdapter,
  RemoteActionRuntime,
} from './remote-action-runtime.js'
import { TestCampaignService } from './test-campaign.service.js'
import { TestProfileCatalogService } from './test-profile-catalog.service.js'
import { createHashPinnedCompileStub } from './workflow-compile.service.js'
import { WorkflowRunService } from './workflow-run.service.js'

describe('phase 5 local completion acceptance', () => {
  it('fail-closes unsupported remote runtime ports without inventing product PASS', async () => {
    const persistence = new InMemoryExecutionPersistence()
    const result = await new BridgeFlowExecutor({
      persistence,
      mutationAdmission: createInMemoryMutationAdmission(),
      bridge: {
        act: async () => ({
          terminalState: 'SUCCEEDED',
          effectVerified: true,
          evidenceRef: 'n/a',
        }),
        waitAny: async () => ({ status: 'TIMEOUT', elapsedMs: 1 }),
        cancelWait: async () => undefined,
        cancelAction: async () => ({ status: 'CANCELLED' }),
      },
      evidence: { factsForOccurrence: () => [] },
      clock: () => 100,
    }).execute({
      runId: 'run-no-remote',
      deviceId: 'device-1',
      plan: {
        schemaVersion: 1,
        planId: 'plan-1',
        workflowRef: 'wf',
        workflowVersion: 1,
        entryStepId: 'remote',
        steps: [
          {
            planStepId: 'remote',
            kind: 'REMOTE_ACTION',
            next: null,
            params: {},
            sourceMapRef: 'src:remote',
            timeoutMs: 1_000,
            capabilityRequirements: [],
            evidenceRequirements: [],
          },
        ],
        waitPlans: [],
        evidenceManifest: {
          continueGateRequirements: [],
          finalOracleRequirements: [],
          derivedGraphDigest: 'sha256:graph',
        },
        capabilityManifest: { required: [], optional: [] },
        hash: { algorithm: 'sha256', digest: 'sha256:plan' },
        provenance: {
          packKey: 'nesy-courier',
          packVersion: '1.0.0',
          packDigest: 'sha256:pack',
          compilerVersion: 'test',
          compiledAt: '2026-08-05T00:00:00.000Z',
        },
        packVersion: '1.0.0' as never,
        packDigest: 'sha256:pack',
        sourceMap: { entries: [] },
      } as never,
    })

    expect(result.productVerdict).not.toMatch(/PASS/)
    expect(result.evaluationFailureClass === 'AUTOMATION_FAILURE' || result.lifecycle === 'CLOSED').toBe(true)
  })

  it('keeps compile hash, run start pin, and campaign no-evidence policy aligned', async () => {
    const compile = createHashPinnedCompileStub()
    const runs = new WorkflowRunService()
    const campaigns = new TestCampaignService()
    const preview = compile.compileWorkflow({
      workflowRef: 'wf',
      workflowIr: { entryStepId: 'a', steps: [{ planStepId: 'a' }] },
      domainPackKey: 'nesy-courier',
      domainPackVersion: '1.0.0',
      domainPackDigest: 'sha256:pack',
    })
    const started = runs.startFromCompile(preview, {
      workflowRef: 'wf',
      deviceId: 'device-1',
      domainPackKey: 'nesy-courier',
      domainPackVersion: '1.0.0',
      domainPackDigest: 'sha256:pack',
    })
    expect(started.compiledPlanHash).toBe(preview.compiledPlanHash)

    const campaign = await campaigns.start({
      campaignKey: 'pr',
      campaignVersion: 1,
      cells: [{ cellKey: 'c1', profileKey: 'p', profileVersion: 1 }],
    })
    const pending = await campaigns.attachCellEvidence({
      campaignId: campaign.campaignId,
      cellKey: 'c1',
      runId: started.runId,
    })
    expect(pending?.cells[0]?.result).toBe('PENDING')
  })

  it('keeps preview releaseGate false and published packs immutable', async () => {
    const profiles = new TestProfileCatalogService()
    expect(
      profiles.validate({
        profileKey: 'preview',
        version: 1,
        kind: 'PREVIEW',
        releaseGate: true,
        packKey: 'nesy-courier',
        packVersion: '1',
        definition: { includedWorkflowRefs: ['login'] },
        owner: 'qa',
      }).errors.join(' '),
    ).toMatch(/releaseGate/i)

    const packs = new DomainPackAdminService()
    const draft = await packs.saveDraft({
      packKey: 'nesy-courier',
      version: '1.0.0',
      bundleDigest: 'sha256:a',
      bundle: {},
    })
    await packs.publish({
      packKey: 'nesy-courier',
      version: '1.0.0',
      publishedBy: 'owner',
      expectedRevision: draft.pack.revision,
    })
    await expect(
      packs.saveDraft({
        packKey: 'nesy-courier',
        version: '1.0.0',
        bundleDigest: 'sha256:b',
        bundle: {},
      }),
    ).rejects.toThrow(/immutable/i)
  })

  it('never auto-retries unknown remote effects and surfaces admission blocked reasons', async () => {
    const execute = vi.fn(async () => ({
      status: 'UNKNOWN_EFFECT' as const,
      error: 'lost',
    }))
    const runtime = new RemoteActionRuntime(
      [
        {
          adapterRef: 'nesy.backoffice',
          operationRef: 'nesy.backoffice.tour.approve',
          effectClass: 'IDEMPOTENT',
          requiresResourceLease: true,
        },
      ],
      { execute },
    )
    const request = {
      operationRef: 'nesy.backoffice.tour.approve',
      allowlisted: true,
      idempotencyKey: 'k1',
      effectClass: 'IDEMPOTENT' as const,
      timeoutMs: 1_000,
      occurrenceId: 'occ-1',
      resourceLeaseId: 'lease-1',
    }
    const spec = {
      adapterRef: 'nesy.backoffice',
      operationRef: 'nesy.backoffice.tour.approve',
      role: 'VALIDATION' as const,
      effectClass: 'IDEMPOTENT_MUTATION' as const,
      idempotencyClass: 'KEYED' as const,
      idempotencyKey: 'k1',
      inputBindings: [],
      outputFactBindings: [{ factKey: 'remote.done', responsePath: 'state' }],
      timeoutPolicy: { timeoutMs: 1_000, maxAttempts: 1 },
      auditPolicy: { recordRequest: true, recordResponse: true },
      reconciliationPolicy: 'RECONCILE_ON_UNKNOWN' as const,
    }
    const first = await runtime.execute({ runId: 'run-1', request, spec })
    const second = await runtime.execute({ runId: 'run-1', request, spec })
    expect(first.ok).toBe(false)
    expect(second.ok).toBe(false)
    expect(execute).toHaveBeenCalledTimes(1)
    if (!first.ok) {
      expect(first.operationalDisposition).toBe('NEEDS_ATTENTION')
      expect(first.productVerdictHint).toBe('NOT_EVALUATED')
    }

    const admission = createDeviceCommandAdmission()
    admission.acquireMutation('device-1', 'run-a')
    expect(admission.acquireMutation('device-1', 'run-b').blockedReason).toMatch(/run-a/)
  })

  it('uses scheduler recovery to skip completed occurrences', () => {
    expect(
      decideSchedulerRecovery({
        lifecycle: 'RUNNING',
        schedulerDisposition: 'LEASED',
        disposition: 'RETRYABLE',
        leaseOwner: 'worker',
        leaseExpiresAtMs: 1,
        heartbeatAtMs: 0,
        heartbeatTimeoutMs: 1,
        nowMs: 10,
        occurrenceState: 'COMPLETED',
      }).action,
    ).toBe('SKIP_COMPLETED')
  })
})
