export default function CockpitLoading() {
  return (
    <div
      className="container-fluid animate-pulse space-y-6"
      role="status"
      aria-label="Loading page content"
    >
      <span className="sr-only">Loading page content</span>
      <div className="space-y-3">
        <div className="h-7 w-56 max-w-2/3 rounded-md bg-accent" />
        <div className="h-4 w-[32rem] max-w-full rounded bg-accent/80" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="space-y-4 rounded-xl border border-border p-5">
            <div className="h-5 w-2/5 rounded bg-accent" />
            <div className="space-y-2.5">
              <div className="h-3.5 w-full rounded bg-accent/80" />
              <div className="h-3.5 w-5/6 rounded bg-accent/80" />
              <div className="h-3.5 w-2/3 rounded bg-accent/80" />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-xl border border-border p-5">
        <div className="h-5 w-40 rounded bg-accent" />
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-10 w-full rounded-md bg-accent/70" />
        ))}
      </div>
    </div>
  )
}
