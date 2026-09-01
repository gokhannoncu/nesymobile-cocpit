import { AlertCircle } from 'lucide-react'
import { fetchVerdictTestProfiles } from '@/lib/verdict-runtime/client'
import { TestProfileRegistryView } from '@/components/automation/test-profile-registry/TestProfileRegistryView'
import { ProductPage } from '@/components/product'

export default async function TestProfilesPage() {
  try {
    const catalog = await fetchVerdictTestProfiles()

    return (
      <ProductPage path="/automation/test-profiles" hideToolbar>
        <TestProfileRegistryView items={catalog.items} partial={catalog.partial} />
      </ProductPage>
    )
  } catch (error) {
    return (
      <ProductPage path="/automation/test-profiles" hideToolbar>
        <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 px-6 py-12 text-center">
          <AlertCircle className="mb-4 size-10 text-destructive" />
          <h3 className="text-lg font-semibold text-foreground">Failed to load test profile catalog</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {error instanceof Error ? error.message : String(error)}
          </p>
          <p className="mt-3 max-w-md text-xs text-muted-foreground">
            An empty table is not shown when the runtime is unreachable — that would be
            indistinguishable from having no profiles.
          </p>
        </div>
      </ProductPage>
    )
  }
}
