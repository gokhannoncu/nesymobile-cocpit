import { fetchVerdictRunHistory } from '@/lib/verdict-runtime/client'

export default async function ExecutionQueuePage() {
  let runs
  try {
    runs = await fetchVerdictRunHistory({ limit: 50, engineType: 'BRIDGEFLOW' })
  } catch (error) {
    return <main className="p-8"><h1 className="text-2xl font-bold">Execution Queue unavailable</h1><p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Runtime error: {error instanceof Error ? error.message : String(error)}</p></main>
  }
  const queued = runs.items.filter((item) => String(item.run.status ?? '').toLowerCase().includes('queued'))
  const running = runs.items.filter((item) => String(item.run.status ?? '').toLowerCase().includes('running'))
  const terminal = runs.items.filter((item) => !queued.includes(item) && !running.includes(item))

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Automation / Operations</p>
        <h1 className="text-2xl font-bold tracking-tight">Execution Queue</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Operational view of BridgeFlow executions. Lifecycle is separate from product verdict; blocked runs stay blocked instead of becoming fake product failures.
        </p>
      </header>
      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Queued" value={queued.length} />
        <Metric label="Running" value={running.length} />
        <Metric label="Terminal / Other" value={terminal.length} />
      </section>
      <section className="rounded-xl border bg-card">
        <div className="border-b px-5 py-3 text-sm font-semibold">Latest BridgeFlow Runs</div>
        <div className="divide-y">
          {runs.items.length === 0 ? (
            <div className="px-5 py-6 text-sm text-muted-foreground">No execution rows found.</div>
          ) : runs.items.map((item) => (
            <div key={String(item.run.id ?? item.correlation.runId)} className="grid gap-2 px-5 py-4 text-sm md:grid-cols-4">
              <div className="font-mono text-xs">{item.correlation.runId}</div>
              <div>Status: {String(item.run.status ?? 'unknown')}</div>
              <div>Engine: {item.correlation.engineType}</div>
              <div>{item.partial ? 'Partial read model' : 'Read model complete'}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border bg-card p-5"><div className="text-xs uppercase text-muted-foreground">{label}</div><div className="mt-2 text-3xl font-bold">{value}</div></div>
}
