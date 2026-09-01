import { describe, expect, it } from 'vitest'
import {
  createDeviceCommandAdmission,
  DeviceCommandAdmission,
  InMemoryDeviceMutationLeaseStore,
} from './device-command-admission.js'
import { DeviceReadinessService } from './device-readiness.service.js'
import { DomainPackAdminService, InMemoryDomainPackAdminStore } from './domain-pack-admin.service.js'
import { DomainPackReadModelsService } from './domain-pack-read-models.service.js'
import {
  DurableInteractionSubscription,
  InMemoryDurableInteractionStore,
} from './durable-interaction-subscription.js'
import { EvidenceSourceQueryService } from './evidence-source-query.service.js'
import { StaticEvidenceSourceResolver } from './evidence-source-resolver.js'
import { TestCampaignService } from './test-campaign.service.js'
import { TestProfileCatalogService } from './test-profile-catalog.service.js'
import {
  InMemoryCompiledPlanStore,
  createHashPinnedCompileStub,
} from './workflow-compile.service.js'
import {
  InMemoryWorkflowRunStartStore,
  parseInjectedFaultBody,
  WorkflowRunService,
} from './workflow-run.service.js'

describe('phase 6 input contracts', () => {
  it('keeps compile preview hash identical to the hash pinned on run start', async () => {
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
    const started = await runs.startFromCompile(preview, {
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

  it('exposes multi-lane device readiness with admission and external blockers', async () => {
    const admission = createDeviceCommandAdmission()
    await admission.acquireMutation('device-1', 'run-owner')
    const readiness = await new DeviceReadinessService(admission, {
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

  it('marks stub compile results with compilerKind STUB', () => {
    const preview = createHashPinnedCompileStub().compileWorkflow({
      workflowRef: 'courier.login',
      workflowIr: { entryStepId: 'open', steps: [{ planStepId: 'open' }] },
      domainPackKey: 'nesy-courier',
      domainPackVersion: '1.0.0',
      domainPackDigest: 'sha256:pack',
    })
    expect(preview.compilerKind).toBe('STUB')
    expect(preview.issues.map((issue) => issue.code)).toContain('STUB_COMPILER')
  })

  it('stores an executable BridgeFlowPlan for accepted compile results', async () => {
    const planStore = new InMemoryCompiledPlanStore()
    const preview = createHashPinnedCompileStub(planStore).compileWorkflow({
      workflowRef: 'courier.login',
      workflowIr: { entryStepId: 'open', steps: [{ planStepId: 'open' }] },
      domainPackKey: 'nesy-courier',
      domainPackVersion: '1.0.0',
      domainPackDigest: 'sha256:pack',
    })
    const plan = await planStore.get({
      planRef: preview.compiledPlanRef,
      planHash: preview.compiledPlanHash,
    })
    expect(plan?.steps[0]?.kind).toBe('NOOP')
    expect(plan?.hash.digest).toBe(preview.compiledPlanHash)
  })

  it('reads interactions by revision cursor and redacts secrets', async () => {
    const subscription = new DurableInteractionSubscription()
    await subscription.append({
      eventId: 'e1',
      runId: 'run-1',
      origin: 'BRIDGE_INJECTED',
      confidence: 0.9,
      occurredAtMs: 1,
      summary: 'tap password=super-secret token:abc123',
    })
    const page = await subscription.read({ runId: 'run-1', afterRevision: 0 })
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

  it('refuses a run that is not pinned to a compiled plan', async () => {
    const service = new WorkflowRunService()
    await expect(service.start({ ...pinned, compiledPlanHash: '' })).rejects.toThrow(/compiledPlanHash/)
  })

  it('refuses a run that is not pinned to a domain pack', async () => {
    const service = new WorkflowRunService()
    await expect(service.start({ ...pinned, domainPackDigest: '' })).rejects.toThrow(/domainPackDigest/)
  })

  it('starts and stays idempotent for a fully pinned request', async () => {
    const service = new WorkflowRunService()
    const first = await service.start(pinned)
    const second = await service.start(pinned)
    expect(first.runId).toBe(second.runId)
    expect(first.compiledPlanHash).toBe('sha256:abc')
    expect(first.injectedFault).toBeNull()
    expect(first.expectedClass).toBeNull()
    expect(first.injectedFaultHost).toBeNull()
  })

  it('treats injectedFault as a distinct start identity from the uninjected twin', async () => {
    const service = new WorkflowRunService()
    const uninjected = await service.start(pinned)
    const injected = await service.start({
      ...pinned,
      injectedFault: 'PROCESS_KILL',
      injectedFaultHost: 'A',
    })
    expect(injected.runId).not.toBe(uninjected.runId)
    expect(injected.injectedFault).toBe('PROCESS_KILL')
    expect(injected.expectedClass).toBe('PROCESS_DEATH')
    expect(injected.injectedFaultHost).toBe('A')
    expect('observedClass' in injected).toBe(false)
  })

  it('refuses to pre-write observedClass at start', () => {
    expect(() => parseInjectedFaultBody({ observedClass: 'PROCESS_DEATH' })).toThrow(/output axis/)
    expect(() => parseInjectedFaultBody({ injectedFault: 'PROCESS_DEATH', injectedFaultHost: 'A' })).toThrow(
      /unknown injectedFault/,
    )
  })

  it('passes pinned execution metadata to the BridgeFlow queue', async () => {
    const enqueued: unknown[] = []
    const service = new WorkflowRunService({
      enqueue(input) {
        enqueued.push(input)
      },
    })
    const started = await service.start(pinned)
    expect(started.engineType).toBe('BRIDGEFLOW')
    expect(enqueued).toEqual([
      expect.objectContaining({
        runId: started.runId,
        deviceId: pinned.deviceId,
        compiledPlanHash: pinned.compiledPlanHash,
        domainPackDigest: pinned.domainPackDigest,
      }),
    ])
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

  it('pins the evidence source catalog item keys', () => {
    const service = new EvidenceSourceQueryService(
      new StaticEvidenceSourceResolver([
        {
          sourceEvent: 'SCREEN_READY',
          factKey: 'ui.screen_ready',
          plane: 'UI',
          subtype: 'SCREEN_STATE',
          authority: 'PRIMARY',
          deliveryLanes: ['ORDERED_REQUIRED'],
          freshnessMaxAgeMs: 5000,
          valueField: 'screenId',
          confidence: 1,
        },
      ]),
    )
    const [item] = service.list().items
    expect(Object.keys(item).sort()).toEqual(
      [
        'authority',
        'confidence',
        'deliveryLanes',
        'factKey',
        'freshnessMaxAgeMs',
        'plane',
        'sourceEvent',
        'subtype',
        'valueField',
      ].sort(),
    )
  })

  it('pins the semantic action catalog item keys', async () => {
    const store = new InMemoryDomainPackAdminStore()
    await store.upsert({
      packKey: 'nesy-courier',
      version: '1.0.0',
      bundleDigest: 'sha256:seed',
      publicationState: 'PUBLISHED',
      revision: 1,
      bundle: {
        registries: {
          semanticActions: [
            {
              actionKey: 'nesy.action.open-stop',
              applicationRef: 'nesy.app.courier',
              displayName: 'Open Stop',
              businessMeaning: 'open stop detail',
              notResponsibleFor: ['complete stop'],
              screenRefs: ['nesy.screen.stop'],
              surfaceRefs: [],
              entityTypeRefs: ['stop'],
              targetRefs: ['nesy.target.stop-row'],
              requiredCapabilityRefs: ['verdict.capability.semantic-action'],
            },
          ],
          macros: [],
        },
      },
    })
    const [item] = (await new DomainPackReadModelsService(store).listSemanticActions(
      'nesy-courier',
      '1.0.0',
    ))!.items
    expect(Object.keys(item).sort()).toEqual(
      [
        'actionKey',
        'applicationRef',
        'businessMeaning',
        'capabilityStatus',
        'displayName',
        'entityTypeRefs',
        'notResponsibleFor',
        'requiredCapabilityRefs',
        'screenRefs',
        'surfaceRefs',
        'targetRefs',
      ].sort(),
    )
    expect(Object.keys(item.capabilityStatus).sort()).toEqual(
      ['missing', 'reason', 'satisfied'].sort(),
    )
    expect(item.capabilityStatus.satisfied).toBe(false)
    expect(item.capabilityStatus.missing).toEqual(['verdict.capability.semantic-action'])
    expect(item.capabilityStatus.reason).toMatch(/Host Bridge B2 baseline missing capabilities/)
  })

  it('satisfies host Bridge B2 refs without a deviceId so authoring is not blocked', async () => {
    const store = new InMemoryDomainPackAdminStore()
    await store.upsert({
      packKey: 'nesy-courier',
      version: '1.0.0',
      bundleDigest: 'sha256:seed',
      publicationState: 'PUBLISHED',
      revision: 1,
      bundle: {
        registries: {
          semanticActions: [
            {
              actionKey: 'nesy.action.login',
              applicationRef: 'nesy.courier.mobile',
              displayName: 'Sign in',
              businessMeaning: 'authenticate',
              notResponsibleFor: ['password reset'],
              screenRefs: ['nesy.auth.login'],
              surfaceRefs: [],
              entityTypeRefs: [],
              targetRefs: ['nesy.target.login-submit'],
              requiredCapabilityRefs: ['verdict.core.bridge.tap', 'verdict.core.bridge.set-text'],
            },
            {
              actionKey: 'nesy.action.process-parcel',
              applicationRef: 'nesy.courier.mobile',
              displayName: 'Process parcel',
              businessMeaning: 'scan a parcel',
              notResponsibleFor: ['camera hardware'],
              screenRefs: ['nesy.delivery.flow'],
              surfaceRefs: [],
              entityTypeRefs: [],
              targetRefs: [],
              requiredCapabilityRefs: ['domain.nesy.scanner.inject'],
            },
          ],
          macros: [],
        },
      },
    })
    const catalog = (await new DomainPackReadModelsService(store).listSemanticActions(
      'nesy-courier',
      '1.0.0',
    ))!
    expect(catalog.items.map((item) => [item.actionKey, item.capabilityStatus.satisfied])).toEqual([
      ['nesy.action.login', true],
      ['nesy.action.process-parcel', true],
    ])
  })

  it('names the device in the missing-reason when a deviceId is supplied', async () => {
    const store = new InMemoryDomainPackAdminStore()
    await store.upsert({
      packKey: 'nesy-courier',
      version: '1.0.0',
      bundleDigest: 'sha256:seed',
      publicationState: 'PUBLISHED',
      revision: 1,
      bundle: {
        registries: {
          semanticActions: [
            {
              actionKey: 'nesy.action.unknown-cap',
              applicationRef: 'nesy.courier.mobile',
              displayName: 'Unknown',
              businessMeaning: 'unknown',
              notResponsibleFor: ['n/a'],
              screenRefs: [],
              surfaceRefs: [],
              entityTypeRefs: [],
              targetRefs: [],
              requiredCapabilityRefs: ['verdict.capability.not-in-baseline'],
            },
          ],
          macros: [],
        },
      },
    })
    const [item] = (await new DomainPackReadModelsService(store).listSemanticActions(
      'nesy-courier',
      '1.0.0',
      { deviceId: 'R6CW400BC8N' },
    ))!.items
    expect(item.capabilityStatus.satisfied).toBe(false)
    expect(item.capabilityStatus.reason).toBe(
      'Device R6CW400BC8N missing capabilities: verdict.capability.not-in-baseline',
    )
  })

  it('pins the target resolution entity keys', async () => {
    const store = new InMemoryDomainPackAdminStore()
    await store.upsert({
      packKey: 'nesy-courier',
      version: '1.0.0',
      bundleDigest: 'sha256:seed',
      publicationState: 'PUBLISHED',
      revision: 1,
      bundle: {
        registries: {
          targets: [
            {
              targetKey: 'nesy.target.stop-row',
              applicationRef: 'nesy.app.courier',
              screenRef: 'nesy.screen.stop',
              displayName: 'Stop row',
              resolution: {
                chain: [
                  {
                    kind: 'ACCESSIBILITY_ID',
                    selector: { id: 'stop-row' },
                    establishesIdentity: true,
                  },
                ],
                ambiguityPolicy: 'FAIL',
                notFoundPolicy: 'FAIL',
                deadlineMs: 1000,
                reverifyBeforeAction: true,
              },
            },
          ],
        },
      },
    })
    const [item] = (await new DomainPackReadModelsService(store).listTargetResolution(
      'nesy-courier',
      '1.0.0',
    ))!.entities
    expect(Object.keys(item).sort()).toEqual(
      [
        'ambiguityPolicy',
        'deadlineMs',
        'entityKey',
        'notFoundPolicy',
        'reverifyBeforeAction',
        'strategies',
        'targetKey',
        'violations',
      ].sort(),
    )
  })

  it('pins the screen-surface catalog item keys', async () => {
    const store = new InMemoryDomainPackAdminStore()
    await store.upsert({
      packKey: 'nesy-courier',
      version: '1.0.0',
      bundleDigest: 'sha256:seed',
      publicationState: 'PUBLISHED',
      revision: 1,
      bundle: {
        registries: {
          applications: [
            {
              applicationKey: 'nesy.app.courier',
              displayName: 'Courier',
              platform: 'ANDROID',
              packageIdentity: 'com.example.courier',
              versionCompatibility: { minVersionCode: 1, maxVersionCode: null },
              adapterCompatibility: {
                adapterRef: 'nesy.courier.app-adapter',
                minAdapterVersion: 1,
                maxAdapterVersion: null,
                requiredCapabilities: [],
              },
              adapterCapabilities: [],
              capabilityRefs: [],
            },
          ],
          screens: [
            {
              screenKey: 'nesy.screen.home',
              applicationRef: 'nesy.app.courier',
              displayName: 'Home',
              runtimeImplementation: { kind: 'ACTIVITY', componentName: 'Home' },
              entryStrategies: [
                {
                  kind: 'WORKFLOW_ENTRY',
                  entryRef: 'home',
                  provesUserPath: true,
                  requiredCapabilityRefs: [],
                },
              ],
              readiness: {
                requiredFactKeys: ['fact.home'],
                deadlineMs: 5000,
              },
              supportedSurfaceRefs: ['nesy.surface.session'],
              supportedActionRefs: [],
            },
          ],
          surfaces: [
            {
              surfaceKey: 'nesy.surface.session',
              applicationRef: 'nesy.app.courier',
              kind: 'DIALOG',
              displayName: 'Session expired',
              parentScreenRefs: ['*'],
              detection: {
                requiredFactKeys: ['fact.session-expired'],
                deadlineMs: 2000,
              },
              defaultPolicy: 'HANDLE',
              priority: 100,
              handlerMacroRef: 'macro.dismiss-session',
              blocksProductVerdict: true,
            },
          ],
        },
      },
    })
    const catalog = (await new DomainPackReadModelsService(store).listScreenSurfaces(
      'nesy-courier',
      '1.0.0',
    ))!
    expect(catalog.publicationState).toBe('PUBLISHED')
    expect(catalog.immutableReason).toMatch(/PUBLISHED/)
    expect(Object.keys(catalog.applications[0]!).sort()).toEqual(
      ['applicationKey', 'displayName', 'platform'].sort(),
    )
    expect(Object.keys(catalog.screens[0]!).sort()).toEqual(
      [
        'applicationRef',
        'displayName',
        'readiness',
        'screenKey',
        'supportedSurfaceRefs',
      ].sort(),
    )
    expect(Object.keys(catalog.surfaces[0]!).sort()).toEqual(
      [
        'applicationRef',
        'blocksProductVerdict',
        'defaultPolicy',
        'detection',
        'displayName',
        'handlerMacroRef',
        'kind',
        'parentScreenRefs',
        'priority',
        'surfaceKey',
      ].sort(),
    )
  })

  it('pins the entity binding catalog item keys', async () => {
    const store = new InMemoryDomainPackAdminStore()
    await store.upsert({
      packKey: 'nesy-courier',
      version: '1.0.0',
      bundleDigest: 'sha256:seed',
      publicationState: 'PUBLISHED',
      revision: 1,
      bundle: {
        registries: {
          entities: [
            {
              entityType: 'STOP',
              applicationRef: 'nesy.app.courier',
              displayName: 'Stop',
              businessKeyPath: '$.stopId',
              identityPaths: ['$.backendId'],
              correlation: { correlationPaths: ['$.stopId'], crossPlane: true },
              freshness: { maxAgeMs: 30_000, onStale: 'FAIL' },
              redaction: { redactPaths: [] },
              sourceQueryRefs: ['query.stops'],
            },
          ],
          targets: [
            {
              targetKey: 'nesy.target.stop-row',
              applicationRef: 'nesy.app.courier',
              screenRef: 'nesy.screen.home',
              displayName: 'Stop row',
              resolution: {
                chain: [
                  {
                    kind: 'ENTITY_BINDING',
                    selector: { keyPath: '$.stopId' },
                    establishesIdentity: true,
                  },
                ],
                ambiguityPolicy: 'FAIL',
                notFoundPolicy: 'FAIL',
                deadlineMs: 1000,
                reverifyBeforeAction: true,
              },
              entityBinding: {
                entityTypeRef: 'STOP',
                targetRef: 'nesy.target.stop-row',
                projectedPaths: ['$.stopId'],
                redactProjection: true,
              },
            },
          ],
        },
      },
    })
    const catalog = (await new DomainPackReadModelsService(store).listEntityBindings(
      'nesy-courier',
      '1.0.0',
    ))!
    expect(Object.keys(catalog.entities[0]!).sort()).toEqual(
      [
        'applicationRef',
        'businessKeyPath',
        'displayName',
        'entityType',
        'identityPaths',
        'sourceQueryRefs',
      ].sort(),
    )
    expect(Object.keys(catalog.bindings[0]!).sort()).toEqual(
      [
        'entityKnown',
        'entityTypeRef',
        'projectedPaths',
        'redactProjection',
        'targetDisplayName',
        'targetRef',
      ].sort(),
    )
    expect(catalog.bindings[0]!.entityKnown).toBe(true)
  })

  it('pins the launch profile catalog item keys', async () => {
    const store = new InMemoryDomainPackAdminStore()
    await store.upsert({
      packKey: 'nesy-courier',
      version: '1.0.0',
      bundleDigest: 'sha256:seed',
      publicationState: 'PUBLISHED',
      revision: 1,
      bundle: {
        registries: {
          launchProfiles: [
            {
              profileKey: 'nesy.launch.cold-real-login',
              applicationRef: 'nesy.app.courier',
              displayName: 'Cold real login',
              startMode: 'COLD_START',
              sessionPreparation: 'REAL_UI_LOGIN',
              preconditionFactKeys: [],
              entry: {
                kind: 'WORKFLOW_ENTRY',
                entryRef: 'login',
                expectedScreenRef: 'nesy.screen.login',
                expectedSurfaceRefs: [],
              },
              preparationOperationRefs: [],
              cleanup: { cleanupRefs: [], runOnFailure: true, deadlineMs: 5000 },
              producesProductVerdict: true,
              releaseIsolation: {
                automationOnly: false,
                releaseGuard: 'none',
                allowedEnvironments: ['lab'],
              },
              requiredCapabilityRefs: [],
            },
          ],
        },
      },
    })
    const [item] = (await new DomainPackReadModelsService(store).listLaunchProfiles(
      'nesy-courier',
      '1.0.0',
    ))!.items
    expect(Object.keys(item).sort()).toEqual(
      [
        'applicationRef',
        'cleanup',
        'displayName',
        'entry',
        'preconditionFactKeys',
        'preparationOperationRefs',
        'producesProductVerdict',
        'profileKey',
        'releaseIsolation',
        'requiredCapabilityRefs',
        'sessionPreparation',
        'startMode',
      ].sort(),
    )
  })

  it('fail-closes DIRECT_STATE launch profiles in release builds', () => {
    const service = new DomainPackReadModelsService(new InMemoryDomainPackAdminStore())
    const result = service.validateLaunchProfile(
      {
        profileKey: 'nesy.launch.direct',
        applicationRef: 'nesy.app.courier',
        displayName: 'Direct',
        startMode: 'COLD_START',
        sessionPreparation: 'DIRECT_STATE',
        preconditionFactKeys: [],
        entry: {
          kind: 'WORKFLOW_ENTRY',
          entryRef: 'x',
          expectedScreenRef: 'nesy.screen.home',
          expectedSurfaceRefs: [],
        },
        preparationOperationRefs: ['op.inject'],
        cleanup: { cleanupRefs: [], runOnFailure: true, deadlineMs: 1000 },
        producesProductVerdict: false,
        releaseIsolation: {
          automationOnly: true,
          releaseGuard: 'automationRelease=false',
          allowedEnvironments: ['lab'],
        },
        requiredCapabilityRefs: [],
      },
      { releaseBuild: true },
    )
    expect(result.ok).toBe(false)
    expect(result.blockedReason).toMatch(/DIRECT_STATE/)
  })

  it('returns structured MISSING_FIELD violations for partial launch profiles', () => {
    const service = new DomainPackReadModelsService(new InMemoryDomainPackAdminStore())
    const result = service.validateLaunchProfile({
      profileKey: 'nesy.launch.draft',
      sessionPreparation: 'DIRECT_STATE',
      // releaseIsolation / cleanup / entry intentionally omitted — builder draft
    })
    expect(result.ok).toBe(false)
    expect(result.violations.map((v) => v.code)).toEqual(
      expect.arrayContaining(['MISSING_FIELD']),
    )
    expect(result.violations.some((v) => v.message.includes('releaseIsolation'))).toBe(true)
    // Must not throw / invent a success — fail-closed with structured codes only.
    expect(result.violations.every((v) => typeof v.code === 'string')).toBe(true)
  })
})

/**
 * Restart continuity. Both services used to hold their state in a field, so a
 * fresh instance forgot everything: a retried run start queued a second
 * execution and the interaction cursor rewound to revision 1. These tests
 * construct a *new* service over a store that already holds prior state — the
 * shape a process restart produces — and assert it continues instead of
 * restarting.
 */
describe('device readiness probes', () => {
  it('passes the requested device id to each probe', async () => {
    const seen: string[] = []
    const readiness = await new DeviceReadinessService(createDeviceCommandAdmission(), {
      adb: (deviceId) => {
        seen.push(deviceId)
        return deviceId === 'attached-device' ? 'UP' : 'DOWN'
      },
    }).get('missing-device')
    expect(seen).toEqual(['missing-device'])
    expect(readiness.lanes.find((lane) => lane.lane === 'ADB')?.status).toBe('DOWN')
  })

  it('reports a lane as UNKNOWN when its probe throws instead of claiming health', async () => {
    const readiness = await new DeviceReadinessService(createDeviceCommandAdmission(), {
      adb: () => {
        throw new Error('adb unreachable')
      },
    }).get('device-1')
    const adbLane = readiness.lanes.find((lane) => lane.lane === 'ADB')
    expect(adbLane?.status).toBe('UNKNOWN')
    expect(adbLane?.detail).toMatch(/adb unreachable/)
  })
})

describe('phase 6 restart continuity', () => {
  it('keeps device mutation ownership across a new admission instance', async () => {
    const store = new InMemoryDeviceMutationLeaseStore()
    const before = new DeviceCommandAdmission(store)
    expect((await before.acquireMutation('device-1', 'run-owner')).acquired).toBe(true)

    const afterRestart = new DeviceCommandAdmission(store)
    expect(await afterRestart.acquireMutation('device-1', 'run-other')).toEqual({
      acquired: false,
      ownerRunId: 'run-owner',
      blockedReason: 'mutation lane owned by run run-owner',
    })
    expect((await afterRestart.snapshot('device-1')).activeMutationOwnerRunId).toBe('run-owner')
  })

  it('returns the already-started run instead of queueing a second execution', async () => {
    const store = new InMemoryWorkflowRunStartStore()
    const request = {
      workflowRef: 'wf.field-login',
      deviceId: 'pixel-7',
      compiledPlanRef: 'plan:wf.field-login',
      compiledPlanHash: 'sha256:abc',
      domainPackKey: 'nesy-courier',
      domainPackVersion: '1.0.0',
      domainPackDigest: 'sha256:seed',
    }
    const first = await new WorkflowRunService(undefined, store).start(request)

    // A new service instance over the same store == the process restarted.
    const afterRestart = await new WorkflowRunService(undefined, store).start(request)

    expect(afterRestart.runId).toBe(first.runId)
    expect(afterRestart.executionId).toBe(first.executionId)
  })

  it('continues the interaction revision sequence across a restart', async () => {
    const store = new InMemoryDurableInteractionStore()
    const before = new DurableInteractionSubscription(store)
    await before.append({
      eventId: 'e1',
      runId: 'run-1',
      origin: 'BRIDGE_INJECTED',
      confidence: 100,
      occurredAtMs: 1,
      summary: 'first',
    })

    const afterRestart = new DurableInteractionSubscription(store)
    const next = await afterRestart.append({
      eventId: 'e2',
      runId: 'run-1',
      origin: 'MANUAL',
      confidence: 50,
      occurredAtMs: 2,
      summary: 'second',
    })

    expect(next.revision).toBe(2)
    const page = await afterRestart.read({ runId: 'run-1', afterRevision: 1 })
    expect(page.latestRevision).toBe(2)
    expect(page.items.map((item) => item.eventId)).toEqual(['e2'])
    expect(page.reconnectCursor.afterRevision).toBe(2)
  })
})
