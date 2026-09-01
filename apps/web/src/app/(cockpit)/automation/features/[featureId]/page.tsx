import Link from 'next/link'
import { AlertCircle, ChevronLeft, Sparkles } from 'lucide-react'
import { fetchVerdictDomainPack, fetchVerdictDomainPacks } from '@/lib/verdict-runtime/client'
import {
  featureContractKey,
  selectLatestPublishedPacks,
} from '@/lib/verdict-runtime/domain-pack-detail'
import { FeatureDetailView } from '@/components/automation/feature-detail/FeatureDetailView'
import { ProductPage } from '@/components/product'
import { Button } from '@nesy/metronic/components/ui/button'

export default async function FeatureDetailPage(props: { params: Promise<{ featureId: string }> }) {
  const { featureId } = await props.params
  const decoded = decodeURIComponent(featureId)

  let packs
  try {
    packs = await fetchVerdictDomainPacks()
  } catch (error) {
    return (
      <ProductPage path="/automation/features" hideToolbar>
        <div className="flex flex-col items-center justify-center rounded-[8px] border border-destructive/20 bg-destructive/5 px-6 py-12 text-center">
          <AlertCircle className="mb-4 size-10 text-destructive" />
          <h3 className="text-lg font-semibold text-foreground">Failed to load feature</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {error instanceof Error ? error.message : String(error)}
          </p>
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
      <ProductPage path="/automation/features" hideToolbar>
        <FeatureDetailView
          packKey={pack.packKey}
          packVersion={pack.version}
          feature={feature}
        />
      </ProductPage>
    )
  }

  return (
    <ProductPage path="/automation/features" hideToolbar>
      <div className="flex flex-col items-center justify-center rounded-[8px] border border-dashed border-border bg-card px-6 py-16 text-center">
        <Sparkles className="mb-4 size-12 text-muted-foreground" />
        <h1 className="text-lg font-semibold text-foreground">Feature not found</h1>
        <p className="mt-2 max-w-md font-mono text-sm text-muted-foreground">{decoded}</p>
        <Button variant="outline" size="sm" className="mt-4 gap-2 rounded-[8px]" asChild>
          <Link href="/automation/features">
            <ChevronLeft className="size-4" />
            Back to registry
          </Link>
        </Button>
      </div>
    </ProductPage>
  )
}
