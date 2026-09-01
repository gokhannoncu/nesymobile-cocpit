'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  Rocket,
  Smartphone,
  Shield,
  Power,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { ShimmerBlock } from '@/components/automation/automation-list-page-shimmer'
import {
  fetchVerdictDomainPacks,
  fetchVerdictLaunchProfiles,
  validateVerdictLaunchProfile,
} from '@/lib/verdict-runtime/client'
import type {
  DomainPackSummary,
  LaunchProfileApi,
  LaunchProfileValidateApi,
} from '@/lib/verdict-runtime/types'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty'; blockedReason?: string; pack?: DomainPackSummary }
  | { status: 'ready'; pack: DomainPackSummary; items: LaunchProfileApi[] }

type Draft = {
  profileKey: string
  applicationRef: string
  displayName: string
  startMode: string
  sessionPreparation: string
  preconditionFactKeysText: string
  entryKind: string
  entryRef: string
  expectedScreenRef: string
  preparationOperationRefsText: string
  cleanupRefsText: string
  cleanupRunOnFailure: boolean
  cleanupDeadlineMs: string
  producesProductVerdict: boolean
  automationOnly: boolean
  releaseGuard: string
  allowedEnvironmentsText: string
}

const SESSION_MODES = ['REAL_UI_LOGIN', 'PREPARED_SESSION', 'DIRECT_STATE'] as const
const START_MODES = ['COLD_START', 'WARM_START', 'REUSE_SESSION'] as const

function FieldShimmer() {
  return (
    <div className="space-y-1">
      <ShimmerBlock className="h-3 w-28" />
      <ShimmerBlock className="h-9 w-full rounded-lg" />
    </div>
  )
}

function SectionShimmer({ fieldCount }: { fieldCount: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <ShimmerBlock className="size-3.5 shrink-0 rounded" />
        <ShimmerBlock className="h-3 w-32" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: fieldCount }).map((_, index) => (
          <FieldShimmer key={index} />
        ))}
      </div>
    </div>
  )
}

function LaunchProfileBuilderShimmer() {
  return (
    <div className="space-y-4" aria-hidden>
      <ShimmerBlock className="h-10 w-full rounded-lg" />
      <ShimmerBlock className="h-5 w-32 rounded-md" />

      <div>
        <ShimmerBlock className="mb-1.5 h-3 w-14" />
        <ShimmerBlock className="h-9 w-full rounded-lg" />
        <div className="mt-2 space-y-1.5 rounded-lg border border-slate-200/70 p-2.5">
          <ShimmerBlock className="h-3.5 w-[78%]" />
          <ShimmerBlock className="h-2.5 w-full" />
        </div>
      </div>

      <SectionShimmer fieldCount={3} />
      <SectionShimmer fieldCount={4} />

      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <ShimmerBlock className="size-3.5 shrink-0 rounded" />
          <ShimmerBlock className="h-3 w-36" />
        </div>
        <div className="space-y-2">
          <FieldShimmer />
          <FieldShimmer />
          <ShimmerBlock className="h-4 w-40 rounded-md" />
          <ShimmerBlock className="h-4 w-44 rounded-md" />
          <ShimmerBlock className="h-4 w-52 rounded-md" />
          <FieldShimmer />
        </div>
      </div>

      <ShimmerBlock className="h-9 w-full rounded-lg" />
    </div>
  )
}

function ProfileSummaryCard({ displayName, profileKey, blockedReason }: {
  displayName: string
  profileKey: string
  blockedReason?: string | null
}) {
  return (
    <div className="mt-2 rounded-lg border border-slate-200/90 bg-slate-50/60 p-2.5">
      <p className="text-xs font-semibold leading-snug text-slate-800">{displayName}</p>
      <p className="mt-0.5 break-all font-mono text-[10px] leading-snug text-slate-500">{profileKey}</p>
      {blockedReason ? (
        <p className="mt-1.5 text-[10px] font-medium leading-snug text-amber-800">{blockedReason}</p>
      ) : null}
    </div>
  )
}

function SectionHeading({ icon: Icon, title }: { icon: typeof Smartphone; title: string }) {
  return (
    <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
      <Icon className="size-3.5 shrink-0 text-slate-500" aria-hidden />
      {title}
    </h4>
  )
}

export function LaunchProfileBuilder() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadToken, setReloadToken] = useState(0)
  const [releaseBuild, setReleaseBuild] = useState(true)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [validating, setValidating] = useState(false)
  const [validation, setValidation] = useState<LaunchProfileValidateApi | null>(null)
  const [validateError, setValidateError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    setValidation(null)
    setValidateError(null)

    ;(async () => {
      try {
        const packs = await fetchVerdictDomainPacks()
        if (cancelled) return
        const { selectPinnedPublishedPack } = await import('@/lib/verdict-runtime/select-published-pack')
        const pack = selectPinnedPublishedPack(packs.items)
        if (!pack) {
          setState({
            status: 'empty',
            blockedReason: 'no published Domain Pack to load launch profiles from',
          })
          return
        }

        const catalog = await fetchVerdictLaunchProfiles(
          pack.packKey,
          pack.version,
          releaseBuild,
        )
        if (cancelled) return

        if (catalog.items.length === 0) {
          setState({
            status: 'empty',
            pack,
            blockedReason: catalog.blockedReason ?? 'pack has no launch profiles',
          })
          setDraft(null)
          return
        }

        const first = catalog.items[0]!
        setSelectedKey((prev) => {
          const nextKey = catalog.items.some((p) => p.profileKey === prev)
            ? (prev as string)
            : first.profileKey
          const selected =
            catalog.items.find((p) => p.profileKey === nextKey) ?? first
          setDraft(toDraft(selected))
          return nextKey
        })
        setState({ status: 'ready', pack, items: [...catalog.items] })
      } catch (error) {
        if (cancelled) return
        setState({
          status: 'error',
          message:
            error instanceof Error ? error.message : 'launch profile catalog unavailable',
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [reloadToken, releaseBuild])

  const fieldErrors = useMemo(() => groupViolationsByField(validation?.violations ?? []), [validation])

  const selectProfile = (profileKey: string) => {
    if (state.status !== 'ready') return
    const profile = state.items.find((p) => p.profileKey === profileKey)
    if (!profile) return
    setSelectedKey(profileKey)
    setDraft(toDraft(profile))
    setValidation(null)
    setValidateError(null)
  }

  const patch = (partial: Partial<Draft>) => {
    setDraft((prev) => (prev === null ? prev : { ...prev, ...partial }))
    setValidation(null)
  }

  const onSessionPreparationChange = (value: string) => {
    if (releaseBuild && value === 'DIRECT_STATE') return
    patch({ sessionPreparation: value })
  }

  const runValidate = async () => {
    if (!draft) return
    setValidating(true)
    setValidateError(null)
    try {
      const result = await validateVerdictLaunchProfile({
        profile: fromDraft(draft),
        releaseBuild,
      })
      setValidation(result)
    } catch (error) {
      setValidation(null)
      setValidateError(error instanceof Error ? error.message : 'validate request failed')
    } finally {
      setValidating(false)
    }
  }

  const selectedProfile =
    state.status === 'ready'
      ? state.items.find((item) => item.profileKey === selectedKey) ?? state.items[0]
      : undefined

  return (
    <div className="p-3">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <Rocket className="size-4 shrink-0 text-indigo-600" aria-hidden />
          <h3 className="truncate text-sm font-semibold text-slate-900">Launch Profile</h3>
        </div>
        <button
          type="button"
          onClick={() => setReloadToken((n) => n + 1)}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200/90 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100 disabled:opacity-50"
          disabled={state.status === 'loading'}
        >
          <RefreshCw className={cn('size-3', state.status === 'loading' && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {state.status === 'loading' ? (
        <LaunchProfileBuilderShimmer />
      ) : (
        <>
          <label className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/60 px-2.5 py-2 text-[11px] font-medium text-slate-700">
            <input
              type="checkbox"
              checked={releaseBuild}
              onChange={(e) => setReleaseBuild(e.target.checked)}
              className="size-3.5 rounded border-slate-300"
            />
            Release build (DIRECT_STATE blocked)
          </label>

          {state.status === 'error' ? (
        <div className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">Launch profiles unavailable</p>
            <p className="mt-0.5 leading-snug text-rose-800">{state.message}</p>
          </div>
        </div>
      ) : null}

      {state.status === 'empty' ? (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">No launch profiles</p>
            <p className="mt-0.5 leading-snug">{state.blockedReason}</p>
          </div>
        </div>
      ) : null}

      {state.status === 'ready' && draft ? (
        <div className="space-y-4">
          <span className="inline-flex rounded-md border border-slate-200/90 bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-600">
            {state.pack.packKey}@{state.pack.version}
          </span>

          <div>
            <label htmlFor="launch-profile-select" className="mb-1.5 block text-[11px] font-semibold text-slate-600">
              Profile
            </label>
            <select
              id="launch-profile-select"
              className="w-full rounded-lg border border-slate-200/90 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 outline-none transition-[border-color,box-shadow] focus:border-slate-300 focus:ring-2 focus:ring-slate-200/80"
              value={selectedKey ?? ''}
              onChange={(e) => selectProfile(e.target.value)}
            >
              {state.items.map((item) => (
                <option key={item.profileKey} value={item.profileKey}>
                  {item.displayName}
                  {item.blockedReason ? ' (blocked)' : ''}
                </option>
              ))}
            </select>
            {selectedProfile ? (
              <ProfileSummaryCard
                displayName={selectedProfile.displayName}
                profileKey={selectedProfile.profileKey}
                blockedReason={selectedProfile.blockedReason}
              />
            ) : null}
          </div>

          <section>
            <SectionHeading icon={Smartphone} title="Process / session" />
            <div className="space-y-2">
              <Field
                label="Application"
                value={draft.applicationRef}
                error={fieldErrors.applicationRef}
                onChange={(v) => patch({ applicationRef: v })}
              />
              <label className="block text-[10px] font-semibold text-slate-600">
                Start mode
                <select
                  className={cn(
                    'mt-1 w-full rounded-lg border bg-white px-2.5 py-2 text-xs font-medium text-slate-800 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200/80',
                    fieldErrors.startMode ? 'border-rose-300' : 'border-slate-200/90',
                  )}
                  value={draft.startMode}
                  onChange={(e) => patch({ startMode: e.target.value })}
                >
                  {START_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[10px] font-semibold text-slate-600">
                Session preparation
                <select
                  className={cn(
                    'mt-1 w-full rounded-lg border bg-white px-2.5 py-2 text-xs font-medium text-slate-800 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200/80',
                    fieldErrors.sessionPreparation ? 'border-rose-300' : 'border-slate-200/90',
                  )}
                  value={draft.sessionPreparation}
                  onChange={(e) => onSessionPreparationChange(e.target.value)}
                >
                  {SESSION_MODES.map((m) => (
                    <option
                      key={m}
                      value={m}
                      disabled={releaseBuild && m === 'DIRECT_STATE'}
                    >
                      {m}
                      {releaseBuild && m === 'DIRECT_STATE' ? ' (blocked in release)' : ''}
                    </option>
                  ))}
                </select>
                {releaseBuild && draft.sessionPreparation === 'DIRECT_STATE' ? (
                  <span className="mt-1 block text-[10px] text-rose-700">
                    DIRECT_STATE is not selectable in release builds
                  </span>
                ) : null}
                {fieldErrors.sessionPreparation ? (
                  <span className="mt-1 block text-[10px] text-rose-700">{fieldErrors.sessionPreparation}</span>
                ) : null}
              </label>
            </div>
          </section>

          <section>
            <SectionHeading icon={Shield} title="Entry / preconditions" />
            <div className="space-y-2">
              <Field
                label="Entry ref"
                value={draft.entryRef}
                error={fieldErrors.entry}
                onChange={(v) => patch({ entryRef: v })}
              />
              <Field
                label="Expected screen"
                value={draft.expectedScreenRef}
                error={fieldErrors.entry}
                onChange={(v) => patch({ expectedScreenRef: v })}
              />
              <Field
                label="Precondition facts (comma)"
                value={draft.preconditionFactKeysText}
                onChange={(v) => patch({ preconditionFactKeysText: v })}
              />
              <Field
                label="Preparation ops (comma)"
                value={draft.preparationOperationRefsText}
                error={fieldErrors.preparationOperationRefs}
                onChange={(v) => patch({ preparationOperationRefsText: v })}
              />
            </div>
          </section>

          <section>
            <SectionHeading icon={Power} title="Cleanup / release isolation" />
            <div className="space-y-2">
              <Field
                label="Cleanup refs (comma)"
                value={draft.cleanupRefsText}
                error={fieldErrors.cleanup}
                onChange={(v) => patch({ cleanupRefsText: v })}
              />
              <Field
                label="Cleanup deadline (ms)"
                value={draft.cleanupDeadlineMs}
                error={fieldErrors.cleanup}
                onChange={(v) => patch({ cleanupDeadlineMs: v })}
              />
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.cleanupRunOnFailure}
                  onChange={(e) => patch({ cleanupRunOnFailure: e.target.checked })}
                  className="size-3.5 rounded border-slate-300"
                />
                Run cleanup on failure
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.producesProductVerdict}
                  onChange={(e) => patch({ producesProductVerdict: e.target.checked })}
                  className="size-3.5 rounded border-slate-300"
                />
                Produces product verdict
              </label>
              {fieldErrors.producesProductVerdict ? (
                <p className="text-[10px] text-rose-700">{fieldErrors.producesProductVerdict}</p>
              ) : null}
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.automationOnly}
                  onChange={(e) => patch({ automationOnly: e.target.checked })}
                  className="size-3.5 rounded border-slate-300"
                />
                Automation only (release isolation)
              </label>
              {fieldErrors.releaseIsolation ? (
                <p className="text-[10px] text-rose-700">{fieldErrors.releaseIsolation}</p>
              ) : null}
              <Field
                label="Release guard"
                value={draft.releaseGuard}
                onChange={(v) => patch({ releaseGuard: v })}
              />
            </div>
          </section>

          <button
            type="button"
            onClick={runValidate}
            disabled={validating || (releaseBuild && draft.sessionPreparation === 'DIRECT_STATE')}
            className="w-full rounded-lg border border-indigo-200/90 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800 transition-colors hover:border-indigo-300 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {validating ? 'Validating…' : 'Validate profile'}
          </button>

          {validateError ? (
            <div className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-900">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <p className="leading-snug">{validateError}</p>
            </div>
          ) : null}

          {validation ? (
            <div
              className={cn(
                'rounded-lg border p-2.5 text-xs',
                validation.ok
                  ? 'border-emerald-200/90 bg-emerald-50/80 text-emerald-900'
                  : 'border-rose-200/90 bg-rose-50/80 text-rose-900',
              )}
            >
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                {validation.ok ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
                {validation.ok ? 'Profile valid' : 'Validation failed'}
              </div>
              {validation.blockedReason ? (
                <p className="mb-1 leading-snug">{validation.blockedReason}</p>
              ) : null}
              {!validation.ok ? (
                <ul className="list-disc space-y-1 pl-4 leading-snug">
                  {validation.violations.map((v) => (
                    <li key={`${v.code}:${v.message}`}>
                      <span className="font-mono">{v.code}</span>: {v.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
        </>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  error,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  return (
    <label className="block text-[10px] font-semibold text-slate-600">
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'mt-1 w-full rounded-lg border bg-white px-2.5 py-2 font-mono text-xs text-slate-800 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200/80',
          error ? 'border-rose-300' : 'border-slate-200/90',
        )}
      />
      {error ? <span className="mt-1 block text-[10px] text-rose-700">{error}</span> : null}
    </label>
  )
}

function toDraft(profile: LaunchProfileApi): Draft {
  const entry = asRecord(profile.entry)
  const cleanup = asRecord(profile.cleanup)
  const release = asRecord(profile.releaseIsolation)
  return {
    profileKey: profile.profileKey,
    applicationRef: profile.applicationRef,
    displayName: profile.displayName,
    startMode: profile.startMode,
    sessionPreparation: profile.sessionPreparation,
    preconditionFactKeysText: profile.preconditionFactKeys.join(', '),
    entryKind: String(entry.kind ?? 'WORKFLOW_ENTRY'),
    entryRef: String(entry.entryRef ?? ''),
    expectedScreenRef: String(entry.expectedScreenRef ?? ''),
    preparationOperationRefsText: profile.preparationOperationRefs.join(', '),
    cleanupRefsText: Array.isArray(cleanup.cleanupRefs)
      ? cleanup.cleanupRefs.map(String).join(', ')
      : '',
    cleanupRunOnFailure: cleanup.runOnFailure === true,
    cleanupDeadlineMs: String(cleanup.deadlineMs ?? ''),
    producesProductVerdict: profile.producesProductVerdict,
    automationOnly: release.automationOnly === true,
    releaseGuard: String(release.releaseGuard ?? ''),
    allowedEnvironmentsText: Array.isArray(release.allowedEnvironments)
      ? release.allowedEnvironments.map(String).join(', ')
      : '',
  }
}

function fromDraft(draft: Draft): Record<string, unknown> {
  return {
    profileKey: draft.profileKey,
    applicationRef: draft.applicationRef,
    displayName: draft.displayName,
    startMode: draft.startMode,
    sessionPreparation: draft.sessionPreparation,
    preconditionFactKeys: splitCsv(draft.preconditionFactKeysText),
    entry: {
      kind: draft.entryKind,
      entryRef: draft.entryRef,
      expectedScreenRef: draft.expectedScreenRef,
      expectedSurfaceRefs: [],
    },
    preparationOperationRefs: splitCsv(draft.preparationOperationRefsText),
    cleanup: {
      cleanupRefs: splitCsv(draft.cleanupRefsText),
      runOnFailure: draft.cleanupRunOnFailure,
      deadlineMs: Number(draft.cleanupDeadlineMs),
    },
    producesProductVerdict: draft.producesProductVerdict,
    releaseIsolation: {
      automationOnly: draft.automationOnly,
      releaseGuard: draft.releaseGuard,
      allowedEnvironments: splitCsv(draft.allowedEnvironmentsText),
    },
    requiredCapabilityRefs: [],
  }
}

function groupViolationsByField(
  violations: readonly { code: string; message: string }[],
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const v of violations) {
    const field =
      fieldFromMessage(v.message) ??
      (v.code.includes('DIRECT_STATE') || v.code.includes('SETUP_LAUNCH')
        ? 'sessionPreparation'
        : v.code.includes('CLEANUP')
          ? 'cleanup'
          : v.code.includes('ISOLATION')
            ? 'releaseIsolation'
            : v.code.includes('MISSING_FIELD')
              ? fieldFromMissing(v.message)
              : 'general')
    if (field && !out[field]) out[field] = v.message
  }
  return out
}

function fieldFromMessage(message: string): string | undefined {
  const match = message.match(/profile\.([a-zA-Z.]+)/)
  if (!match) return undefined
  const path = match[1]!
  if (path.startsWith('cleanup')) return 'cleanup'
  if (path.startsWith('entry')) return 'entry'
  if (path.startsWith('releaseIsolation')) return 'releaseIsolation'
  if (path.startsWith('sessionPreparation')) return 'sessionPreparation'
  if (path.startsWith('preparationOperationRefs')) return 'preparationOperationRefs'
  return path.split('.')[0]
}

function fieldFromMissing(message: string): string {
  if (message.includes('releaseIsolation')) return 'releaseIsolation'
  if (message.includes('cleanup')) return 'cleanup'
  if (message.includes('entry')) return 'entry'
  if (message.includes('sessionPreparation')) return 'sessionPreparation'
  return 'general'
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
