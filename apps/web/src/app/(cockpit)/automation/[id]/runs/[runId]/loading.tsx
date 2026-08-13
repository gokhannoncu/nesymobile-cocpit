import { ProductPage } from '@/components/product/page-shell'

export default function RunDetailLoading() {
  return (
    <ProductPage path="/automation/list" title="Loading run">
      <div
        className="space-y-5 animate-pulse motion-reduce:animate-none"
        role="status"
        aria-label="Loading run dashboard"
      >
        <span className="sr-only">Loading run dashboard</span>
        <div className="rounded-xl border bg-card p-5">
          <div className="h-3 w-36 rounded bg-accent" />
          <div className="mt-3 h-7 w-72 max-w-full rounded bg-accent" />
          <div className="mt-3 h-4 w-[34rem] max-w-full rounded bg-accent/70" />
          <div className="mt-4 flex gap-2">
            <div className="h-6 w-28 rounded-full bg-accent/70" />
            <div className="h-6 w-24 rounded-full bg-accent/70" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-28 rounded-xl border bg-card p-4">
              <div className="h-3 w-24 rounded bg-accent/70" />
              <div className="mt-4 h-7 w-20 rounded bg-accent" />
              <div className="mt-3 h-3 w-full rounded bg-accent/60" />
            </div>
          ))}
        </div>
        <div className="h-14 rounded-xl border bg-card p-2">
          <div className="h-full rounded-lg bg-accent/60" />
        </div>
      </div>
    </ProductPage>
  )
}
