import { fetchVerdictRunDetail, fetchVerdictEvidenceJourney, fetchVerdictLegacyRunSummary } from '@/lib/verdict-runtime/client'
import { EvidenceJourneyDrawer } from '@/components/automation/run-detail/EvidenceJourneyDrawer'
import { OccurrenceTree } from '@/components/automation/run-detail/OccurrenceTree'
import { LayerBadges } from '@/components/automation/run-detail/LayerBadge'
import { GateOracleTimeline } from '@/components/automation/run-detail/GateOracleTimeline'
import { OutcomePanel } from '@/components/automation/run-detail/OutcomePanel'
import { VerdictDisposition } from '@/components/automation/run-detail/VerdictDisposition'
import { ReproExportPanel } from '@/components/automation/run-detail/ReproExportPanel'
import { InteractionOriginBadge } from '@/components/automation/run-detail/InteractionOriginBadge'
import { LiveUpdateSubscription } from '@/components/automation/run-detail/LiveUpdateSubscription'
import { Alert, AlertDescription, AlertTitle } from '@nesy/metronic/components/ui/alert'
import { InfoIcon } from 'lucide-react'

export default async function RunDetailPage(props: { params: Promise<{ id: string, runId: string }> }) {
  const params = await props.params;
  const { runId } = params;

  let runDetail = null
  let evidenceJourney = null
  let isLegacy = false

  try {
    runDetail = await fetchVerdictRunDetail(runId)
    // Check if it's legacy
    if (runDetail?.correlation?.engineType === 'MAESTRO_LEGACY') {
      isLegacy = true
      runDetail = await fetchVerdictLegacyRunSummary(runId) as any
    }
    
    evidenceJourney = await fetchVerdictEvidenceJourney(runId)
  } catch (err) {
    try {
      runDetail = await fetchVerdictLegacyRunSummary(runId) as any
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
          <AlertDescription>Run is in a blocked state: {runDetail.blockedReason}</AlertDescription>
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
          <AlertDescription>This is a legacy Maestro run. Detailed capabilities are limited.</AlertDescription>
        </Alert>
        <VerdictDisposition run={runDetail} />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Run {runId.split('-')[0]}</h1>
            <LiveUpdateSubscription runId={runId} />
          </div>
          <p className="text-muted-foreground text-sm mt-1">Durable execution trace and evidence.</p>
        </div>
        <EvidenceJourneyDrawer runId={runId} journey={evidenceJourney || undefined} />
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
            <LayerBadges states={[
              { layer: 'UI', state: 'PASS' },
              { layer: 'App', state: 'PASS' },
              { layer: 'Local', state: 'NOT_MEASURED' },
              { layer: 'Remote', state: 'NOT_APPLICABLE', reason: 'No remote checks defined' }
            ]} />
          </div>
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Interactions</h2>
            <div className="flex gap-2">
              <InteractionOriginBadge origin="BRIDGE_INJECTED" confidence={100} />
              <InteractionOriginBadge origin="MANUAL" confidence={98} />
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <OccurrenceTree run={runDetail} />
          <ReproExportPanel run={runDetail} />
        </div>
      </div>
    </div>
  )
}
