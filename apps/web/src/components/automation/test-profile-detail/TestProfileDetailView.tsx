'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  Camera,
  ChevronRight,
  Database,
  ShieldAlert,
} from 'lucide-react'
import { TestProfileDetailHeader } from '@/components/automation/test-profile-detail/TestProfileDetailHeader'
import { SegmentTabs } from '@/components/product/segment-tabs'
import { StatCard, StatGrid } from '@/components/product/stats'
import { cn } from '@nesy/metronic/lib/utils'
import type { TestProfileCatalogItemApi } from '@/lib/verdict-runtime/types'
import type {
  ParsedTestCampaignMembership,
  ParsedTestProfileDefinition,
} from '@/lib/verdict-runtime/test-profile-detail'
import { testCampaignDetailHref } from '@/lib/verdict-runtime/test-campaign-registry'

const cellGrid = 'border-b border-r border-border last:border-r-0'
const thClass = cn('px-2.5 py-1.5 text-left', cellGrid)
const tdClass = cn('px-2.5 py-1.5 align-middle', cellGrid)

function WorkflowRefChip({ refKey }: { refKey: string }) {
  return (
    <span
      title={refKey}
      className="inline-flex max-w-full truncate rounded-md border border-indigo-200/80 bg-indigo-50/70 px-2 py-1 font-mono text-[10px] font-medium text-indigo-800 ring-1 ring-inset ring-indigo-200/50 dark:border-indigo-800/50 dark:bg-indigo-950/30 dark:text-indigo-200"
    >
      {refKey}
    </span>
  )
}

function CapabilityRefChip({ refKey }: { refKey: string }) {
  return (
    <span
      title={refKey}
      className="inline-flex max-w-full truncate rounded-md border border-violet-200/80 bg-violet-50/70 px-2 py-1 font-mono text-[10px] font-medium text-violet-800 ring-1 ring-inset ring-violet-200/50 dark:border-violet-800/50 dark:bg-violet-950/30 dark:text-violet-200"
    >
      {refKey}
    </span>
  )
}

function RefChip({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex max-w-full truncate rounded-md border border-border/70 bg-muted/30 px-2 py-1 font-mono text-[10px] font-medium text-muted-foreground"
    >
      {children}
    </span>
  )
}

function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-border/80 bg-muted/15 px-3 py-4 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}

function SectionPanel({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-2', className)}>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  )
}

function TelemetryPanel({
  telemetry,
}: {
  telemetry: ParsedTestProfileDefinition['telemetry']
}) {
  return (
    <StatGrid cols={3} dense>
      <StatCard
        variant="compact"
        icon={Camera}
        label="Artifacts"
        value={telemetry.captureArtifacts ? 'On' : 'Off'}
        hint="Capture diagnostic artifacts during run"
        tone={telemetry.captureArtifacts ? 'green' : 'gray'}
      />
      <StatCard
        variant="compact"
        icon={Database}
        label="Sample rate"
        value={`1 / ${telemetry.evidenceSampleEveryN}`}
        hint="Evidence sampling frequency"
        tone="blue"
      />
      <StatCard
        variant="compact"
        icon={ShieldAlert}
        label="Raw evidence"
        value={telemetry.retainRawEvidence ? 'Retain' : 'Drop'}
        hint="Whether raw evidence is retained"
        tone={telemetry.retainRawEvidence ? 'teal' : 'gray'}
      />
    </StatGrid>
  )
}

function CampaignMembershipTable({
  campaigns,
}: {
  campaigns: ParsedTestCampaignMembership[]
}) {
  if (campaigns.length === 0) {
    return (
      <EmptyHint>
        This profile is not referenced by any declared campaign in the pack.
      </EmptyHint>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr className="bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <th className={thClass}>Campaign</th>
            <th className={cn('hidden sm:table-cell', thClass)}>On failure</th>
            <th className={cn('w-24', thClass)}>Gate</th>
            <th className={cn('w-20 text-right', thClass)}>Order</th>
            <th className={cn('w-16 text-right', thClass)}>Open</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign, index) => (
            <tr
              key={campaign.campaignKey}
              className={cn(
                'transition-colors',
                index % 2 === 1 ? 'bg-muted/35' : 'bg-card',
              )}
            >
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
                <span
                  className={cn(
                    'inline-flex rounded-[4px] px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ring-1 ring-inset',
                    campaign.releaseGate
                      ? 'bg-sky-50 text-sky-700 ring-sky-200/80'
                      : 'bg-slate-100 text-slate-500 ring-slate-200/80',
                  )}
                >
                  {campaign.releaseGate ? 'Yes' : 'No'}
                </span>
              </td>
              <td className={cn('tabular-nums text-muted-foreground', tdClass)}>
                {campaign.profileIndex + 1}/{campaign.profileCount}
              </td>
              <td className={tdClass}>
                <div className="flex justify-end">
                  {campaign.campaignId ? (
                    <Link
                      href={testCampaignDetailHref(campaign.campaignId)}
                      className="inline-flex items-center gap-0.5 rounded-md py-0.5 text-[11px] font-semibold text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
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

function FaultPlanPanel({
  faultPlan,
}: {
  faultPlan: NonNullable<ParsedTestProfileDefinition['faultPlan']>
}) {
  return (
    <SectionPanel title={`Fault plan · ${faultPlan.injections.length} injection${faultPlan.injections.length === 1 ? '' : 's'}`}>
      <p className="text-xs text-muted-foreground">
        Expect recovery:{' '}
        <span className="font-semibold text-foreground">{faultPlan.expectRecovery ? 'Yes' : 'No'}</span>
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className={thClass}>Fault</th>
              <th className={cn('w-28', thClass)}>Kind</th>
              <th className={thClass}>Trigger</th>
              <th className={cn('hidden lg:table-cell', thClass)}>Correlation</th>
              <th className={cn('hidden lg:table-cell', thClass)}>Recovery</th>
            </tr>
          </thead>
          <tbody>
            {faultPlan.injections.map((injection, index) => (
              <tr
                key={`${injection.faultRef}-${injection.triggerRef}`}
                className={index % 2 === 1 ? 'bg-muted/35' : 'bg-card'}
              >
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
    </SectionPanel>
  )
}

function ScopeTab({
  definition,
  workflowRefs,
  capabilityRefs,
}: {
  definition: ParsedTestProfileDefinition | null
  workflowRefs: string[]
  capabilityRefs: string[]
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <SectionPanel title="Workflow scope">
        {workflowRefs.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {workflowRefs.map((workflowRef) => (
              <WorkflowRefChip key={workflowRef} refKey={workflowRef} />
            ))}
          </div>
        ) : (
          <EmptyHint>
            {definition
              ? 'No workflow refs declared in the pack contract.'
              : 'Pack contract unavailable — only runtime catalog metadata is shown.'}
          </EmptyHint>
        )}
      </SectionPanel>

      <SectionPanel title="Required capabilities">
        {capabilityRefs.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {capabilityRefs.map((capabilityRef) => (
              <CapabilityRefChip key={capabilityRef} refKey={capabilityRef} />
            ))}
          </div>
        ) : (
          <EmptyHint>No required capabilities declared in the pack contract.</EmptyHint>
        )}
      </SectionPanel>
    </div>
  )
}

function PolicyTab({
  definition,
  catalogItem,
}: {
  definition: ParsedTestProfileDefinition | null
  catalogItem: TestProfileCatalogItemApi
}) {
  if (!definition) {
    return (
      <EmptyHint>
        Execution policy details are only available from the published pack contract.
      </EmptyHint>
    )
  }

  return (
    <div className="space-y-5">
      <SectionPanel title="Telemetry">
        <TelemetryPanel telemetry={definition.telemetry} />
      </SectionPanel>

      {definition.performanceBudgetRefs.length > 0 ? (
        <SectionPanel title="Performance budgets">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className={thClass}>Budget</th>
                  <th className={thClass}>Applies to</th>
                </tr>
              </thead>
              <tbody>
                {definition.performanceBudgetRefs.map((budget, index) => (
                  <tr
                    key={`${budget.budgetRef}-${budget.appliesToRef}`}
                    className={index % 2 === 1 ? 'bg-muted/35' : 'bg-card'}
                  >
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
        </SectionPanel>
      ) : null}

      {definition.differential ? (
        <SectionPanel title="Differential policy">
          <div className="rounded-lg border border-violet-200/70 bg-violet-50/40 p-3 dark:border-violet-900/50 dark:bg-violet-950/20">
            <div className="grid gap-3 sm:grid-cols-2">
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
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {definition.differential.onCriticalDiff.replace(/_/g, ' ')}
                </p>
              </div>
            </div>
            {definition.differential.criticalFactKeys.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {definition.differential.criticalFactKeys.map((factKey) => (
                  <RefChip key={factKey}>{factKey}</RefChip>
                ))}
              </div>
            ) : null}
          </div>
        </SectionPanel>
      ) : null}

      {definition.faultPlan && definition.faultPlan.injections.length > 0 ? (
        <FaultPlanPanel faultPlan={definition.faultPlan} />
      ) : null}

      <SectionPanel title="Contract anchors">
        <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Application', value: definition.applicationRef },
            { label: 'Launch profile', value: definition.launchProfileRef },
            { label: 'Contract version', value: `v${definition.version}` },
            { label: 'Catalog version', value: `v${catalogItem.version}` },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-border/60 bg-muted/15 px-3 py-2"
            >
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {item.label}
              </dt>
              <dd className="mt-1 truncate font-mono text-xs text-foreground" title={item.value}>
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </SectionPanel>
    </div>
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

  const policyCount =
    (definition ? 1 : 0) +
    (definition?.performanceBudgetRefs.length ?? 0) +
    (definition?.differential ? 1 : 0) +
    faultCount

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

      <SegmentTabs
        appearance="pill"
        defaultValue="scope"
        items={[
          {
            value: 'scope',
            label: 'Scope',
            count: workflowRefs.length + capabilityRefs.length,
            content: (
              <ScopeTab
                definition={definition}
                workflowRefs={workflowRefs}
                capabilityRefs={capabilityRefs}
              />
            ),
          },
          {
            value: 'policy',
            label: 'Policy',
            count: policyCount,
            content: <PolicyTab definition={definition} catalogItem={catalogItem} />,
          },
          {
            value: 'campaigns',
            label: 'Campaigns',
            count: campaigns.length,
            content: (
              <SectionPanel title="Campaign membership">
                <CampaignMembershipTable campaigns={campaigns} />
              </SectionPanel>
            ),
          },
        ]}
      />
    </div>
  )
}
