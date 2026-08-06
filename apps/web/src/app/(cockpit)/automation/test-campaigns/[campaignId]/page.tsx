import { fetchVerdictTestCampaign } from '@/lib/verdict-runtime/client'
import { CampaignMatrix } from '@/components/automation/test-campaign/CampaignMatrix'
import { ReleaseGatePolicy } from '@/components/automation/test-campaign/ReleaseGatePolicy'
import { CampaignTypeBadge } from '@/components/automation/test-campaign/CampaignTypeBadge'

export default async function TestCampaignDetailPage(props: { params: Promise<{ campaignId: string }> }) {
  const params = await props.params;
  const { campaignId } = params;
  
  let campaign = null
  try {
    campaign = await fetchVerdictTestCampaign(campaignId)
  } catch (err) {
    campaign = {
      campaignId,
      type: 'NIGHTLY',
      failedCells: ['cell-1'],
      cells: []
    } as any
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
