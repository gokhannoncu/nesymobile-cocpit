'use client'

import { SurfaceRegistryManager } from '@/components/automation/domain-pack/SurfaceRegistryManager'
import { DomainPackSurfacesPageShimmer } from '@/components/automation/domain-pack/domain-pack-catalog-shimmer'
import { ProductPage } from '@/components/product'
import { useParams, useSearchParams } from 'next/navigation'

export default function DomainPackSurfacesPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const packId = params.packId as string
  const version = searchParams.get('version') || 'latest'

  return (
    <ProductPage path="/automation/domain-packs" hideToolbar>
      <SurfaceRegistryManager packKey={packId} version={version} fallback={<DomainPackSurfacesPageShimmer />} />
    </ProductPage>
  )
}
