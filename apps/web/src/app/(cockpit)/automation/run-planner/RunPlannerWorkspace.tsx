'use client'

import { Fragment, useMemo, useState, useTransition, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Layers,
  Package,
  Play,
  Search,
  Smartphone,
  Workflow,
  XCircle,
} from 'lucide-react'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { Input } from '@nesy/metronic/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nesy/metronic/components/ui/select'
import { cn } from '@nesy/metronic/lib/utils'
import { startVerdictTestCampaign } from '@/lib/verdict-runtime/client'
import {
  packIdentity,
  parsePackIdentity,
  selectPinnedPublishedPack,
} from '@/lib/verdict-runtime/select-published-pack'
import type {
  DomainPackCatalogApi,
  RunHistoryResult,
  TestProfileCatalogApi,
  WorkflowCatalogApi,
} from '@/lib/verdict-runtime/types'

export function RunPlannerWorkspace({
  workflows,
  packs,
  profiles,
  runs,
  catalogBlocked,
}: {
  workflows: WorkflowCatalogApi
  packs: DomainPackCatalogApi
  profiles: TestProfileCatalogApi
  runs: RunHistoryResult
  catalogBlocked: string[]
}) {
  const publishedPacks = useMemo(
    () =>
      packs.items
        .filter((pack) => pack.publicationState === 'PUBLISHED')
        .slice()
        .sort((left, right) => {
          const readyDelta = Number(Boolean(right.compileReady)) - Number(Boolean(left.compileReady))
          if (readyDelta !== 0) return readyDelta
          return packIdentity(left).localeCompare(packIdentity(right))
        }),
    [packs.items],
  )
  const defaultPack = selectPinnedPublishedPack(publishedPacks)
  const [workflowId, setWorkflowId] = useState(workflows.items[0]?.id ?? '')
  const [packIdentityValue, setPackIdentityValue] = useState(
    defaultPack ? packIdentity(defaultPack) : '',
  )
  const [profileKey, setProfileKey] = useState(profiles.items[0]?.profileKey ?? '')
  const [deviceId, setDeviceId] = useState('lab-device-1')
  const [impact, setImpact] = useState('delivery')
  const [result, setResult] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedWorkflow = workflows.items.find((workflow) => workflow.id === workflowId)
  const selectedPackIdentity = parsePackIdentity(packIdentityValue)
  const selectedPack = publishedPacks.find(
    (pack) =>
      selectedPackIdentity !== null &&
      pack.packKey === selectedPackIdentity.packKey &&
      pack.version === selectedPackIdentity.version,
  )
  const selectedProfile = profiles.items.find((profile) => profile.profileKey === profileKey)
  const activeDeviceRuns = runs.items.filter(
    (run) =>
      String(run.run.deviceId ?? '') === deviceId &&
      ['queued', 'pending', 'running'].includes(String(run.run.status ?? '').toLowerCase()),
  )
  const impactedWorkflows = useMemo(() => {
    const term = impact.trim().toLowerCase()
    if (!term) return workflows.items.slice(0, 5)
    const matches = workflows.items.filter((workflow) =>
      [workflow.name, workflow.description ?? '', workflow.category ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
    return matches.length > 0 ? matches.slice(0, 6) : workflows.items.slice(0, 5)
  }, [impact, workflows.items])

  const selectionBlocked = [
    selectedWorkflow === undefined ? 'Select a workflow.' : null,
    selectedPack === undefined ? 'Select a published Domain Pack version.' : null,
    selectedProfile === undefined ? 'Select a test profile.' : null,
    activeDeviceRuns.length > 0
      ? `Device "${deviceId}" already has ${activeDeviceRuns.length} active run(s).`
      : null,
  ].filter((item): item is string => item !== null)

  const allBlocked = [...catalogBlocked, ...selectionBlocked]
  const canLaunch = allBlocked.length === 0

  const preflightChecks = [
    {
      label: 'Workflow catalog loaded',
      detail: selectedWorkflow?.name ?? 'Pick a workflow to test',
      ok: selectedWorkflow !== undefined,
    },
    {
      label: 'Domain Pack pinned',
      detail: selectedPack ? packIdentity(selectedPack) : 'Only published versions can be pinned',
      ok: selectedPack !== undefined,
    },
    {
      label: 'Test profile selected',
      detail: selectedProfile
        ? `${selectedProfile.profileKey} v${selectedProfile.version}`
        : 'Profile defines scope and release gate',
      ok: selectedProfile !== undefined,
    },
    {
      label: 'Device available',
      detail:
        activeDeviceRuns.length > 0
          ? `${activeDeviceRuns.length} active run(s) on this device`
          : `Resource "${deviceId}" is free`,
      ok: activeDeviceRuns.length === 0,
    },
    {
      label: 'Catalog readiness',
      detail:
        catalogBlocked.length === 0
          ? 'Manifest preview can be produced'
          : catalogBlocked[0] ?? 'Catalog incomplete',
      ok: catalogBlocked.length === 0,
    },
  ]

  const planSteps = [
    {
      label: 'Workflow',
      value: selectedWorkflow?.name ?? 'Not selected',
      hint: selectedWorkflow?.category ?? selectedWorkflow?.slug,
      icon: Workflow,
      ready: selectedWorkflow !== undefined,
    },
    {
      label: 'Domain Pack',
      value: selectedPack ? packIdentity(selectedPack) : 'Not selected',
      hint: selectedPack?.compileReady ? 'Compile-ready' : 'Catalog reference only',
      icon: Package,
      ready: selectedPack !== undefined,
    },
    {
      label: 'Profile',
      value: selectedProfile?.profileKey ?? 'Not selected',
      hint: selectedProfile
        ? `v${selectedProfile.version}${selectedProfile.releaseGate ? ' · release gate' : ''}`
        : undefined,
      icon: Layers,
      ready: selectedProfile !== undefined,
    },
    {
      label: 'Device',
      value: deviceId || 'Not set',
      hint: activeDeviceRuns.length > 0 ? 'Conflict detected' : 'Exclusive lease for this cell',
      icon: Smartphone,
      ready: deviceId.trim().length > 0 && activeDeviceRuns.length === 0,
    },
    {
      label: 'Campaign cell',
      value: canLaunch ? 'Ready to freeze & launch' : 'Waiting on blockers',
      hint: selectedProfile?.releaseGate ? 'Release summary included' : 'Diagnostic run',
      icon: CircleDot,
      ready: canLaunch,
    },
  ]

  const startCampaign = () => {
    if (!selectedWorkflow || !selectedPack || !selectedProfile || !canLaunch) return
    startTransition(async () => {
      setResult(null)
      const response = await startVerdictTestCampaign({
        campaignKey: `planner.${Date.now()}`,
        campaignVersion: 1,
        cells: [
          {
            cellKey: `${selectedWorkflow.slug || selectedWorkflow.id}:${deviceId}`,
            profileKey: selectedProfile.profileKey,
            profileVersion: selectedProfile.version,
            deviceCell: deviceId,
            datasetRef: 'planner-dataset',
            workflowRef: selectedWorkflow.slug || selectedWorkflow.id,
            domainPackKey: selectedPack.packKey,
            domainPackVersion: selectedPack.version,
            domainPackDigest: selectedPack.bundleDigest,
            releaseGate: selectedProfile.releaseGate,
          },
        ],
      })
      setResult(response.campaign?.campaignId ?? 'Campaign request accepted')
    })
  }

  return (
    <div className="space-y-6">
      <PlannerSection
        step={1}
        title="Configure the run"
        description="These four inputs are frozen together as one campaign cell. Nothing executes until you confirm the plan below."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FieldBlock
            label="Workflow"
            hint="Which automation flow to execute"
          >
            <Select value={workflowId} onValueChange={setWorkflowId}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Select workflow" />
              </SelectTrigger>
              <SelectContent>
                {workflows.items.map((workflow) => (
                  <SelectItem key={workflow.id} value={workflow.id}>
                    {workflow.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldBlock>

          <FieldBlock
            label="Domain Pack"
            hint="Published version pinned for this run"
          >
            <Select value={packIdentityValue} onValueChange={setPackIdentityValue}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Select pack" />
              </SelectTrigger>
              <SelectContent>
                {publishedPacks.map((pack) => (
                  <SelectItem key={packIdentity(pack)} value={packIdentity(pack)}>
                    {packIdentity(pack)}
                    {!pack.compileReady ? ' (catalog only)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldBlock>

          <FieldBlock
            label="Test profile"
            hint="Scope, dataset, and release gate"
          >
            <Select value={profileKey} onValueChange={setProfileKey}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Select profile" />
              </SelectTrigger>
              <SelectContent>
                {profiles.items.map((profile) => (
                  <SelectItem key={profile.profileKey} value={profile.profileKey}>
                    {profile.profileKey} v{profile.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldBlock>

          <FieldBlock
            label="Device / resource"
            hint="Lab device or resource lease ID"
          >
            <Input
              className="h-10"
              value={deviceId}
              onChange={(event) => setDeviceId(event.target.value)}
              placeholder="e.g. lab-device-1"
            />
          </FieldBlock>
        </div>
      </PlannerSection>

      <PlannerSection
        step={2}
        title="Review the frozen plan"
        description="This is the manifest that will be sent to Verdict. Each step must resolve before launch."
      >
        <PlanPipeline steps={planSteps} />
      </PlannerSection>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <PlannerSection
          step={3}
          title="Find a workflow (optional)"
          description="Search by feature, capability, or keyword — useful when you know the impact area but not the exact workflow name."
          className="h-full"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 pl-9"
              value={impact}
              onChange={(event) => setImpact(event.target.value)}
              placeholder="e.g. delivery, login, pickup…"
            />
          </div>
          <div className="mt-3 grid gap-2">
            {impactedWorkflows.map((workflow) => {
              const selected = workflow.id === workflowId
              return (
                <button
                  key={workflow.id}
                  type="button"
                  onClick={() => setWorkflowId(workflow.id)}
                  className={cn(
                    'flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                    selected
                      ? 'border-nesy-muted bg-nesy-soft/30'
                      : 'border-border bg-background hover:border-nesy-muted/50 hover:bg-muted/30',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{workflow.name}</span>
                    {workflow.description ? (
                      <span className="mt-0.5 block line-clamp-1 text-xs text-muted-foreground">
                        {workflow.description}
                      </span>
                    ) : null}
                  </span>
                  {workflow.category ? (
                    <Badge size="sm" appearance="outline" variant="secondary" className="shrink-0">
                      {workflow.category}
                    </Badge>
                  ) : null}
                </button>
              )
            })}
          </div>
        </PlannerSection>

        <PlannerSection
          step={4}
          title="Pre-flight & launch"
          description="Blocked reasons are explicit — a non-run never reads as product failure."
          className="h-full"
        >
          <ul className="space-y-2">
            {preflightChecks.map((check) => (
              <li
                key={check.label}
                className={cn(
                  'flex gap-2.5 rounded-lg border px-3 py-2.5',
                  check.ok
                    ? 'border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20'
                    : 'border-amber-200/80 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20',
                )}
              >
                {check.ok ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                )}
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{check.label}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    {check.detail}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          {allBlocked.length > 0 ? (
            <div className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2.5 dark:border-amber-900/50 dark:bg-amber-950/30">
              <p className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                <XCircle className="size-3.5 shrink-0" />
                {allBlocked.length} blocker{allBlocked.length === 1 ? '' : 's'} must be resolved
              </p>
              <ul className="mt-2 space-y-1 pl-5 text-xs text-amber-800/90 dark:text-amber-200/90">
                {allBlocked.map((reason) => (
                  <li key={reason} className="list-disc">
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-4 shrink-0" />
              All checks passed — ready to launch
            </p>
          )}

          <Button
            type="button"
            disabled={!canLaunch || isPending}
            onClick={startCampaign}
            className="mt-5 h-11 w-full rounded-md bg-nesy text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,122,26,0.24)] hover:bg-nesy-hover disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
          >
            <Play className="size-4" />
            {isPending ? 'Starting campaign…' : 'Start campaign'}
          </Button>

          {result ? (
            <p className="mt-3 rounded-lg border border-emerald-200/80 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
              Campaign created: <span className="font-semibold">{result}</span>
            </p>
          ) : null}
        </PlannerSection>
      </div>
    </div>
  )
}

function PlannerSection({
  step,
  title,
  description,
  children,
  className,
}: {
  step: number
  title: string
  description: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-lg border border-border bg-card p-5 shadow-xs',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-nesy text-xs font-bold text-white">
          {step}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function FieldBlock({
  label,
  hint,
  children,
}: {
  label: string
  hint: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-semibold text-foreground">{label}</span>
      <span className="block text-xs leading-snug text-muted-foreground">{hint}</span>
      <div className="pt-0.5">{children}</div>
    </label>
  )
}

function PlanPipeline({
  steps,
}: {
  steps: Array<{
    label: string
    value: string
    hint?: string
    icon: LucideIcon
    ready: boolean
  }>
}) {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-max items-stretch gap-2 md:min-w-0 md:gap-0">
        {steps.map((step, index) => (
          <Fragment key={step.label}>
            <div
              className={cn(
                'flex w-[11.5rem] shrink-0 flex-col rounded-lg border p-3 md:w-auto md:min-w-0 md:flex-1',
                step.ready
                  ? 'border-border bg-background'
                  : 'border-dashed border-amber-300/80 bg-amber-50/40 dark:border-amber-800/60 dark:bg-amber-950/20',
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-md',
                    step.ready
                      ? 'bg-nesy-soft text-nesy-ink'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  <step.icon className="size-3.5" strokeWidth={2.2} />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {step.label}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                {step.value}
              </p>
              {step.hint ? (
                <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                  {step.hint}
                </p>
              ) : null}
            </div>
            {index < steps.length - 1 ? (
              <div className="flex shrink-0 items-center px-1 text-muted-foreground md:px-2">
                <ArrowRight className="size-4" aria-hidden />
              </div>
            ) : null}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
