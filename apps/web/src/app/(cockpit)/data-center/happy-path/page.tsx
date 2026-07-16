'use client'

import { useCallback, useState } from 'react'
import { PackagePlus, PlusIcon, RefreshCw } from 'lucide-react'
import { Button } from '@nesy/metronic/components/ui/button'
import { ProductPage } from '@/components/product'
import { DataCenterAuthRequired, DataCenterHeader } from '@/components/data-center/shared'
import { CreateSetDialog, type CreateSetReconfigureSeed } from '@/components/data-center/happy-path/create-set-dialog'
import { HappyPathListTable } from '@/components/data-center/happy-path/happy-path-list-table'
import { HappyPathPageShimmer } from '@/components/data-center/happy-path/happy-path-page-shimmer'
import { useNesyAuthGate } from '@/contexts/nesy-auth-context'

export default function HappyPathOperationsPage() {
  const { isConnected, authUiReady } = useNesyAuthGate()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [reconfigureSeed, setReconfigureSeed] = useState<CreateSetReconfigureSeed | null>(
    null,
  )

  const handleCreated = useCallback(() => {
    setRefreshKey((prev) => prev + 1)
  }, [])

  return (
    <ProductPage path="/data-center/happy-path">
      <div className="flex flex-col gap-4">
        {!authUiReady ? (
          <HappyPathPageShimmer />
        ) : (
          <>
            <DataCenterHeader
              icon={PackagePlus}
              title="Happy Path Operations"
              lead="Run end-to-end happy path scenarios on the connected Nesy Dashboard environment."
              tone="nesy"
              actions={
                isConnected ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="h-10 shrink-0 whitespace-nowrap py-0"
                      onClick={() => setRefreshKey((prev) => prev + 1)}
                    >
                      <RefreshCw className="size-4" />
                      Refresh
                    </Button>
                    <Button
                      type="button"
                      variant="nesy"
                      size="lg"
                      className="h-10 shrink-0 whitespace-nowrap py-0"
                      onClick={() => setIsCreateOpen(true)}
                    >
                      <PlusIcon className="size-4" />
                      Create Set
                    </Button>
                  </>
                ) : undefined
              }
            />

            {isConnected ? (
              <>
                <HappyPathListTable
                  refreshKey={refreshKey}
                  onCreateSet={() => setIsCreateOpen(true)}
                  onReconfigure={(seed) => {
                    setReconfigureSeed(seed)
                    setIsCreateOpen(true)
                  }}
                />
                <CreateSetDialog
                  open={isCreateOpen}
                  onOpenChange={(open) => {
                    setIsCreateOpen(open)
                    if (!open) setReconfigureSeed(null)
                  }}
                  onCreated={handleCreated}
                  reconfigureSeed={reconfigureSeed}
                />
              </>
            ) : (
              <DataCenterAuthRequired />
            )}
          </>
        )}
      </div>
    </ProductPage>
  )
}
