'use client'

import { Calendar } from 'lucide-react'
import { ProductPage } from '@/components/product'
import { DataCenterAuthRequired, DataCenterHeader, DataCenterPlaceholder } from '@/components/data-center/shared'
import { useNesyAuthGate } from '@/contexts/nesy-auth-context'

export default function PickupOperationsPage() {
  const { isConnected } = useNesyAuthGate()

  return (
    <ProductPage path="/data-center/pickup">
      <div className="flex flex-col gap-4">
        <DataCenterHeader
          icon={Calendar}
          title="Pickup Operations"
          lead="Schedule and manage pickup requests through the connected dashboard session."
          tone="indigo"
        />
        {isConnected ? (
          <DataCenterPlaceholder
            title="Pickup workspace"
            lead="Page content will be migrated from NesyAutomation. Connection is active."
          />
        ) : (
          <DataCenterAuthRequired />
        )}
      </div>
    </ProductPage>
  )
}
