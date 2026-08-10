import { fetchVerdictDomainPack, fetchVerdictDomainPacks } from '@/lib/verdict-runtime/client'

export default async function CapabilityContractsPage() {
  let packs
  try {
    packs = await fetchVerdictDomainPacks()
  } catch (error) {
    return <main className="p-8"><h1 className="text-2xl font-bold">Capability Contracts unavailable</h1><p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Runtime error: {error instanceof Error ? error.message : String(error)}</p></main>
  }
  const rows: { packKey: string; key: string; title: string; provider: string; layer: string }[] = []
  for (const pack of packs.items.filter((item) => item.publicationState === 'PUBLISHED')) {
    const detail = await fetchVerdictDomainPack(pack.packKey, pack.version)
    for (const cap of detail.capabilities ?? []) {
      rows.push({
        packKey: pack.packKey,
        key: String(cap.capabilityKey ?? cap.key),
        title: String(cap.displayName ?? cap.capabilityKey ?? cap.key),
        provider: String(cap.provider ?? 'unknown'),
        layer: String(cap.layer ?? 'domain'),
      })
    }
  }
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-8">
      <header><p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Product Coverage</p><h1 className="text-2xl font-bold tracking-tight">Capability Contracts</h1></header>
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((row) => <div key={row.key} className="rounded-xl border bg-card p-5"><div className="text-xs text-muted-foreground">{row.packKey} · {row.layer} · {row.provider}</div><div className="mt-1 font-semibold">{row.title}</div><code className="mt-2 block text-xs">{row.key}</code></div>)}
        {rows.length === 0 ? <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">No capabilities found.</div> : null}
      </div>
    </main>
  )
}
