'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { fetchVerdictDomainPack, saveDomainPackDraft, publishDomainPack } from '@/lib/verdict-runtime/client'
import { DomainPackDetailApi } from '@/lib/verdict-runtime/types'
import { DomainPackDetailPageShimmer } from '@/components/automation/domain-pack/domain-pack-catalog-shimmer'
import { DomainPackHeader } from '@/components/automation/domain-pack/DomainPackHeader'
import { DomainPackTabs } from '@/components/automation/domain-pack/DomainPackTabs'
import { ProductPage } from '@/components/product'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@nesy/metronic/components/ui/button'

export default function DomainPackDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const packId = params.packId as string
  const version = searchParams.get('version') || 'latest'
  
  const [data, setData] = useState<DomainPackDetailApi | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetchVerdictDomainPack(packId, version)
      setData(res)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load domain pack details'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [packId, version])

  const handleSaveDraft = async () => {
    if (!data) return
    try {
      setIsSaving(true)
      await saveDomainPackDraft({
        packKey: data.packKey,
        version: data.version,
        concurrencyToken: data.concurrencyToken
      })
      await loadData()
    } catch (err) {
      console.error('Failed to save draft:', err)
      alert('Failed to save draft. Check console for details.')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!data) return
    const hasErrors = Object.keys(data.validation || {}).length > 0
    if (hasErrors) {
      alert('Cannot publish domain pack with validation errors.')
      return
    }
    
    if (!confirm('Are you sure you want to publish this domain pack? This action cannot be undone.')) {
      return
    }

    try {
      setIsPublishing(true)
      await publishDomainPack({
        packKey: data.packKey,
        version: data.version,
      })
      await loadData()
    } catch (err) {
      console.error('Failed to publish:', err)
      alert('Failed to publish domain pack. Check console for details.')
    } finally {
      setIsPublishing(false)
    }
  }

  if (loading) {
    return (
      <ProductPage path="/automation/domain-packs" hideToolbar>
        <DomainPackDetailPageShimmer />
      </ProductPage>
    )
  }

  if (error || !data) {
    return (
      <ProductPage path="/automation/domain-packs" hideToolbar>
        <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-12 dark:border-red-900/50 dark:bg-red-950/20">
          <AlertCircle className="mb-4 size-10 text-red-500" />
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200">Failed to load domain pack</h3>
          <p className="mt-1 mb-4 max-w-md text-center text-sm text-red-600 dark:text-red-400">
            {error?.message || 'Unknown error'}
          </p>
          <Button onClick={loadData} variant="outline" className="gap-2 bg-white dark:bg-gray-950">
            <RefreshCw className="size-4" /> Retry
          </Button>
        </div>
      </ProductPage>
    )
  }

  if (data.blockedReason) {
    return (
      <ProductPage path="/automation/domain-packs" hideToolbar>
        <DomainPackHeader pack={data} />
        <div className="mt-6 rounded-r-lg border-l-4 border-red-500 bg-red-50 p-6 dark:bg-red-950/30">
          <h3 className="flex items-center gap-2 text-lg font-medium text-red-800 dark:text-red-400">
            <AlertCircle className="size-5" /> Pack Access Blocked
          </h3>
          <p className="mt-2 text-red-700 dark:text-red-300">
            {data.blockedReason}
          </p>
        </div>
      </ProductPage>
    )
  }

  const hasValidationErrors = Object.keys(data.validation || {}).length > 0

  return (
    <ProductPage path="/automation/domain-packs" hideToolbar>
      <div className="space-y-6">
        <DomainPackHeader 
          pack={data} 
          isSaving={isSaving}
          isPublishing={isPublishing}
          onSaveDraft={handleSaveDraft}
          onPublish={handlePublish}
          hasValidationErrors={hasValidationErrors}
        />
        <DomainPackTabs pack={data} />
      </div>
    </ProductPage>
  )
}
