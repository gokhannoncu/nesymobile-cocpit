import { prisma } from '@nesy/db'
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

async function seedWorkflowCatalog(): Promise<void> {
  for (const workflow of NESY_COURIER_INDEPENDENT_WORKFLOWS) {
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
        nodes: [],
        edges: [],
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
        nodes: [],
        edges: [],
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
