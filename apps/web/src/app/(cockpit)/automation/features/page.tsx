import Link from 'next/link'
import { fetchVerdictDomainPack, fetchVerdictDomainPacks } from '@/lib/verdict-runtime/client'

export default async function FeatureRegistryPage() {
  let features
  try {
    features = await loadPackRows('features')
  } catch (error) {
    return <main className="p-8"><h1 className="text-2xl font-bold">Feature Registry unavailable</h1><p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Runtime error: {error instanceof Error ? error.message : String(error)}</p></main>
  }
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Product Coverage</p>
        <h1 className="text-2xl font-bold tracking-tight">Feature Registry</h1>
        <p className="mt-2 text-sm text-muted-foreground">Executable feature contracts across published Domain Packs.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {features.map((row) => (
          <Link key={`${row.packKey}:${row.key}`} href={`/automation/features/${encodeURIComponent(row.key)}`} className="rounded-xl border bg-card p-5 hover:bg-muted/40">
            <div className="text-xs text-muted-foreground">{row.packKey}</div>
            <div className="mt-1 font-semibold">{row.title}</div>
            <div className="mt-2 text-xs text-muted-foreground">{row.key}</div>
          </Link>
        ))}
        {features.length === 0 ? <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">No feature contracts found.</div> : null}
      </div>
    </main>
  )
}

async function loadPackRows(field: 'features') {
  const packs = await fetchVerdictDomainPacks()
  const rows: { packKey: string; key: string; title: string }[] = []
  for (const pack of packs.items.filter((item) => item.publicationState === 'PUBLISHED')) {
    const detail = await fetchVerdictDomainPack(pack.packKey, pack.version)
    for (const entry of detail[field] ?? []) {
      const key = String(entry.featureKey ?? entry.key ?? entry.id ?? 'unknown')
      rows.push({ packKey: pack.packKey, key, title: String(entry.displayName ?? entry.title ?? key) })
    }
  }
  return rows
}
