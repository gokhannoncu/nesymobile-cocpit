'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
  Smartphone,
  Truck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@nesy/metronic/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nesy/metronic/components/ui/select'
import { cn } from '@nesy/metronic/lib/utils'
import { AUTOMATION_LOAD_TOUR_PATH } from '@nesy/metronic/config/layout-21.config'
import { ProductPage } from '@/components/product'
import { useNesyAuth } from '@/contexts/nesy-auth-context'
import { extractZimmetBarcodes } from '@/lib/automation/load-tour-barcodes'
import {
  fetchWorkflow,
  previewWorkflowYaml,
  startWorkflowRun,
} from '@/services/automation-api'
import {
  NESY_DASHBOARD_COUNTRY_ENVIRONMENTS,
  NESY_DASHBOARD_TOOLBAR_COUNTRIES,
  type NesyDashboardToolbarCountry,
  type NesyEnvironment,
} from '@/services/nesy-auth'
import {
  listNesyMobileAdbDevices,
  type NesyMobileAdbDevice,
} from '@/services/nesy-mobile-auth'
import { fetchPickups, type PickupRecord } from '@/services/pickup'
import { fetchShipments, type ShipmentRecord } from '@/services/shipment'

const WORKFLOW_SLUG = '01-load-tour-flow'

function isDeviceRunnable(device: NesyMobileAdbDevice) {
  const status = (device.status || '').toLowerCase()
  return status === 'device' || status === 'online'
}

function deviceTitle(device: NesyMobileAdbDevice) {
  return device.marketName || device.modelName || device.label || device.id
}

function shipmentLabel(record: ShipmentRecord) {
  const d = record.data ?? {}
  const shipmentId =
    (typeof d.shipmentId === 'string' && d.shipmentId) ||
    (typeof d.ShipmentId === 'string' && d.ShipmentId) ||
    record.id
  return shipmentId
}

function shipmentTypeLabel(record: ShipmentRecord) {
  const d = record.data ?? {}
  if (typeof d.shipmentType === 'string' && d.shipmentType) return d.shipmentType
  return '—'
}

export default function LoadTourFlowPage() {
  const router = useRouter()
  const {
    country,
    environment,
    setCountry,
    setEnvironment,
    availableEnvironments,
  } = useNesyAuth()

  const [shipments, setShipments] = useState<ShipmentRecord[]>([])
  const [pickups, setPickups] = useState<PickupRecord[]>([])
  const [loadingLists, setLoadingLists] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const [selectedShipmentIds, setSelectedShipmentIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [selectedPickupIds, setSelectedPickupIds] = useState<Set<string>>(
    () => new Set(),
  )

  const [devices, setDevices] = useState<NesyMobileAdbDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [loadingDevices, setLoadingDevices] = useState(false)

  const [workflowId, setWorkflowId] = useState<string | null>(null)
  const [workflowNodes, setWorkflowNodes] = useState<unknown[]>([])
  const [workflowEdges, setWorkflowEdges] = useState<unknown[]>([])
  const [workflowConfig, setWorkflowConfig] = useState<Record<
    string,
    unknown
  > | null>(null)

  const [yamlPreview, setYamlPreview] = useState<string>('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [running, setRunning] = useState(false)

  const countryReady = Boolean(country && environment)

  const selectedShipments = useMemo(
    () => shipments.filter((s) => selectedShipmentIds.has(s.id)),
    [shipments, selectedShipmentIds],
  )
  const selectedPickups = useMemo(
    () => pickups.filter((p) => selectedPickupIds.has(p.id)),
    [pickups, selectedPickupIds],
  )

  const zimmetBarcodes = useMemo(() => {
    const codes: string[] = []
    const seen = new Set<string>()
    for (const shipment of selectedShipments) {
      for (const code of extractZimmetBarcodes(shipment.data)) {
        if (seen.has(code)) continue
        seen.add(code)
        codes.push(code)
      }
    }
    return codes
  }, [selectedShipments])

  const hasSelection =
    selectedShipments.length > 0 || selectedPickups.length > 0
  const canRun =
    countryReady && hasSelection && Boolean(selectedDeviceId) && !running

  const runInput = useMemo(() => {
    const input: Record<string, string> = {}
    if (zimmetBarcodes.length > 0) input.barcode = zimmetBarcodes.join(',')
    if (selectedPickups.length > 0) {
      input.pickupDbIds = selectedPickups.map((p) => p.id).join(',')
    }
    return input
  }, [zimmetBarcodes, selectedPickups])

  const loadLists = useCallback(async () => {
    if (!country || !environment) {
      setShipments([])
      setPickups([])
      return
    }
    setLoadingLists(true)
    setListError(null)
    try {
      const [shipRows, pickRows] = await Promise.all([
        fetchShipments({ country, environment }),
        fetchPickups({ country, environment }),
      ])
      setShipments(shipRows)
      setPickups(pickRows)
      setSelectedShipmentIds(new Set())
      setSelectedPickupIds(new Set())
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load shipments/pickups'
      setListError(message)
      toast.error(message)
    } finally {
      setLoadingLists(false)
    }
  }, [country, environment])

  const loadDevices = useCallback(async () => {
    setLoadingDevices(true)
    try {
      const response = await listNesyMobileAdbDevices()
      const next = response.devices ?? []
      setDevices(next)
      setSelectedDeviceId((prev) => {
        if (prev && next.some((d) => d.id === prev && isDeviceRunnable(d))) {
          return prev
        }
        return next.find(isDeviceRunnable)?.id ?? null
      })
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'ADB devices could not be listed.',
      )
    } finally {
      setLoadingDevices(false)
    }
  }, [])

  const loadWorkflow = useCallback(async () => {
    try {
      const workflow = await fetchWorkflow(WORKFLOW_SLUG)
      setWorkflowId(workflow.id)
      const version = workflow.currentVersion
      setWorkflowNodes(version?.nodes ?? [])
      setWorkflowEdges(version?.edges ?? [])
      setWorkflowConfig(version?.config ?? null)
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'LOAD & TOUR workflow could not be loaded.',
      )
    }
  }, [])

  useEffect(() => {
    void loadLists()
  }, [loadLists])

  useEffect(() => {
    void loadDevices()
    void loadWorkflow()
  }, [loadDevices, loadWorkflow])

  useEffect(() => {
    if (!hasSelection || workflowNodes.length === 0) {
      setYamlPreview('')
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    void previewWorkflowYaml({
      nodes: workflowNodes,
      edges: workflowEdges,
      config: workflowConfig,
      country: country || undefined,
      environment: environment || undefined,
      runInput,
    })
      .then((yaml) => {
        if (!cancelled) setYamlPreview(yaml)
      })
      .catch((err) => {
        if (!cancelled) {
          setYamlPreview('')
          toast.error(
            err instanceof Error ? err.message : 'YAML preview failed',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [
    hasSelection,
    workflowNodes,
    workflowEdges,
    workflowConfig,
    country,
    environment,
    runInput,
  ])

  const toggleShipment = (id: string) => {
    setSelectedShipmentIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const togglePickup = (id: string) => {
    setSelectedPickupIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCountryChange = (value: string) => {
    const next = value as NesyDashboardToolbarCountry
    setCountry(next)
    const envs = NESY_DASHBOARD_COUNTRY_ENVIRONMENTS[next] as readonly NesyEnvironment[]
    if (!envs.includes(environment)) {
      setEnvironment(envs[0] ?? 'stage')
    }
  }

  const handleRun = async () => {
    if (!canRun || !selectedDeviceId || !country || !environment) return
    setRunning(true)
    try {
      const result = await startWorkflowRun(WORKFLOW_SLUG, {
        selectedDeviceId,
        mode: 'full',
        country,
        environment,
        runInput,
      })
      toast.success('Load & Tour run started')
      router.push(
        `/automation/${WORKFLOW_SLUG}/runs/${result.runId}`,
      )
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to start workflow run',
      )
    } finally {
      setRunning(false)
    }
  }

  return (
    <ProductPage
      path={AUTOMATION_LOAD_TOUR_PATH}
      title="Load & Tour Flow"
      toolbarActions={
        workflowId ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/automation/${workflowId}`}>
              <ExternalLink className="size-3.5" />
              Graph editor
            </Link>
          </Button>
        ) : null
      }
    >
      <div className="space-y-6 pb-10">
        <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Truck className="size-4 text-emerald-600" />
                Select country, then shipments and optional pickups
              </div>
              <p className="max-w-2xl text-sm text-muted-foreground">
                No create/generate on this page. Pick existing Cockpit records,
                preview LOAD YAML, then run zimmet → tour request → tour
                approve (pickup assign when selected).
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Country
                </label>
                <Select value={country} onValueChange={handleCountryChange}>
                  <SelectTrigger className="h-10 w-[120px]">
                    <SelectValue placeholder="Country" />
                  </SelectTrigger>
                  <SelectContent>
                    {NESY_DASHBOARD_TOOLBAR_COUNTRIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Environment
                </label>
                <Select
                  value={environment}
                  onValueChange={(v) => setEnvironment(v as NesyEnvironment)}
                >
                  <SelectTrigger className="h-10 w-[120px]">
                    <SelectValue placeholder="Env" />
                  </SelectTrigger>
                  <SelectContent>
                    {(availableEnvironments.length
                      ? availableEnvironments
                      : ['stage', 'prod']
                    ).map((env) => (
                      <SelectItem key={env} value={env}>
                        {env}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-10"
                onClick={() => void loadLists()}
                disabled={!countryReady || loadingLists}
              >
                {loadingLists ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                Refresh lists
              </Button>
            </div>
          </div>
        </section>

        {!countryReady ? (
          <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
            Select a country and environment to load shipment and pickup tables.
          </div>
        ) : (
          <>
            {listError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                {listError}
              </div>
            ) : null}

            <section className="rounded-xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold">
                  Shipments{' '}
                  <span className="font-normal text-muted-foreground">
                    ({selectedShipmentIds.size} selected / {shipments.length})
                  </span>
                </h2>
              </div>
              <div className="max-h-[320px] overflow-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="sticky top-0 bg-muted/80 text-xs text-muted-foreground backdrop-blur">
                    <tr>
                      <th className="w-10 px-4 py-2" />
                      <th className="px-3 py-2 font-medium">Shipment</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Unload</th>
                      <th className="px-3 py-2 font-medium">Zimmet barcodes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingLists ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-muted-foreground"
                        >
                          <Loader2 className="mx-auto size-4 animate-spin" />
                        </td>
                      </tr>
                    ) : shipments.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-muted-foreground"
                        >
                          No shipments for {country}/{environment}. Create them
                          in Data Center first.
                        </td>
                      </tr>
                    ) : (
                      shipments.map((row) => {
                        const codes = extractZimmetBarcodes(row.data)
                        const checked = selectedShipmentIds.has(row.id)
                        return (
                          <tr
                            key={row.id}
                            className={cn(
                              'border-t border-border/70 hover:bg-muted/40',
                              checked && 'bg-emerald-50/60 dark:bg-emerald-950/20',
                            )}
                          >
                            <td className="px-4 py-2.5">
                              <input
                                type="checkbox"
                                className="size-4 accent-emerald-600"
                                checked={checked}
                                onChange={() => toggleShipment(row.id)}
                                aria-label={`Select shipment ${shipmentLabel(row)}`}
                              />
                            </td>
                            <td className="px-3 py-2.5 font-mono text-xs">
                              {shipmentLabel(row)}
                            </td>
                            <td className="px-3 py-2.5">{shipmentTypeLabel(row)}</td>
                            <td className="px-3 py-2.5">{row.unloadStatus}</td>
                            <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                              {codes.length ? codes.join(', ') : '—'}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold">
                  Pickups{' '}
                  <span className="font-normal text-muted-foreground">
                    (optional · {selectedPickupIds.size} selected /{' '}
                    {pickups.length})
                  </span>
                </h2>
              </div>
              <div className="max-h-[280px] overflow-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="sticky top-0 bg-muted/80 text-xs text-muted-foreground backdrop-blur">
                    <tr>
                      <th className="w-10 px-4 py-2" />
                      <th className="px-3 py-2 font-medium">Shipment / waybill</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Assign status</th>
                      <th className="px-3 py-2 font-medium">DB id</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingLists ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-muted-foreground"
                        >
                          <Loader2 className="mx-auto size-4 animate-spin" />
                        </td>
                      </tr>
                    ) : pickups.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-muted-foreground"
                        >
                          No pickups for {country}/{environment}. Optional —
                          leave empty if you only need zimmet.
                        </td>
                      </tr>
                    ) : (
                      pickups.map((row) => {
                        const checked = selectedPickupIds.has(row.id)
                        return (
                          <tr
                            key={row.id}
                            className={cn(
                              'border-t border-border/70 hover:bg-muted/40',
                              checked && 'bg-emerald-50/60 dark:bg-emerald-950/20',
                            )}
                          >
                            <td className="px-4 py-2.5">
                              <input
                                type="checkbox"
                                className="size-4 accent-emerald-600"
                                checked={checked}
                                onChange={() => togglePickup(row.id)}
                                aria-label={`Select pickup ${row.shipmentId || row.id}`}
                              />
                            </td>
                            <td className="px-3 py-2.5 font-mono text-xs">
                              {row.shipmentId || '—'}
                            </td>
                            <td className="px-3 py-2.5">{row.pickupType}</td>
                            <td className="px-3 py-2.5">{row.assignStatus}</td>
                            <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                              {row.id}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold">Run summary</h2>
                  <p className="text-sm text-muted-foreground">
                    {hasSelection ? (
                      <>
                        {zimmetBarcodes.length} barcode
                        {zimmetBarcodes.length === 1 ? '' : 's'} for zimmet ·{' '}
                        {selectedPickups.length} pickup
                        {selectedPickups.length === 1 ? '' : 's'} for assign
                      </>
                    ) : (
                      <>Select at least one shipment or one pickup to enable Run.</>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Smartphone className="size-3.5" />
                      Device
                    </label>
                    <div className="flex gap-2">
                      <Select
                        value={selectedDeviceId ?? undefined}
                        onValueChange={setSelectedDeviceId}
                      >
                        <SelectTrigger className="h-10 min-w-[220px]">
                          <SelectValue placeholder="Select device" />
                        </SelectTrigger>
                        <SelectContent>
                          {devices.map((device) => (
                            <SelectItem
                              key={device.id}
                              value={device.id}
                              disabled={!isDeviceRunnable(device)}
                            >
                              {deviceTitle(device)}
                              {!isDeviceRunnable(device) ? ' (offline)' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10"
                        onClick={() => void loadDevices()}
                        disabled={loadingDevices}
                      >
                        {loadingDevices ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <Button
                    className="h-10 bg-orange-500 text-white hover:bg-orange-600"
                    disabled={!canRun}
                    onClick={() => void handleRun()}
                  >
                    {running ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Play className="size-3.5" />
                    )}
                    Run
                  </Button>
                </div>
              </div>

              {!hasSelection ? (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Validation: need ≥1 shipment or ≥1 pickup.
                </p>
              ) : null}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    YAML preview
                  </h3>
                  {previewLoading ? (
                    <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                  ) : null}
                </div>
                <pre className="max-h-[280px] overflow-auto rounded-lg border border-border bg-slate-950 p-4 text-[11px] leading-relaxed text-slate-100">
                  {yamlPreview ||
                    (hasSelection
                      ? '# Generating preview…'
                      : '# Select shipments and/or pickups to preview LOAD YAML')}
                </pre>
              </div>
            </section>
          </>
        )}
      </div>
    </ProductPage>
  )
}
