'use client'

import { useCallback, useState } from 'react'
import { PlusIcon, RefreshCw } from 'lucide-react'
import { Button } from '@nesy/metronic/components/ui/button'
import { ProductPage } from '@/components/product'
import { DataCenterAuthRequired } from '@/components/data-center/shared'
import { CreateSetDialog } from '@/components/data-center/happy-path/create-set-dialog'
import { HappyPathListTable } from '@/components/data-center/happy-path/happy-path-list-table'
import { useNesyAuthGate } from '@/contexts/nesy-auth-context'

export default function HappyPathOperationsPage() {
  const { isConnected } = useNesyAuthGate()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleCreated = useCallback(() => {
    setRefreshKey((prev) => prev + 1)
  }, [])

  return (
    <ProductPage path="/data-center/happy-path">
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
              Create Set
            </Button>
          </div>
        )}

        {isConnected ? (
          <>
            <HappyPathListTable
              refreshKey={refreshKey}
              onCreateSet={() => setIsCreateOpen(true)}
            />
            <CreateSetDialog
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
