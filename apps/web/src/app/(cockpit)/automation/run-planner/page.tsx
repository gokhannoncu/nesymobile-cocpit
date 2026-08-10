import {
  fetchVerdictDomainPacks,
  fetchVerdictTestProfiles,
  fetchVerdictWorkflowCatalog,
} from '@/lib/verdict-runtime/client'

export default async function RunPlannerPage() {
  let workflows, packs, profiles
  try {
    ;[workflows, packs, profiles] = await Promise.all([
      fetchVerdictWorkflowCatalog(100),
      fetchVerdictDomainPacks(),
      fetchVerdictTestProfiles(),
    ])
  } catch (error) {
    return <RuntimeError title="Run Planner unavailable" error={error} />
  }
  const publishedPacks = packs.items.filter((pack) => pack.publicationState === 'PUBLISHED')
  const releaseProfiles = profiles.items.filter((profile) => profile.releaseGate)
  const blocked = [
    publishedPacks.length === 0 ? 'No published Domain Pack can be pinned.' : null,
    workflows.items.length === 0 ? 'No workflow is available for planning.' : null,
    releaseProfiles.length === 0 ? 'No release-gate Test Profile is available.' : null,
  ].filter((item): item is string => item !== null)

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Automation / Planning</p>
        <h1 className="text-2xl font-bold tracking-tight">Run Planner</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Freezes workflow, Domain Pack, profile and resource inputs before execution. Skipped and blocked reasons are explicit so a non-run never reads as product failure.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Workflows" value={workflows.items.length} />
        <Metric label="Published Packs" value={publishedPacks.length} />
        <Metric label="Release Profiles" value={releaseProfiles.length} />
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Planner Readiness</h2>
        {blocked.length === 0 ? (
          <p className="mt-3 text-sm text-emerald-700">READY: manifest preview can be produced from current catalogs.</p>
        ) : (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-700">
            {blocked.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        )}
      </section>
    </main>
  )
}

function RuntimeError({ title, error }: { title: string; error: unknown }) {
  return <main className="p-8"><h1 className="text-2xl font-bold">{title}</h1><p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Runtime error: {error instanceof Error ? error.message : String(error)}</p></main>
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  )
}
