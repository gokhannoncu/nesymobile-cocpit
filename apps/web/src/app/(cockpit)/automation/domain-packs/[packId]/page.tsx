'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { fetchVerdictDomainPack, saveDomainPackDraft, publishDomainPack } from '@/lib/verdict-runtime/client'
import { DomainPackDetailApi } from '@/lib/verdict-runtime/types'
import { DomainPackDetailPageShimmer } from '@/components/automation/domain-pack/domain-pack-catalog-shimmer'
import { DomainPackHeader } from '@/components/automation/domain-pack/DomainPackHeader'
import { DomainPackTabs } from '@/components/automation/domain-pack/DomainPackTabs'
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
      // Normally we'd pass the updated content, but for UI we just pass the current state as a mock edit
      await saveDomainPackDraft({
        packKey: data.packKey,
        version: data.version,
        concurrencyToken: data.concurrencyToken
      })
      // Reload to get updated draft
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
      // Reload to get published state
      await loadData()
    } catch (err) {
      console.error('Failed to publish:', err)
      alert('Failed to publish domain pack. Check console for details.')
    } finally {
      setIsPublishing(false)
    }
  }

  if (loading) {
    return <DomainPackDetailPageShimmer />
  }

  if (error || !data) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex flex-col items-center justify-center p-12 border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 rounded-xl">
          <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200">Failed to load domain pack</h3>
          <p className="text-red-600 dark:text-red-400 mt-1 mb-4 text-sm text-center max-w-md">
            {error?.message || 'Unknown error'}
          </p>
          <Button onClick={loadData} variant="outline" className="gap-2 bg-white dark:bg-gray-950">
            <RefreshCw className="w-4 h-4" /> Retry
          </Button>
        </div>
      </div>
    )
  }

  if (data.blockedReason) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <DomainPackHeader 
          pack={data} 
        />
        <div className="p-6 border-l-4 border-red-500 bg-red-50 dark:bg-red-950/30 rounded-r-lg mt-6">
          <h3 className="text-lg font-medium text-red-800 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" /> Pack Access Blocked
          </h3>
          <p className="mt-2 text-red-700 dark:text-red-300">
            {data.blockedReason}
          </p>
        </div>
      </div>
    )
  }

  const hasValidationErrors = Object.keys(data.validation || {}).length > 0

  return (
    <div className="container mx-auto p-6 max-w-7xl">
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
  )
}
