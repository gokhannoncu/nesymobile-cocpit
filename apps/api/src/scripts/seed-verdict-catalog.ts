import { prisma, type Prisma } from '@nesy/db'
import {
  publishBundle,
  type PublishedVersion,
  type TestProfileDefinition,
} from '@nesy/domain-pack-contracts'
import {
  buildNesyCourierBundle,
  NESY_COURIER_INDEPENDENT_WORKFLOWS,
  NESY_COURIER_TEST_PROFILES,
} from '@nesy/nesy-courier-domain-pack'
import { buildMatchReactionBundle } from '@nesy/match-reaction-domain-pack'
import { PrismaDomainPackAdminStore, PrismaTestProfileCatalogStore } from '../services/phase6-prisma-stores.js'
import type { TestProfileKind, TestProfileRecord } from '../services/test-profile-catalog.service.js'

const PUBLISHED_AT = '1970-01-01T00:00:00.000Z'
const PUBLISHED_BY = 'catalog-seed'
const SOURCE_COMMIT = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT ?? 'workspace'

function publishFirstPartyBundles(): PublishedVersion[] {
  const provenance = {
    publishedAt: PUBLISHED_AT,
    publishedBy: PUBLISHED_BY,
    sourceCommit: SOURCE_COMMIT,
  }
  return [
    publishBundle(buildNesyCourierBundle(), provenance),
    publishBundle(buildMatchReactionBundle(), provenance),
  ]
}

function runtimeProfileKind(kind: TestProfileDefinition['kind']): TestProfileKind {
  switch (kind) {
    case 'PREVIEW':
    case 'DIAGNOSTIC':
      return 'PREVIEW'
    case 'BAD_DAY':
      return 'FAULT'
    case 'RELEASE':
    case 'DIFFERENTIAL':
      return 'CORE'
  }
}

function runtimeProfile(profile: TestProfileDefinition, pack: PublishedVersion): TestProfileRecord {
  return {
    profileKey: profile.profileKey,
    version: profile.version,
    kind: runtimeProfileKind(profile.kind),
    releaseGate: profile.releaseGate,
    packKey: pack.packKey,
    packVersion: pack.version,
    owner: profile.applicationRef,
    definition: {
      includedWorkflowRefs: profile.includedWorkflowRefs,
      launchProfileRef: profile.launchProfileRef,
      requiredCapabilities: profile.requiredCapabilityRefs,
    },
    lastResult: 'NOT_RUN',
  }
}

async function seedPublishedBundle(store: PrismaDomainPackAdminStore, published: PublishedVersion): Promise<void> {
  const existing = await store.get(published.packKey, published.version)
  if (existing?.publicationState === 'PUBLISHED' && existing.bundleDigest === published.digest) {
    return
  }
  if (existing?.publicationState === 'PUBLISHED' && existing.bundleDigest !== published.digest) {
    throw new Error(
      `Refusing to overwrite published ${published.packKey}@${published.version}: ` +
        `${existing.bundleDigest} != ${published.digest}`,
    )
  }

  await store.upsert({
    packKey: published.packKey,
    version: published.version,
    bundleDigest: published.digest,
    publicationState: 'PUBLISHED',
    bundle: published.bundle,
    revision: existing === undefined ? 1 : existing.revision + 1,
    publishedAt: published.publishedAt,
    publishedBy: PUBLISHED_BY,
  })
}

/**
 * One canvas node, before it is linked into a chain.
 *
 * `LAUNCH_APP` leads every chain because a canvas is what an OPERATOR edits: the
 * pack's macros assume a running app, and a canvas that opened on "Auth / Login"
 * would give them nowhere to set country and environment.
 */
interface CanvasNodeSeed {
  id: string
  type: string
  title: string
  subtitle: string
  icon: string
  config: Record<string, unknown>
}

const LAUNCH_NODE: CanvasNodeSeed = {
  id: 'launch-app',
  type: 'LAUNCH_APP',
  title: 'Launch App',
  subtitle: 'App session start',
  icon: 'Smartphone',
  config: { country: 'HR', environment: 'stage', clearState: true },
}

const LOGIN_NODE: CanvasNodeSeed = {
  id: 'auth-login',
  type: 'AUTH_LOGIN',
  title: 'Auth / Login',
  subtitle: 'Courier PIN login',
  icon: 'UserRound',
  config: { pinCode: '' },
}

const SELECT_ROUTE_NODE: CanvasNodeSeed = {
  id: 'select-route',
  type: 'SELECT_ROUTE',
  title: 'Select Route',
  subtitle: 'Route selection',
  icon: 'Route',
  config: { routeNumber: '' },
}

/**
 * Canvas chains per pack workflow, in run order.
 *
 * The later node ids reuse the composed macro's leg prefixes, so a canvas node
 * and the run timeline's `<leg>-<step>` ids can be read side by side. The first
 * three keep the ids the login-and-select-route canvas already seeded.
 */
const CANVAS_CHAINS: Record<string, readonly CanvasNodeSeed[]> = {
  'nesy.workflow.login-and-select-route': [LAUNCH_NODE, LOGIN_NODE, SELECT_ROUTE_NODE],
  'nesy.workflow.full-courier-day': [
    LAUNCH_NODE,
    LOGIN_NODE,
    SELECT_ROUTE_NODE,
    {
      id: 'load',
      type: 'LOAD_TO_VEHICLE',
      title: 'Load to Vehicle',
      subtitle: 'Zimmet — parcel onto the schedule',
      icon: 'Truck',
      config: { barcode: '' },
    },
    {
      id: 'permit',
      type: 'REQUEST_TOUR_START',
      title: 'Request Tour Start',
      subtitle: 'Courier requests, dispatcher approves',
      icon: 'Play',
      config: {},
    },
    {
      id: 'visit',
      type: 'OPEN_STOP',
      title: 'Open Stop',
      subtitle: 'Open the stop the loading created',
      icon: 'CircleCheck',
      config: {},
    },
    {
      id: 'item',
      type: 'SCAN_BARCODE',
      title: 'Scan Barcode',
      subtitle: 'Process parcel — opens the delivery flow',
      icon: 'ScanBarcode',
      config: { barcode: '' },
    },
    {
      id: 'deliver',
      type: 'DELIVERY_OPERATION',
      title: 'Delivery Operation',
      subtitle: 'Complete delivery (unpaid DELY path)',
      icon: 'Box',
      config: { stopId: '', taskId: '', shipmentId: '', signatureRequired: true },
    },
  ],
}

function canvasForWorkflow(workflowKey: string): {
  nodes: Prisma.InputJsonValue
  edges: Prisma.InputJsonValue
} {
  const chain = CANVAS_CHAINS[workflowKey]
  if (chain === undefined) {
    return { nodes: [], edges: [] }
  }

  const nodes = chain.map((seed, index) => ({
    id: seed.id,
    type: seed.type,
    kind: 'action',
    position: { x: 380, y: 80 + index * 160 },
    data: {
      title: seed.title,
      subtitle: seed.subtitle,
      icon: seed.icon,
      config: seed.config,
    },
    parentId: null,
    children: [],
    branchType: null,
    nextNodeId: chain[index + 1]?.id ?? null,
    connections: [],
  }))

  const edges = chain.slice(0, -1).map((seed, index) => ({
    id: `${seed.id}-to-${chain[index + 1]!.id}`,
    sourceNodeId: seed.id,
    targetNodeId: chain[index + 1]!.id,
    sourceHandle: 'default',
    targetHandle: 'top',
  }))

  return { nodes, edges }
}

async function seedWorkflowCatalog(): Promise<void> {
  for (const workflow of NESY_COURIER_INDEPENDENT_WORKFLOWS) {
    const canvas = canvasForWorkflow(workflow.workflowKey)
    const row = await prisma.workflow.upsert({
      where: { slug: workflow.workflowKey },
      create: {
        slug: workflow.workflowKey,
        name: workflow.displayName,
        description: workflow.businessMeaning,
        status: 'published',
        category: 'verdict',
        icon: 'Workflow',
        iconClassName: '',
      },
      update: {
        name: workflow.displayName,
        description: workflow.businessMeaning,
        status: 'published',
        category: 'verdict',
        icon: 'Workflow',
        iconClassName: '',
      },
    })

    const version = await prisma.workflowVersion.upsert({
      where: { workflowId_version: { workflowId: row.id, version: 1 } },
      create: {
        workflowId: row.id,
        version: 1,
        nodes: canvas.nodes,
        edges: canvas.edges,
        config: {
          source: 'domain-pack-seed',
          workflowRef: workflow.workflowKey,
          macroRefs: workflow.macroRefs,
          fragmentRefs: workflow.fragmentRefs,
        },
        changelog: 'Provisioned from Nesy Courier Domain Pack seed.',
        createdBy: PUBLISHED_BY,
      },
      update: {
        nodes: canvas.nodes,
        edges: canvas.edges,
        config: {
          source: 'domain-pack-seed',
          workflowRef: workflow.workflowKey,
          macroRefs: workflow.macroRefs,
          fragmentRefs: workflow.fragmentRefs,
        },
        changelog: 'Provisioned from Nesy Courier Domain Pack seed.',
      },
    })

    await prisma.workflow.update({
      where: { id: row.id },
      data: { currentVersionId: version.id },
    })
  }
}

async function main(): Promise<void> {
  const domainPackStore = new PrismaDomainPackAdminStore(prisma)
  const testProfileStore = new PrismaTestProfileCatalogStore(prisma)
  const published = publishFirstPartyBundles()
  const nesy = published.find((pack) => pack.packKey === 'nesy.courier')
  if (nesy === undefined) throw new Error('Nesy Courier bundle was not published by seed')

  for (const pack of published) {
    await seedPublishedBundle(domainPackStore, pack)
  }
  for (const profile of NESY_COURIER_TEST_PROFILES) {
    await testProfileStore.upsert(runtimeProfile(profile, nesy))
  }
  await seedWorkflowCatalog()

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        packs: published.map((pack) => ({
          packKey: pack.packKey,
          version: pack.version,
          digest: pack.digest,
        })),
        testProfiles: NESY_COURIER_TEST_PROFILES.length,
        workflows: NESY_COURIER_INDEPENDENT_WORKFLOWS.length,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
