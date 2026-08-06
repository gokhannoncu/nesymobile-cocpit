import { describe, expect, it } from 'vitest'
import { createDeviceCommandAdmission } from './device-command-admission.js'
import { DeviceReadinessService } from './device-readiness.service.js'
import { DomainPackAdminService } from './domain-pack-admin.service.js'
import { DurableInteractionSubscription } from './durable-interaction-subscription.js'
import { TestCampaignService } from './test-campaign.service.js'
import { TestProfileCatalogService } from './test-profile-catalog.service.js'
import { createHashPinnedCompileStub } from './workflow-compile.service.js'
import { WorkflowRunService } from './workflow-run.service.js'

describe('phase 6 input contracts', () => {
  it('keeps compile preview hash identical to the hash pinned on run start', () => {
    const compile = createHashPinnedCompileStub()
    const runs = new WorkflowRunService()
    const request = {
      workflowRef: 'courier.login',
      workflowIr: { entryStepId: 'open', steps: [{ planStepId: 'open' }] },
      domainPackKey: 'nesy-courier',
      domainPackVersion: '1.0.0',
      domainPackDigest: 'sha256:pack',
    }
    const preview = compile.compileWorkflow(request)
    const started = runs.startFromCompile(preview, {
      workflowRef: request.workflowRef,
      deviceId: 'device-1',
      domainPackKey: request.domainPackKey,
      domainPackVersion: request.domainPackVersion,
      domainPackDigest: request.domainPackDigest,
    })
    expect(preview.ok).toBe(true)
    expect(started.compiledPlanHash).toBe(preview.compiledPlanHash)
    expect(started.engineType).toBe('BRIDGEFLOW')
  })

  it('enforces domain pack publish immutability and optimistic concurrency', async () => {
    const admin = new DomainPackAdminService()
    const draft = await admin.saveDraft({
      packKey: 'nesy-courier',
      version: '1.0.0',
      bundleDigest: 'sha256:a',
      bundle: { ok: true },
    })
    const published = await admin.publish({
      packKey: 'nesy-courier',
      version: '1.0.0',
      publishedBy: 'owner',
      expectedRevision: draft.pack.revision,
    })
    expect(published.pack.publicationState).toBe('PUBLISHED')
    await expect(
      admin.saveDraft({
        packKey: 'nesy-courier',
        version: '1.0.0',
        bundleDigest: 'sha256:b',
        bundle: { ok: false },
      }),
    ).rejects.toThrow(/immutable/i)
    await expect(
      admin.publish({
        packKey: 'nesy-courier',
        version: '1.0.0',
        publishedBy: 'owner',
        expectedRevision: published.pack.revision,
      }),
    ).rejects.toThrow(/immutable/i)
  })

  it('rejects preview profiles with releaseGate=true', () => {
    const profiles = new TestProfileCatalogService()
    expect(
      profiles.validate({
        profileKey: 'preview-login',
        version: 1,
        kind: 'PREVIEW',
        releaseGate: true,
        packKey: 'nesy-courier',
        packVersion: '1.0.0',
        definition: { includedWorkflowRefs: ['login'] },
        owner: 'qa',
      }).ok,
    ).toBe(false)
  })

  it('does not invent PASS/FAIL for campaign cells without evidence', async () => {
    const campaigns = new TestCampaignService()
    const started = await campaigns.start({
      campaignKey: 'nightly',
      campaignVersion: 1,
      cells: [
        {
          cellKey: 'loginxpixel',
          profileKey: 'preview-login',
          profileVersion: 1,
          deviceCell: 'pixel',
        },
      ],
    })
    const withoutEvidence = await campaigns.attachCellEvidence({
      campaignId: started.campaignId,
      cellKey: 'loginxpixel',
      runId: 'run-1',
    })
    expect(withoutEvidence?.cells[0]?.result).toBe('PENDING')
    expect(withoutEvidence?.cells[0]?.blockedReason).toMatch(/evidence/i)

    const withEvidence = await campaigns.attachCellEvidence({
      campaignId: started.campaignId,
      cellKey: 'loginxpixel',
      runId: 'run-1',
      evidenceSummaryRef: 'evidence:1',
      result: 'PASS',
    })
    expect(withEvidence?.cells[0]?.result).toBe('PASS')
    expect(withEvidence?.cells[0]?.runDetailPath).toBe('/automation/runs/run-1')
  })

  it('exposes multi-lane device readiness with admission and external blockers', () => {
    const admission = createDeviceCommandAdmission()
    admission.acquireMutation('device-1', 'run-owner')
    const readiness = new DeviceReadinessService(admission, {
      adb: () => 'UP',
      receiptBus: () => 'UP',
      orderedBus: () => 'DEGRADED',
    }).get('device-1')
    expect(readiness.lanes.some((lane) => lane.lane === 'RECEIPT_BUS')).toBe(true)
    expect(readiness.lanes.some((lane) => lane.lane === 'ORDERED_BUS')).toBe(true)
    expect(readiness.commandAdmission.blockedReason).toMatch(/run-owner/)
    expect(readiness.externalBlockers.map((item) => item.id)).toEqual(
      expect.arrayContaining(['B-12', 'CP3-DUT']),
    )
  })

  it('reads interactions by revision cursor and redacts secrets', () => {
    const subscription = new DurableInteractionSubscription()
    subscription.append({
      eventId: 'e1',
      runId: 'run-1',
      origin: 'BRIDGE_INJECTED',
      confidence: 0.9,
      occurredAtMs: 1,
      summary: 'tap password=super-secret token:abc123',
    })
    const page = subscription.read({ runId: 'run-1', afterRevision: 0 })
    expect(page.items).toHaveLength(1)
    expect(page.items[0]?.summary).toMatch(/REDACTED/)
    expect(page.items[0]?.summary).not.toMatch(/super-secret|abc123/)
    expect(page.reconnectCursor.afterRevision).toBe(1)
  })
})

describe('workflow compile provenance pinning', () => {
  it('fails closed when the compile request is not pinned to a domain pack', () => {
    const service = createHashPinnedCompileStub()
    const result = service.compileWorkflow({
      workflowRef: 'wf.field-login',
      workflowIr: {},
      domainPackKey: 'nesy-courier',
      domainPackVersion: '1.0.0',
      domainPackDigest: '',
    })
    expect(result.ok).toBe(false)
    expect(result.compiledPlanHash).toBe('')
    expect(result.issues.map((issue) => issue.code)).toContain('UNPINNED_COMPILE_REQUEST')
  })

  it('still compiles a fully pinned request', () => {
    const service = createHashPinnedCompileStub()
    const result = service.compileWorkflow({
      workflowRef: 'wf.field-login',
      workflowIr: { steps: [] },
      domainPackKey: 'nesy-courier',
      domainPackVersion: '1.0.0',
      domainPackDigest: 'sha256:seed0001',
    })
    expect(result.ok).toBe(true)
    expect(result.provenance.packDigest).toBe('sha256:seed0001')
  })
})

describe('workflow run start pinning', () => {
  const pinned = {
    workflowRef: 'wf.field-login',
    deviceId: 'pixel-7',
    compiledPlanRef: 'plan:wf.field-login',
    compiledPlanHash: 'sha256:abc',
    domainPackKey: 'nesy-courier',
    domainPackVersion: '1.0.0',
    domainPackDigest: 'sha256:seed0001',
  }

  it('refuses a run that is not pinned to a compiled plan', () => {
    const service = new WorkflowRunService()
    expect(() => service.start({ ...pinned, compiledPlanHash: '' })).toThrow(/compiledPlanHash/)
  })

  it('refuses a run that is not pinned to a domain pack', () => {
    const service = new WorkflowRunService()
    expect(() => service.start({ ...pinned, domainPackDigest: '' })).toThrow(/domainPackDigest/)
  })

  it('starts and stays idempotent for a fully pinned request', () => {
    const service = new WorkflowRunService()
    const first = service.start(pinned)
    const second = service.start(pinned)
    expect(first.runId).toBe(second.runId)
    expect(first.compiledPlanHash).toBe('sha256:abc')
  })
})

/**
 * The cockpit mirrors these DTOs by hand in
 * `apps/web/src/lib/verdict-runtime/types.ts`. Drift is invisible to `tsc`
 * because the web side declares its own interface, and it stayed invisible at
 * runtime while the lists were empty. Pinning the key sets makes any change
 * deliberate: update the web mirror in the same commit.
 */
describe('phase 6 read-model DTO shape', () => {
  it('pins the domain pack catalog item keys', async () => {
    const service = new DomainPackAdminService()
    await service.saveDraft({
      packKey: 'nesy-courier',
      version: '1.0.0',
      bundleDigest: 'sha256:seed',
      bundle: {},
    })
    const [item] = (await service.list()).items
    expect(Object.keys(item).sort()).toEqual(
      ['bundleDigest', 'packKey', 'publicationState', 'publishedAt', 'revision', 'version'].sort(),
    )
  })

  it('pins the test profile catalog item keys', async () => {
    const service = new TestProfileCatalogService()
    await service.save({
      profileKey: 'nesy-core-regression',
      version: 1,
      kind: 'CORE',
      releaseGate: true,
      packKey: 'nesy-courier',
      packVersion: '1.0.0',
      definition: { includedWorkflowRefs: ['wf.a'] },
      owner: 'qa-platform',
    })
    const [item] = (await service.list()).items
    expect(Object.keys(item).sort()).toEqual(
      [
        'blockedReason',
        'kind',
        'lastResult',
        'owner',
        'packKey',
        'packVersion',
        'profileKey',
        'releaseGate',
        'version',
      ].sort(),
    )
  })

  it('pins the test campaign catalog item keys', async () => {
    const service = new TestCampaignService()
    await service.start({
      campaignKey: 'nightly',
      campaignVersion: 1,
      cells: [{ cellKey: 'c1', profileKey: 'nesy-core-regression', profileVersion: 1 }],
    })
    const [item] = (await service.list()).items
    expect(Object.keys(item).sort()).toEqual(
      ['campaignId', 'campaignKey', 'campaignVersion', 'cellCount', 'releaseGateResult', 'status'].sort(),
    )
  })
})
