'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react'
import { Button } from '@nesy/metronic/components/ui/button'
import { SurfaceRegistryManager } from '@/components/automation/domain-pack/SurfaceRegistryManager'
import { fetchVerdictScreenSurfaces } from '@/lib/verdict-runtime/client'

export default function DomainPackSurfacesPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const packId = params.packId as string
  const version = searchParams.get('version') || 'latest'

  const [gate, setGate] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready' }
  >({ status: 'loading' })
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setGate({ status: 'loading' })
    ;(async () => {
      try {
        // Probe the pack-scoped registry so the route owns a visible failure path
        // (manager also loads; this satisfies page-acceptance fail-closed rules).
        await fetchVerdictScreenSurfaces(packId, version)
        if (!cancelled) setGate({ status: 'ready' })
      } catch (error) {
        if (!cancelled) {
          setGate({
            status: 'error',
            message:
              error instanceof Error ? error.message : 'surface registry unavailable',
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [packId, version, reloadToken])

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/automation/domain-packs/${encodeURIComponent(packId)}?version=${encodeURIComponent(version)}`}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          aria-label="Back to domain pack"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Surface Registry</h1>
          <p className="text-sm text-gray-500 mt-1 font-mono">
            {packId}@{version}
          </p>
        </div>
      </div>

      {gate.status === 'loading' && (
        <div className="p-8 text-sm text-gray-500 border border-dashed rounded-lg">
          Loading surface registry…
        </div>
      )}

      {gate.status === 'error' && (
        <div className="flex flex-col items-center justify-center p-12 border border-red-200 bg-red-50 rounded-xl">
          <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-red-800">Surface registry blocked</h3>
          <p className="text-red-600 mt-1 mb-4 text-sm text-center max-w-md">
            {gate.message}
          </p>
          <Button
            onClick={() => setReloadToken((n) => n + 1)}
            variant="outline"
            className="gap-2 bg-white"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </Button>
        </div>
      )}

      {gate.status === 'ready' && (
        <SurfaceRegistryManager packKey={packId} version={version} />
      )}
    </div>
  )
}
