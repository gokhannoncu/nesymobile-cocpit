'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'
import { Button } from '@nesy/metronic/components/ui/button'
import { ProductPage } from '@/components/product/page-shell'

export default function RunDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ProductPage path="/automation/list" title="Run unavailable">
      <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-card p-6 shadow-sm">
        <span className="flex size-11 items-center justify-center rounded-xl bg-red-50 text-red-700">
          <AlertTriangle className="size-5" />
        </span>
        <h1 className="mt-4 text-xl font-semibold">Run dashboard could not be prepared</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The route failed before a durable snapshot could be handed to the dashboard. Retrying is
          safe and does not restart or modify the run.
        </p>
        <p className="mt-3 rounded-lg bg-muted/50 p-3 font-mono text-xs text-muted-foreground">
          {error.message || 'Unexpected run detail route error'}
          {error.digest ? ` · reference ${error.digest}` : ''}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={reset} className="gap-2">
            <RefreshCw className="size-4" />
            Retry dashboard
          </Button>
          <Button asChild variant="outline">
            <Link href="/automation/list" className="gap-2">
              <ArrowLeft className="size-4" />
              Workflow library
            </Link>
          </Button>
        </div>
      </div>
    </ProductPage>
  )
}
