import { CampaignTable } from '@/components/automation/test-campaign/CampaignTable'

export default async function TestCampaignsPage() {
  const campaigns = [
    { campaignId: 'cmp-nightly-123', type: 'NIGHTLY', partial: false, failedCells: ['cell-1'] },
    { campaignId: 'cmp-pr-456', type: 'PR', partial: true, failedCells: [] }
  ]

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Test Campaigns</h1>
        <p className="text-muted-foreground">View execution matrices across devices and datasets.</p>
      </div>

      <CampaignTable items={campaigns} />
    </div>
  )
}
