import type {
  DomainPackAdminGetApi,
  DomainPackDetailApi,
  DomainPackSummary,
  DomainPackVersionRecordApi,
} from './types'
import { comparePackVersions } from './select-published-pack'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (entry): entry is Record<string, unknown> =>
      entry !== null && typeof entry === 'object' && !Array.isArray(entry),
  )
}

/**
 * Runtime admin GET returns `{ apiVersion, pack: { bundle } }`.
 * Product Coverage pages and the pack detail UI expect a flat DomainPackDetailApi.
 */
export function mapAdminPackToDetailApi(admin: DomainPackAdminGetApi): DomainPackDetailApi {
  const pack = admin.pack
  const bundle = asRecord(pack.bundle) ?? {}
  const registries = asRecord(bundle.registries) ?? {}
  const manifest = asRecord(bundle.manifest) ?? {}

  return {
    apiVersion: admin.apiVersion,
    packKey: pack.packKey,
    displayName: String(manifest.packName ?? manifest.displayName ?? pack.packKey),
    state: pack.publicationState,
    version: pack.version,
    publishedBundleHash: pack.bundleDigest,
    activePinnedRunVersions: [],
    manifest,
    compatibility: {},
    applications: asArray(registries.applications),
    screens: asArray(registries.screens),
    surfaces: asArray(registries.surfaces),
    entities: asArray(registries.entities),
    targets: asArray(registries.targets),
    evidenceSources: asArray(registries.evidenceSources),
    semanticActions: asArray(registries.semanticActions),
    macros: asArray(registries.macros),
    features: asArray(registries.features),
    capabilities: asArray(registries.capabilities),
    oracleTemplates: asArray(registries.oracleTemplates),
    launchProfiles: asArray(registries.launchProfiles),
    testProfiles: asArray(registries.testProfiles),
    migrations: asArray(registries.migrations),
    validation: {},
    partial: false,
    concurrencyToken: String(pack.revision),
  }
}

/** One published row per packKey — highest semver wins. */
export function selectLatestPublishedPacks(
  items: readonly DomainPackSummary[],
): DomainPackSummary[] {
  const latestByKey = new Map<string, DomainPackSummary>()

  for (const item of items) {
    if (item.publicationState !== 'PUBLISHED') continue
    const current = latestByKey.get(item.packKey)
    if (!current || comparePackVersions(item.version, current.version) > 0) {
      latestByKey.set(item.packKey, item)
    }
  }

  return [...latestByKey.values()].sort((left, right) =>
    left.packKey.localeCompare(right.packKey),
  )
}

export function featureContractKey(entry: Record<string, unknown>): string {
  return String(entry.featureKey ?? entry.key ?? entry.id ?? 'unknown')
}

export function featureContractTitle(entry: Record<string, unknown>): string {
  const authoring = asRecord(entry.authoring)
  const fromAuthoring = authoring?.displayName
  if (typeof fromAuthoring === 'string' && fromAuthoring.trim()) return fromAuthoring.trim()
  const top = entry.displayName ?? entry.title
  if (typeof top === 'string' && top.trim()) return top.trim()
  return featureContractKey(entry)
}

export function featureContractDescription(entry: Record<string, unknown>): string | null {
  const authoring = asRecord(entry.authoring)
  const description = authoring?.description
  if (typeof description === 'string' && description.trim()) return description.trim()
  return null
}

export function featureContractTags(entry: Record<string, unknown>): string[] {
  const authoring = asRecord(entry.authoring)
  if (!Array.isArray(authoring?.tags)) return []
  return authoring.tags.filter(
    (tag): tag is string => typeof tag === 'string' && tag.trim().length > 0,
  )
}

export function featureContractOwner(entry: Record<string, unknown>): string | null {
  const authoring = asRecord(entry.authoring)
  const owner = authoring?.owner
  if (typeof owner === 'string' && owner.trim()) return owner.trim()
  return null
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

export function featureExecutableSummary(entry: Record<string, unknown>): {
  invariantCount: number
  gatingInvariantCount: number
  screenCount: number
  workflowCount: number
} {
  const executable = asRecord(entry.executable) ?? entry
  const invariants = asArray(executable.invariants)
  return {
    invariantCount: invariants.length,
    gatingInvariantCount: invariants.filter((item) => item.bindsReleaseGate === true).length,
    screenCount: asStringArray(executable.screenRefs).length,
    workflowCount: asStringArray(executable.workflowRefs).length,
  }
}

export function capabilityContractKey(entry: Record<string, unknown>): string {
  return String(entry.capabilityKey ?? entry.key ?? entry.id ?? 'unknown')
}

export function capabilityContractTitle(entry: Record<string, unknown>): string {
  const top = entry.displayName ?? entry.title
  if (typeof top === 'string' && top.trim()) return top.trim()
  return capabilityContractKey(entry)
}

export function capabilityContractDescription(entry: Record<string, unknown>): string | null {
  const description = entry.description
  if (typeof description === 'string' && description.trim()) return description.trim()
  return null
}

export function capabilityContractLayer(entry: Record<string, unknown>): string {
  return String(entry.layer ?? 'unknown')
}

export function capabilityContractProvider(entry: Record<string, unknown>): string {
  return String(entry.provider ?? 'unknown')
}

export function capabilityRuntimeDetected(entry: Record<string, unknown>): boolean {
  return entry.runtimeDetected === true
}

export function capabilityAutomationOnly(entry: Record<string, unknown>): boolean {
  return entry.automationOnly === true
}

export function capabilityDetectionRef(entry: Record<string, unknown>): string | null {
  const ref = entry.detectionRef
  if (typeof ref === 'string' && ref.trim()) return ref.trim()
  return null
}

export function isCoreCapabilityLayer(layer: string): boolean {
  return layer.startsWith('verdict.core')
}

export function isDomainCapabilityLayer(layer: string): boolean {
  return layer.startsWith('domain.')
}

export function isDomainPackAdminGetApi(value: unknown): value is DomainPackAdminGetApi {
  const record = asRecord(value)
  if (!record) return false
  const pack = asRecord(record.pack)
  return typeof record.apiVersion === 'string' && pack !== null && typeof pack.packKey === 'string'
}

export function coerceDomainPackDetail(value: unknown): DomainPackDetailApi {
  if (isDomainPackAdminGetApi(value)) return mapAdminPackToDetailApi(value)
  return value as DomainPackDetailApi
}

export type { DomainPackVersionRecordApi }
