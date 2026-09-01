'use client'

import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@nesy/metronic/components/ui/button'
import Link from 'next/link'
import { AUTOMATION_LOAD_TOUR_PATH } from '@nesy/metronic/config/layout-21.config'
import { LoadTourFlowPageShimmer } from '@/components/automation/shimmers/load-tour-flow-shimmer'
import { LoadTourFlowWorkspace } from '@/components/automation/load-tour-flow-workspace'
import { ProductPage } from '@/components/product'
import { fetchWorkflow } from '@/services/automation-api'
import { fetchVerdictDomainPacks } from '@/lib/verdict-runtime/client'
import { packIdentity, selectPinnedPublishedPack } from '@/lib/verdict-runtime/select-published-pack'

const WORKFLOW_SLUG = '01-load-tour-flow'

export default function LoadTourFlowPage() {
  const [workflowId, setWorkflowId] = useState<string | null>(null)
  const [packPin, setPackPin] = useState<string | null>(null)
  const [packError, setPackError] = useState<string | null>(null)
  const [bootstrapping, setBootstrapping] = useState(true)

  useEffect(() => {
    void fetchWorkflow(WORKFLOW_SLUG)
      .then((workflow) => setWorkflowId(workflow.id))
      .catch(() => setWorkflowId(null))
  }, [])

  useEffect(() => {
    void fetchVerdictDomainPacks()
      .then((catalog) => {
        const published = selectPinnedPublishedPack(catalog.items)
        if (!published) {
          setPackError('No published Domain Pack — runs cannot be pinned.')
          setPackPin(null)
          return
        }
        setPackError(null)
        setPackPin(packIdentity(published))
      })
      .catch((error) => {
        setPackError(error instanceof Error ? error.message : 'Domain Pack catalog unavailable')
        setPackPin(null)
      })
      .finally(() => setBootstrapping(false))
  }, [])

  return (
    <ProductPage
      path={AUTOMATION_LOAD_TOUR_PATH}
      title="Load & Tour Flow"
      toolbarActions={
        workflowId ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/automation/${workflowId}`}>
              <ExternalLink className="size-3.5" />
              Graph editor
            </Link>
          </Button>
        ) : null
      }
    >
      {bootstrapping ? (
        <LoadTourFlowPageShimmer />
      ) : (
        <>
      {packError ? (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {packError}
        </div>
      ) : packPin ? (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 font-mono">
          Verdict runtime pin: {packPin}
        </div>
      ) : null}
      <LoadTourFlowWorkspace />
        </>
      )}
    </ProductPage>
  )
}
