export const TEST_PROFILE_API_VERSION = 'verdict-runtime.v1' as const

export type TestProfileKind = 'CORE' | 'PREVIEW' | 'SOAK' | 'FAULT'

export interface TestProfileRecord {
  profileKey: string
  version: number
  kind: TestProfileKind
  releaseGate: boolean
  packKey: string
  packVersion: string
  definition: {
    includedWorkflowRefs: readonly string[]
    launchProfileRef?: string
    datasetRef?: string
    requiredCapabilities?: readonly string[]
  }
  owner: string
  lastResult?: 'PASS' | 'FAIL' | 'INCONCLUSIVE' | 'NOT_RUN'
  blockedReason?: string
}

/** Async so the same contract covers the in-memory and database-backed stores. */
export interface TestProfileCatalogStore {
  list(): Promise<TestProfileRecord[]>
  get(profileKey: string, version: number): Promise<TestProfileRecord | undefined>
  upsert(profile: TestProfileRecord): Promise<void>
}

export class InMemoryTestProfileCatalogStore implements TestProfileCatalogStore {
  private readonly profiles = new Map<string, TestProfileRecord>()

  private id(profileKey: string, version: number): string {
    return `${profileKey}@${version}`
  }

  async list(): Promise<TestProfileRecord[]> {
    return [...this.profiles.values()]
  }

  async get(profileKey: string, version: number): Promise<TestProfileRecord | undefined> {
    return this.profiles.get(this.id(profileKey, version))
  }

  async upsert(profile: TestProfileRecord): Promise<void> {
    this.profiles.set(this.id(profile.profileKey, profile.version), { ...profile })
  }
}

export class TestProfileCatalogService {
  constructor(
    private readonly store: TestProfileCatalogStore = new InMemoryTestProfileCatalogStore(),
  ) {}

  async list() {
    const profiles = await this.store.list()
    return {
      apiVersion: TEST_PROFILE_API_VERSION,
      partial: false,
      items: profiles.map((profile) => ({
        profileKey: profile.profileKey,
        version: profile.version,
        kind: profile.kind,
        releaseGate: profile.releaseGate,
        packKey: profile.packKey,
        packVersion: profile.packVersion,
        owner: profile.owner,
        lastResult: profile.lastResult ?? 'NOT_RUN',
        blockedReason: profile.blockedReason,
      })),
    }
  }

  async get(profileKey: string, version: number) {
    const profile = await this.store.get(profileKey, version)
    if (!profile) return null
    return { apiVersion: TEST_PROFILE_API_VERSION, profile }
  }

  validate(profile: TestProfileRecord): { ok: boolean; errors: string[] } {
    const errors: string[] = []
    if (profile.kind === 'PREVIEW' && profile.releaseGate) {
      errors.push('preview profiles must set releaseGate=false')
    }
    if (profile.definition.includedWorkflowRefs.length === 0) {
      errors.push('profile requires at least one included workflow')
    }
    if (profile.kind === 'SOAK' && !profile.definition.datasetRef) {
      errors.push('soak profiles require datasetRef')
    }
    return { ok: errors.length === 0, errors }
  }

  async save(profile: TestProfileRecord) {
    const validation = this.validate(profile)
    if (!validation.ok) {
      throw new Error(validation.errors.join('; '))
    }
    await this.store.upsert(profile)
    return { apiVersion: TEST_PROFILE_API_VERSION, profile }
  }
}
