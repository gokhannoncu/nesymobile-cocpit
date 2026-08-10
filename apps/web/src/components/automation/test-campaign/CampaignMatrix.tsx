'use client'
import { CampaignCell, type CampaignCellView } from './CampaignCell'

export function CampaignMatrix({ cells }: { cells: CampaignCellView[] }) {
  const devices = [...new Set(cells.map((cell) => String((cell as { deviceCell?: unknown }).deviceCell ?? 'unassigned')))]
  const profiles = [...new Set(cells.map((cell) => String((cell as { profileKey?: unknown }).profileKey ?? 'profile')))]

  if (cells.length === 0) {
    return <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">No campaign cells yet.</div>
  }

  return (
    <div className="border rounded-md overflow-hidden bg-background">
      <div className="grid gap-px bg-border p-px" style={{ gridTemplateColumns: `180px repeat(${Math.max(devices.length, 1)}, minmax(160px, 1fr))` }}>
        <div className="bg-muted p-2 font-medium text-sm flex items-center">Profile \\ Device</div>
        {devices.map((device) => <div key={device} className="bg-muted p-2 font-medium text-sm text-center">{device}</div>)}
        {profiles.flatMap((profile) => [
          <div key={`${profile}:label`} className="bg-background p-2 text-sm font-medium flex items-center">{profile}</div>,
          ...devices.map((device) => {
            const cell = cells.find((item) =>
              String((item as { profileKey?: unknown }).profileKey ?? 'profile') === profile &&
              String((item as { deviceCell?: unknown }).deviceCell ?? 'unassigned') === device,
            )
            return <div key={`${profile}:${device}`} className="bg-background p-1"><CampaignCell cell={cell ?? { status: 'NO_EVIDENCE' }} /></div>
          }),
        ])}
      </div>
    </div>
  )
}
