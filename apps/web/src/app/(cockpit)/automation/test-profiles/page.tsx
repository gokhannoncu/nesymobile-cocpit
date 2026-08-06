import { fetchVerdictTestProfiles } from '@/lib/verdict-runtime/client'
import { TestProfileTable } from '@/components/automation/test-profile/TestProfileTable'
import { Alert, AlertDescription, AlertTitle } from '@nesy/metronic/components/ui/alert'
import type { TestProfileCatalogItemApi } from '@/lib/verdict-runtime/types'

export default async function TestProfilesPage() {
  let items: TestProfileCatalogItemApi[] | null = null
  try {
    items = (await fetchVerdictTestProfiles()).items
  } catch {
    // Swallowing this into an empty table would render "no profiles" for a
    // runtime that is simply unreachable.
    items = null
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Test Profiles</h1>
        <p className="text-muted-foreground">Manage SMOKE, REGRESSION, and other verification profiles.</p>
      </div>

      {items === null ? (
        <Alert variant="destructive">
          <AlertTitle>Profile catalog unavailable</AlertTitle>
          <AlertDescription>
            The Verdict runtime did not return the profile catalog. An empty list is
            not shown, because that would be indistinguishable from having no profiles.
          </AlertDescription>
        </Alert>
      ) : (
        <TestProfileTable items={items} />
      )}
    </div>
  )
}
