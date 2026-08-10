import { fetchVerdictDomainPack, fetchVerdictDomainPacks } from '@/lib/verdict-runtime/client'

export default async function FeatureDetailPage(props: { params: Promise<{ featureId: string }> }) {
  const { featureId } = await props.params
  const decoded = decodeURIComponent(featureId)
  let packs
  try {
    packs = await fetchVerdictDomainPacks()
  } catch (error) {
    return <main className="p-8"><h1 className="text-2xl font-bold">Feature detail unavailable</h1><p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Runtime error: {error instanceof Error ? error.message : String(error)}</p></main>
  }
  for (const pack of packs.items.filter((item) => item.publicationState === 'PUBLISHED')) {
    let detail
    try {
      detail = await fetchVerdictDomainPack(pack.packKey, pack.version)
    } catch {
      continue
    }
    const feature = (detail.features ?? []).find((entry) => String(entry.featureKey ?? entry.key ?? entry.id) === decoded)
    if (feature) {
      return (
        <main className="mx-auto max-w-4xl space-y-6 p-8">
          <header>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">{pack.packKey}@{pack.version}</p>
            <h1 className="text-2xl font-bold tracking-tight">{String(feature.displayName ?? feature.title ?? decoded)}</h1>
          </header>
          <pre className="overflow-auto rounded-xl border bg-muted p-4 text-xs">{JSON.stringify(feature, null, 2)}</pre>
        </main>
      )
    }
  }
  return <main className="p-8"><h1 className="text-xl font-semibold">Feature not found</h1><p className="text-sm text-muted-foreground">{decoded}</p></main>
}
