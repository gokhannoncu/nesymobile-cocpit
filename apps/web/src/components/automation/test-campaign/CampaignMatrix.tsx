'use client'
import { CampaignCell } from './CampaignCell'

export function CampaignMatrix({ cells }: { cells: any[] }) {
  return (
    <div className="border rounded-md overflow-hidden bg-background">
      <div className="grid grid-cols-4 gap-px bg-border p-px">
        <div className="bg-muted p-2 font-medium text-sm flex items-center">Profile \\ Device</div>
        <div className="bg-muted p-2 font-medium text-sm text-center">Pixel 7 (API 33)</div>
        <div className="bg-muted p-2 font-medium text-sm text-center">Galaxy S23 (API 34)</div>
        <div className="bg-muted p-2 font-medium text-sm text-center">iPhone 15 (iOS 17)</div>

        {/* Demo row 1 */}
        <div className="bg-background p-2 text-sm font-medium flex items-center">Smoke Suite</div>
        <div className="bg-background p-1"><CampaignCell cell={{ status: 'PASS', evidenceRef: 'ev-1', runId: 'run-1' }} /></div>
        <div className="bg-background p-1"><CampaignCell cell={{ status: 'PASS', evidenceRef: 'ev-2', runId: 'run-2' }} /></div>
        <div className="bg-background p-1"><CampaignCell cell={{ status: 'NO_EVIDENCE' }} /></div>

        {/* Demo row 2 */}
        <div className="bg-background p-2 text-sm font-medium flex items-center">Auth Regression</div>
        <div className="bg-background p-1"><CampaignCell cell={{ status: 'FAIL', evidenceRef: 'ev-3', runId: 'run-3' }} /></div>
        <div className="bg-background p-1"><CampaignCell cell={{ status: 'BLOCKED', evidenceRef: 'ev-4', runId: 'run-4' }} /></div>
        <div className="bg-background p-1"><CampaignCell cell={{ status: 'PASS', evidenceRef: 'ev-5', runId: 'run-5' }} /></div>
      </div>
    </div>
  )
}
