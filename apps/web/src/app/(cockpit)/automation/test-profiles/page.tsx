import { fetchVerdictTestProfiles } from '@/lib/verdict-runtime/client'
import { TestProfileTable } from '@/components/automation/test-profile/TestProfileTable'

export default async function TestProfilesPage() {
  let catalog = null
  try {
    catalog = await fetchVerdictTestProfiles()
  } catch (err) {
    catalog = { items: [] }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Test Profiles</h1>
        <p className="text-muted-foreground">Manage SMOKE, REGRESSION, and other verification profiles.</p>
      </div>

      <TestProfileTable items={catalog.items} />
    </div>
  )
}
