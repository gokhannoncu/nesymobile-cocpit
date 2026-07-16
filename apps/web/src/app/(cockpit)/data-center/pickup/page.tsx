'use client'

import { useCallback, useState } from 'react'
import { Calendar, PlusIcon, RefreshCw } from 'lucide-react'
import { Button } from '@nesy/metronic/components/ui/button'
import { ProductPage } from '@/components/product'
import { DataCenterAuthRequired, DataCenterHeader } from '@/components/data-center/shared'
import { CreatePickupDialog } from '@/components/data-center/pickup/create-pickup-dialog'
import { PickupListTable } from '@/components/data-center/pickup/pickup-list-table'
import { useNesyAuthGate } from '@/contexts/nesy-auth-context'

export default function PickupOperationsPage() {
  const { isConnected } = useNesyAuthGate()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleCreated = useCallback(() => {
    setRefreshKey((prev) => prev + 1)
  }, [])

  return (
    <ProductPage path="/data-center/pickup">
      <div className="flex flex-col gap-4">
        <DataCenterHeader
          icon={Calendar}
          title="Pickup Operations"
          lead="Create and manage pickup requests against the connected Nesy Dashboard environment."
          tone="indigo"
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
                  Create Pickup
                </Button>
              </>
            ) : undefined
          }
        />

        {isConnected ? (
          <>
            <PickupListTable refreshKey={refreshKey} />
            <CreatePickupDialog
              open={isCreateOpen}
              onOpenChange={setIsCreateOpen}
              onCreated={handleCreated}
            />
          </>
        ) : (
          <DataCenterAuthRequired />
        )}
      </div>
    </ProductPage>
  )
}
