import type { TestProfileCatalogItemApi } from '@/lib/verdict-runtime/types'

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

export interface ParsedCampaignCell {
  cellKey: string
  profileKey: string
  profileVersion: number
  deviceCell: string
  datasetRef: string | null
  runIds: string[]
  result: string
  blockedReason: string | null
  evidenceSummaryRef: string | null
  runDetailPath: string | null
}

export interface ParsedTestCampaignDefinition {
  campaignKey: string
  version: number
  displayName: string
  profileRefs: string[]
  releaseGate: boolean
  onProfileFailure: string
  raw: Record<string, unknown>
}

export interface CampaignCellStats {
  total: number
  pass: number
  fail: number
  blocked: number
  pending: number
  partial: number
}

export interface ProfileSequenceRow {
  profileKey: string
  index: number
  profileVersion: number | null
  catalogKind: string | null
  cellCount: number
  passCount: number
  failCount: number
  blockedCount: number
  pendingCount: number
}

export function parseCampaignCell(raw: Record<string, unknown>): ParsedCampaignCell {
  const runIdsRaw = raw.runIds
  const runIds = Array.isArray(runIdsRaw)
    ? runIdsRaw.filter((item): item is string => typeof item === 'string')
    : []

  return {
    cellKey: asString(raw.cellKey) ?? 'unknown',
    profileKey: asString(raw.profileKey) ?? 'unknown',
    profileVersion: asNumber(raw.profileVersion, 1),
    deviceCell: asString(raw.deviceCell) ?? 'unassigned',
    datasetRef: asString(raw.datasetRef),
    runIds,
    result: asString(raw.result) ?? asString(raw.status) ?? 'PENDING',
    blockedReason: asString(raw.blockedReason),
    evidenceSummaryRef: asString(raw.evidenceSummaryRef),
    runDetailPath: asString(raw.runDetailPath),
  }
}

export function parseCampaignCells(cells: readonly Record<string, unknown>[]): ParsedCampaignCell[] {
  return cells.map(parseCampaignCell)
}

export function parseTestCampaignDefinition(
  raw: Record<string, unknown>,
): ParsedTestCampaignDefinition | null {
  const campaignKey = asString(raw.campaignKey)
  if (!campaignKey) return null

  return {
    campaignKey,
    version: asNumber(raw.version, 1),
    displayName: asString(raw.displayName) ?? campaignKey,
    profileRefs: asStringArray(raw.profileRefs),
    releaseGate: asBoolean(raw.releaseGate),
    onProfileFailure: asString(raw.onProfileFailure) ?? 'CONTINUE',
    raw,
  }
}

export function findTestCampaignDefinition(
  campaigns: readonly Record<string, unknown>[],
  campaignKey: string | null | undefined,
): ParsedTestCampaignDefinition | null {
  if (!campaignKey) return null
  const match = campaigns.find((entry) => asString(entry.campaignKey) === campaignKey)
  return match ? parseTestCampaignDefinition(match) : null
}

export function countCampaignCellResults(cells: readonly ParsedCampaignCell[]): CampaignCellStats {
  const stats: CampaignCellStats = {
    total: cells.length,
    pass: 0,
    fail: 0,
    blocked: 0,
    pending: 0,
    partial: 0,
  }

  for (const cell of cells) {
    switch (cell.result) {
      case 'PASS':
        stats.pass += 1
        break
      case 'FAIL':
        stats.fail += 1
        break
      case 'BLOCKED':
        stats.blocked += 1
        break
      case 'PARTIAL':
        stats.partial += 1
        break
      default:
        stats.pending += 1
        break
    }
  }

  return stats
}

export function buildProfileSequence(
  definition: ParsedTestCampaignDefinition | null,
  cells: readonly ParsedCampaignCell[],
  profileCatalog: ReadonlyMap<string, TestProfileCatalogItemApi>,
): ProfileSequenceRow[] {
  const profileKeys =
    definition && definition.profileRefs.length > 0
      ? definition.profileRefs
      : [...new Set(cells.map((cell) => cell.profileKey))]

  return profileKeys.map((profileKey, index) => {
    const profileCells = cells.filter((cell) => cell.profileKey === profileKey)
    const catalogItem = profileCatalog.get(profileKey)

    return {
      profileKey,
      index,
      profileVersion: profileCells[0]?.profileVersion ?? catalogItem?.version ?? null,
      catalogKind: catalogItem?.kind ?? null,
      cellCount: profileCells.length,
      passCount: profileCells.filter((cell) => cell.result === 'PASS').length,
      failCount: profileCells.filter((cell) => cell.result === 'FAIL').length,
      blockedCount: profileCells.filter((cell) => cell.result === 'BLOCKED').length,
      pendingCount: profileCells.filter(
        (cell) => cell.result === 'PENDING' || cell.result === 'PARTIAL',
      ).length,
    }
  })
}

export function profileCatalogByKey(
  items: readonly TestProfileCatalogItemApi[],
): Map<string, TestProfileCatalogItemApi> {
  const map = new Map<string, TestProfileCatalogItemApi>()
  for (const item of items) map.set(item.profileKey, item)
  return map
}

export function resolvePackFromProfiles(
  profileKeys: readonly string[],
  catalog: readonly TestProfileCatalogItemApi[],
): { packKey: string; packVersion: string } | null {
  for (const profileKey of profileKeys) {
    const match = catalog.find((item) => item.profileKey === profileKey)
    if (match) return { packKey: match.packKey, packVersion: match.packVersion }
  }
  return null
}

export function campaignTypeHint(campaignKey: string): string {
  switch (campaignKey) {
    case 'PR':
    case 'persist-pr':
      return 'Fast feedback on pull requests — smoke and preview profiles'
    case 'NIGHTLY':
    case 'persist-nightly':
      return 'Scheduled regression — critical paths and fault scenarios'
    case 'WEEKLY':
    case 'persist-weekly':
      return 'Extended coverage — load, compatibility, and soak profiles'
    case 'RELEASE':
    case 'persist-release':
      return 'Release gate — blocks promotion when required cells fail'
    default:
      return 'Verification campaign from the domain pack catalog'
  }
}

export function campaignFailurePolicyLabel(policy: string): string {
  return policy.replace(/_/g, ' ')
}
