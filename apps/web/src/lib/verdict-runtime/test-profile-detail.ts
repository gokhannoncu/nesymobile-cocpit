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

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (entry): entry is Record<string, unknown> =>
      entry !== null && typeof entry === 'object' && !Array.isArray(entry),
  )
}

export interface ParsedFaultInjection {
  faultRef: string
  kind: string
  triggerRef: string
  correlationFactKey: string | null
  expectedRecoveryFactKey: string | null
}

export interface ParsedTestProfileDefinition {
  profileKey: string
  version: number
  kind: string
  displayName: string
  applicationRef: string
  launchProfileRef: string
  includedWorkflowRefs: string[]
  releaseGate: boolean
  telemetry: {
    captureArtifacts: boolean
    evidenceSampleEveryN: number
    retainRawEvidence: boolean
  }
  faultPlan: {
    expectRecovery: boolean
    injections: ParsedFaultInjection[]
  } | null
  differential: {
    baselineBuildRef: string
    criticalFactKeys: string[]
    onCriticalDiff: string
  } | null
  performanceBudgetRefs: Array<{ budgetRef: string; appliesToRef: string }>
  requiredCapabilityRefs: string[]
  raw: Record<string, unknown>
}

export interface ParsedTestCampaignMembership {
  campaignKey: string
  displayName: string
  version: number
  releaseGate: boolean
  onProfileFailure: string
  profileIndex: number
  profileCount: number
  campaignId: string | null
}

export function parseTestProfileDefinition(
  raw: Record<string, unknown>,
): ParsedTestProfileDefinition | null {
  const profileKey = asString(raw.profileKey)
  if (!profileKey) return null

  const telemetryRaw = raw.telemetry
  const telemetryRecord =
    telemetryRaw !== null && typeof telemetryRaw === 'object' && !Array.isArray(telemetryRaw)
      ? (telemetryRaw as Record<string, unknown>)
      : {}

  const faultPlanRaw = raw.faultPlan
  const faultPlanRecord =
    faultPlanRaw !== null && typeof faultPlanRaw === 'object' && !Array.isArray(faultPlanRaw)
      ? (faultPlanRaw as Record<string, unknown>)
      : null

  const differentialRaw = raw.differential
  const differentialRecord =
    differentialRaw !== null && typeof differentialRaw === 'object' && !Array.isArray(differentialRaw)
      ? (differentialRaw as Record<string, unknown>)
      : null

  const faultInjections = faultPlanRecord
    ? asRecordArray(faultPlanRecord.injections).map((injection) => ({
        faultRef: asString(injection.faultRef) ?? 'unknown.fault',
        kind: asString(injection.kind) ?? 'UNKNOWN',
        triggerRef: asString(injection.triggerRef) ?? 'unknown.trigger',
        correlationFactKey: asString(injection.correlationFactKey),
        expectedRecoveryFactKey: asString(injection.expectedRecoveryFactKey),
      }))
    : []

  const performanceBudgetRefs = asRecordArray(raw.performanceBudgetRefs)
    .map((entry) => ({
      budgetRef: asString(entry.budgetRef) ?? '',
      appliesToRef: asString(entry.appliesToRef) ?? '',
    }))
    .filter((entry) => entry.budgetRef && entry.appliesToRef)

  return {
    profileKey,
    version: asNumber(raw.version, 1),
    kind: asString(raw.kind) ?? 'UNKNOWN',
    displayName: asString(raw.displayName) ?? profileKey,
    applicationRef: asString(raw.applicationRef) ?? '—',
    launchProfileRef: asString(raw.launchProfileRef) ?? '—',
    includedWorkflowRefs: asStringArray(raw.includedWorkflowRefs),
    releaseGate: asBoolean(raw.releaseGate),
    telemetry: {
      captureArtifacts: asBoolean(telemetryRecord.captureArtifacts),
      evidenceSampleEveryN: asNumber(telemetryRecord.evidenceSampleEveryN, 1),
      retainRawEvidence: asBoolean(telemetryRecord.retainRawEvidence),
    },
    faultPlan: faultPlanRecord
      ? {
          expectRecovery: asBoolean(faultPlanRecord.expectRecovery),
          injections: faultInjections,
        }
      : null,
    differential: differentialRecord
      ? {
          baselineBuildRef: asString(differentialRecord.baselineBuildRef) ?? '—',
          criticalFactKeys: asStringArray(differentialRecord.criticalFactKeys),
          onCriticalDiff: asString(differentialRecord.onCriticalDiff) ?? '—',
        }
      : null,
    performanceBudgetRefs,
    requiredCapabilityRefs: asStringArray(raw.requiredCapabilityRefs),
    raw,
  }
}

export function findTestProfileDefinition(
  profiles: readonly Record<string, unknown>[],
  profileKey: string,
): ParsedTestProfileDefinition | null {
  const match = profiles.find((entry) => asString(entry.profileKey) === profileKey)
  return match ? parseTestProfileDefinition(match) : null
}

export function parseTestCampaignMembership(
  raw: Record<string, unknown>,
  profileKey: string,
): ParsedTestCampaignMembership | null {
  const campaignKey = asString(raw.campaignKey)
  if (!campaignKey) return null

  const profileRefs = asStringArray(raw.profileRefs)
  const profileIndex = profileRefs.indexOf(profileKey)
  if (profileIndex < 0) return null

  return {
    campaignKey,
    displayName: asString(raw.displayName) ?? campaignKey,
    version: asNumber(raw.version, 1),
    releaseGate: asBoolean(raw.releaseGate),
    onProfileFailure: asString(raw.onProfileFailure) ?? 'CONTINUE',
    profileIndex,
    profileCount: profileRefs.length,
    campaignId: null,
  }
}

export function findCampaignMembershipsForProfile(
  campaigns: readonly Record<string, unknown>[],
  profileKey: string,
  catalogCampaignIds: ReadonlyMap<string, string>,
): ParsedTestCampaignMembership[] {
  return campaigns
    .map((entry) => parseTestCampaignMembership(entry, profileKey))
    .filter((entry): entry is ParsedTestCampaignMembership => entry !== null)
    .map((entry) => ({
      ...entry,
      campaignId: catalogCampaignIds.get(entry.campaignKey) ?? null,
    }))
    .sort((left, right) => left.campaignKey.localeCompare(right.campaignKey))
}

export function resolveLaunchProfileLabel(
  launchProfiles: readonly Record<string, unknown>[],
  launchProfileRef: string,
): string {
  const match = launchProfiles.find((entry) => asString(entry.profileKey) === launchProfileRef)
  return asString(match?.displayName) ?? launchProfileRef
}

export function catalogCampaignIdByKey(
  items: ReadonlyArray<{ campaignKey: string; campaignId: string }>,
): Map<string, string> {
  const map = new Map<string, string>()
  for (const item of items) map.set(item.campaignKey, item.campaignId)
  return map
}

export function profileKindHint(kind: string): string {
  switch (kind) {
    case 'CORE':
    case 'RELEASE':
      return 'Release-gate eligible regression profile'
    case 'PREVIEW':
      return 'Fast feedback profile — never gates release'
    case 'SOAK':
    case 'DIAGNOSTIC':
      return 'Diagnostic or endurance profile'
    case 'FAULT':
    case 'BAD_DAY':
      return 'Fault injection and recovery validation'
    case 'DIFFERENTIAL':
      return 'Compares evidence against a baseline build'
    default:
      return 'Verification profile from the domain pack catalog'
  }
}

export function mergeCatalogWithDefinition(
  catalogItem: TestProfileCatalogItemApi,
  definition: ParsedTestProfileDefinition | null,
) {
  return {
    profileKey: catalogItem.profileKey,
    catalogVersion: catalogItem.version,
    catalogKind: catalogItem.kind,
    packKey: catalogItem.packKey,
    packVersion: catalogItem.packVersion,
    owner: catalogItem.owner,
    lastResult: catalogItem.lastResult,
    blockedReason: catalogItem.blockedReason ?? null,
    releaseGate: definition?.releaseGate ?? catalogItem.releaseGate,
    displayName: definition?.displayName ?? catalogItem.profileKey,
    contractKind: definition?.kind ?? catalogItem.kind,
  }
}
