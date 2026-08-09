import {
  fetchVerdictRunDetail,
  fetchVerdictEvidenceJourney,
  fetchVerdictLegacyRunSummary,
} from '@/lib/verdict-runtime/client'
import type { RunDetailResult } from '@/lib/verdict-runtime/types'
import { deriveLayerApplicability } from '@/lib/verdict-runtime/layer-applicability'
import { EvidenceJourneyDrawer } from '@/components/automation/run-detail/EvidenceJourneyDrawer'
import { OccurrenceTree } from '@/components/automation/run-detail/OccurrenceTree'
import { LayerBadges } from '@/components/automation/run-detail/LayerBadge'
import { GateOracleTimeline } from '@/components/automation/run-detail/GateOracleTimeline'
import { OutcomePanel } from '@/components/automation/run-detail/OutcomePanel'
import { VerdictDisposition } from '@/components/automation/run-detail/VerdictDisposition'
import { ReproExportPanel } from '@/components/automation/run-detail/ReproExportPanel'
import { ProvenancePanel } from '@/components/automation/run-detail/ProvenancePanel'
import { InteractionOriginsPanel } from '@/components/automation/run-detail/InteractionOriginsPanel'
import { DiagnosticWaterfall } from '@/components/automation/run-detail/DiagnosticWaterfall'
import { LiveUpdateSubscription } from '@/components/automation/run-detail/LiveUpdateSubscription'
import { Alert, AlertDescription, AlertTitle } from '@nesy/metronic/components/ui/alert'
import { InfoIcon } from 'lucide-react'

export default async function RunDetailPage(props: {
  params: Promise<{ id: string; runId: string }>
}) {
  const params = await props.params
  const { runId } = params

  let runDetail: RunDetailResult | null = null
  let evidenceJourney = null
  let isLegacy = false

  try {
    runDetail = await fetchVerdictRunDetail(runId)
    if (runDetail?.correlation?.engineType === 'MAESTRO_LEGACY') {
      isLegacy = true
      runDetail = (await fetchVerdictLegacyRunSummary(runId)) as RunDetailResult
    }

    evidenceJourney = await fetchVerdictEvidenceJourney(runId)
  } catch {
    try {
      runDetail = (await fetchVerdictLegacyRunSummary(runId)) as RunDetailResult
      isLegacy = true
    } catch {
      return (
        <div className="p-8">
          <Alert variant="destructive">
            <AlertTitle>Error loading run</AlertTitle>
            <AlertDescription>Could not load details for run {runId}.</AlertDescription>
          </Alert>
        </div>
      )
    }
  }

  if (runDetail?.partial || runDetail?.blockedReason) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertTitle>Blocked State</AlertTitle>
          <AlertDescription>
            Run is in a blocked state: {runDetail.blockedReason}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!runDetail) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertTitle>Error loading run</AlertTitle>
          <AlertDescription>Could not load details for run {runId}.</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (isLegacy) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Run {runId.split('-')[0]}</h1>
            <p className="text-muted-foreground">Legacy YAML Run (Read Only)</p>
          </div>
        </div>
        <Alert>
          <InfoIcon className="w-4 h-4" />
          <AlertTitle>Legacy View</AlertTitle>
          <AlertDescription>
            This is a legacy Maestro run. Detailed capabilities are limited.
          </AlertDescription>
        </Alert>
        <VerdictDisposition run={runDetail} />
      </div>
    )
  }

  const layerStates = deriveLayerApplicability(runDetail)
  // Cockpit operators currently declare rbac ['*'] on this route — deep-link allowed.
  // When finer roles land, gate this from session claims (evidence:read).
  const canViewRawEvidence = true

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Run {runId.split('-')[0]}</h1>
            <LiveUpdateSubscription runId={runId} />
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Durable execution trace and evidence.
          </p>
        </div>
        <EvidenceJourneyDrawer
          runId={runId}
          journey={evidenceJourney || undefined}
          canViewRawEvidence={canViewRawEvidence}
        />
      </div>

      <VerdictDisposition run={runDetail} />
      <OutcomePanel run={runDetail} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Execution Timeline</h2>
            <GateOracleTimeline run={runDetail} />
          </div>
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Layers</h2>
            <LayerBadges states={layerStates} />
            <p className="text-[11px] text-muted-foreground font-mono">
              From persisted oracleEvaluations · max revision per plane
            </p>
          </div>
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Diagnostic Waterfall</h2>
            <DiagnosticWaterfall run={runDetail} />
          </div>
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Interactions</h2>
            <InteractionOriginsPanel runId={runId} />
          </div>
        </div>

        <div className="space-y-8">
          <OccurrenceTree run={runDetail} />
          <ProvenancePanel run={runDetail} />
          <ReproExportPanel run={runDetail} />
        </div>
      </div>
    </div>
  )
}
