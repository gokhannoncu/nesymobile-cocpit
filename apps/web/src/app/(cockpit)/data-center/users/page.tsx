'use client'

import { useState } from 'react'
import { Users, Wallet } from 'lucide-react'
import { Button } from '@nesy/metronic/components/ui/button'
import { ProductPage } from '@/components/product'
import { DataCenterAuthRequired, DataCenterHeader } from '@/components/data-center/shared'
import { CourierWalletsDialog } from '@/components/data-center/users/courier-wallets-dialog'
import { UserOperationsWorkspace } from '@/components/data-center/users/user-operations-workspace'
import { useNesyAuthGate } from '@/contexts/nesy-auth-context'

export default function UserOperationsPage() {
  const { isConnected } = useNesyAuthGate()
  const [walletsOpen, setWalletsOpen] = useState(false)

  return (
    <ProductPage path="/data-center/users">
      <div className="flex flex-col gap-4">
        <DataCenterHeader
          icon={Users}
          title="User Operations"
          lead="Search and manage Nesy Dashboard users, devices, PINs, and courier wallets (User/GetAllUsers via Cockpit API)."
          tone="nesy"
          actions={
            isConnected ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-10 shrink-0 whitespace-nowrap py-0"
                onClick={() => setWalletsOpen(true)}
              >
                <Wallet className="size-4" />
                Courier wallets
              </Button>
            ) : undefined
          }
        />

        {isConnected ? (
          <>
            <UserOperationsWorkspace />
            <CourierWalletsDialog open={walletsOpen} onOpenChange={setWalletsOpen} />
          </>
        ) : (
          <DataCenterAuthRequired />
        )}
      </div>
    </ProductPage>
  )
}
