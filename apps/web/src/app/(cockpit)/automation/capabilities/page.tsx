import { fetchVerdictDomainPack, fetchVerdictDomainPacks } from '@/lib/verdict-runtime/client'
import {
  capabilityContractKey,
  capabilityContractTitle,
  selectLatestPublishedPacks,
} from '@/lib/verdict-runtime/domain-pack-detail'
import { ProductPage } from '@/components/product'

export default async function CapabilityContractsPage() {
  let rows: { packKey: string; version: string; key: string; title: string; provider: string; layer: string }[]
  try {
    const packs = await fetchVerdictDomainPacks()
    rows = []
    for (const pack of selectLatestPublishedPacks(packs.items)) {
      const detail = await fetchVerdictDomainPack(pack.packKey, pack.version)
      for (const cap of detail.capabilities ?? []) {
        rows.push({
          packKey: pack.packKey,
          version: pack.version,
          key: capabilityContractKey(cap),
          title: capabilityContractTitle(cap),
          provider: String(cap.provider ?? 'unknown'),
          layer: String(cap.layer ?? 'domain'),
        })
      }
    }
  } catch (error) {
    return (
      <ProductPage path="/automation/capabilities">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Runtime error: {error instanceof Error ? error.message : String(error)}
        </div>
      </ProductPage>
    )
  }

  return (
    <ProductPage path="/automation/capabilities">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          Product Coverage
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Capability Contracts</h1>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((row) => (
          <div key={`${row.packKey}:${row.key}`} className="rounded-xl border bg-card p-5">
            <div className="text-xs text-muted-foreground">
              {row.packKey}@{row.version} · {row.layer} · {row.provider}
            </div>
            <div className="mt-1 font-semibold">{row.title}</div>
            <code className="mt-2 block text-xs">{row.key}</code>
          </div>
        ))}
        {rows.length === 0 ? (
          <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
            No capabilities found.
          </div>
        ) : null}
      </div>
    </ProductPage>
  )
}
