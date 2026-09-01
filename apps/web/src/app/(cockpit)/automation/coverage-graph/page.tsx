import { fetchVerdictDomainPack, fetchVerdictDomainPacks } from '@/lib/verdict-runtime/client'
import { selectLatestPublishedPacks } from '@/lib/verdict-runtime/domain-pack-detail'
import { ProductPage } from '@/components/product'

export default async function CoverageGraphPage() {
  let rows: {
    packKey: string
    version: string
    features: number
    screens: number
    targets: number
    evidence: number
    tests: number
  }[]
  try {
    const packs = await fetchVerdictDomainPacks()
    rows = []
    for (const pack of selectLatestPublishedPacks(packs.items)) {
      const detail = await fetchVerdictDomainPack(pack.packKey, pack.version)
      rows.push({
        packKey: pack.packKey,
        version: pack.version,
        features: detail.features?.length ?? 0,
        screens: detail.screens?.length ?? 0,
        targets: detail.targets?.length ?? 0,
        evidence: detail.evidenceSources?.length ?? 0,
        tests: detail.testProfiles?.length ?? 0,
      })
    }
  } catch (error) {
    return (
      <ProductPage path="/automation/coverage-graph">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Runtime error: {error instanceof Error ? error.message : String(error)}
        </div>
      </ProductPage>
    )
  }

  return (
    <ProductPage path="/automation/coverage-graph">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          Product Coverage
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Coverage Graph</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Product → Feature → Screen/Target → Evidence → Test Profile coverage summary.
        </p>
      </header>
      <div className="grid gap-4 lg:grid-cols-4">
        {(['Product', 'Feature', 'Evidence', 'Test Profile'] as const).map((node, index) => (
          <div key={node} className="rounded-xl border bg-card p-5 text-center">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
              {node}
            </div>
            <div className="mt-3 text-2xl font-bold">
              {index === 0
                ? rows.length
                : rows.reduce(
                    (sum, row) =>
                      sum + (index === 1 ? row.features : index === 2 ? row.evidence : row.tests),
                    0,
                  )}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {index < 3 ? 'feeds next layer →' : 'release gate input'}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-card">
        {rows.map((row) => (
          <div
            key={row.packKey}
            className="grid gap-3 border-b px-5 py-4 text-sm md:grid-cols-6"
          >
            <b>
              {row.packKey}@{row.version}
            </b>
            <span>Features {row.features}</span>
            <span>Screens {row.screens}</span>
            <span>Targets {row.targets}</span>
            <span>Evidence {row.evidence}</span>
            <span>Tests {row.tests}</span>
          </div>
        ))}
        {rows.length === 0 ? (
          <div className="p-5 text-sm text-muted-foreground">No published packs to graph.</div>
        ) : null}
      </div>
    </ProductPage>
  )
}
