'use client'

import { cn } from '@nesy/metronic/lib/utils'
import {
  formatParentScreens,
  surfaceKindTone,
  surfacePolicyTone,
} from '@/lib/verdict-runtime/surface-registry'
import { toneIconBox, toneText } from '@/components/product/tones'
import type { SurfaceRegistryItemApi } from '@/lib/verdict-runtime/types'

const cellGrid = 'border-b border-r border-border last:border-r-0'
const thClass = cn('px-2.5 py-2 text-left', cellGrid)
const tdClass = cn('px-2.5 py-2 align-middle', cellGrid)

const badgeClass =
  'inline-flex rounded-[4px] border border-current/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide'

function KindBadge({ kind }: { kind: string }) {
  const tone = surfaceKindTone(kind)
  return (
    <span className={cn(badgeClass, toneIconBox[tone], toneText[tone])}>{kind.replace(/_/g, ' ')}</span>
  )
}

function PolicyBadge({ policy }: { policy: string }) {
  const tone = surfacePolicyTone(policy)
  return (
    <span className={cn(badgeClass, toneIconBox[tone], toneText[tone])}>
      {policy.replace(/_/g, ' ')}
    </span>
  )
}

export function SurfaceRegistryTable({
  surfaces,
  selectedSurfaceKey,
  onSelect,
}: {
  surfaces: SurfaceRegistryItemApi[]
  selectedSurfaceKey: string | null
  onSelect: (surfaceKey: string) => void
}) {
  if (surfaces.length === 0) {
    return (
      <div className="rounded-[8px] border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
        No surfaces match the current filters.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-[8px] border border-border">
      <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr className="bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <th className={thClass}>Surface</th>
            <th className={cn('hidden sm:table-cell', thClass)}>Kind</th>
            <th className={thClass}>Policy</th>
            <th className={cn('hidden md:table-cell w-16', thClass)}>Priority</th>
            <th className={cn('hidden lg:table-cell', thClass)}>Parent screens</th>
            <th className={cn('hidden xl:table-cell', thClass)}>Handler</th>
            <th className={cn('hidden md:table-cell w-24', thClass)}>Verdict</th>
          </tr>
        </thead>
        <tbody>
          {surfaces.map((surface, index) => {
            const selected = surface.surfaceKey === selectedSurfaceKey
            return (
              <tr
                key={surface.surfaceKey}
                onClick={() => onSelect(surface.surfaceKey)}
                className={cn(
                  'cursor-pointer transition-colors',
                  selected
                    ? 'bg-nesy-soft/50 hover:bg-nesy-soft/60'
                    : index % 2 === 1
                      ? 'bg-muted/50 hover:bg-muted/65'
                      : 'bg-card hover:bg-muted/35',
                )}
              >
                <td className={tdClass}>
                  <p className="font-semibold text-foreground">{surface.displayName}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {surface.surfaceKey}
                  </p>
                </td>
                <td className={cn('hidden sm:table-cell', tdClass)}>
                  <KindBadge kind={surface.kind} />
                </td>
                <td className={tdClass}>
                  <PolicyBadge policy={surface.defaultPolicy} />
                </td>
                <td className={cn('hidden md:table-cell tabular-nums text-muted-foreground', tdClass)}>
                  {surface.priority}
                </td>
                <td className={cn('hidden lg:table-cell max-w-xs truncate text-[10px] text-muted-foreground', tdClass)}>
                  {formatParentScreens(surface.parentScreenRefs)}
                </td>
                <td className={cn('hidden xl:table-cell max-w-xs truncate font-mono text-[10px] text-muted-foreground', tdClass)}>
                  {surface.handlerMacroRef ?? '—'}
                </td>
                <td className={cn('hidden md:table-cell', tdClass)}>
                  {surface.blocksProductVerdict ? (
                    <span className="text-[10px] font-semibold text-orange-700 dark:text-orange-300">
                      Blocks
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">No</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
