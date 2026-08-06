import {
  validateLaunchProfile,
  validateTargetResolutionPolicy,
  type ApplicationDefinition,
  type EntityDefinition,
  type LaunchProfile,
  type MacroDefinition,
  type ScreenDefinition,
  type SemanticActionDefinition,
  type SurfaceDefinition,
  type TargetDefinition,
  type TargetResolutionPolicy,
} from '@nesy/domain-pack-contracts'

import type {
  DomainPackAdminStore,
  DomainPackPublicationState,
} from './domain-pack-admin.service.js'

export const DOMAIN_PACK_READ_API_VERSION = 'verdict-runtime.v1' as const

export interface CapabilityStatus {
  satisfied: boolean
  missing: readonly string[]
  reason: string | null
}

export interface SemanticActionApiItem {
  actionKey: string
  displayName: string
  businessMeaning: string
  notResponsibleFor: readonly string[]
  applicationRef: string
  screenRefs: readonly string[]
  surfaceRefs: readonly string[]
  entityTypeRefs: readonly string[]
  targetRefs: readonly string[]
  requiredCapabilityRefs: readonly string[]
  capabilityStatus: CapabilityStatus
}

export interface SemanticActionMacroSummary {
  macroKey: string
  actionRef: string
  displayName: string
  businessMeaning: string
  notResponsibleFor: readonly string[]
  requiredCapabilityRefs: readonly string[]
  capabilityStatus: CapabilityStatus
}

export interface SemanticActionCatalogResult {
  apiVersion: typeof DOMAIN_PACK_READ_API_VERSION
  packKey: string
  packVersion: string
  partial: boolean
  items: SemanticActionApiItem[]
  macros: SemanticActionMacroSummary[]
  blockedReason?: string
}

export interface TargetResolutionStrategyApi {
  order: number
  kind: string
  establishesIdentity: boolean
  ambiguityPolicy: string
}

export interface TargetResolutionEntityApi {
  entityKey: string
  targetKey: string
  strategies: TargetResolutionStrategyApi[]
  notFoundPolicy: string
  ambiguityPolicy: string
  deadlineMs: number
  reverifyBeforeAction: boolean
  violations: readonly { code: string; message: string }[]
}

export interface TargetResolutionCatalogResult {
  apiVersion: typeof DOMAIN_PACK_READ_API_VERSION
  packKey: string
  packVersion: string
  partial: boolean
  entities: TargetResolutionEntityApi[]
  blockedReason?: string
}

export interface LaunchProfileApiItem {
  profileKey: string
  applicationRef: string
  displayName: string
  startMode: string
  sessionPreparation: string
  preconditionFactKeys: readonly string[]
  entry: LaunchProfile['entry']
  preparationOperationRefs: readonly string[]
  cleanup: LaunchProfile['cleanup']
  producesProductVerdict: boolean
  releaseIsolation: LaunchProfile['releaseIsolation']
  requiredCapabilityRefs: readonly string[]
  blockedReason?: string
}

export interface LaunchProfileCatalogResult {
  apiVersion: typeof DOMAIN_PACK_READ_API_VERSION
  packKey: string
  packVersion: string
  partial: boolean
  items: LaunchProfileApiItem[]
  blockedReason?: string
}

export interface EntityCatalogItem {
  entityType: string
  applicationRef: string
  displayName: string
  businessKeyPath: string
  identityPaths: readonly string[]
  sourceQueryRefs: readonly string[]
}

export interface EntityBindingCatalogItem {
  entityTypeRef: string
  targetRef: string
  targetDisplayName: string
  projectedPaths: readonly string[]
  redactProjection: boolean
  /** True when entityTypeRef resolves to a registries.entities entry. */
  entityKnown: boolean
}

export interface EntityBindingCatalogResult {
  apiVersion: typeof DOMAIN_PACK_READ_API_VERSION
  packKey: string
  packVersion: string
  partial: boolean
  entities: EntityCatalogItem[]
  bindings: EntityBindingCatalogItem[]
  blockedReason?: string
}

export interface ReadinessContractApi {
  requiredFactKeys: readonly string[]
  anyOfFactKeys: readonly string[]
  noneOfFactKeys: readonly string[]
  deadlineMs: number
  stableForMs: number | null
}

export interface ApplicationRegistryItem {
  applicationKey: string
  displayName: string
  platform: string
}

export interface ScreenRegistryItem {
  screenKey: string
  applicationRef: string
  displayName: string
  readiness: ReadinessContractApi
  supportedSurfaceRefs: readonly string[]
}

export interface SurfaceRegistryItem {
  surfaceKey: string
  applicationRef: string
  kind: string
  displayName: string
  parentScreenRefs: readonly string[]
  detection: ReadinessContractApi
  defaultPolicy: string
  priority: number
  handlerMacroRef: string | null
  blocksProductVerdict: boolean
}

export interface ScreenSurfaceCatalogResult {
  apiVersion: typeof DOMAIN_PACK_READ_API_VERSION
  packKey: string
  packVersion: string
  publicationState: DomainPackPublicationState
  revision: number
  bundleDigest: string
  partial: boolean
  applications: ApplicationRegistryItem[]
  screens: ScreenRegistryItem[]
  surfaces: SurfaceRegistryItem[]
  blockedReason?: string
  /** Present when publicationState is not DRAFT — edits must be refused. */
  immutableReason?: string
}

/**
 * Pack-scoped read models for Phase 6 UI binding. Loads published (or draft)
 * bundles from the admin store and projects registry slices — never invents rows.
 */
export class DomainPackReadModelsService {
  constructor(private readonly store: DomainPackAdminStore) {}

  async listSemanticActions(
    packKey: string,
    version: string,
    options: { deviceId?: string } = {},
  ): Promise<SemanticActionCatalogResult | null> {
    const loaded = await this.loadBundle(packKey, version)
    if (!loaded) return null

    const actions = asArray<SemanticActionDefinition>(loaded.registries?.semanticActions)
    const macros = asArray<MacroDefinition>(loaded.registries?.macros)
    const negotiationAvailable = false

    return {
      apiVersion: DOMAIN_PACK_READ_API_VERSION,
      packKey,
      packVersion: version,
      partial: actions.length === 0,
      items: actions.map((action) => ({
        actionKey: action.actionKey,
        displayName: action.displayName,
        businessMeaning: action.businessMeaning,
        notResponsibleFor: [...(action.notResponsibleFor ?? [])],
        applicationRef: action.applicationRef,
        screenRefs: [...(action.screenRefs ?? [])],
        surfaceRefs: [...(action.surfaceRefs ?? [])],
        entityTypeRefs: [...(action.entityTypeRefs ?? [])],
        targetRefs: [...(action.targetRefs ?? [])],
        requiredCapabilityRefs: [...(action.requiredCapabilityRefs ?? [])],
        capabilityStatus: capabilityStatusFor(
          action.requiredCapabilityRefs ?? [],
          options.deviceId,
          negotiationAvailable,
        ),
      })),
      macros: macros.map((macro) => ({
        macroKey: macro.macroKey,
        actionRef: macro.actionRef,
        displayName: macro.displayName,
        businessMeaning: macro.businessMeaning,
        notResponsibleFor: [...(macro.notResponsibleFor ?? [])],
        requiredCapabilityRefs: [...(macro.requiredCapabilityRefs ?? [])],
        capabilityStatus: capabilityStatusFor(
          macro.requiredCapabilityRefs ?? [],
          options.deviceId,
          negotiationAvailable,
        ),
      })),
      ...(actions.length === 0
        ? { blockedReason: 'pack bundle has no semanticActions registry entries' }
        : {}),
    }
  }

  async listTargetResolution(
    packKey: string,
    version: string,
  ): Promise<TargetResolutionCatalogResult | null> {
    const loaded = await this.loadBundle(packKey, version)
    if (!loaded) return null

    const targets = asArray<TargetDefinition>(loaded.registries?.targets)
    const entities: TargetResolutionEntityApi[] = targets.map((target) => {
      const resolution = target.resolution
      const violations = resolution
        ? validateTargetResolutionPolicy(resolution, `targets.${target.targetKey}.resolution`)
        : [{ code: 'EMPTY_CHAIN', message: 'target has no resolution policy' }]
      return {
        entityKey: target.entityBinding?.entityTypeRef ?? target.targetKey,
        targetKey: target.targetKey,
        strategies: (resolution?.chain ?? []).map((strategy, index) => ({
          order: index + 1,
          kind: strategy.kind,
          establishesIdentity: strategy.establishesIdentity,
          ambiguityPolicy: resolution.ambiguityPolicy,
        })),
        notFoundPolicy: resolution?.notFoundPolicy ?? 'FAIL',
        ambiguityPolicy: resolution?.ambiguityPolicy ?? 'FAIL',
        deadlineMs: resolution?.deadlineMs ?? 0,
        reverifyBeforeAction: resolution?.reverifyBeforeAction ?? false,
        violations,
      }
    })

    return {
      apiVersion: DOMAIN_PACK_READ_API_VERSION,
      packKey,
      packVersion: version,
      partial: entities.length === 0,
      entities,
      ...(entities.length === 0
        ? { blockedReason: 'pack bundle has no targets registry entries' }
        : {}),
    }
  }

  validateTargetResolution(policy: TargetResolutionPolicy): {
    apiVersion: typeof DOMAIN_PACK_READ_API_VERSION
    ok: boolean
    violations: readonly { code: string; message: string }[]
  } {
    const violations = validateTargetResolutionPolicy(policy, 'policy')
    return {
      apiVersion: DOMAIN_PACK_READ_API_VERSION,
      ok: violations.length === 0,
      violations,
    }
  }

  async listScreenSurfaces(
    packKey: string,
    version: string,
  ): Promise<ScreenSurfaceCatalogResult | null> {
    const record = await this.store.get(packKey, version)
    if (!record) return null

    const registries =
      isRecord(record.bundle) && isRecord(record.bundle.registries)
        ? record.bundle.registries
        : undefined

    const applications = asArray<ApplicationDefinition>(registries?.applications).map(
      (app) => ({
        applicationKey: app.applicationKey,
        displayName: app.displayName,
        platform: String(app.platform ?? ''),
      }),
    )

    const screens = asArray<ScreenDefinition>(registries?.screens).map((screen) => ({
      screenKey: screen.screenKey,
      applicationRef: screen.applicationRef,
      displayName: screen.displayName,
      readiness: projectReadiness(screen.readiness),
      supportedSurfaceRefs: [...(screen.supportedSurfaceRefs ?? [])],
    }))

    const surfaces = asArray<SurfaceDefinition>(registries?.surfaces).map((surface) => ({
      surfaceKey: surface.surfaceKey,
      applicationRef: surface.applicationRef,
      kind: surface.kind,
      displayName: surface.displayName,
      parentScreenRefs: [...(surface.parentScreenRefs ?? [])],
      detection: projectReadiness(surface.detection),
      defaultPolicy: surface.defaultPolicy,
      priority: surface.priority,
      handlerMacroRef: surface.handlerMacroRef ?? null,
      blocksProductVerdict: surface.blocksProductVerdict === true,
    }))

    const immutable =
      record.publicationState === 'PUBLISHED' || record.publicationState === 'ARCHIVED'

    return {
      apiVersion: DOMAIN_PACK_READ_API_VERSION,
      packKey,
      packVersion: version,
      publicationState: record.publicationState,
      revision: record.revision,
      bundleDigest: record.bundleDigest,
      partial: applications.length === 0 && screens.length === 0 && surfaces.length === 0,
      applications,
      screens,
      surfaces,
      ...(applications.length === 0 && screens.length === 0 && surfaces.length === 0
        ? { blockedReason: 'pack bundle has no applications, screens, or surfaces' }
        : {}),
      ...(immutable
        ? {
            immutableReason: `pack is ${record.publicationState} — surface registry is read-only`,
          }
        : {}),
    }
  }

  async listEntityBindings(
    packKey: string,
    version: string,
  ): Promise<EntityBindingCatalogResult | null> {
    const loaded = await this.loadBundle(packKey, version)
    if (!loaded) return null

    const entityDefs = asArray<EntityDefinition>(loaded.registries?.entities)
    const targets = asArray<TargetDefinition>(loaded.registries?.targets)
    const knownTypes = new Set(entityDefs.map((e) => e.entityType))

    const entities: EntityCatalogItem[] = entityDefs.map((entity) => ({
      entityType: entity.entityType,
      applicationRef: entity.applicationRef,
      displayName: entity.displayName,
      businessKeyPath: entity.businessKeyPath,
      identityPaths: [...(entity.identityPaths ?? [])],
      sourceQueryRefs: [...(entity.sourceQueryRefs ?? [])],
    }))

    const bindings: EntityBindingCatalogItem[] = targets
      .filter((target) => target.entityBinding !== undefined)
      .map((target) => {
        const binding = target.entityBinding!
        return {
          entityTypeRef: binding.entityTypeRef,
          targetRef: binding.targetRef || target.targetKey,
          targetDisplayName: target.displayName,
          projectedPaths: [...(binding.projectedPaths ?? [])],
          redactProjection: binding.redactProjection === true,
          entityKnown: knownTypes.has(binding.entityTypeRef),
        }
      })

    const unboundTargets = targets.filter((t) => t.entityBinding === undefined).length
    const unknownEntityRefs = bindings.filter((b) => !b.entityKnown).length

    return {
      apiVersion: DOMAIN_PACK_READ_API_VERSION,
      packKey,
      packVersion: version,
      partial:
        entities.length === 0 ||
        bindings.length === 0 ||
        unknownEntityRefs > 0 ||
        unboundTargets > 0,
      entities,
      bindings,
      ...(entities.length === 0 && bindings.length === 0
        ? { blockedReason: 'pack bundle has no entities or entity bindings' }
        : unknownEntityRefs > 0
          ? {
              blockedReason: `${unknownEntityRefs} binding(s) reference unknown entityTypeRef`,
            }
          : {}),
    }
  }

  async listLaunchProfiles(
    packKey: string,
    version: string,
    options: { releaseBuild?: boolean } = {},
  ): Promise<LaunchProfileCatalogResult | null> {
    const loaded = await this.loadBundle(packKey, version)
    if (!loaded) return null

    const profiles = asArray<LaunchProfile>(loaded.registries?.launchProfiles)
    const releaseBuild = options.releaseBuild === true
    const items: LaunchProfileApiItem[] = profiles.map((profile) => {
      const blockedReason = releaseBlockedReason(profile, releaseBuild)
      return {
        profileKey: profile.profileKey,
        applicationRef: profile.applicationRef,
        displayName: profile.displayName,
        startMode: profile.startMode,
        sessionPreparation: profile.sessionPreparation,
        preconditionFactKeys: [...(profile.preconditionFactKeys ?? [])],
        entry: profile.entry,
        preparationOperationRefs: [...(profile.preparationOperationRefs ?? [])],
        cleanup: profile.cleanup,
        producesProductVerdict: profile.producesProductVerdict,
        releaseIsolation: profile.releaseIsolation,
        requiredCapabilityRefs: [...(profile.requiredCapabilityRefs ?? [])],
        ...(blockedReason === undefined ? {} : { blockedReason }),
      }
    })

    return {
      apiVersion: DOMAIN_PACK_READ_API_VERSION,
      packKey,
      packVersion: version,
      partial: items.length === 0,
      items,
      ...(items.length === 0
        ? { blockedReason: 'pack bundle has no launchProfiles registry entries' }
        : {}),
    }
  }

  validateLaunchProfile(
    profile: LaunchProfile | Record<string, unknown>,
    options: { releaseBuild?: boolean } = {},
  ): {
    apiVersion: typeof DOMAIN_PACK_READ_API_VERSION
    ok: boolean
    violations: readonly { code: string; message: string }[]
    blockedReason?: string
  } {
    // Accept partial builder drafts: shape-check before contract validation so a
    // missing releaseIsolation becomes 422 MISSING_FIELD, not a 400 TypeError.
    const shapeViolations = launchProfileShapeViolations(profile)
    if (shapeViolations.length > 0) {
      return {
        apiVersion: DOMAIN_PACK_READ_API_VERSION,
        ok: false,
        violations: shapeViolations,
      }
    }

    const typed = profile as LaunchProfile
    const violations: { code: string; message: string }[] = validateLaunchProfile(
      typed,
      'profile',
    ).map((v) => ({ code: v.code, message: v.message }))
    const releaseBlock = releaseBlockedReason(typed, options.releaseBuild === true)
    if (releaseBlock !== undefined) {
      violations.push({
        code: 'DIRECT_STATE_BLOCKED_IN_RELEASE',
        message: releaseBlock,
      })
    }
    return {
      apiVersion: DOMAIN_PACK_READ_API_VERSION,
      ok: violations.length === 0,
      violations,
      ...(releaseBlock === undefined ? {} : { blockedReason: releaseBlock }),
    }
  }

  async listRunTargetResolutions(runId: string): Promise<{
    apiVersion: typeof DOMAIN_PACK_READ_API_VERSION
    runId: string
    partial: boolean
    items: readonly Record<string, unknown>[]
    blockedReason?: string
  }> {
    // No durable per-run target-resolution audit table yet — return an honest
    // empty partial rather than fabricating matched strategies.
    return {
      apiVersion: DOMAIN_PACK_READ_API_VERSION,
      runId,
      partial: true,
      items: [],
      blockedReason:
        runId.trim() === ''
          ? 'runId is required'
          : 'no target-resolution observations persisted for this run',
    }
  }

  private async loadBundle(
    packKey: string,
    version: string,
  ): Promise<{ registries?: Record<string, unknown> } | null> {
    const record = await this.store.get(packKey, version)
    if (!record) return null
    if (!isRecord(record.bundle)) return { registries: undefined }
    const registries = record.bundle.registries
    return { registries: isRecord(registries) ? registries : undefined }
  }
}

/**
 * Capability gating for palette listing. Bridge B2 negotiation is not wired
 * yet, so any non-empty requiredCapabilityRefs set is reported unsatisfied —
 * `deviceId` is accepted for forward compatibility but does not change the
 * outcome until negotiation is connected (phase-6-debt follow-up).
 */
function capabilityStatusFor(
  required: readonly string[],
  _deviceId: string | undefined,
  _negotiationAvailable: boolean,
): CapabilityStatus {
  if (required.length === 0) {
    return { satisfied: true, missing: [], reason: null }
  }
  return {
    satisfied: false,
    missing: [...required],
    reason: 'Bridge B2 capability negotiation not available on this device',
  }
}

function launchProfileShapeViolations(
  profile: LaunchProfile | Record<string, unknown>,
): { code: string; message: string }[] {
  if (!isRecord(profile)) {
    return [{ code: 'MISSING_FIELD', message: 'profile must be an object' }]
  }
  const violations: { code: string; message: string }[] = []
  for (const field of ['releaseIsolation', 'cleanup', 'entry', 'sessionPreparation'] as const) {
    if (profile[field] === undefined || profile[field] === null) {
      violations.push({
        code: 'MISSING_FIELD',
        message: `profile.${field} is required`,
      })
    }
  }
  return violations
}

function releaseBlockedReason(
  profile: LaunchProfile,
  releaseBuild: boolean,
): string | undefined {
  if (!releaseBuild) return undefined
  if (profile.sessionPreparation === 'DIRECT_STATE') {
    return 'DIRECT_STATE session preparation is blocked in release builds'
  }
  if (
    profile.sessionPreparation === 'PREPARED_SESSION' &&
    profile.releaseIsolation?.automationOnly !== true
  ) {
    return 'PREPARED_SESSION without releaseIsolation.automationOnly is blocked in release builds'
  }
  return undefined
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function projectReadiness(value: unknown): ReadinessContractApi {
  if (!isRecord(value)) {
    return {
      requiredFactKeys: [],
      anyOfFactKeys: [],
      noneOfFactKeys: [],
      deadlineMs: 0,
      stableForMs: null,
    }
  }
  return {
    requiredFactKeys: asArray<string>(value.requiredFactKeys),
    anyOfFactKeys: asArray<string>(value.anyOfFactKeys),
    noneOfFactKeys: asArray<string>(value.noneOfFactKeys),
    deadlineMs: typeof value.deadlineMs === 'number' ? value.deadlineMs : 0,
    stableForMs: typeof value.stableForMs === 'number' ? value.stableForMs : null,
  }
}
