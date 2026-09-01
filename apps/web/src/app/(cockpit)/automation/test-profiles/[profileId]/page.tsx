import Link from 'next/link'
import { AlertCircle, ChevronLeft, FlaskConical } from 'lucide-react'
import {
  fetchVerdictDomainPack,
  fetchVerdictTestCampaigns,
  fetchVerdictTestProfiles,
} from '@/lib/verdict-runtime/client'
import { TestProfileDetailView } from '@/components/automation/test-profile-detail/TestProfileDetailView'
import { ProductPage } from '@/components/product'
import { Button } from '@nesy/metronic/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@nesy/metronic/components/ui/alert'
import {
  catalogCampaignIdByKey,
  findCampaignMembershipsForProfile,
  findTestProfileDefinition,
  resolveLaunchProfileLabel,
} from '@/lib/verdict-runtime/test-profile-detail'

export default async function TestProfileDetailPage(props: {
  params: Promise<{ profileId: string }>
}) {
  const { profileId } = await props.params
  const decoded = decodeURIComponent(profileId)

  let catalog
  try {
    catalog = await fetchVerdictTestProfiles()
  } catch (error) {
    return (
      <ProductPage path="/automation/test-profiles" hideToolbar>
        <Alert variant="destructive">
          <AlertTitle>Profile catalog unavailable</AlertTitle>
          <AlertDescription>
            The Verdict runtime did not return the test profile catalog.
            {error instanceof Error ? ` ${error.message}` : null}
          </AlertDescription>
        </Alert>
      </ProductPage>
    )
  }

  const catalogItem = catalog.items.find((item) => item.profileKey === decoded)
  if (!catalogItem) {
    return (
      <ProductPage path="/automation/test-profiles" hideToolbar>
        <div className="flex flex-col items-center justify-center rounded-[8px] border border-dashed border-border bg-card px-6 py-16 text-center">
          <FlaskConical className="mb-4 size-12 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">Profile not found</h1>
          <p className="mt-2 max-w-md font-mono text-sm text-muted-foreground">{decoded}</p>
          <Button variant="outline" size="sm" className="mt-4 gap-2 rounded-[8px]" asChild>
            <Link href="/automation/test-profiles">
              <ChevronLeft className="size-4" />
              Back to catalog
            </Link>
          </Button>
        </div>
      </ProductPage>
    )
  }

  let packDetail = null
  let packLoadError: string | null = null
  try {
    packDetail = await fetchVerdictDomainPack(catalogItem.packKey, catalogItem.packVersion)
  } catch (error) {
    packLoadError = error instanceof Error ? error.message : 'Pack detail unavailable'
  }

  const definition = packDetail
    ? findTestProfileDefinition(packDetail.testProfiles, decoded)
    : null

  let campaigns = catalogCampaignIdByKey([])
  try {
    const campaignCatalog = await fetchVerdictTestCampaigns()
    campaigns = catalogCampaignIdByKey(campaignCatalog.items)
  } catch {
    // Campaign catalog is optional enrichment for detail links.
  }

  const campaignMemberships = packDetail
    ? findCampaignMembershipsForProfile(packDetail.testCampaigns ?? [], decoded, campaigns)
    : []

  const launchProfileLabel = packDetail && definition
    ? resolveLaunchProfileLabel(packDetail.launchProfiles, definition.launchProfileRef)
    : definition?.launchProfileRef ?? '—'

  return (
    <ProductPage path="/automation/test-profiles" hideToolbar>
      {packLoadError ? (
        <Alert className="mb-5">
          <AlertCircle className="size-4" />
          <AlertTitle>Pack contract partially unavailable</AlertTitle>
          <AlertDescription>
            Runtime catalog metadata is shown, but the published pack contract could not be loaded (
            {packLoadError}).
          </AlertDescription>
        </Alert>
      ) : null}

      <TestProfileDetailView
        catalogItem={catalogItem}
        definition={definition}
        launchProfileLabel={launchProfileLabel}
        campaigns={campaignMemberships}
      />
    </ProductPage>
  )
}
