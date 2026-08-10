'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  Rocket,
  Smartphone,
  Shield,
  Power,
  Loader2,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react'
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

  return (
    <div className="p-4 bg-white border rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-2 border-b">
        <div className="flex items-center gap-2">
          <Rocket size={18} className="text-indigo-600" />
          <h3 className="font-semibold text-sm">Launch Profile</h3>
        </div>
        <button
          type="button"
          onClick={() => setReloadToken((n) => n + 1)}
          className="flex items-center gap-1 text-[10px] bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded font-medium"
          disabled={state.status === 'loading'}
        >
          <RefreshCw size={12} className={state.status === 'loading' ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <label className="flex items-center gap-2 text-[11px] mb-3">
        <input
          type="checkbox"
          checked={releaseBuild}
          onChange={(e) => setReleaseBuild(e.target.checked)}
        />
        Release build (DIRECT_STATE blocked)
      </label>

      {state.status === 'loading' && (
        <div className="flex items-center gap-2 text-xs text-gray-500 py-6 justify-center">
          <Loader2 size={14} className="animate-spin" />
          Loading launch profiles…
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex gap-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded p-3">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Launch profiles unavailable</p>
            <p className="mt-0.5 opacity-90">{state.message}</p>
          </div>
        </div>
      )}

      {state.status === 'empty' && (
        <div className="flex gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded p-3">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">No launch profiles</p>
            <p className="mt-0.5 opacity-90">{state.blockedReason}</p>
          </div>
        </div>
      )}

      {state.status === 'ready' && draft && (
        <div className="space-y-4">
          <p className="text-[10px] text-gray-500 font-mono">
            {state.pack.packKey}@{state.pack.version}
          </p>

          <select
            className="w-full text-xs border rounded p-1.5 bg-gray-50"
            value={selectedKey ?? ''}
            onChange={(e) => selectProfile(e.target.value)}
          >
            {state.items.map((item) => (
              <option key={item.profileKey} value={item.profileKey}>
                {item.displayName} ({item.profileKey})
                {item.blockedReason ? ' — blocked' : ''}
              </option>
            ))}
          </select>

          <section>
            <h4 className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-2">
              <Smartphone size={14} /> Process / session
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="applicationRef"
                value={draft.applicationRef}
                error={fieldErrors.applicationRef}
                onChange={(v) => patch({ applicationRef: v })}
                className="col-span-2"
              />
              <label className="col-span-1 text-[10px] text-gray-600">
                startMode
                <select
                  className={`mt-0.5 w-full text-xs border rounded p-1.5 ${fieldErrors.startMode ? 'border-red-400' : ''}`}
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
              <label className="col-span-1 text-[10px] text-gray-600">
                sessionPreparation
                <select
                  className={`mt-0.5 w-full text-xs border rounded p-1.5 ${fieldErrors.sessionPreparation ? 'border-red-400' : ''}`}
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
                  <span className="block text-red-700 mt-0.5">
                    DIRECT_STATE is not selectable in release builds
                  </span>
                ) : null}
                {fieldErrors.sessionPreparation ? (
                  <span className="block text-red-700 mt-0.5">{fieldErrors.sessionPreparation}</span>
                ) : null}
              </label>
            </div>
          </section>

          <section>
            <h4 className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-2">
              <Shield size={14} /> Entry / preconditions
            </h4>
            <div className="space-y-2">
              <Field
                label="entry.entryRef"
                value={draft.entryRef}
                error={fieldErrors.entry}
                onChange={(v) => patch({ entryRef: v })}
              />
              <Field
                label="entry.expectedScreenRef"
                value={draft.expectedScreenRef}
                error={fieldErrors.entry}
                onChange={(v) => patch({ expectedScreenRef: v })}
              />
              <Field
                label="preconditionFactKeys (comma)"
                value={draft.preconditionFactKeysText}
                onChange={(v) => patch({ preconditionFactKeysText: v })}
              />
              <Field
                label="preparationOperationRefs (comma)"
                value={draft.preparationOperationRefsText}
                error={fieldErrors.preparationOperationRefs}
                onChange={(v) => patch({ preparationOperationRefsText: v })}
              />
            </div>
          </section>

          <section>
            <h4 className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-2">
              <Power size={14} /> Cleanup / release isolation
            </h4>
            <div className="space-y-2">
              <Field
                label="cleanup.cleanupRefs (comma)"
                value={draft.cleanupRefsText}
                error={fieldErrors.cleanup}
                onChange={(v) => patch({ cleanupRefsText: v })}
              />
              <Field
                label="cleanup.deadlineMs"
                value={draft.cleanupDeadlineMs}
                error={fieldErrors.cleanup}
                onChange={(v) => patch({ cleanupDeadlineMs: v })}
              />
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={draft.cleanupRunOnFailure}
                  onChange={(e) => patch({ cleanupRunOnFailure: e.target.checked })}
                />
                cleanup.runOnFailure
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={draft.producesProductVerdict}
                  onChange={(e) => patch({ producesProductVerdict: e.target.checked })}
                />
                producesProductVerdict
              </label>
              {fieldErrors.producesProductVerdict ? (
                <p className="text-[10px] text-red-700">{fieldErrors.producesProductVerdict}</p>
              ) : null}
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={draft.automationOnly}
                  onChange={(e) => patch({ automationOnly: e.target.checked })}
                />
                releaseIsolation.automationOnly
              </label>
              {fieldErrors.releaseIsolation ? (
                <p className="text-[10px] text-red-700">{fieldErrors.releaseIsolation}</p>
              ) : null}
              <Field
                label="releaseIsolation.releaseGuard"
                value={draft.releaseGuard}
                onChange={(v) => patch({ releaseGuard: v })}
              />
            </div>
          </section>

          <button
            type="button"
            onClick={runValidate}
            disabled={validating || (releaseBuild && draft.sessionPreparation === 'DIRECT_STATE')}
            className="w-full text-xs py-1.5 rounded border font-medium bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100 disabled:opacity-50"
          >
            {validating ? 'Validating…' : 'Validate profile'}
          </button>

          {validateError ? (
            <div className="flex gap-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded p-2">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <p>{validateError}</p>
            </div>
          ) : null}

          {validation ? (
            <div
              className={`text-xs rounded border p-2 ${
                validation.ok
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold mb-1">
                {validation.ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                {validation.ok ? 'Profile valid' : 'Validation failed'}
              </div>
              {validation.blockedReason ? (
                <p className="mb-1">{validation.blockedReason}</p>
              ) : null}
              {!validation.ok ? (
                <ul className="space-y-1 list-disc pl-4">
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
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  error,
  className = '',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  className?: string
}) {
  return (
    <label className={`block text-[10px] text-gray-600 ${className}`}>
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-0.5 w-full text-xs border rounded p-1.5 ${error ? 'border-red-400' : ''}`}
      />
      {error ? <span className="block text-red-700 mt-0.5">{error}</span> : null}
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
