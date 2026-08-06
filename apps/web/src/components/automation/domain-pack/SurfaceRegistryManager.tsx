'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Layers,
  Loader2,
  RefreshCw,
  Save,
  ShieldAlert,
} from 'lucide-react'
import {
  fetchVerdictDomainPackAdmin,
  fetchVerdictScreenSurfaces,
  saveDomainPackDraft,
} from '@/lib/verdict-runtime/client'
import type {
  ScreenSurfaceCatalogApi,
  SurfaceRegistryItemApi,
} from '@/lib/verdict-runtime/types'

const SURFACE_KINDS = [
  'DIALOG',
  'BOTTOM_SHEET',
  'SYSTEM_OVERLAY',
  'SCANNER',
  'WEBVIEW_OVERLAY',
  'POPUP',
] as const

const SURFACE_POLICIES = ['HANDLE', 'IGNORE', 'FAIL', 'OPERATOR_ATTENTION'] as const

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty'; blockedReason?: string }
  | { status: 'ready'; catalog: ScreenSurfaceCatalogApi }

type SurfaceDraft = {
  surfaceKey: string
  applicationRef: string
  kind: string
  displayName: string
  parentScreenRefsText: string
  detectionRequiredText: string
  detectionAnyOfText: string
  detectionNoneOfText: string
  detectionDeadlineMs: string
  detectionStableForMs: string
  defaultPolicy: string
  priority: string
  handlerMacroRef: string
  blocksProductVerdict: boolean
}

function draftFromSurface(surface: SurfaceRegistryItemApi): SurfaceDraft {
  return {
    surfaceKey: surface.surfaceKey,
    applicationRef: surface.applicationRef,
    kind: surface.kind,
    displayName: surface.displayName,
    parentScreenRefsText: surface.parentScreenRefs.join(', '),
    detectionRequiredText: surface.detection.requiredFactKeys.join(', '),
    detectionAnyOfText: surface.detection.anyOfFactKeys.join(', '),
    detectionNoneOfText: surface.detection.noneOfFactKeys.join(', '),
    detectionDeadlineMs: String(surface.detection.deadlineMs),
    detectionStableForMs:
      surface.detection.stableForMs === null ? '' : String(surface.detection.stableForMs),
    defaultPolicy: surface.defaultPolicy,
    priority: String(surface.priority),
    handlerMacroRef: surface.handlerMacroRef ?? '',
    blocksProductVerdict: surface.blocksProductVerdict,
  }
}

function splitCsv(text: string): string[] {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function surfaceFromDraft(draft: SurfaceDraft): Record<string, unknown> {
  const detection: Record<string, unknown> = {
    requiredFactKeys: splitCsv(draft.detectionRequiredText),
    deadlineMs: Number(draft.detectionDeadlineMs) || 0,
  }
  const anyOf = splitCsv(draft.detectionAnyOfText)
  const noneOf = splitCsv(draft.detectionNoneOfText)
  if (anyOf.length > 0) detection.anyOfFactKeys = anyOf
  if (noneOf.length > 0) detection.noneOfFactKeys = noneOf
  if (draft.detectionStableForMs.trim() !== '') {
    detection.stableForMs = Number(draft.detectionStableForMs) || 0
  }

  const surface: Record<string, unknown> = {
    surfaceKey: draft.surfaceKey,
    applicationRef: draft.applicationRef,
    kind: draft.kind,
    displayName: draft.displayName,
    parentScreenRefs: splitCsv(draft.parentScreenRefsText),
    detection,
    defaultPolicy: draft.defaultPolicy,
    priority: Number(draft.priority) || 0,
    blocksProductVerdict: draft.blocksProductVerdict,
  }
  if (draft.handlerMacroRef.trim() !== '') {
    surface.handlerMacroRef = draft.handlerMacroRef.trim()
  }
  return surface
}

async function digestBundle(bundle: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(bundle))
  const hash = await crypto.subtle.digest('SHA-256', encoded)
  const hex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `sha256:${hex}`
}

export function SurfaceRegistryManager({
  packKey,
  version,
}: {
  packKey: string
  version: string
}) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadToken, setReloadToken] = useState(0)
  const [selectedAppKey, setSelectedAppKey] = useState<string | null>(null)
  const [selectedScreenKey, setSelectedScreenKey] = useState<string | null>(null)
  const [selectedSurfaceKey, setSelectedSurfaceKey] = useState<string | null>(null)
  const [draft, setDraft] = useState<SurfaceDraft | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveOk, setSaveOk] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    setSaveError(null)
    setSaveOk(null)

    ;(async () => {
      try {
        const catalog = await fetchVerdictScreenSurfaces(packKey, version)
        if (cancelled) return
        if (
          catalog.applications.length === 0 &&
          catalog.screens.length === 0 &&
          catalog.surfaces.length === 0
        ) {
          setState({
            status: 'empty',
            blockedReason: catalog.blockedReason,
          })
          setDraft(null)
          return
        }

        const app =
          catalog.applications.find((a) => a.applicationKey === selectedAppKey) ??
          catalog.applications[0]
        const appKey = app?.applicationKey ?? null
        const screensForApp = catalog.screens.filter((s) =>
          appKey ? s.applicationRef === appKey : true,
        )
        const screen =
          screensForApp.find((s) => s.screenKey === selectedScreenKey) ?? screensForApp[0]
        const screenKey = screen?.screenKey ?? null
        const surfacesForContext = catalog.surfaces.filter((surface) => {
          if (appKey && surface.applicationRef !== appKey) return false
          if (!screenKey) return true
          return (
            surface.parentScreenRefs.includes('*') ||
            surface.parentScreenRefs.includes(screenKey)
          )
        })
        const surface =
          surfacesForContext.find((s) => s.surfaceKey === selectedSurfaceKey) ??
          surfacesForContext[0] ??
          catalog.surfaces[0]

        setSelectedAppKey(appKey)
        setSelectedScreenKey(screenKey)
        setSelectedSurfaceKey(surface?.surfaceKey ?? null)
        setDraft(surface ? draftFromSurface(surface) : null)
        setDirty(false)
        setState({ status: 'ready', catalog })
      } catch (error) {
        if (cancelled) return
        setState({
          status: 'error',
          message:
            error instanceof Error ? error.message : 'screen/surface catalog unavailable',
        })
      }
    })()

    return () => {
      cancelled = true
    }
    // Selection is resolved inside after load; reloadToken drives refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packKey, version, reloadToken])

  const readOnly =
    state.status === 'ready' &&
    (state.catalog.publicationState !== 'DRAFT' || Boolean(state.catalog.immutableReason))

  const screensForApp = useMemo(() => {
    if (state.status !== 'ready') return []
    if (!selectedAppKey) return state.catalog.screens
    return state.catalog.screens.filter((s) => s.applicationRef === selectedAppKey)
  }, [state, selectedAppKey])

  const surfacesForScreen = useMemo(() => {
    if (state.status !== 'ready') return []
    return state.catalog.surfaces.filter((surface) => {
      if (selectedAppKey && surface.applicationRef !== selectedAppKey) return false
      if (!selectedScreenKey) return true
      return (
        surface.parentScreenRefs.includes('*') ||
        surface.parentScreenRefs.includes(selectedScreenKey)
      )
    })
  }, [state, selectedAppKey, selectedScreenKey])

  const selectSurface = (surfaceKey: string) => {
    if (state.status !== 'ready') return
    const surface = state.catalog.surfaces.find((s) => s.surfaceKey === surfaceKey)
    if (!surface) return
    setSelectedSurfaceKey(surfaceKey)
    setDraft(draftFromSurface(surface))
    setDirty(false)
    setSaveError(null)
    setSaveOk(null)
  }

  const updateDraft = <K extends keyof SurfaceDraft>(key: K, value: SurfaceDraft[K]) => {
    if (readOnly) return
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev))
    setDirty(true)
    setSaveOk(null)
  }

  const handleSave = async () => {
    if (!draft || state.status !== 'ready' || readOnly) return
    setSaving(true)
    setSaveError(null)
    setSaveOk(null)
    try {
      const admin = await fetchVerdictDomainPackAdmin(packKey, version)
      const pack = admin.pack
      if (pack.publicationState !== 'DRAFT') {
        throw new Error(state.catalog.immutableReason ?? 'published packs are immutable')
      }
      const bundle =
        pack.bundle && typeof pack.bundle === 'object' && !Array.isArray(pack.bundle)
          ? structuredClone(pack.bundle) as Record<string, unknown>
          : { registries: {} }
      const registries =
        bundle.registries && typeof bundle.registries === 'object' && !Array.isArray(bundle.registries)
          ? (bundle.registries as Record<string, unknown>)
          : {}
      const existingSurfaces = Array.isArray(registries.surfaces)
        ? ([...registries.surfaces] as Record<string, unknown>[])
        : []
      const nextSurface = surfaceFromDraft(draft)
      const idx = existingSurfaces.findIndex((s) => s.surfaceKey === draft.surfaceKey)
      if (idx >= 0) existingSurfaces[idx] = { ...existingSurfaces[idx], ...nextSurface }
      else existingSurfaces.push(nextSurface)
      registries.surfaces = existingSurfaces
      bundle.registries = registries
      const bundleDigest = await digestBundle(bundle)
      await saveDomainPackDraft({
        packKey,
        version,
        bundle,
        bundleDigest,
        expectedRevision: pack.revision,
      })
      setSaveOk('Surface saved to draft')
      setDirty(false)
      setReloadToken((n) => n + 1)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'failed to save surface draft')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-indigo-600" />
          <h3 className="font-semibold text-sm">Application → Screen → Surface Registry</h3>
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

      {state.status === 'loading' && (
        <div className="flex items-center gap-2 text-xs text-gray-500 py-8 justify-center">
          <Loader2 size={14} className="animate-spin" />
          Loading screen/surface registry…
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex gap-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded p-3">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Surface registry unavailable</div>
            <div className="mt-0.5">{state.message}</div>
          </div>
        </div>
      )}

      {state.status === 'empty' && (
        <div className="flex gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded p-3">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">No applications / screens / surfaces</div>
            <div className="mt-0.5">
              {state.blockedReason ?? 'pack registry slice is empty'}
            </div>
          </div>
        </div>
      )}

      {state.status === 'ready' && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
            <span className="font-mono">
              {state.catalog.packKey}@{state.catalog.packVersion}
            </span>
            <span>·</span>
            <span>{state.catalog.publicationState}</span>
            <span>·</span>
            <span>rev {state.catalog.revision}</span>
            <span>·</span>
            <span>
              {state.catalog.applications.length} apps / {state.catalog.screens.length} screens /{' '}
              {state.catalog.surfaces.length} surfaces
            </span>
          </div>

          {readOnly && (
            <div className="flex gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded p-3">
              <ShieldAlert size={14} className="shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Read-only surface registry</div>
                <div className="mt-0.5">
                  {state.catalog.immutableReason ??
                    'Only DRAFT pack versions can edit surface fields.'}
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[220px_220px_1fr]">
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 border-b px-3 py-2 text-[10px] font-semibold uppercase text-gray-500">
                Applications
              </div>
              <ul className="max-h-72 overflow-auto divide-y">
                {state.catalog.applications.map((app) => (
                  <li key={app.applicationKey}>
                    <button
                      type="button"
                      className={`w-full text-left px-3 py-2 text-xs ${
                        selectedAppKey === app.applicationKey
                          ? 'bg-indigo-50 text-indigo-900'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        setSelectedAppKey(app.applicationKey)
                        const firstScreen = state.catalog.screens.find(
                          (s) => s.applicationRef === app.applicationKey,
                        )
                        setSelectedScreenKey(firstScreen?.screenKey ?? null)
                      }}
                    >
                      <div className="font-medium">{app.displayName}</div>
                      <div className="font-mono text-[10px] text-gray-500">
                        {app.applicationKey}
                      </div>
                      <div className="text-[10px] text-gray-400">{app.platform}</div>
                    </button>
                  </li>
                ))}
                {state.catalog.applications.length === 0 && (
                  <li className="px-3 py-4 text-xs text-gray-500">No applications</li>
                )}
              </ul>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 border-b px-3 py-2 text-[10px] font-semibold uppercase text-gray-500">
                Screens
              </div>
              <ul className="max-h-72 overflow-auto divide-y">
                {screensForApp.map((screen) => (
                  <li key={screen.screenKey}>
                    <button
                      type="button"
                      className={`w-full text-left px-3 py-2 text-xs ${
                        selectedScreenKey === screen.screenKey
                          ? 'bg-indigo-50 text-indigo-900'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedScreenKey(screen.screenKey)}
                    >
                      <div className="font-medium">{screen.displayName}</div>
                      <div className="font-mono text-[10px] text-gray-500">
                        {screen.screenKey}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        readiness deadline {screen.readiness.deadlineMs}ms
                      </div>
                    </button>
                  </li>
                ))}
                {screensForApp.length === 0 && (
                  <li className="px-3 py-4 text-xs text-gray-500">No screens for app</li>
                )}
              </ul>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 border-b px-3 py-2 text-[10px] font-semibold uppercase text-gray-500">
                Surfaces
              </div>
              <ul className="max-h-40 overflow-auto divide-y border-b">
                {surfacesForScreen.map((surface) => (
                  <li key={surface.surfaceKey}>
                    <button
                      type="button"
                      className={`w-full text-left px-3 py-2 text-xs ${
                        selectedSurfaceKey === surface.surfaceKey
                          ? 'bg-indigo-50 text-indigo-900'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => selectSurface(surface.surfaceKey)}
                    >
                      <div className="font-medium">{surface.displayName}</div>
                      <div className="font-mono text-[10px] text-gray-500">
                        {surface.surfaceKey} · {surface.kind}
                      </div>
                    </button>
                  </li>
                ))}
                {surfacesForScreen.length === 0 && (
                  <li className="px-3 py-4 text-xs text-gray-500">
                    No surfaces for this screen (including global `*`)
                  </li>
                )}
              </ul>

              {draft ? (
                <div className="p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="displayName">
                      <input
                        className="w-full text-xs border rounded p-1.5"
                        value={draft.displayName}
                        disabled={readOnly}
                        onChange={(e) => updateDraft('displayName', e.target.value)}
                      />
                    </Field>
                    <Field label="kind">
                      <select
                        className="w-full text-xs border rounded p-1.5"
                        value={draft.kind}
                        disabled={readOnly}
                        onChange={(e) => updateDraft('kind', e.target.value)}
                      >
                        {SURFACE_KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {kind}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="parentScreenRefs" className="col-span-2">
                      <input
                        className="w-full text-xs border rounded p-1.5 font-mono"
                        value={draft.parentScreenRefsText}
                        disabled={readOnly}
                        onChange={(e) => updateDraft('parentScreenRefsText', e.target.value)}
                        placeholder="nesy.screen.home, * "
                      />
                    </Field>
                    <Field label="defaultPolicy">
                      <select
                        className="w-full text-xs border rounded p-1.5"
                        value={draft.defaultPolicy}
                        disabled={readOnly}
                        onChange={(e) => updateDraft('defaultPolicy', e.target.value)}
                      >
                        {SURFACE_POLICIES.map((policy) => (
                          <option key={policy} value={policy}>
                            {policy}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="priority">
                      <input
                        className="w-full text-xs border rounded p-1.5 font-mono"
                        value={draft.priority}
                        disabled={readOnly}
                        onChange={(e) => updateDraft('priority', e.target.value)}
                      />
                    </Field>
                    <Field label="detection.requiredFactKeys" className="col-span-2">
                      <input
                        className="w-full text-xs border rounded p-1.5 font-mono"
                        value={draft.detectionRequiredText}
                        disabled={readOnly}
                        onChange={(e) => updateDraft('detectionRequiredText', e.target.value)}
                      />
                    </Field>
                    <Field label="detection.anyOfFactKeys">
                      <input
                        className="w-full text-xs border rounded p-1.5 font-mono"
                        value={draft.detectionAnyOfText}
                        disabled={readOnly}
                        onChange={(e) => updateDraft('detectionAnyOfText', e.target.value)}
                      />
                    </Field>
                    <Field label="detection.noneOfFactKeys">
                      <input
                        className="w-full text-xs border rounded p-1.5 font-mono"
                        value={draft.detectionNoneOfText}
                        disabled={readOnly}
                        onChange={(e) => updateDraft('detectionNoneOfText', e.target.value)}
                      />
                    </Field>
                    <Field label="detection.deadlineMs">
                      <input
                        className="w-full text-xs border rounded p-1.5 font-mono"
                        value={draft.detectionDeadlineMs}
                        disabled={readOnly}
                        onChange={(e) => updateDraft('detectionDeadlineMs', e.target.value)}
                      />
                    </Field>
                    <Field label="detection.stableForMs">
                      <input
                        className="w-full text-xs border rounded p-1.5 font-mono"
                        value={draft.detectionStableForMs}
                        disabled={readOnly}
                        onChange={(e) => updateDraft('detectionStableForMs', e.target.value)}
                      />
                    </Field>
                    <Field label="handlerMacroRef" className="col-span-2">
                      <input
                        className="w-full text-xs border rounded p-1.5 font-mono"
                        value={draft.handlerMacroRef}
                        disabled={readOnly}
                        onChange={(e) => updateDraft('handlerMacroRef', e.target.value)}
                      />
                    </Field>
                    <label className="col-span-2 flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={draft.blocksProductVerdict}
                        disabled={readOnly}
                        onChange={(e) => updateDraft('blocksProductVerdict', e.target.checked)}
                      />
                      blocksProductVerdict
                    </label>
                  </div>

                  {!readOnly && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={!dirty || saving}
                        className="inline-flex items-center gap-1.5 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded disabled:opacity-50"
                      >
                        {saving ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Save size={12} />
                        )}
                        Save surface to draft
                      </button>
                      {dirty && (
                        <span className="text-[10px] text-amber-700">Unsaved changes</span>
                      )}
                    </div>
                  )}

                  {saveError && (
                    <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                      {saveError}
                    </div>
                  )}
                  {saveOk && (
                    <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2">
                      {saveOk}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 text-xs text-gray-500">Select a surface to inspect.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">
        {label}
      </label>
      {children}
    </div>
  )
}
