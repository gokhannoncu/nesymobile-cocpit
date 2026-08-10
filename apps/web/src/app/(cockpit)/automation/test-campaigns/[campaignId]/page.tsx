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
  const passCount = campaign.cells.filter((cell) => String(cell.result ?? cell.status) === 'PASS').length
  const failCount = campaign.cells.filter((cell) => String(cell.result ?? cell.status) === 'FAIL').length
  const blockedCount = campaign.cells.filter((cell) => String(cell.result ?? cell.status) === 'BLOCKED').length
  const pendingCount = campaign.cells.length - passCount - failCount - blockedCount

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Campaign: {campaign.campaignId}</h1>
          <CampaignTypeBadge type={String((campaign as { type?: string }).type ?? 'NIGHTLY')} />
        </div>
      </div>

      <ReleaseGatePolicy failedCells={campaign.failedCells || []} />

      <div className="grid gap-4 md:grid-cols-4">
        <Summary label="PASS" value={passCount} />
        <Summary label="FAIL" value={failCount} />
        <Summary label="BLOCKED" value={blockedCount} />
        <Summary label="PENDING" value={pendingCount} />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Execution Matrix</h3>
        <CampaignMatrix cells={campaign.cells || []} />
      </div>
    </div>
  )
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-bold">{value}</div></div>
}
