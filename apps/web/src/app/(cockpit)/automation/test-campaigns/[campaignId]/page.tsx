import Link from 'next/link'
import { AlertCircle, CalendarRange, ChevronLeft } from 'lucide-react'
import {
  fetchVerdictDomainPack,
  fetchVerdictTestCampaign,
  fetchVerdictTestCampaigns,
  fetchVerdictTestProfiles,
} from '@/lib/verdict-runtime/client'
import { TestCampaignDetailView } from '@/components/automation/test-campaign-detail/TestCampaignDetailView'
import { ProductPage } from '@/components/product'
import { Button } from '@nesy/metronic/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@nesy/metronic/components/ui/alert'
import {
  buildProfileSequence,
  countCampaignCellResults,
  findTestCampaignDefinition,
  parseCampaignCells,
  profileCatalogByKey,
  resolvePackFromProfiles,
} from '@/lib/verdict-runtime/test-campaign-detail'

export default async function TestCampaignDetailPage(props: {
  params: Promise<{ campaignId: string }>
}) {
  const { campaignId } = await props.params
  const decoded = decodeURIComponent(campaignId)

  let campaign
  let loadError: string | null = null
  try {
    campaign = await fetchVerdictTestCampaign(decoded)
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Campaign could not be loaded'
  }

  if (!campaign) {
    return (
      <ProductPage path="/automation/test-campaigns" hideToolbar>
        <div className="flex flex-col items-center justify-center rounded-[8px] border border-dashed border-border bg-card px-6 py-16 text-center">
          <CalendarRange className="mb-4 size-12 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">Campaign unavailable</h1>
          <p className="mt-2 max-w-md font-mono text-sm text-muted-foreground">{decoded}</p>
          {loadError ? (
            <p className="mt-2 max-w-md text-xs text-muted-foreground">{loadError}</p>
          ) : null}
          <Button variant="outline" size="sm" className="mt-4 gap-2 rounded-[8px]" asChild>
            <Link href="/automation/test-campaigns">
              <ChevronLeft className="size-4" />
              Back to catalog
            </Link>
          </Button>
        </div>
      </ProductPage>
    )
  }

  let catalogItem = null
  try {
    const catalog = await fetchVerdictTestCampaigns()
    catalogItem = catalog.items.find((item) => item.campaignId === decoded) ?? null
  } catch {
    // Catalog enrichment is optional.
  }

  const cells = parseCampaignCells(campaign.cells)
  const stats = countCampaignCellResults(cells)
  const profileKeys = [...new Set(cells.map((cell) => cell.profileKey))]

  let packDetail = null
  let packLoadError: string | null = null
  let profileCatalog = profileCatalogByKey([])
  let packKey: string | null = null
  let packVersion: string | null = null

  try {
    const profiles = await fetchVerdictTestProfiles()
    profileCatalog = profileCatalogByKey(profiles.items)
    const packRef = resolvePackFromProfiles(profileKeys, profiles.items)
    if (packRef) {
      packKey = packRef.packKey
      packVersion = packRef.packVersion
      packDetail = await fetchVerdictDomainPack(packRef.packKey, packRef.packVersion)
    }
  } catch (error) {
    packLoadError = error instanceof Error ? error.message : 'Pack detail unavailable'
  }

  const campaignKey = campaign.campaignKey ?? catalogItem?.campaignKey ?? 'UNKNOWN'
  const definition = packDetail
    ? findTestCampaignDefinition(packDetail.testCampaigns ?? [], campaignKey)
    : null

  const profileSequence = buildProfileSequence(definition, cells, profileCatalog)

  return (
    <ProductPage path="/automation/test-campaigns" hideToolbar>
      {packLoadError ? (
        <Alert className="mb-5">
          <AlertCircle className="size-4" />
          <AlertTitle>Pack contract partially unavailable</AlertTitle>
          <AlertDescription>
            Runtime campaign results are shown, but the published pack contract could not be loaded (
            {packLoadError}).
          </AlertDescription>
        </Alert>
      ) : null}

      <TestCampaignDetailView
        campaign={{
          campaignId: campaign.campaignId,
          campaignKey,
          campaignVersion: campaign.campaignVersion ?? catalogItem?.campaignVersion ?? 1,
          status: campaign.status ?? catalogItem?.status ?? 'UNKNOWN',
          releaseGateResult:
            campaign.releaseGateResult ?? catalogItem?.releaseGateResult ?? 'NOT_EVALUATED',
          failedCells: campaign.failedCells ?? [],
          partial: campaign.partial,
        }}
        catalogItem={catalogItem}
        definition={definition}
        packKey={packKey}
        packVersion={packVersion}
        cells={cells}
        stats={stats}
        profileSequence={profileSequence}
      />
    </ProductPage>
  )
}
