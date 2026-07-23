'use client'

import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@nesy/metronic/components/ui/button'
import Link from 'next/link'
import { AUTOMATION_LOAD_TOUR_PATH } from '@nesy/metronic/config/layout-21.config'
import { LoadTourFlowWorkspace } from '@/components/automation/load-tour-flow-workspace'
import { ProductPage } from '@/components/product'
import { fetchWorkflow } from '@/services/automation-api'

const WORKFLOW_SLUG = '01-load-tour-flow'

export default function LoadTourFlowPage() {
  const [workflowId, setWorkflowId] = useState<string | null>(null)

  useEffect(() => {
    void fetchWorkflow(WORKFLOW_SLUG)
      .then((workflow) => setWorkflowId(workflow.id))
      .catch(() => setWorkflowId(null))
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
      <LoadTourFlowWorkspace />
    </ProductPage>
  )
}
