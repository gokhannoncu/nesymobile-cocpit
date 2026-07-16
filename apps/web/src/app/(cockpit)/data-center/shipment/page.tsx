'use client'

import { useCallback, useState } from 'react'
import { PlusIcon, RefreshCw, Truck } from 'lucide-react'
import { Button } from '@nesy/metronic/components/ui/button'
import { ProductPage } from '@/components/product'
import { DataCenterAuthRequired, DataCenterHeader } from '@/components/data-center/shared'
import { CreateShipmentDialog } from '@/components/data-center/shipment/create-shipment-dialog'
import { ShipmentListTable } from '@/components/data-center/shipment/shipment-list-table'
import { useNesyAuthGate } from '@/contexts/nesy-auth-context'

export default function ShipmentOperationsPage() {
  const { isConnected } = useNesyAuthGate()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleCreated = useCallback(() => {
    setRefreshKey((prev) => prev + 1)
  }, [])

  const handleCloseAfterCreate = useCallback(() => {
    setIsCreateOpen(false)
  }, [])

  return (
    <ProductPage path="/data-center/shipment">
      <div className="container-fluid flex flex-col gap-4">
        <DataCenterHeader
          icon={Truck}
          title="Shipment Operations"
          lead="Create and manage shipments against the connected Nesy Dashboard environment."
          tone="indigo"
          actions={
            isConnected ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-10 min-h-10 shrink-0 py-0"
                  onClick={() => setRefreshKey((prev) => prev + 1)}
                >
                  <RefreshCw className="size-4" />
                  Refresh
                </Button>
                <Button
                  type="button"
                  variant="mono"
                  size="lg"
                  className="h-10 min-h-10 shrink-0 py-0"
                  onClick={() => setIsCreateOpen(true)}
                >
                  <PlusIcon className="size-4" />
                  Create Shipment
                </Button>
              </>
            ) : undefined
          }
        />

        {isConnected ? (
          <>
            <ShipmentListTable refreshKey={refreshKey} />
            <CreateShipmentDialog
              open={isCreateOpen}
              onOpenChange={setIsCreateOpen}
              onCreated={handleCreated}
              onCloseAfterCreate={handleCloseAfterCreate}
            />
          </>
        ) : (
          <DataCenterAuthRequired />
        )}
      </div>
    </ProductPage>
  )
}
