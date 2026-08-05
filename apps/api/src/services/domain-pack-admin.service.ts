export const DOMAIN_PACK_ADMIN_API_VERSION = 'verdict-runtime.v1' as const

export type DomainPackPublicationState = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export interface DomainPackVersionRecord {
  packKey: string
  version: string
  bundleDigest: string
  publicationState: DomainPackPublicationState
  bundle: unknown
  revision: number
  publishedAt?: string
  publishedBy?: string
}

export interface DomainPackAdminStore {
  list(): DomainPackVersionRecord[]
  get(packKey: string, version: string): DomainPackVersionRecord | undefined
  upsert(record: DomainPackVersionRecord): void
}

export class InMemoryDomainPackAdminStore implements DomainPackAdminStore {
  private readonly records = new Map<string, DomainPackVersionRecord>()

  private key(packKey: string, version: string): string {
    return `${packKey}@${version}`
  }

  list(): DomainPackVersionRecord[] {
    return [...this.records.values()]
  }

  get(packKey: string, version: string): DomainPackVersionRecord | undefined {
    return this.records.get(this.key(packKey, version))
  }

  upsert(record: DomainPackVersionRecord): void {
    this.records.set(this.key(record.packKey, record.version), { ...record })
  }
}

export class DomainPackAdminService {
  constructor(private readonly store: DomainPackAdminStore = new InMemoryDomainPackAdminStore()) {}

  list() {
    return {
      apiVersion: DOMAIN_PACK_ADMIN_API_VERSION,
      items: this.store.list().map((item) => ({
        packKey: item.packKey,
        version: item.version,
        bundleDigest: item.bundleDigest,
        publicationState: item.publicationState,
        revision: item.revision,
        publishedAt: item.publishedAt,
      })),
    }
  }

  get(packKey: string, version: string) {
    const record = this.store.get(packKey, version)
    if (!record) return null
    return { apiVersion: DOMAIN_PACK_ADMIN_API_VERSION, pack: record }
  }

  saveDraft(input: {
    packKey: string
    version: string
    bundleDigest: string
    bundle: unknown
    expectedRevision?: number
  }) {
    const existing = this.store.get(input.packKey, input.version)
    if (existing?.publicationState === 'PUBLISHED') {
      throw new Error('published domain pack versions are immutable')
    }
    if (
      existing !== undefined &&
      input.expectedRevision !== undefined &&
      existing.revision !== input.expectedRevision
    ) {
      throw new Error('optimistic concurrency conflict')
    }
    const next: DomainPackVersionRecord = {
      packKey: input.packKey,
      version: input.version,
      bundleDigest: input.bundleDigest,
      publicationState: 'DRAFT',
      bundle: input.bundle,
      revision: (existing?.revision ?? 0) + 1,
    }
    this.store.upsert(next)
    return { apiVersion: DOMAIN_PACK_ADMIN_API_VERSION, pack: next }
  }

  publish(input: { packKey: string; version: string; publishedBy: string; expectedRevision: number }) {
    const existing = this.store.get(input.packKey, input.version)
    if (!existing) throw new Error('domain pack version not found')
    if (existing.publicationState === 'PUBLISHED') {
      throw new Error('published domain pack versions are immutable')
    }
    if (existing.revision !== input.expectedRevision) {
      throw new Error('optimistic concurrency conflict')
    }
    const next: DomainPackVersionRecord = {
      ...existing,
      publicationState: 'PUBLISHED',
      publishedAt: new Date().toISOString(),
      publishedBy: input.publishedBy,
      revision: existing.revision + 1,
    }
    this.store.upsert(next)
    return { apiVersion: DOMAIN_PACK_ADMIN_API_VERSION, pack: next }
  }
}
