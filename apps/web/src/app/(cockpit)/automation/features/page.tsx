import { AlertCircle } from 'lucide-react'
import { fetchVerdictDomainPack, fetchVerdictDomainPacks } from '@/lib/verdict-runtime/client'
import {
  featureContractDescription,
  featureContractKey,
  featureContractOwner,
  featureContractTags,
  featureContractTitle,
  featureExecutableSummary,
  selectLatestPublishedPacks,
} from '@/lib/verdict-runtime/domain-pack-detail'
import { FeatureRegistryView } from '@/components/automation/feature-registry/FeatureRegistryView'
import type { FeatureRegistryRow } from '@/components/automation/feature-registry/FeatureRegistryView'
import { ProductPage } from '@/components/product'

export default async function FeatureRegistryPage() {
  let features: FeatureRegistryRow[]
  try {
    features = await loadFeatureRows()
  } catch (error) {
    return (
      <ProductPage path="/automation/features" hideToolbar>
        <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 px-6 py-12 text-center">
          <AlertCircle className="mb-4 size-10 text-destructive" />
          <h3 className="text-lg font-semibold text-foreground">Failed to load feature registry</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {error instanceof Error ? error.message : String(error)}
          </p>
        </div>
      </ProductPage>
    )
  }

  return (
    <ProductPage path="/automation/features" hideToolbar>
      <FeatureRegistryView features={features} />
    </ProductPage>
  )
}

async function loadFeatureRows(): Promise<FeatureRegistryRow[]> {
  const packs = await fetchVerdictDomainPacks()
  const rows: FeatureRegistryRow[] = []

  for (const pack of selectLatestPublishedPacks(packs.items)) {
    const detail = await fetchVerdictDomainPack(pack.packKey, pack.version)
    for (const entry of detail.features ?? []) {
      const summary = featureExecutableSummary(entry)
      rows.push({
        packKey: pack.packKey,
        version: pack.version,
        key: featureContractKey(entry),
        title: featureContractTitle(entry),
        description: featureContractDescription(entry),
        tags: featureContractTags(entry),
        owner: featureContractOwner(entry),
        invariantCount: summary.invariantCount,
        gatingInvariantCount: summary.gatingInvariantCount,
        screenCount: summary.screenCount,
        workflowCount: summary.workflowCount,
      })
    }
  }

  return rows.sort((left, right) => left.title.localeCompare(right.title))
}
