import { fetchVerdictTestCampaign } from '@/lib/verdict-runtime/client'
import { CampaignMatrix } from '@/components/automation/test-campaign/CampaignMatrix'
import { ReleaseGatePolicy } from '@/components/automation/test-campaign/ReleaseGatePolicy'
import { CampaignTypeBadge } from '@/components/automation/test-campaign/CampaignTypeBadge'

export default async function TestCampaignDetailPage(props: { params: Promise<{ campaignId: string }> }) {
  const params = await props.params;
  const { campaignId } = params;
  
  let campaign = null
  let loadError: string | null = null
  try {
    campaign = await fetchVerdictTestCampaign(campaignId)
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Campaign could not be loaded'
  }

  if (!campaign) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Campaign: {campaignId}</h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Campaign read model unavailable. {loadError}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Campaign: {campaign.campaignId}</h1>
          <CampaignTypeBadge type={(campaign as any).type || 'NIGHTLY'} />
        </div>
      </div>

      <ReleaseGatePolicy failedCells={campaign.failedCells || []} />

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Execution Matrix</h3>
        <CampaignMatrix cells={campaign.cells || []} />
      </div>
    </div>
  )
}
