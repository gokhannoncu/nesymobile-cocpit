'use client'

import { PackagePlus } from 'lucide-react'
import { ProductPage } from '@/components/product'
import { DataCenterAuthRequired, DataCenterHeader, DataCenterPlaceholder } from '@/components/data-center/shared'
import { useNesyAuthGate } from '@/contexts/nesy-auth-context'

export default function HappyPathOperationsPage() {
  const { isConnected } = useNesyAuthGate()

  return (
    <ProductPage path="/data-center/happy-path">
      <div className="container-fluid flex flex-col gap-4">
        <DataCenterHeader
          icon={PackagePlus}
          title="Happy Path Operations"
          lead="Run end-to-end happy path scenarios on the connected Nesy Dashboard environment."
          tone="indigo"
        />
        {isConnected ? (
          <DataCenterPlaceholder
            title="Happy Path workspace"
            lead="Page content will be migrated from NesyAutomation. Connection is active."
          />
        ) : (
          <DataCenterAuthRequired />
        )}
      </div>
    </ProductPage>
  )
}
