'use client'

import { useMemo, useState, useTransition } from 'react'
import { startVerdictTestCampaign } from '@/lib/verdict-runtime/client'
import {
  packIdentity,
  parsePackIdentity,
  selectPinnedPublishedPack,
} from '@/lib/verdict-runtime/select-published-pack'
import type { DomainPackCatalogApi, TestProfileCatalogApi, WorkflowCatalogApi, RunHistoryResult } from '@/lib/verdict-runtime/types'

export function RunPlannerWorkspace({
  workflows,
  packs,
  profiles,
  runs,
}: {
  workflows: WorkflowCatalogApi
  packs: DomainPackCatalogApi
  profiles: TestProfileCatalogApi
  runs: RunHistoryResult
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
  const activeDeviceRuns = runs.items.filter((run) =>
    String(run.run.deviceId ?? '') === deviceId &&
    ['queued', 'pending', 'running'].includes(String(run.run.status ?? '').toLowerCase()),
  )
  const impactedWorkflows = useMemo(() => {
    const term = impact.toLowerCase()
    const matches = workflows.items.filter((workflow) =>
      [workflow.name, workflow.description ?? '', workflow.category ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
    return matches.length > 0 ? matches : workflows.items.slice(0, 5)
  }, [impact, workflows.items])
  const blockedReasons = [
    selectedWorkflow === undefined ? 'Select a workflow.' : null,
    selectedPack === undefined ? 'Select a published Domain Pack version.' : null,
    selectedProfile === undefined ? 'Select a Test Profile.' : null,
    activeDeviceRuns.length > 0 ? `Device ${deviceId} already has ${activeDeviceRuns.length} active run(s).` : null,
  ].filter((item): item is string => item !== null)

  const startCampaign = () => {
    if (!selectedWorkflow || !selectedPack || !selectedProfile) return
    startTransition(async () => {
      setResult(null)
      const response = await startVerdictTestCampaign({
        campaignKey: `planner.${Date.now()}`,
        campaignVersion: 1,
        cells: [{
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
        }],
      })
      setResult(response.campaign?.campaignId ?? 'Campaign request accepted')
    })
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-4">
        <Select label="Workflow" value={workflowId} onChange={setWorkflowId} options={workflows.items.map((w) => ({ value: w.id, label: w.name }))} />
        <Select
          label="Domain Pack"
          value={packIdentityValue}
          onChange={setPackIdentityValue}
          options={publishedPacks.map((p) => ({
            value: packIdentity(p),
            label: `${packIdentity(p)}${p.compileReady ? '' : ' (catalog only)'}`,
          }))}
        />
        <Select label="Test Profile" value={profileKey} onChange={setProfileKey} options={profiles.items.map((p) => ({ value: p.profileKey, label: `${p.profileKey} v${p.version}` }))} />
        <label className="text-sm font-medium">Device / Resource
          <input className="mt-2 h-10 w-full rounded-md border px-3 text-sm" value={deviceId} onChange={(event) => setDeviceId(event.target.value)} />
        </label>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Impact-driven Workflow Selection</h2>
          <input className="mt-3 h-10 w-full rounded-md border px-3 text-sm" value={impact} onChange={(event) => setImpact(event.target.value)} placeholder="repository path, feature, capability, API..." />
          <div className="mt-4 grid gap-2">
            {impactedWorkflows.map((workflow) => (
              <button key={workflow.id} type="button" onClick={() => setWorkflowId(workflow.id)} className="rounded-md border px-3 py-2 text-left text-sm hover:bg-muted">
                <b>{workflow.name}</b><span className="ml-2 text-xs text-muted-foreground">{workflow.category ?? 'uncategorized'}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Resource Conflict Simulation</h2>
          {blockedReasons.length === 0 ? <p className="mt-3 text-sm text-emerald-700">No blocking conflict detected.</p> : (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-700">{blockedReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          )}
          <button type="button" disabled={blockedReasons.length > 0 || isPending} onClick={startCampaign} className="mt-5 h-10 w-full rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
            {isPending ? 'Starting campaign...' : 'Start Campaign'}
          </button>
          {result ? <p className="mt-3 text-xs text-emerald-700">Created: {result}</p> : null}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Plan Graph Preview</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          {['Workflow', 'Domain Pack', 'Profile', 'Device Lease', 'Campaign Cell'].map((label, index) => (
            <div key={label} className="rounded-lg border bg-muted/30 p-3 text-center text-xs">
              <div className="font-semibold">{label}</div>
              <div className="mt-1 text-muted-foreground">{index < 4 ? '→' : 'release summary'}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="text-sm font-medium">{label}
      <select className="mt-2 h-10 w-full rounded-md border px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}
