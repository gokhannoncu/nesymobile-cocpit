import { PreviewGateWarning } from '@/components/automation/test-profile/PreviewGateWarning'
import { TestProfileKindBadge } from '@/components/automation/test-profile/TestProfileKindBadge'
import { Badge } from '@nesy/metronic/components/ui/badge'

export default async function TestProfileDetailPage(props: { params: Promise<{ profileId: string }> }) {
  const params = await props.params;
  const { profileId } = params;
  
  const profile = {
    key: profileId,
    displayName: 'Example Profile',
    kind: 'REGRESSION',
    preview: true,
    releaseGate: true,
    owner: 'Platform Team',
    blockedReason: null
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{profile.displayName}</h1>
          <TestProfileKindBadge kind={profile.kind} />
          {profile.preview && <Badge variant="secondary">PREVIEW</Badge>}
        </div>
        <p className="text-muted-foreground font-mono text-sm mt-1">{profile.key}</p>
      </div>

      {profile.preview && <PreviewGateWarning releaseGate={profile.releaseGate} />}

      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="font-semibold border-b pb-2">Configuration</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Release Gate</dt><dd>{profile.releaseGate ? 'Yes' : 'No'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Owner</dt><dd>{profile.owner}</dd></div>
          </dl>
        </div>
        
        <div className="space-y-4">
          <h3 className="font-semibold border-b pb-2">Device Matrix</h3>
          <p className="text-sm text-muted-foreground">No explicit constraints defined.</p>
        </div>
      </div>
    </div>
  )
}
