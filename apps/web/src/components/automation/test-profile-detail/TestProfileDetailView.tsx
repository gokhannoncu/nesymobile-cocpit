import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { TestProfileDetailHeader } from '@/components/automation/test-profile-detail/TestProfileDetailHeader'
import { cn } from '@nesy/metronic/lib/utils'
import type { TestProfileCatalogItemApi } from '@/lib/verdict-runtime/types'
import type {
  ParsedTestCampaignMembership,
  ParsedTestProfileDefinition,
} from '@/lib/verdict-runtime/test-profile-detail'
import { testCampaignDetailHref } from '@/lib/verdict-runtime/test-campaign-registry'

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

function RefChip({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex max-w-full truncate rounded-[4px] border border-border/70 bg-muted/30 px-2 py-1 font-mono text-[10px] font-medium text-muted-foreground"
    >
      {children}
    </span>
  )
}

function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

function TelemetryGrid({
  telemetry,
}: {
  telemetry: ParsedTestProfileDefinition['telemetry']
}) {
  const items = [
    {
      label: 'Capture artifacts',
      value: telemetry.captureArtifacts ? 'Yes' : 'No',
    },
    {
      label: 'Evidence sample rate',
      value: `Every ${telemetry.evidenceSampleEveryN} event${telemetry.evidenceSampleEveryN === 1 ? '' : 's'}`,
    },
    {
      label: 'Retain raw evidence',
      value: telemetry.retainRawEvidence ? 'Yes' : 'No',
    },
  ]

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-[8px] border border-border/60 bg-muted/15 px-3 py-2.5"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {item.label}
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">{item.value}</p>
        </div>
      ))}
    </div>
  )
}

function CampaignMembershipTable({
  campaigns,
}: {
  campaigns: ParsedTestCampaignMembership[]
}) {
  if (campaigns.length === 0) {
    return <EmptyHint>This profile is not referenced by any declared campaign in the pack.</EmptyHint>
  }

  return (
    <div className="overflow-x-auto rounded-[8px] border border-border">
      <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr className="bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <th className={thClass}>Campaign</th>
            <th className={cn('hidden sm:table-cell', thClass)}>Failure policy</th>
            <th className={cn('w-24', thClass)}>Gate</th>
            <th className={cn('w-20 text-right', thClass)}>Order</th>
            <th className={cn('w-16 text-right', thClass)}>Open</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <tr key={campaign.campaignKey} className="bg-card">
              <td className={tdClass}>
                <p className="font-semibold text-foreground">{campaign.displayName}</p>
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                  {campaign.campaignKey}
                </p>
              </td>
              <td className={cn('hidden sm:table-cell', tdClass)}>
                <span className="text-foreground">{campaign.onProfileFailure.replace(/_/g, ' ')}</span>
              </td>
              <td className={tdClass}>
                <span className="text-foreground">{campaign.releaseGate ? 'Yes' : 'No'}</span>
              </td>
              <td className={cn('tabular-nums text-muted-foreground', tdClass)}>
                {campaign.profileIndex + 1}/{campaign.profileCount}
              </td>
              <td className={tdClass}>
                <div className="flex justify-end">
                  {campaign.campaignId ? (
                    <Link
                      href={testCampaignDetailHref(campaign.campaignId)}
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

function FaultPlanSection({
  faultPlan,
}: {
  faultPlan: NonNullable<ParsedTestProfileDefinition['faultPlan']>
}) {
  return (
    <DetailSection
      title="Fault plan"
      description={`Expect recovery: ${faultPlan.expectRecovery ? 'yes' : 'no'} · ${faultPlan.injections.length} injection${faultPlan.injections.length === 1 ? '' : 's'}`}
    >
      <div className="overflow-x-auto rounded-[8px] border border-border">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className={thClass}>Fault</th>
              <th className={cn('w-28', thClass)}>Kind</th>
              <th className={thClass}>Trigger</th>
              <th className={cn('hidden lg:table-cell', thClass)}>Correlation fact</th>
              <th className={cn('hidden lg:table-cell', thClass)}>Recovery fact</th>
            </tr>
          </thead>
          <tbody>
            {faultPlan.injections.map((injection) => (
              <tr key={`${injection.faultRef}-${injection.triggerRef}`} className="bg-card">
                <td className={tdClass}>
                  <RefChip title={injection.faultRef}>{injection.faultRef}</RefChip>
                </td>
                <td className={tdClass}>
                  <span className="font-semibold uppercase text-foreground">{injection.kind}</span>
                </td>
                <td className={tdClass}>
                  <RefChip title={injection.triggerRef}>{injection.triggerRef}</RefChip>
                </td>
                <td className={cn('hidden lg:table-cell', tdClass)}>
                  {injection.correlationFactKey ? (
                    <RefChip>{injection.correlationFactKey}</RefChip>
                  ) : (
                    '—'
                  )}
                </td>
                <td className={cn('hidden lg:table-cell', tdClass)}>
                  {injection.expectedRecoveryFactKey ? (
                    <RefChip>{injection.expectedRecoveryFactKey}</RefChip>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DetailSection>
  )
}

export function TestProfileDetailView({
  catalogItem,
  definition,
  launchProfileLabel,
  campaigns,
}: {
  catalogItem: TestProfileCatalogItemApi
  definition: ParsedTestProfileDefinition | null
  launchProfileLabel: string
  campaigns: ParsedTestCampaignMembership[]
}) {
  const displayName = definition?.displayName ?? catalogItem.profileKey
  const workflowRefs = definition?.includedWorkflowRefs ?? []
  const capabilityRefs = definition?.requiredCapabilityRefs ?? []
  const faultCount = definition?.faultPlan?.injections.length ?? 0

  return (
    <div className="space-y-5">
      <TestProfileDetailHeader
        profileKey={catalogItem.profileKey}
        displayName={displayName}
        catalogKind={catalogItem.kind}
        contractKind={definition?.kind ?? catalogItem.kind}
        packKey={catalogItem.packKey}
        packVersion={catalogItem.packVersion}
        owner={catalogItem.owner}
        lastResult={catalogItem.lastResult}
        blockedReason={catalogItem.blockedReason ?? null}
        releaseGate={definition?.releaseGate ?? catalogItem.releaseGate}
        launchProfileRef={definition?.launchProfileRef ?? '—'}
        launchProfileLabel={launchProfileLabel}
        workflowCount={workflowRefs.length}
        capabilityCount={capabilityRefs.length}
        faultCount={faultCount}
        campaignCount={campaigns.length}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <DetailSection
          title="Workflow scope"
          description="Macros and journeys executed when this profile runs."
        >
          {workflowRefs.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {workflowRefs.map((workflowRef) => (
                <RefChip key={workflowRef} title={workflowRef}>
                  {workflowRef}
                </RefChip>
              ))}
            </div>
          ) : (
            <EmptyHint>
              {definition
                ? 'The pack contract does not list any workflow refs for this profile.'
                : 'Pack contract unavailable — only runtime catalog metadata is shown.'}
            </EmptyHint>
          )}
        </DetailSection>

        <DetailSection
          title="Required capabilities"
          description="Capability contracts that must be available for the profile to execute."
        >
          {capabilityRefs.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {capabilityRefs.map((capabilityRef) => (
                <RefChip key={capabilityRef} title={capabilityRef}>
                  {capabilityRef}
                </RefChip>
              ))}
            </div>
          ) : (
            <EmptyHint>No required capabilities declared in the pack contract.</EmptyHint>
          )}
        </DetailSection>
      </div>

      <DetailSection
        title="Telemetry policy"
        description="Evidence capture and sampling rules applied during execution."
      >
        {definition ? (
          <TelemetryGrid telemetry={definition.telemetry} />
        ) : (
          <EmptyHint>Telemetry policy is only available from the published pack contract.</EmptyHint>
        )}
      </DetailSection>

      {definition?.faultPlan && definition.faultPlan.injections.length > 0 ? (
        <FaultPlanSection faultPlan={definition.faultPlan} />
      ) : null}

      {definition?.differential ? (
        <DetailSection
          title="Differential policy"
          description="Baseline comparison rules for regression against a prior build."
        >
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Baseline build
                </p>
                <p className="mt-1 font-mono text-xs text-foreground">
                  {definition.differential.baselineBuildRef}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  On critical diff
                </p>
                <p className="mt-1 text-foreground">
                  {definition.differential.onCriticalDiff.replace(/_/g, ' ')}
                </p>
              </div>
            </div>
            {definition.differential.criticalFactKeys.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {definition.differential.criticalFactKeys.map((factKey) => (
                  <RefChip key={factKey}>{factKey}</RefChip>
                ))}
              </div>
            ) : null}
          </div>
        </DetailSection>
      ) : null}

      {definition && definition.performanceBudgetRefs.length > 0 ? (
        <DetailSection title="Performance budgets" description="Latency budgets enforced during the run.">
          <div className="overflow-x-auto rounded-[8px] border border-border">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className={thClass}>Budget</th>
                  <th className={thClass}>Applies to</th>
                </tr>
              </thead>
              <tbody>
                {definition.performanceBudgetRefs.map((budget) => (
                  <tr key={`${budget.budgetRef}-${budget.appliesToRef}`} className="bg-card">
                    <td className={tdClass}>
                      <RefChip>{budget.budgetRef}</RefChip>
                    </td>
                    <td className={tdClass}>
                      <RefChip>{budget.appliesToRef}</RefChip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DetailSection>
      ) : null}

      <DetailSection
        title="Campaign membership"
        description="Ordered campaigns in the domain pack that include this profile."
      >
        <CampaignMembershipTable campaigns={campaigns} />
      </DetailSection>

      {definition ? (
        <DetailSection
          title="Contract anchors"
          description="Immutable references from the published profile definition."
        >
          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              { label: 'Application ref', value: definition.applicationRef },
              { label: 'Launch profile ref', value: definition.launchProfileRef },
              { label: 'Contract version', value: `v${definition.version}` },
              { label: 'Catalog version', value: `v${catalogItem.version}` },
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
