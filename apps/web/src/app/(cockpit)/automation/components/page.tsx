import { fetchVerdictDomainPack, fetchVerdictDomainPacks } from '@/lib/verdict-runtime/client'

export default async function ComponentRegistryPage() {
  let packs
  try {
    packs = await fetchVerdictDomainPacks()
  } catch (error) {
    return <main className="p-8"><h1 className="text-2xl font-bold">Component Registry unavailable</h1><p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Runtime error: {error instanceof Error ? error.message : String(error)}</p></main>
  }
  const rows: { packKey: string; key: string; title: string; kind: string }[] = []
  for (const pack of packs.items.filter((item) => item.publicationState === 'PUBLISHED')) {
    const detail = await fetchVerdictDomainPack(pack.packKey, pack.version)
    for (const screen of detail.screens ?? []) rows.push({ packKey: pack.packKey, key: String(screen.screenKey), title: String(screen.displayName ?? screen.screenKey), kind: 'SCREEN' })
    for (const surface of detail.surfaces ?? []) rows.push({ packKey: pack.packKey, key: String(surface.surfaceKey), title: String(surface.displayName ?? surface.surfaceKey), kind: 'SURFACE' })
    for (const target of detail.targets ?? []) rows.push({ packKey: pack.packKey, key: String(target.targetKey), title: String(target.displayName ?? target.targetKey), kind: 'TARGET' })
  }
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-8">
      <header><p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Product Coverage</p><h1 className="text-2xl font-bold tracking-tight">Component Registry</h1></header>
      <div className="rounded-xl border bg-card">
        {rows.map((row) => <div key={`${row.kind}:${row.key}`} className="grid gap-2 border-b px-5 py-3 text-sm md:grid-cols-4"><b>{row.kind}</b><span>{row.title}</span><code className="text-xs">{row.key}</code><span className="text-muted-foreground">{row.packKey}</span></div>)}
        {rows.length === 0 ? <div className="p-5 text-sm text-muted-foreground">No components found.</div> : null}
      </div>
    </main>
  )
}
