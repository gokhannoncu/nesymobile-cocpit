'use client'

import { useCallback, useState } from 'react'
import { PlusIcon, RefreshCw } from 'lucide-react'
import { Button } from '@nesy/metronic/components/ui/button'
import { ProductPage } from '@/components/product'
import { DataCenterAuthRequired } from '@/components/data-center/shared'
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
      <div className="flex flex-col gap-4">
        {isConnected && (
          <div className="flex justify-end gap-2">
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
              Create Shipment
            </Button>
          </div>
        )}

        {isConnected ? (          <>
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
