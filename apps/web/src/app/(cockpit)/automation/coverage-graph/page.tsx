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
      screens: detail.screens.length,
      targets: detail.targets.length,
      evidence: detail.evidenceSources.length,
      tests: detail.testProfiles.length,
    })
  }
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-8">
      <header><p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Product Coverage</p><h1 className="text-2xl font-bold tracking-tight">Coverage Graph</h1><p className="mt-2 text-sm text-muted-foreground">Product → Feature → Screen/Target → Evidence → Test Profile coverage summary.</p></header>
      <div className="rounded-xl border bg-card">
        {rows.map((row) => <div key={row.packKey} className="grid gap-3 border-b px-5 py-4 text-sm md:grid-cols-6"><b>{row.packKey}</b><span>Features {row.features}</span><span>Screens {row.screens}</span><span>Targets {row.targets}</span><span>Evidence {row.evidence}</span><span>Tests {row.tests}</span></div>)}
        {rows.length === 0 ? <div className="p-5 text-sm text-muted-foreground">No published packs to graph.</div> : null}
      </div>
    </main>
  )
}
