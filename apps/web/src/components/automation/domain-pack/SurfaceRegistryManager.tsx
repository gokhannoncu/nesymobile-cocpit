'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  fetchVerdictDomainPackAdmin,
  fetchVerdictScreenSurfaces,
  saveDomainPackDraft,
} from '@/lib/verdict-runtime/client'
import type { ScreenSurfaceCatalogApi } from '@/lib/verdict-runtime/types'
import { SurfaceRegistryHeader } from '@/components/automation/domain-pack/surface-registry/SurfaceRegistryHeader'
import { SurfaceRegistryFilters } from '@/components/automation/domain-pack/surface-registry/SurfaceRegistryFilters'
import { SurfaceRegistryTable } from '@/components/automation/domain-pack/surface-registry/SurfaceRegistryTable'
import {
  draftFromSurface,
  SurfaceDetailPanel,
  type SurfaceDraft,
} from '@/components/automation/domain-pack/surface-registry/SurfaceDetailPanel'
import {
  filterSurfaces,
  screensForApplication,
  surfaceRegistryStats,
} from '@/lib/verdict-runtime/surface-registry'

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
  fallback = null,
}: {
  packKey: string
  version: string
  fallback?: React.ReactNode
}) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadToken, setReloadToken] = useState(0)
  const [selectedAppKey, setSelectedAppKey] = useState<string | null>(null)
  const [selectedScreenKey, setSelectedScreenKey] = useState<string | null>(null)
  const [selectedKind, setSelectedKind] = useState<string | null>(null)
  const [selectedPolicy, setSelectedPolicy] = useState<string | null>(null)
  const [query, setQuery] = useState('')
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
          setState({ status: 'empty', blockedReason: catalog.blockedReason })
          setDraft(null)
          return
        }

        const app = catalog.applications[0]
        const appKey = app?.applicationKey ?? null
        const firstScreen = catalog.screens.find((screen) =>
          appKey ? screen.applicationRef === appKey : true,
        )
        const filtered = filterSurfaces(catalog.surfaces, {
          appKey,
          screenKey: firstScreen?.screenKey ?? null,
          kind: null,
          policy: null,
          query: '',
        })
        const surface = filtered[0] ?? catalog.surfaces[0]

        setSelectedAppKey(appKey)
        setSelectedScreenKey(firstScreen?.screenKey ?? null)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packKey, version, reloadToken])

  const readOnly =
    state.status === 'ready' &&
    (state.catalog.publicationState !== 'DRAFT' || Boolean(state.catalog.immutableReason))

  const screensForApp = useMemo(() => {
    if (state.status !== 'ready') return []
    return screensForApplication(state.catalog.screens, selectedAppKey)
  }, [state, selectedAppKey])

  const filteredSurfaces = useMemo(() => {
    if (state.status !== 'ready') return []
    return filterSurfaces(state.catalog.surfaces, {
      appKey: selectedAppKey,
      screenKey: selectedScreenKey,
      kind: selectedKind,
      policy: selectedPolicy,
      query,
    })
  }, [state, selectedAppKey, selectedScreenKey, selectedKind, selectedPolicy, query])

  const selectedSurface = useMemo(() => {
    if (state.status !== 'ready') return null
    return (
      state.catalog.surfaces.find((surface) => surface.surfaceKey === selectedSurfaceKey) ?? null
    )
  }, [state, selectedSurfaceKey])

  const stats = state.status === 'ready' ? surfaceRegistryStats(state.catalog) : null
  const platform =
    state.status === 'ready'
      ? (state.catalog.applications[0]?.platform ?? null)
      : null

  const selectSurface = (surfaceKey: string) => {
    if (state.status !== 'ready') return
    const surface = state.catalog.surfaces.find((item) => item.surfaceKey === surfaceKey)
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
          ? (structuredClone(pack.bundle) as Record<string, unknown>)
          : { registries: {} }
      const registries =
        bundle.registries && typeof bundle.registries === 'object' && !Array.isArray(bundle.registries)
          ? (bundle.registries as Record<string, unknown>)
          : {}
      const existingSurfaces = Array.isArray(registries.surfaces)
        ? ([...registries.surfaces] as Record<string, unknown>[])
        : []
      const nextSurface = surfaceFromDraft(draft)
      const idx = existingSurfaces.findIndex((item) => item.surfaceKey === draft.surfaceKey)
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
      setReloadToken((value) => value + 1)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'failed to save surface draft')
    } finally {
      setSaving(false)
    }
  }

  if (state.status === 'loading') {
    return <>{fallback}</>
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-[8px] border border-red-200/80 bg-red-50/70 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">Surface registry unavailable</p>
            <p className="mt-0.5 text-xs opacity-90">{state.message}</p>
          </div>
        </div>
      </div>
    )
  }

  if (state.status === 'empty') {
    return (
      <div className="rounded-[8px] border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">No applications, screens, or surfaces</p>
            <p className="mt-0.5 text-xs opacity-90">
              {state.blockedReason ?? 'pack registry slice is empty'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <SurfaceRegistryHeader
        packKey={state.catalog.packKey}
        packVersion={state.catalog.packVersion}
        publicationState={state.catalog.publicationState}
        revision={state.catalog.revision}
        platform={platform}
        applicationCount={stats?.applicationCount ?? 0}
        screenCount={stats?.screenCount ?? 0}
        surfaceCount={stats?.surfaceCount ?? 0}
        verdictBlocking={stats?.verdictBlocking ?? 0}
        readOnly={readOnly}
        immutableReason={state.catalog.immutableReason ?? null}
        onRefresh={() => setReloadToken((value) => value + 1)}
        refreshing={false}
      />

      <SurfaceRegistryFilters
        applications={state.catalog.applications}
        screens={screensForApp}
        surfaces={state.catalog.surfaces}
        selectedAppKey={selectedAppKey}
        selectedScreenKey={selectedScreenKey}
        selectedKind={selectedKind}
        selectedPolicy={selectedPolicy}
        query={query}
        onAppChange={(appKey) => {
          setSelectedAppKey(appKey)
          const firstScreen = state.catalog.screens.find((screen) =>
            appKey ? screen.applicationRef === appKey : true,
          )
          setSelectedScreenKey(firstScreen?.screenKey ?? null)
        }}
        onScreenChange={setSelectedScreenKey}
        onKindChange={setSelectedKind}
        onPolicyChange={setSelectedPolicy}
        onQueryChange={setQuery}
      />

      <div className="overflow-hidden rounded-[8px] border border-border bg-card">
        <div className="border-b border-border bg-muted/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Surface registry</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {filteredSurfaces.length} of {state.catalog.surfaces.length} surfaces shown
          </p>
        </div>
        <div className="p-4">
          <SurfaceRegistryTable
            surfaces={filteredSurfaces}
            selectedSurfaceKey={selectedSurfaceKey}
            onSelect={selectSurface}
          />
        </div>
      </div>

      <SurfaceDetailPanel
        surface={selectedSurface}
        draft={draft}
        readOnly={readOnly}
        dirty={dirty}
        saving={saving}
        saveError={saveError}
        saveOk={saveOk}
        onDraftChange={updateDraft}
        onSave={handleSave}
      />
    </div>
  )
}

// Re-export constants used by tests or legacy imports
export { SURFACE_KINDS, SURFACE_POLICIES }
