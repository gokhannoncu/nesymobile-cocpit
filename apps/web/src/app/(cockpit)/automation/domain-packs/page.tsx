'use client'

import React, { useEffect, useState } from 'react'
import { fetchVerdictDomainPacks } from '@/lib/verdict-runtime/client'
import { DomainPackCatalogApi, DomainPackSummary } from '@/lib/verdict-runtime/types'
import { DomainPackStateBadge } from '@/components/automation/domain-pack/DomainPackStateBadge'
import { Package, Search, AlertCircle, RefreshCw, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@nesy/metronic/components/ui/button'

export default function DomainPacksCatalogPage() {
  const [data, setData] = useState<DomainPackCatalogApi | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetchVerdictDomainPacks()
      setData(res)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load domain packs'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const query = searchQuery.toLowerCase()
  const filteredItems =
    data?.items.filter(
      (item) =>
        item.packKey.toLowerCase().includes(query) ||
        item.version.toLowerCase().includes(query),
    ) ?? []

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Domain Packs</h1>
          <p className="text-gray-500 mt-1">Manage semantic domain packs for automation targets</p>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search packs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 border rounded-md w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:bg-gray-900"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="border rounded-xl p-6 h-48 animate-pulse bg-gray-50 dark:bg-gray-900/50" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center p-12 border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 rounded-xl">
          <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200">Failed to load domain packs</h3>
          <p className="text-red-600 dark:text-red-400 mt-1 mb-4 text-sm text-center max-w-md">
            {error.message}
          </p>
          <Button onClick={loadData} variant="outline" className="gap-2 bg-white dark:bg-gray-950">
            <RefreshCw className="w-4 h-4" /> Retry
          </Button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 border border-dashed rounded-xl bg-gray-50 dark:bg-gray-900/20">
          <Package className="w-12 h-12 text-gray-400 mb-4" />
          <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100">No domain packs found</h3>
          <p className="text-gray-500 mt-2 text-center max-w-md">
            {searchQuery ? "Try adjusting your search query." : "No domain packs are currently available in the runtime."}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map(pack => (
            <Link 
              key={`${pack.packKey}-${pack.version}`}
              href={`/automation/domain-packs/${encodeURIComponent(pack.packKey)}?version=${encodeURIComponent(pack.version)}`}
              className="group block"
            >
              <div className="border rounded-xl p-6 h-full bg-white dark:bg-gray-950 hover:shadow-md hover:border-primary/30 transition-all duration-200 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
                
                <div className="flex justify-between items-start mb-4 pr-6">
                  <h3 className="text-lg font-semibold truncate" title={pack.packKey}>
                    {pack.packKey}
                  </h3>
                  <DomainPackStateBadge state={pack.publicationState} />
                </div>
                
                <div className="text-sm text-gray-500 font-mono mb-6 truncate" title={pack.bundleDigest}>
                  {pack.bundleDigest}
                </div>
                
                <div className="mt-auto grid grid-cols-2 gap-y-4 gap-x-2 text-sm text-gray-600 dark:text-gray-400">
                  <div>
                    <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Version</span>
                    {pack.version}
                  </div>
                  <div>
                    <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Revision</span>
                    {pack.revision}
                  </div>
                  <div className="col-span-2">
                    <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Published</span>
                    {pack.publishedAt ? new Date(pack.publishedAt).toLocaleString() : 'not published'}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
