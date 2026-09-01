import { fetchVerdictRunHistory } from '@/lib/verdict-runtime/client'
import { ProductPage } from '@/components/product'
import { ExecutionQueueView } from '@/components/automation/execution-queue/ExecutionQueueView'

export const dynamic = 'force-dynamic'

export default async function ExecutionQueuePage() {
  let items
  try {
    const runs = await fetchVerdictRunHistory({ limit: 100, engineType: 'BRIDGEFLOW' })
    items = runs.items
  } catch (error) {
    return (
      <ProductPage path="/automation/execution-queue" hideToolbar>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/60 dark:bg-amber-950/30">
          <h1 className="text-lg font-semibold text-foreground">Execution Queue unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Runtime error: {error instanceof Error ? error.message : String(error)}
          </p>
        </div>
      </ProductPage>
    )
  }

  return (
    <ProductPage path="/automation/execution-queue" hideToolbar>
      <ExecutionQueueView initialItems={items} />
    </ProductPage>
  )
}
