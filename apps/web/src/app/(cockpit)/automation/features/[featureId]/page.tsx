import { fetchVerdictDomainPack, fetchVerdictDomainPacks } from '@/lib/verdict-runtime/client'
import {
  featureContractKey,
  featureContractTitle,
  selectLatestPublishedPacks,
} from '@/lib/verdict-runtime/domain-pack-detail'
import { ProductPage } from '@/components/product'

export default async function FeatureDetailPage(props: { params: Promise<{ featureId: string }> }) {
  const { featureId } = await props.params
  const decoded = decodeURIComponent(featureId)

  let packs
  try {
    packs = await fetchVerdictDomainPacks()
  } catch (error) {
    return (
      <ProductPage path="/automation/features">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Runtime error: {error instanceof Error ? error.message : String(error)}
        </div>
      </ProductPage>
    )
  }

  for (const pack of selectLatestPublishedPacks(packs.items)) {
    let detail
    try {
      detail = await fetchVerdictDomainPack(pack.packKey, pack.version)
    } catch {
      continue
    }

    const feature = (detail.features ?? []).find(
      (entry) => featureContractKey(entry) === decoded,
    )
    if (!feature) continue

    return (
      <ProductPage path="/automation/features">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
            {pack.packKey}@{pack.version}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{featureContractTitle(feature)}</h1>
          <p className="mt-2 font-mono text-xs text-muted-foreground">{decoded}</p>
        </header>
        <pre className="overflow-auto rounded-xl border bg-muted p-4 text-xs">
          {JSON.stringify(feature, null, 2)}
        </pre>
      </ProductPage>
    )
  }

  return (
    <ProductPage path="/automation/features">
      <h1 className="text-xl font-semibold">Feature not found</h1>
      <p className="text-sm text-muted-foreground">{decoded}</p>
    </ProductPage>
  )
}
