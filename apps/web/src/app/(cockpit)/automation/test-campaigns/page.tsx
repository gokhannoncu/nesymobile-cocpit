import { fetchVerdictTestCampaigns } from '@/lib/verdict-runtime/client'
import { CampaignTable } from '@/components/automation/test-campaign/CampaignTable'
import { Alert, AlertDescription, AlertTitle } from '@nesy/metronic/components/ui/alert'
import type { TestCampaignCatalogItemApi } from '@/lib/verdict-runtime/types'

export default async function TestCampaignsPage() {
  let items: TestCampaignCatalogItemApi[]
  try {
    items = (await fetchVerdictTestCampaigns()).items
  } catch {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Test Campaigns</h1>
        </div>
        <Alert variant="destructive">
          <AlertTitle>Campaign catalog unavailable</AlertTitle>
          <AlertDescription>
            The Verdict runtime did not return the campaign catalog. Nothing is
            shown rather than a guessed campaign state.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Test Campaigns</h1>
        <p className="text-muted-foreground">View execution matrices across devices and datasets.</p>
      </div>

      <CampaignTable items={items} />
    </div>
  )
}
