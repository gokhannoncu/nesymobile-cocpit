import {
  fetchVerdictDomainPacks,
  fetchVerdictRunHistory,
  fetchVerdictTestProfiles,
  fetchVerdictWorkflowCatalog,
} from '@/lib/verdict-runtime/client'
import { ProductPage } from '@/components/product'
import { RunPlannerPageIntro } from './RunPlannerPageIntro'
import { RunPlannerWorkspace } from './RunPlannerWorkspace'

export default async function RunPlannerPage() {
  let workflows, packs, profiles, runs
  try {
    ;[workflows, packs, profiles, runs] = await Promise.all([
      fetchVerdictWorkflowCatalog(100),
      fetchVerdictDomainPacks(),
      fetchVerdictTestProfiles(),
      fetchVerdictRunHistory({ limit: 50, engineType: 'BRIDGEFLOW' }),
    ])
  } catch (error) {
    return <RuntimeError title="Run Planner unavailable" error={error} />
  }

  const publishedPacks = packs.items.filter((pack) => pack.publicationState === 'PUBLISHED')
  const releaseProfiles = profiles.items.filter((profile) => profile.releaseGate)
  const catalogBlocked = [
    publishedPacks.length === 0 ? 'No published Domain Pack can be pinned.' : null,
    workflows.items.length === 0 ? 'No workflow is available for planning.' : null,
    releaseProfiles.length === 0 ? 'No release-gate Test Profile is available.' : null,
  ].filter((item): item is string => item !== null)

  return (
    <ProductPage path="/automation/run-planner" hideToolbar>
      <RunPlannerPageIntro
        workflowCount={workflows.items.length}
        publishedPackCount={publishedPacks.length}
        releaseProfileCount={releaseProfiles.length}
      />

      <RunPlannerWorkspace
        workflows={workflows}
        packs={packs}
        profiles={profiles}
        runs={runs}
        catalogBlocked={catalogBlocked}
      />
    </ProductPage>
  )
}

function RuntimeError({ title, error }: { title: string; error: unknown }) {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Runtime error: {error instanceof Error ? error.message : String(error)}
      </p>
    </main>
  )
}
