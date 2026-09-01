'use client'

import { CampaignCell, type CampaignCellView } from './CampaignCell'
import { cn } from '@nesy/metronic/lib/utils'

export function CampaignMatrix({ cells }: { cells: CampaignCellView[] }) {
  const devices = [
    ...new Set(cells.map((cell) => String((cell as { deviceCell?: unknown }).deviceCell ?? 'unassigned'))),
  ]
  const profiles = [
    ...new Set(cells.map((cell) => String((cell as { profileKey?: unknown }).profileKey ?? 'profile'))),
  ]

  if (cells.length === 0) {
    return (
      <div className="rounded-[8px] border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No campaign cells yet — schedule profiles from the run planner.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-[8px] border border-border">
      <div
        className="grid min-w-max gap-px bg-border"
        style={{
          gridTemplateColumns: `minmax(180px, 220px) repeat(${Math.max(devices.length, 1)}, minmax(140px, 1fr))`,
        }}
      >
        <div className="bg-muted/50 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Profile \ Device
        </div>
        {devices.map((device) => (
          <div
            key={device}
            className="bg-muted/50 px-3 py-2.5 text-center font-mono text-[10px] font-semibold text-foreground"
          >
            {device}
          </div>
        ))}
        {profiles.flatMap((profile) => [
          <div
            key={`${profile}:label`}
            className="bg-card px-3 py-2 font-mono text-xs font-semibold text-foreground"
          >
            {profile}
          </div>,
          ...devices.map((device) => {
            const cell = cells.find(
              (item) =>
                String((item as { profileKey?: unknown }).profileKey ?? 'profile') === profile &&
                String((item as { deviceCell?: unknown }).deviceCell ?? 'unassigned') === device,
            )
            return (
              <div key={`${profile}:${device}`} className={cn('bg-card p-1.5')}>
                <CampaignCell cell={cell ?? { status: 'NO_EVIDENCE' }} />
              </div>
            )
          }),
        ])}
      </div>
    </div>
  )
}
