import { fetchVerdictTestProfiles } from '@/lib/verdict-runtime/client'
import { PreviewGateWarning } from '@/components/automation/test-profile/PreviewGateWarning'
import { TestProfileKindBadge } from '@/components/automation/test-profile/TestProfileKindBadge'
import { Alert, AlertDescription, AlertTitle } from '@nesy/metronic/components/ui/alert'
import { Badge } from '@nesy/metronic/components/ui/badge'

/**
 * The runtime exposes a profile catalog but no per-profile detail endpoint yet,
 * so the detail view selects its profile from the catalog response. Nothing is
 * synthesised: an unknown id renders as not-found rather than as a placeholder
 * profile.
 */
export default async function TestProfileDetailPage(props: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await props.params

  let catalog
  try {
    catalog = await fetchVerdictTestProfiles()
  } catch {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertTitle>Profile catalog unavailable</AlertTitle>
          <AlertDescription>
            The Verdict runtime did not return the test profile catalog, so
            profile <span className="font-mono">{profileId}</span> cannot be shown.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const profile = catalog.items.find(
    (item) => item.profileKey === profileId,
  ) as
    | {
        profileKey: string
        version?: string
        kind?: string
        releaseGate?: boolean
        owner?: string
        lastResult?: string
        blockedReason?: string | null
      }
    | undefined

  if (!profile) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Alert>
          <AlertTitle>Profile not found</AlertTitle>
          <AlertDescription>
            No profile with key <span className="font-mono">{profileId}</span> exists in the catalog.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const isPreview = profile.releaseGate === false

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{profile.profileKey}</h1>
          {profile.kind && <TestProfileKindBadge kind={profile.kind} />}
          {isPreview && <Badge variant="secondary">PREVIEW</Badge>}
        </div>
        <p className="text-muted-foreground font-mono text-sm mt-1">
          {profile.version ? `v${profile.version}` : 'version not reported'}
        </p>
      </div>

      {isPreview && <PreviewGateWarning releaseGate={profile.releaseGate ?? false} />}

      {profile.blockedReason && (
        <Alert variant="destructive">
          <AlertTitle>Blocked</AlertTitle>
          <AlertDescription>{profile.blockedReason}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="font-semibold border-b pb-2">Configuration</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Release Gate</dt>
              <dd>{profile.releaseGate ? 'Yes' : 'No'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Owner</dt>
              <dd>{profile.owner ?? 'not reported'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Last Result</dt>
              <dd>{profile.lastResult ?? 'NOT_RUN'}</dd>
            </div>
          </dl>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold border-b pb-2">Device Matrix</h3>
          <p className="text-sm text-muted-foreground">
            The catalog response does not carry device constraints; open a campaign to see the executed matrix.
          </p>
        </div>
      </div>
    </div>
  )
}
