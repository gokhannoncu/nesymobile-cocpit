/**
 * Database-backed stores for the Phase 6 contract services.
 *
 * These services previously held their state in module-scope `Map`s, so
 * everything the cockpit wrote — published domain packs, saved profiles, started
 * campaigns — disappeared on every API restart. Phase 5 shipped the schema for
 * all of it; these stores connect the two.
 *
 * The in-memory implementations stay in place and remain the default in unit
 * tests: they are the same contract, without a database.
 */

import type { PrismaClient } from '@nesy/db'

import type {
  DomainPackAdminStore,
  DomainPackPublicationState,
  DomainPackVersionRecord,
} from './domain-pack-admin.service.js'
import type {
  TestProfileCatalogStore,
  TestProfileKind,
  TestProfileRecord,
} from './test-profile-catalog.service.js'
import type {
  CampaignCellRecord,
  CampaignRecord,
  TestCampaignStore,
} from './test-campaign.service.js'
import {
  WORKFLOW_RUN_API_VERSION,
  type WorkflowRunStartRequest,
  type WorkflowRunStartResult,
  type WorkflowRunStartStore,
} from './workflow-run.service.js'
import type {
  DurableInteractionEvent,
  DurableInteractionStore,
  InteractionOrigin,
} from './durable-interaction-subscription.js'

/* ------------------------------------------------------------------ */
/* Domain packs                                                        */
/* ------------------------------------------------------------------ */

export class PrismaDomainPackAdminStore implements DomainPackAdminStore {
  constructor(private readonly prisma: PrismaClient) {}

  async list(): Promise<DomainPackVersionRecord[]> {
    const rows = await this.prisma.verdictDomainPackVersion.findMany({
      include: { domainPack: true },
      orderBy: [{ createdAt: 'asc' }],
    })
    return rows.map((row) => toDomainPackRecord(row, row.domainPack.packKey))
  }

  async get(packKey: string, version: string): Promise<DomainPackVersionRecord | undefined> {
    const pack = await this.prisma.verdictDomainPack.findUnique({ where: { packKey } })
    if (!pack) return undefined
    const row = await this.prisma.verdictDomainPackVersion.findUnique({
      where: { domainPackId_version: { domainPackId: pack.id, version } },
    })
    return row ? toDomainPackRecord(row, packKey) : undefined
  }

  async upsert(record: DomainPackVersionRecord): Promise<void> {
    const pack = await this.prisma.verdictDomainPack.upsert({
      where: { packKey: record.packKey },
      create: { packKey: record.packKey },
      update: {},
    })

    const data = {
      bundleDigest: record.bundleDigest,
      publicationState: record.publicationState,
      bundle: (record.bundle ?? {}) as object,
      revision: record.revision,
      publishedAt: record.publishedAt === undefined ? null : new Date(record.publishedAt),
      publishedBy: record.publishedBy ?? null,
      // Mirrors the DRAFT→PUBLISHED transition the DB trigger allows exactly once.
      immutableAt: record.publicationState === 'PUBLISHED' ? new Date() : null,
    }

    await this.prisma.verdictDomainPackVersion.upsert({
      where: { domainPackId_version: { domainPackId: pack.id, version: record.version } },
      create: { domainPackId: pack.id, version: record.version, ...data },
      update: data,
    })
  }
}

interface DomainPackVersionRow {
  version: string
  bundleDigest: string
  publicationState: string
  bundle: unknown
  revision: number
  publishedAt: Date | null
  publishedBy: string | null
}

function toDomainPackRecord(row: DomainPackVersionRow, packKey: string): DomainPackVersionRecord {
  return {
    packKey,
    version: row.version,
    bundleDigest: row.bundleDigest,
    publicationState: row.publicationState as DomainPackPublicationState,
    bundle: row.bundle,
    revision: row.revision,
    ...(row.publishedAt === null ? {} : { publishedAt: row.publishedAt.toISOString() }),
    ...(row.publishedBy === null ? {} : { publishedBy: row.publishedBy }),
  }
}

/* ------------------------------------------------------------------ */
/* Test profiles                                                       */
/* ------------------------------------------------------------------ */

/**
 * `verdict_test_profile_version` carries the identity columns plus a JSON
 * `definition`. Everything the catalog DTO exposes beyond profileKey/version is
 * stored inside that document, so no schema change is needed.
 */
interface StoredProfileDefinition {
  kind: TestProfileKind
  releaseGate: boolean
  packKey: string
  packVersion: string
  owner: string
  definition: TestProfileRecord['definition']
  lastResult?: TestProfileRecord['lastResult']
  blockedReason?: string
}

export class PrismaTestProfileCatalogStore implements TestProfileCatalogStore {
  constructor(private readonly prisma: PrismaClient) {}

  async list(): Promise<TestProfileRecord[]> {
    const rows = await this.prisma.verdictTestProfileVersion.findMany({
      orderBy: [{ profileKey: 'asc' }, { version: 'asc' }],
    })
    return rows.map((row) => toProfileRecord(row.profileKey, row.version, row.definition))
  }

  async get(profileKey: string, version: number): Promise<TestProfileRecord | undefined> {
    const row = await this.prisma.verdictTestProfileVersion.findUnique({
      where: { profileKey_version: { profileKey, version } },
    })
    return row ? toProfileRecord(row.profileKey, row.version, row.definition) : undefined
  }

  async upsert(profile: TestProfileRecord): Promise<void> {
    const stored: StoredProfileDefinition = {
      kind: profile.kind,
      releaseGate: profile.releaseGate,
      packKey: profile.packKey,
      packVersion: profile.packVersion,
      owner: profile.owner,
      definition: profile.definition,
      ...(profile.lastResult === undefined ? {} : { lastResult: profile.lastResult }),
      ...(profile.blockedReason === undefined ? {} : { blockedReason: profile.blockedReason }),
    }
    await this.prisma.verdictTestProfileVersion.upsert({
      where: { profileKey_version: { profileKey: profile.profileKey, version: profile.version } },
      create: {
        profileKey: profile.profileKey,
        version: profile.version,
        definition: stored as unknown as object,
      },
      update: { definition: stored as unknown as object },
    })
  }
}

function toProfileRecord(profileKey: string, version: number, definition: unknown): TestProfileRecord {
  const stored = (definition ?? {}) as Partial<StoredProfileDefinition>
  return {
    profileKey,
    version,
    kind: stored.kind ?? 'CORE',
    releaseGate: stored.releaseGate ?? false,
    packKey: stored.packKey ?? '',
    packVersion: stored.packVersion ?? '',
    definition: stored.definition ?? { includedWorkflowRefs: [] },
    owner: stored.owner ?? 'system',
    ...(stored.lastResult === undefined ? {} : { lastResult: stored.lastResult }),
    ...(stored.blockedReason === undefined ? {} : { blockedReason: stored.blockedReason }),
  }
}

/* ------------------------------------------------------------------ */
/* Test campaigns                                                      */
/* ------------------------------------------------------------------ */

export class PrismaTestCampaignStore implements TestCampaignStore {
  constructor(private readonly prisma: PrismaClient) {}

  async list(): Promise<CampaignRecord[]> {
    const rows = await this.prisma.verdictTestCampaign.findMany({
      include: { cells: { orderBy: { cellKey: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    })
    return rows.map(toCampaignRecord)
  }

  async get(campaignId: string): Promise<CampaignRecord | undefined> {
    const row = await this.prisma.verdictTestCampaign.findUnique({
      where: { campaignId },
      include: { cells: { orderBy: { cellKey: 'asc' } } },
    })
    return row ? toCampaignRecord(row) : undefined
  }

  async upsert(campaign: CampaignRecord): Promise<void> {
    const failedCells = campaign.cells
      .filter((cell) => cell.result === 'FAIL' || cell.result === 'BLOCKED')
      .map((cell) => cell.cellKey)

    const header = {
      campaignKey: campaign.campaignKey,
      campaignVersion: campaign.campaignVersion,
      status: campaign.status,
      definition: { campaignKey: campaign.campaignKey, campaignVersion: campaign.campaignVersion },
      failedCells,
      releaseGateResult: campaign.releaseGateResult ?? 'NOT_EVALUATED',
      evidenceSummaryRef: campaign.evidenceSummaryRef ?? null,
    }

    const row = await this.prisma.verdictTestCampaign.upsert({
      where: { campaignId: campaign.campaignId },
      create: { campaignId: campaign.campaignId, ...header },
      update: header,
    })

    for (const cell of campaign.cells) {
      const cellData = {
        profileKey: cell.profileKey,
        profileVersion: cell.profileVersion,
        deviceCell: cell.deviceCell ?? null,
        runIds: [...cell.runIds],
        result: cell.result,
        blockedReason: cell.blockedReason ?? null,
        evidenceSummaryRef: cell.evidenceSummaryRef ?? null,
      }
      await this.prisma.verdictCampaignCell.upsert({
        where: { campaignId_cellKey: { campaignId: row.id, cellKey: cell.cellKey } },
        create: { campaignId: row.id, cellKey: cell.cellKey, ...cellData },
        update: cellData,
      })
    }
  }
}

interface CampaignCellRow {
  cellKey: string
  profileKey: string
  profileVersion: number
  deviceCell: string | null
  runIds: unknown
  result: string
  blockedReason: string | null
  evidenceSummaryRef: string | null
}

interface CampaignRow {
  campaignId: string
  campaignKey: string
  campaignVersion: number
  status: string
  releaseGateResult: string | null
  evidenceSummaryRef: string | null
  definition: unknown
  cells: CampaignCellRow[]
}

function toCampaignRecord(row: CampaignRow): CampaignRecord {
  return {
    campaignId: row.campaignId,
    campaignKey: row.campaignKey,
    campaignVersion: row.campaignVersion,
    status: row.status as CampaignRecord['status'],
    releaseGateResult: (row.releaseGateResult ?? 'NOT_EVALUATED') as CampaignRecord['releaseGateResult'],
    ...(row.evidenceSummaryRef === null ? {} : { evidenceSummaryRef: row.evidenceSummaryRef }),
    cells: row.cells.map(
      (cell): CampaignCellRecord => ({
        cellKey: cell.cellKey,
        profileKey: cell.profileKey,
        profileVersion: cell.profileVersion,
        ...(cell.deviceCell === null ? {} : { deviceCell: cell.deviceCell }),
        runIds: Array.isArray(cell.runIds) ? (cell.runIds as string[]) : [],
        result: cell.result as CampaignCellRecord['result'],
        ...(cell.blockedReason === null ? {} : { blockedReason: cell.blockedReason }),
        ...(cell.evidenceSummaryRef === null
          ? {}
          : { evidenceSummaryRef: cell.evidenceSummaryRef }),
      }),
    ),
  }
}

/* ------------------------------------------------------------------ */
/* Run starts                                                          */
/* ------------------------------------------------------------------ */

export class PrismaWorkflowRunStartStore implements WorkflowRunStartStore {
  constructor(private readonly prisma: PrismaClient) {}

  async findByIdempotencyKey(idempotencyKey: string): Promise<WorkflowRunStartResult | undefined> {
    const row = await this.prisma.verdictRunStart.findUnique({ where: { idempotencyKey } })
    if (!row) return undefined
    return {
      apiVersion: WORKFLOW_RUN_API_VERSION,
      runId: row.runId,
      executionId: row.executionId,
      compiledPlanHash: row.compiledPlanHash,
      status: row.status as 'QUEUED',
      engineType: row.engineType as 'BRIDGEFLOW',
    }
  }

  async insert(input: {
    idempotencyKey: string
    request: WorkflowRunStartRequest
    result: WorkflowRunStartResult
  }): Promise<void> {
    const { request, result } = input
    await this.prisma.verdictRunStart.create({
      data: {
        idempotencyKey: input.idempotencyKey,
        runId: result.runId,
        executionId: result.executionId,
        workflowRef: request.workflowRef,
        deviceId: request.deviceId,
        compiledPlanRef: request.compiledPlanRef,
        compiledPlanHash: request.compiledPlanHash,
        domainPackKey: request.domainPackKey,
        domainPackVersion: request.domainPackVersion,
        domainPackDigest: request.domainPackDigest,
        releaseGate: request.releaseGate === true,
        profileKey: request.profileKey ?? null,
        profileVersion: request.profileVersion ?? null,
        status: result.status,
        engineType: result.engineType,
      },
    })
  }
}

/* ------------------------------------------------------------------ */
/* Durable interactions                                                */
/* ------------------------------------------------------------------ */

export class PrismaDurableInteractionStore implements DurableInteractionStore {
  constructor(private readonly prisma: PrismaClient) {}

  async listByRun(runId: string): Promise<DurableInteractionEvent[]> {
    const rows = await this.prisma.verdictRunInteraction.findMany({
      where: { runId },
      orderBy: { revision: 'asc' },
    })
    return rows.map((row) => ({
      eventId: row.eventId,
      runId: row.runId,
      revision: row.revision,
      origin: row.origin as InteractionOrigin,
      confidence: row.confidence,
      occurredAtMs: Number(row.occurredAtMs),
      summary: row.summary,
      secretRedacted: true,
    }))
  }

  async append(event: DurableInteractionEvent): Promise<DurableInteractionEvent> {
    await this.prisma.verdictRunInteraction.create({
      data: {
        runId: event.runId,
        eventId: event.eventId,
        revision: event.revision,
        origin: event.origin,
        confidence: event.confidence,
        occurredAtMs: BigInt(event.occurredAtMs),
        summary: event.summary,
        secretRedacted: true,
      },
    })
    return event
  }
}
