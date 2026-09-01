import { AlertCircle } from 'lucide-react'
import { fetchVerdictTestCampaigns } from '@/lib/verdict-runtime/client'
import { TestCampaignRegistryView } from '@/components/automation/test-campaign-registry/TestCampaignRegistryView'
import { ProductPage } from '@/components/product'

export default async function TestCampaignsPage() {
  try {
    const catalog = await fetchVerdictTestCampaigns()

    return (
      <ProductPage path="/automation/test-campaigns" hideToolbar>
        <TestCampaignRegistryView items={catalog.items} />
      </ProductPage>
    )
  } catch (error) {
    return (
      <ProductPage path="/automation/test-campaigns" hideToolbar>
        <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 px-6 py-12 text-center">
          <AlertCircle className="mb-4 size-10 text-destructive" />
          <h3 className="text-lg font-semibold text-foreground">Failed to load test campaign catalog</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {error instanceof Error ? error.message : String(error)}
          </p>
          <p className="mt-3 max-w-md text-xs text-muted-foreground">
            Nothing is shown when the runtime is unreachable — that would be indistinguishable from
            having no campaigns.
          </p>
        </div>
      </ProductPage>
    )
  }
}
