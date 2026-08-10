import { fetchVerdictDomainPack, fetchVerdictDomainPacks } from '@/lib/verdict-runtime/client'

export default async function CoverageGraphPage() {
  let packs
  try {
    packs = await fetchVerdictDomainPacks()
  } catch (error) {
    return <main className="p-8"><h1 className="text-2xl font-bold">Coverage Graph unavailable</h1><p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Runtime error: {error instanceof Error ? error.message : String(error)}</p></main>
  }
  const rows: { packKey: string; features: number; screens: number; targets: number; evidence: number; tests: number }[] = []
  for (const pack of packs.items.filter((item) => item.publicationState === 'PUBLISHED')) {
    const detail = await fetchVerdictDomainPack(pack.packKey, pack.version)
    rows.push({
      packKey: pack.packKey,
      features: detail.features?.length ?? 0,
      screens: detail.screens?.length ?? 0,
      targets: detail.targets?.length ?? 0,
      evidence: detail.evidenceSources?.length ?? 0,
      tests: detail.testProfiles?.length ?? 0,
    })
  }
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-8">
      <header><p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Product Coverage</p><h1 className="text-2xl font-bold tracking-tight">Coverage Graph</h1><p className="mt-2 text-sm text-muted-foreground">Product → Feature → Screen/Target → Evidence → Test Profile coverage summary.</p></header>
      <div className="grid gap-4 lg:grid-cols-4">
        {['Product', 'Feature', 'Evidence', 'Test Profile'].map((node, index) => (
          <div key={node} className="rounded-xl border bg-card p-5 text-center">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">{node}</div>
            <div className="mt-3 text-2xl font-bold">{index === 0 ? rows.length : rows.reduce((sum, row) => sum + (index === 1 ? row.features : index === 2 ? row.evidence : row.tests), 0)}</div>
            <div className="mt-2 text-xs text-muted-foreground">{index < 3 ? 'feeds next layer →' : 'release gate input'}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-card">
        {rows.map((row) => <div key={row.packKey} className="grid gap-3 border-b px-5 py-4 text-sm md:grid-cols-6"><b>{row.packKey}</b><span>Features {row.features}</span><span>Screens {row.screens}</span><span>Targets {row.targets}</span><span>Evidence {row.evidence}</span><span>Tests {row.tests}</span></div>)}
        {rows.length === 0 ? <div className="p-5 text-sm text-muted-foreground">No published packs to graph.</div> : null}
      </div>
    </main>
  )
}
