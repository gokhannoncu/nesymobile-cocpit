import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight, ShieldAlert, ShieldCheck } from 'lucide-react'
import { CampaignMatrix } from '@/components/automation/test-campaign/CampaignMatrix'
import { TestCampaignDetailHeader } from '@/components/automation/test-campaign-detail/TestCampaignDetailHeader'
import { TestProfileKindBadge } from '@/components/automation/test-profile/TestProfileKindBadge'
import { cn } from '@nesy/metronic/lib/utils'
import type { TestCampaignCatalogItemApi } from '@/lib/verdict-runtime/types'
import type {
  CampaignCellStats,
  ParsedCampaignCell,
  ParsedTestCampaignDefinition,
  ProfileSequenceRow,
} from '@/lib/verdict-runtime/test-campaign-detail'
import { campaignFailurePolicyLabel } from '@/lib/verdict-runtime/test-campaign-detail'
import { campaignCellResultTone } from '@/lib/verdict-runtime/test-campaign-registry'
import { testProfileDetailHref } from '@/lib/verdict-runtime/test-profile-registry'
import { toneIconBox, toneText } from '@/components/product/tones'

const cellGrid = 'border-b border-r border-border last:border-r-0'
const thClass = cn('px-2.5 py-2 text-left', cellGrid)
const tdClass = cn('px-2.5 py-2 align-middle', cellGrid)

function DetailSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <article className="overflow-hidden rounded-[8px] border border-border bg-card">
      <div className="border-b border-border bg-muted/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </article>
  )
}

function ResultStatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'teal' | 'red' | 'orange' | 'gray' | 'amber'
}) {
  return (
    <div className={cn('rounded-[8px] border px-3 py-3', toneIconBox[tone])}>
      <p className={cn('text-[10px] font-semibold uppercase tracking-wide', toneText[tone])}>
        {label}
      </p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums', toneText[tone])}>{value}</p>
    </div>
  )
}

function ReleaseGateBanner({
  releaseGateResult,
  contractReleaseGate,
  failedCells,
  partial,
}: {
  releaseGateResult: string
  contractReleaseGate: boolean
  failedCells: string[]
  partial: boolean
}) {
  const blocked =
    failedCells.length > 0 ||
    releaseGateResult === 'FAIL' ||
    (contractReleaseGate && releaseGateResult !== 'PASS' && !partial && failedCells.length > 0)

  const approved = releaseGateResult === 'PASS' && failedCells.length === 0
  const unevaluated = releaseGateResult === 'NOT_EVALUATED' || partial

  const tone = approved ? 'teal' : blocked ? 'red' : unevaluated ? 'gray' : 'amber'
  const Icon = approved ? ShieldCheck : ShieldAlert
  const headline = approved
    ? 'Release gate approved'
    : blocked
      ? 'Release gate blocked'
      : unevaluated
        ? 'Release gate not evaluated'
        : 'Release gate pending'

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-[8px] border px-4 py-3',
        toneIconBox[tone],
      )}
    >
      <Icon className={cn('mt-0.5 size-5 shrink-0', toneText[tone])} />
      <div className="min-w-0">
        <h3 className={cn('text-sm font-semibold', toneText[tone])}>{headline}</h3>
        <p className={cn('mt-0.5 text-xs leading-relaxed', toneText[tone], 'opacity-90')}>
          {approved
            ? 'All required cells passed release-gate policies.'
            : blocked
              ? `${failedCells.length} cell${failedCells.length === 1 ? '' : 's'} failed required policies.`
              : partial
                ? 'Some cells are still awaiting run evidence — verdict is withheld until summaries arrive.'
                : contractReleaseGate
                  ? 'This campaign is configured as a release gate; evaluation completes when all cells have evidence.'
                  : 'This campaign does not block release, but cell results are tracked for operator visibility.'}
        </p>
        {failedCells.length > 0 ? (
          <p className={cn('mt-2 font-mono text-[10px]', toneText[tone], 'opacity-80')}>
            Failed: {failedCells.join(', ')}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function CellResultBadge({ result }: { result: string }) {
  const tone = campaignCellResultTone(result)
  return (
    <span
      className={cn(
        'inline-flex rounded-[4px] border border-current/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide',
        toneIconBox[tone],
        toneText[tone],
      )}
    >
      {result.replace(/_/g, ' ')}
    </span>
  )
}

function ProfileSequenceTable({ rows }: { rows: ProfileSequenceRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No profile sequence declared — cells will appear as they are scheduled.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-[8px] border border-border">
      <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr className="bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <th className={thClass}>Order</th>
            <th className={thClass}>Profile</th>
            <th className={cn('hidden sm:table-cell', thClass)}>Kind</th>
            <th className={cn('hidden md:table-cell', thClass)}>Version</th>
            <th className={thClass}>Cells</th>
            <th className={thClass}>Results</th>
            <th className={cn('w-16 text-right', thClass)}>Open</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.profileKey} className="bg-card">
              <td className={cn('tabular-nums text-muted-foreground', tdClass)}>
                {row.index + 1}
              </td>
              <td className={tdClass}>
                <p className="font-mono font-semibold text-foreground">{row.profileKey}</p>
              </td>
              <td className={cn('hidden sm:table-cell', tdClass)}>
                {row.catalogKind ? <TestProfileKindBadge kind={row.catalogKind} /> : '—'}
              </td>
              <td className={cn('hidden md:table-cell tabular-nums text-muted-foreground', tdClass)}>
                {row.profileVersion !== null ? `v${row.profileVersion}` : '—'}
              </td>
              <td className={cn('tabular-nums', tdClass)}>{row.cellCount}</td>
              <td className={tdClass}>
                <div className="flex flex-wrap gap-1">
                  {row.passCount > 0 ? (
                    <span className="text-[10px] font-semibold text-teal-700 dark:text-teal-300">
                      {row.passCount} pass
                    </span>
                  ) : null}
                  {row.failCount > 0 ? (
                    <span className="text-[10px] font-semibold text-red-700 dark:text-red-300">
                      {row.failCount} fail
                    </span>
                  ) : null}
                  {row.blockedCount > 0 ? (
                    <span className="text-[10px] font-semibold text-orange-700 dark:text-orange-300">
                      {row.blockedCount} blocked
                    </span>
                  ) : null}
                  {row.pendingCount > 0 ? (
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {row.pendingCount} pending
                    </span>
                  ) : null}
                  {row.cellCount === 0 ? (
                    <span className="text-[10px] text-muted-foreground">not scheduled</span>
                  ) : null}
                </div>
              </td>
              <td className={tdClass}>
                <div className="flex justify-end">
                  <Link
                    href={testProfileDetailHref(row.profileKey)}
                    className="inline-flex items-center gap-0.5 rounded-[8px] py-0.5 text-[11px] font-semibold text-nesy-ink transition hover:bg-nesy-soft/40"
                  >
                    Open
                    <ChevronRight className="size-3 shrink-0" />
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CellsTable({ cells }: { cells: ParsedCampaignCell[] }) {
  if (cells.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No execution cells yet — start the campaign from the run planner.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-[8px] border border-border">
      <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr className="bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <th className={thClass}>Cell</th>
            <th className={thClass}>Profile</th>
            <th className={cn('hidden sm:table-cell', thClass)}>Device</th>
            <th className={thClass}>Result</th>
            <th className={cn('hidden lg:table-cell', thClass)}>Blocked reason</th>
            <th className={cn('hidden md:table-cell', thClass)}>Runs</th>
            <th className={cn('w-16 text-right', thClass)}>Run</th>
          </tr>
        </thead>
        <tbody>
          {cells.map((cell) => (
            <tr key={cell.cellKey} className="bg-card">
              <td className={cn('font-mono text-[10px] text-muted-foreground', tdClass)}>
                {cell.cellKey}
              </td>
              <td className={tdClass}>
                <Link
                  href={testProfileDetailHref(cell.profileKey)}
                  className="font-mono font-semibold text-nesy-ink hover:underline"
                >
                  {cell.profileKey}
                </Link>
                <p className="mt-0.5 text-[10px] text-muted-foreground">v{cell.profileVersion}</p>
              </td>
              <td className={cn('hidden sm:table-cell font-mono text-[10px]', tdClass)}>
                {cell.deviceCell}
              </td>
              <td className={tdClass}>
                <CellResultBadge result={cell.result} />
              </td>
              <td className={cn('hidden lg:table-cell max-w-xs truncate text-muted-foreground', tdClass)}>
                {cell.blockedReason ?? '—'}
              </td>
              <td className={cn('hidden md:table-cell tabular-nums text-muted-foreground', tdClass)}>
                {cell.runIds.length}
              </td>
              <td className={tdClass}>
                <div className="flex justify-end">
                  {cell.runDetailPath ? (
                    <Link
                      href={cell.runDetailPath}
                      className="inline-flex items-center gap-0.5 rounded-[8px] py-0.5 text-[11px] font-semibold text-nesy-ink transition hover:bg-nesy-soft/40"
                    >
                      Open
                      <ChevronRight className="size-3 shrink-0" />
                    </Link>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function TestCampaignDetailView({
  campaign,
  catalogItem,
  definition,
  packKey,
  packVersion,
  cells,
  stats,
  profileSequence,
}: {
  campaign: {
    campaignId: string
    campaignKey: string
    campaignVersion: number
    status: string
    releaseGateResult: string
    failedCells: string[]
    partial: boolean
  }
  catalogItem: TestCampaignCatalogItemApi | null
  definition: ParsedTestCampaignDefinition | null
  packKey: string | null
  packVersion: string | null
  cells: ParsedCampaignCell[]
  stats: CampaignCellStats
  profileSequence: ProfileSequenceRow[]
}) {
  const displayName = definition?.displayName ?? catalogItem?.campaignKey ?? campaign.campaignKey
  const campaignKey = campaign.campaignKey || catalogItem?.campaignKey || 'UNKNOWN'
  const campaignVersion = campaign.campaignVersion ?? catalogItem?.campaignVersion ?? 1
  const status = campaign.status || catalogItem?.status || 'UNKNOWN'
  const releaseGateResult =
    campaign.releaseGateResult || catalogItem?.releaseGateResult || 'NOT_EVALUATED'

  return (
    <div className="space-y-5">
      <TestCampaignDetailHeader
        campaignId={campaign.campaignId}
        campaignKey={campaignKey}
        campaignVersion={typeof campaignVersion === 'number' ? campaignVersion : Number(campaignVersion)}
        displayName={displayName}
        status={status}
        releaseGateResult={releaseGateResult}
        contractReleaseGate={definition?.releaseGate ?? false}
        onProfileFailure={definition?.onProfileFailure ?? null}
        packKey={packKey}
        packVersion={packVersion}
        stats={stats}
        partial={campaign.partial}
      />

      <ReleaseGateBanner
        releaseGateResult={releaseGateResult}
        contractReleaseGate={definition?.releaseGate ?? false}
        failedCells={campaign.failedCells}
        partial={campaign.partial}
      />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <ResultStatCard label="Pass" value={stats.pass} tone="teal" />
        <ResultStatCard label="Fail" value={stats.fail} tone="red" />
        <ResultStatCard label="Blocked" value={stats.blocked} tone="orange" />
        <ResultStatCard label="Pending" value={stats.pending} tone="gray" />
        <ResultStatCard label="Partial" value={stats.partial} tone="amber" />
      </div>

      <DetailSection
        title="Profile sequence"
        description="Ordered profiles from the pack contract — each row aggregates matrix cells for that profile."
      >
        <ProfileSequenceTable rows={profileSequence} />
      </DetailSection>

      <DetailSection
        title="Execution matrix"
        description="Profile × device grid — click a cell with evidence to open the backing run."
      >
        <CampaignMatrix cells={cells} />
      </DetailSection>

      <DetailSection
        title="Cell inventory"
        description="Flat list of all scheduled cells with result, device, and run links."
      >
        <CellsTable cells={cells} />
      </DetailSection>

      {definition ? (
        <DetailSection
          title="Contract anchors"
          description="Immutable references from the published campaign definition."
        >
          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              { label: 'Campaign key', value: definition.campaignKey },
              { label: 'Contract version', value: `v${definition.version}` },
              {
                label: 'Failure policy',
                value: campaignFailurePolicyLabel(definition.onProfileFailure),
              },
              { label: 'Release gate', value: definition.releaseGate ? 'Yes' : 'No' },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[8px] border border-border/60 bg-muted/15 px-3 py-2.5"
              >
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </dt>
                <dd className="mt-1 font-mono text-xs text-foreground">{item.value}</dd>
              </div>
            ))}
          </dl>
        </DetailSection>
      ) : null}
    </div>
  )
}
