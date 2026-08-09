'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type RowSelectionState,
} from '@tanstack/react-table'
import {
  ArrowRight,
  Barcode,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  Globe2,
  Loader2,
  Package,
  Play,
  RefreshCw,
  Search,
  Smartphone,
  Truck,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@nesy/metronic/components/ui/alert'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardHeading,
  CardTable,
  CardTitle,
  CardToolbar,
} from '@nesy/metronic/components/ui/card'
import { DataGrid } from '@nesy/metronic/components/ui/data-grid'
import { DataGridPagination } from '@nesy/metronic/components/ui/data-grid-pagination'
import {
  DataGridTable,
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
} from '@nesy/metronic/components/ui/data-grid-table'
import { Input, InputWrapper } from '@nesy/metronic/components/ui/input'
import { ScrollArea, ScrollBar } from '@nesy/metronic/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nesy/metronic/components/ui/select'
import { Skeleton } from '@nesy/metronic/components/ui/skeleton'
import { Progress } from '@nesy/metronic/components/ui/progress'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@nesy/metronic/components/ui/tabs'
import { cn } from '@nesy/metronic/lib/utils'
import {
  DATA_CENTER_PICKUP_PATH,
  DATA_CENTER_SHIPMENT_PATH,
} from '@nesy/metronic/config/layout-21.config'
import { useNesyAuth } from '@/contexts/nesy-auth-context'
import { extractZimmetBarcodes } from '@/lib/automation/load-tour-barcodes'
import {
  fetchWorkflow,
  previewWorkflowYaml,
} from '@/services/automation-api'
import { startPinnedVerdictRun } from '@/lib/verdict-runtime/start-pinned-run'
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

const WORKFLOW_STEPS = [
  { id: 'zimmet', label: 'Zimmet', detail: 'Load barcodes to vehicle' },
  { id: 'tour-request', label: 'Tour request', detail: 'Submit route request' },
  { id: 'tour-approve', label: 'Tour approve', detail: 'Approve assigned tour' },
  { id: 'pickup-assign', label: 'Pickup assign', detail: 'Optional pickup tasks' },
] as const

const selectSkeleton = <Skeleton className="size-4" />
const textSkeleton = <Skeleton className="h-4 w-full" />
const badgeSkeleton = <Skeleton className="h-6 w-20" />

function isDeviceRunnable(device: NesyMobileAdbDevice) {
  const status = (device.status || '').toLowerCase()
  return status === 'device' || status === 'online'
}

function deviceTitle(device: NesyMobileAdbDevice) {
  return device.marketName || device.modelName || device.label || device.id
}

function shipmentLabel(record: ShipmentRecord) {
  const d = record.data ?? {}
  return (
    (typeof d.shipmentId === 'string' && d.shipmentId) ||
    (typeof d.ShipmentId === 'string' && d.ShipmentId) ||
    record.id
  )
}

function shipmentTypeLabel(record: ShipmentRecord) {
  const d = record.data ?? {}
  if (typeof d.shipmentType === 'string' && d.shipmentType) return d.shipmentType
  return 'Standard'
}

function unloadStatusVariant(status: string) {
  if (status === 'Completed') return 'success' as const
  if (status === 'Failed') return 'destructive' as const
  return 'secondary' as const
}

function assignStatusVariant(status: string) {
  if (status === 'Assigned') return 'success' as const
  if (status === 'Pending') return 'secondary' as const
  return 'warning' as const
}

function assignStatusLabel(status: string) {
  if (status === 'TaskNotFound') return 'Task not found'
  if (status === 'AssignFailed') return 'Assign failed'
  if (status === 'PickupListFailed') return 'List failed'
  if (status === 'NoSchedule') return 'No schedule'
  return status
}

type ShipmentRow = {
  id: string
  shipmentId: string
  type: string
  unloadStatus: string
  barcodes: string[]
  record: ShipmentRecord
}

type PickupRow = {
  id: string
  shipmentId: string
  pickupType: string
  assignStatus: string
  record: PickupRecord
}

function mapShipmentRow(record: ShipmentRecord): ShipmentRow {
  return {
    id: record.id,
    shipmentId: shipmentLabel(record),
    type: shipmentTypeLabel(record),
    unloadStatus: record.unloadStatus ?? 'Pending',
    barcodes: extractZimmetBarcodes(record.data),
    record,
  }
}

function mapPickupRow(record: PickupRecord): PickupRow {
  return {
    id: record.id,
    shipmentId: record.shipmentId || '—',
    pickupType:
      record.pickupType === 'remote' ? 'Remote pickup' : 'Pickup at customer',
    assignStatus: record.assignStatus,
    record,
  }
}

function globalRowFilter(row: Record<string, unknown>, query: string) {
  const hay = Object.values(row)
    .flatMap((value) => {
      if (Array.isArray(value)) return value.join(' ')
      if (value && typeof value === 'object') return JSON.stringify(value)
      return String(value ?? '')
    })
    .join(' ')
    .toLowerCase()
  return hay.includes(query.toLowerCase())
}

export function LoadTourFlowWorkspace() {
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

  const [shipmentSelection, setShipmentSelection] = useState<RowSelectionState>({})
  const [pickupSelection, setPickupSelection] = useState<RowSelectionState>({})
  const [shipmentSearch, setShipmentSearch] = useState('')
  const [pickupSearch, setPickupSearch] = useState('')
  const [shipmentPagination, setShipmentPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 8,
  })
  const [pickupPagination, setPickupPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 8,
  })

  const [devices, setDevices] = useState<NesyMobileAdbDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [loadingDevices, setLoadingDevices] = useState(false)

  const [workflowNodes, setWorkflowNodes] = useState<unknown[]>([])
  const [workflowEdges, setWorkflowEdges] = useState<unknown[]>([])
  const [workflowConfig, setWorkflowConfig] = useState<Record<string, unknown> | null>(
    null,
  )

  const [yamlPreview, setYamlPreview] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [running, setRunning] = useState(false)

  const [yamlCopied, setYamlCopied] = useState(false)

  const countryReady = Boolean(country && environment)

  const shipmentRows = useMemo(() => shipments.map(mapShipmentRow), [shipments])
  const pickupRows = useMemo(() => pickups.map(mapPickupRow), [pickups])

  const selectedShipmentIds = useMemo(
    () => Object.keys(shipmentSelection).filter((id) => shipmentSelection[id]),
    [shipmentSelection],
  )
  const selectedPickupIds = useMemo(
    () => Object.keys(pickupSelection).filter((id) => pickupSelection[id]),
    [pickupSelection],
  )

  const selectedShipments = useMemo(
    () => shipments.filter((s) => selectedShipmentIds.includes(s.id)),
    [shipments, selectedShipmentIds],
  )
  const selectedPickups = useMemo(
    () => pickups.filter((p) => selectedPickupIds.includes(p.id)),
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

  const hasSelection = selectedShipments.length > 0 || selectedPickups.length > 0
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

  const setupStepDone = countryReady
  const selectionStepDone = hasSelection
  const deviceStepDone = Boolean(selectedDeviceId)

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
      setShipmentSelection({})
      setPickupSelection({})
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
      const result = await startPinnedVerdictRun({
        workflowRef: WORKFLOW_SLUG,
        deviceId: selectedDeviceId,
        workflowIr: {
          nodes: workflowNodes,
          edges: workflowEdges,
        },
      })
      toast.success(
        `Load & Tour queued via Verdict BridgeFlow (${zimmetBarcodes.length} barcode(s), plan ${result.compiledPlanHash.slice(0, 12)}…)`,
      )
      router.push(`/automation/${WORKFLOW_SLUG}/runs/${result.runId}`)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to start workflow run',
      )
    } finally {
      setRunning(false)
    }
  }

  const shipmentColumns = useMemo<ColumnDef<ShipmentRow>[]>(
    () => [
      {
        accessorKey: 'id',
        header: () => <DataGridTableRowSelectAll />,
        cell: ({ row }) => <DataGridTableRowSelect row={row} />,
        enableSorting: false,
        enableHiding: false,
        size: 36,
        meta: { skeleton: selectSkeleton },
      },
      {
        accessorKey: 'shipmentId',
        header: () => <span>Shipment</span>,
        cell: ({ row }) => (
          <span className="font-mono text-xs font-medium text-foreground">
            {row.original.shipmentId}
          </span>
        ),
        size: 160,
        meta: { skeleton: textSkeleton },
      },
      {
        accessorKey: 'type',
        header: () => <span>Type</span>,
        cell: ({ row }) => (
          <Badge variant="outline" appearance="light" size="sm">
            {row.original.type}
          </Badge>
        ),
        size: 110,
        meta: { skeleton: badgeSkeleton },
      },
      {
        accessorKey: 'unloadStatus',
        header: () => <span>Unload</span>,
        cell: ({ row }) => (
          <Badge
            variant={unloadStatusVariant(row.original.unloadStatus)}
            appearance="light"
            size="sm"
          >
            {row.original.unloadStatus}
          </Badge>
        ),
        size: 110,
        meta: { skeleton: badgeSkeleton },
      },
      {
        accessorKey: 'barcodes',
        header: () => <span>Zimmet barcodes</span>,
        cell: ({ row }) => {
          const codes = row.original.barcodes
          if (!codes.length) {
            return <span className="text-muted-foreground">—</span>
          }
          return (
            <div className="flex flex-wrap gap-1">
              {codes.slice(0, 2).map((code) => (
                <Badge key={code} variant="info" appearance="outline" size="sm">
                  {code}
                </Badge>
              ))}
              {codes.length > 2 ? (
                <Badge variant="secondary" appearance="light" size="sm">
                  +{codes.length - 2}
                </Badge>
              ) : null}
            </div>
          )
        },
        size: 220,
        meta: { skeleton: textSkeleton },
      },
    ],
    [],
  )

  const pickupColumns = useMemo<ColumnDef<PickupRow>[]>(
    () => [
      {
        accessorKey: 'id',
        header: () => <DataGridTableRowSelectAll />,
        cell: ({ row }) => <DataGridTableRowSelect row={row} />,
        enableSorting: false,
        enableHiding: false,
        size: 36,
        meta: { skeleton: selectSkeleton },
      },
      {
        accessorKey: 'shipmentId',
        header: () => <span>Shipment / waybill</span>,
        cell: ({ row }) => (
          <span className="font-mono text-xs font-medium text-foreground">
            {row.original.shipmentId}
          </span>
        ),
        size: 160,
        meta: { skeleton: textSkeleton },
      },
      {
        accessorKey: 'pickupType',
        header: () => <span>Type</span>,
        cell: ({ row }) => (
          <Badge variant="outline" appearance="light" size="sm">
            {row.original.pickupType}
          </Badge>
        ),
        size: 150,
        meta: { skeleton: badgeSkeleton },
      },
      {
        accessorKey: 'assignStatus',
        header: () => <span>Assign status</span>,
        cell: ({ row }) => (
          <Badge
            variant={assignStatusVariant(row.original.assignStatus)}
            appearance="light"
            size="sm"
          >
            {assignStatusLabel(row.original.assignStatus)}
          </Badge>
        ),
        size: 130,
        meta: { skeleton: badgeSkeleton },
      },
      {
        id: 'dbId',
        accessorFn: (row) => row.id,
        header: () => <span>DB id</span>,
        cell: ({ row }) => (
          <span
            className="block max-w-[140px] truncate font-mono text-[11px] text-muted-foreground"
            title={row.original.id}
          >
            {row.original.id}
          </span>
        ),
        size: 150,
        meta: { skeleton: textSkeleton },
      },
    ],
    [],
  )

  const shipmentTable = useReactTable({
    data: shipmentRows,
    columns: shipmentColumns,
    state: {
      rowSelection: shipmentSelection,
      globalFilter: shipmentSearch,
      pagination: shipmentPagination,
    },
    onRowSelectionChange: setShipmentSelection,
    onGlobalFilterChange: setShipmentSearch,
    onPaginationChange: setShipmentPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue) =>
      globalRowFilter(row.original as unknown as Record<string, unknown>, String(filterValue)),
    enableRowSelection: true,
    getRowId: (row) => row.id,
  })

  const pickupTable = useReactTable({
    data: pickupRows,
    columns: pickupColumns,
    state: {
      rowSelection: pickupSelection,
      globalFilter: pickupSearch,
      pagination: pickupPagination,
    },
    onRowSelectionChange: setPickupSelection,
    onGlobalFilterChange: setPickupSearch,
    onPaginationChange: setPickupPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue) =>
      globalRowFilter(row.original as unknown as Record<string, unknown>, String(filterValue)),
    enableRowSelection: true,
    getRowId: (row) => row.id,
  })

  const copyYamlPreview = useCallback(async () => {
    if (!yamlPreview) return
    try {
      await navigator.clipboard.writeText(yamlPreview)
      setYamlCopied(true)
      toast.success('YAML copied to clipboard')
      window.setTimeout(() => setYamlCopied(false), 2000)
    } catch {
      toast.error('Could not copy YAML')
    }
  }, [yamlPreview])

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId)

  return (
    <div className="space-y-6 pb-28 xl:pb-10">
      <Card className="overflow-hidden border-nesy/15 bg-gradient-to-br from-nesy-soft/40 via-card to-card">
        <CardHeader className="min-h-0 flex-col items-start gap-4 border-none pb-0 sm:flex-row sm:items-center">
          <CardHeading className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-lg bg-nesy text-white shadow-sm">
                <Truck className="size-4" />
              </span>
              <div>
                <CardTitle className="text-base">Configure & run</CardTitle>
                <CardDescription className="mt-1 max-w-2xl">
                  Select Cockpit records, then queue zimmet → tour request → tour
                  approve via Verdict WorkflowRunApi (BridgeFlow) on a connected device.
                </CardDescription>
              </div>
            </div>
          </CardHeading>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          <WorkflowPipeline
            setupDone={setupStepDone}
            selectionDone={selectionStepDone}
            deviceDone={deviceStepDone}
            pickupSelected={selectedPickups.length > 0}
          />
          <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-background/80 p-4 backdrop-blur-sm lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info" appearance="light" size="md">
                <Globe2 className="size-3.5" />
                {country?.toUpperCase() || '—'} / {environment || '—'}
              </Badge>
              <Badge variant="secondary" appearance="light" size="md">
                <Package className="size-3.5" />
                {shipments.length} shipments
              </Badge>
              <Badge variant="secondary" appearance="light" size="md">
                <Truck className="size-3.5" />
                {pickups.length} pickups
              </Badge>
            </div>
            <div className="flex flex-wrap items-end gap-2">
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
                className="h-10"
                onClick={() => void loadLists()}
                disabled={!countryReady || loadingLists}
              >
                {loadingLists ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                Refresh data
              </Button>
              {countryReady ? (
                <>
                  <Button variant="ghost" className="h-10" size="sm" asChild>
                    <Link href={DATA_CENTER_SHIPMENT_PATH}>Shipments</Link>
                  </Button>
                  <Button variant="ghost" className="h-10" size="sm" asChild>
                    <Link href={DATA_CENTER_PICKUP_PATH}>Pickups</Link>
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {!countryReady ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Globe2 className="size-10 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">
              Choose country and environment
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              Shipment and pickup tables load from Cockpit Data Center for the
              selected market.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-4">
            {listError ? (
              <Alert variant="destructive" appearance="light" size="md">
                <AlertTitle>Could not load records</AlertTitle>
                <AlertDescription>{listError}</AlertDescription>
              </Alert>
            ) : null}

            <Tabs defaultValue="shipments" className="gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <TabsList variant="line" size="md">
                  <TabsTrigger value="shipments">
                    Shipments
                    {selectedShipmentIds.length > 0 ? (
                      <Badge variant="success" appearance="light" size="sm">
                        {selectedShipmentIds.length}
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger value="pickups">
                    Pickups
                    <span className="text-muted-foreground">(optional)</span>
                    {selectedPickupIds.length > 0 ? (
                      <Badge variant="success" appearance="light" size="sm">
                        {selectedPickupIds.length}
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="shipments" className="mt-0">
                <SelectionTableCard
                  title="Shipments"
                  description="Select one or more shipments to extract zimmet barcodes."
                  searchValue={shipmentSearch}
                  onSearchChange={setShipmentSearch}
                  searchPlaceholder="Search shipment id, type, barcode…"
                  loading={loadingLists}
                  emptyTitle="No shipments in this environment"
                  emptyDescription={`Create shipments in Data Center for ${country}/${environment}, then refresh.`}
                  emptyActionHref={DATA_CENTER_SHIPMENT_PATH}
                  emptyActionLabel="Open Data Center · Shipments"
                  selectedCount={selectedShipmentIds.length}
                  totalCount={shipments.length}
                  table={shipmentTable}
                  onClearSelection={() => setShipmentSelection({})}
                />
              </TabsContent>

              <TabsContent value="pickups" className="mt-0">
                <SelectionTableCard
                  title="Pickups"
                  description="Optional — include pickups when you need assign steps in the run."
                  searchValue={pickupSearch}
                  onSearchChange={setPickupSearch}
                  searchPlaceholder="Search waybill, task id, status…"
                  loading={loadingLists}
                  emptyTitle="No pickups in this environment"
                  emptyDescription="Pickups are optional. Leave empty if you only need zimmet."
                  emptyActionHref={DATA_CENTER_PICKUP_PATH}
                  emptyActionLabel="Open Data Center · Pickups"
                  selectedCount={selectedPickupIds.length}
                  totalCount={pickups.length}
                  table={pickupTable}
                  onClearSelection={() => setPickupSelection({})}
                />
              </TabsContent>
            </Tabs>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <RunSummaryPanel
              hasSelection={hasSelection}
              zimmetBarcodes={zimmetBarcodes}
              selectedShipments={selectedShipments.length}
              selectedPickups={selectedPickups.length}
              devices={devices}
              selectedDeviceId={selectedDeviceId}
              selectedDevice={selectedDevice}
              loadingDevices={loadingDevices}
              onDeviceChange={setSelectedDeviceId}
              onRefreshDevices={() => void loadDevices()}
              canRun={canRun}
              running={running}
              onRun={() => void handleRun()}
              setupStepDone={setupStepDone}
              selectionStepDone={selectionStepDone}
              deviceStepDone={deviceStepDone}
            />

            <Card className="overflow-hidden">
              <CardHeader className="min-h-12 border-b py-3">
                <CardHeading>
                  <CardTitle className="text-sm">Legacy YAML preview</CardTitle>
                  <CardDescription className="text-xs">
                    Debug-only legacy YAML — run uses Verdict BridgeFlow, not Maestro
                  </CardDescription>
                </CardHeading>
                <CardToolbar>
                  {previewLoading ? (
                    <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                  ) : yamlPreview ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => void copyYamlPreview()}
                    >
                      {yamlCopied ? (
                        <Check className="size-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      {yamlCopied ? 'Copied' : 'Copy'}
                    </Button>
                  ) : null}
                </CardToolbar>
              </CardHeader>
              <CardContent className="overflow-hidden bg-slate-950 p-0">
                <ScrollArea className="h-[280px] w-full">
                  <pre className="p-4 font-mono text-[11px] leading-relaxed text-slate-100">
                    <code className="block whitespace-pre-wrap break-all">
                      {yamlPreview ||
                        (hasSelection
                          ? '# Generating preview…'
                          : '# Select shipments and/or pickups to preview LOAD YAML')}
                    </code>
                  </pre>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
                <div className="border-t border-slate-800 px-4 py-2 text-[11px] text-slate-400">
                  {hasSelection
                    ? `${zimmetBarcodes.length} barcode(s) · ${selectedPickups.length} pickup(s) in payload`
                    : 'Preview updates automatically when your selection changes.'}
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      )}

      {countryReady ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)] backdrop-blur supports-[backdrop-filter]:bg-background/80 xl:hidden">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    canRun ? 'bg-emerald-500' : 'bg-nesy',
                  )}
                  style={{
                    width: `${Math.round(((setupStepDone ? 1 : 0) + (selectionStepDone ? 1 : 0) + (deviceStepDone ? 1 : 0)) / 3 * 100)}%`,
                  }}
                />
              </div>
              <p className="truncate text-sm font-medium">
                {hasSelection
                  ? `${zimmetBarcodes.length} barcode · ${selectedPickups.length} pickup`
                  : 'Select records to run'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {selectedDevice
                  ? deviceTitle(selectedDevice)
                  : 'No device selected'}
              </p>
            </div>
            <Button
              variant="nesy"
              className="shrink-0"
              disabled={!canRun}
              onClick={() => void handleRun()}
            >
              {running ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              Run
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function WorkflowPipeline({
  setupDone,
  selectionDone,
  deviceDone,
  pickupSelected,
}: {
  setupDone: boolean
  selectionDone: boolean
  deviceDone: boolean
  pickupSelected: boolean
}) {
  const checkpoints = [
    { label: 'Environment', done: setupDone },
    { label: 'Records', done: selectionDone },
    { label: 'Device', done: deviceDone },
    { label: 'Run', done: false },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {checkpoints.map((step, index) => (
          <div key={step.label} className="flex items-center gap-2">
            <div
              className={cn(
                'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                step.done
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'border-border bg-background text-muted-foreground',
              )}
            >
              {step.done ? (
                <CheckCircle2 className="size-3.5 shrink-0" />
              ) : (
                <Circle className="size-3.5 shrink-0" />
              )}
              {step.label}
            </div>
            {index < checkpoints.length - 1 ? (
              <ArrowRight className="size-3.5 text-muted-foreground/60" />
            ) : null}
          </div>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {WORKFLOW_STEPS.map((step, index) => {
          const active =
            step.id === 'pickup-assign' ? pickupSelected : selectionDone
          return (
            <div
              key={step.id}
              className={cn(
                'relative rounded-lg border px-3 py-2.5 transition-colors',
                active
                  ? 'border-nesy/30 bg-nesy-soft/30'
                  : 'border-border/70 bg-muted/20',
                step.id === 'pickup-assign' && !pickupSelected && 'opacity-70',
              )}
            >
              <span className="absolute right-2 top-2 text-[10px] font-semibold tabular-nums text-muted-foreground/70">
                {index + 1}
              </span>
              <p className="text-xs font-semibold text-foreground">{step.label}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {step.detail}
                {step.id === 'pickup-assign' && !pickupSelected
                  ? ' · skipped when no pickup selected'
                  : ''}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SelectionTableCard<T extends { id: string }>({
  title,
  description,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  loading,
  emptyTitle,
  emptyDescription,
  emptyActionHref,
  emptyActionLabel,
  selectedCount,
  totalCount,
  table,
  onClearSelection,
}: {
  title: string
  description: string
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder: string
  loading: boolean
  emptyTitle: string
  emptyDescription: string
  emptyActionHref: string
  emptyActionLabel: string
  selectedCount: number
  totalCount: number
  table: ReturnType<typeof useReactTable<T>>
  onClearSelection: () => void
}) {
  const filteredCount = table.getFilteredRowModel().rows.length
  const hasFilter = searchValue.trim().length > 0

  if (loading) {
    return (
      <Card>
        <CardHeader className="min-h-0 flex-col items-start gap-3 border-b py-4">
          <CardHeading>
            <CardTitle className="text-sm">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </CardHeading>
        </CardHeader>
        <CardContent className="space-y-3 py-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (totalCount === 0) {
    return (
      <Card>
        <CardHeader className="min-h-0 flex-col items-start gap-3 border-b py-4">
          <CardHeading>
            <CardTitle className="text-sm">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </CardHeading>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <Package className="size-9 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {emptyDescription}
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href={emptyActionHref}>{emptyActionLabel}</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <DataGrid
      table={table}
      recordCount={filteredCount}
      isLoading={loading}
      loadingSkeletonRowCount={5}
      onRowClick={(row) => {
        const tableRow = table.getRow(row.id)
        tableRow?.toggleSelected()
      }}
      tableLayout={{
        cellBorder: true,
        rowBorder: true,
        headerBorder: true,
        headerSticky: true,
        width: 'fixed',
      }}
    >
      <Card>
        <CardHeader className="min-h-0 flex-col items-start gap-3 border-b py-4 sm:flex-row sm:items-center">
          <CardHeading className="min-w-0">
            <CardTitle className="text-sm">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </CardHeading>
          <CardToolbar className="w-full flex-wrap gap-2 sm:w-auto">
            <Badge variant="secondary" appearance="light" size="sm">
              {selectedCount} selected / {totalCount}
            </Badge>
            {selectedCount > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={onClearSelection}
              >
                Clear selection
              </Button>
            ) : null}
          </CardToolbar>
        </CardHeader>

        <div className="border-b border-border p-3">
          <InputWrapper>
            <Search className="size-4 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
            />
            {hasFilter ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </InputWrapper>
        </div>

        {filteredCount === 0 ? (
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Search className="size-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">
              No rows match your search
            </p>
            <p className="text-sm text-muted-foreground">
              Try a different shipment id, barcode, or status keyword.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onSearchChange('')}
            >
              Clear search
            </Button>
          </CardContent>
        ) : (
          <>
            <CardTable>
              <ScrollArea className="max-h-[360px] w-full">
                <DataGridTable />
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardTable>
            <CardFooter className="justify-between gap-3 py-3">
              <p className="text-xs text-muted-foreground">
                Click a row or use checkboxes to build the run payload.
              </p>
              <DataGridPagination sizes={[8, 15, 25]} />
            </CardFooter>
          </>
        )}
      </Card>
    </DataGrid>
  )
}

function RunSummaryPanel({
  hasSelection,
  zimmetBarcodes,
  selectedShipments,
  selectedPickups,
  devices,
  selectedDeviceId,
  selectedDevice,
  loadingDevices,
  onDeviceChange,
  onRefreshDevices,
  canRun,
  running,
  onRun,
  setupStepDone,
  selectionStepDone,
  deviceStepDone,
}: {
  hasSelection: boolean
  zimmetBarcodes: string[]
  selectedShipments: number
  selectedPickups: number
  devices: NesyMobileAdbDevice[]
  selectedDeviceId: string | null
  selectedDevice: NesyMobileAdbDevice | undefined
  loadingDevices: boolean
  onDeviceChange: (id: string) => void
  onRefreshDevices: () => void
  canRun: boolean
  running: boolean
  onRun: () => void
  setupStepDone: boolean
  selectionStepDone: boolean
  deviceStepDone: boolean
}) {
  const checklist = [
    { label: 'Country & environment set', done: setupStepDone },
    { label: 'At least one shipment or pickup', done: selectionStepDone },
    { label: 'ADB device connected', done: deviceStepDone },
  ]
  const readyCount = checklist.filter((item) => item.done).length
  const readyPercent = Math.round((readyCount / checklist.length) * 100)

  return (
    <Card className="overflow-hidden">
      <CardHeader className="min-h-12 border-b py-3">
        <CardHeading>
          <CardTitle className="text-sm">Run summary</CardTitle>
          <CardDescription className="text-xs">
            Review payload and start the workflow
          </CardDescription>
        </CardHeading>
        <CardToolbar>
          <Badge
            variant={canRun ? 'success' : 'warning'}
            appearance="light"
            size="sm"
          >
            {readyCount}/{checklist.length} ready
          </Badge>
        </CardToolbar>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground">
              Launch readiness
            </span>
            <span
              className={cn(
                'font-semibold tabular-nums',
                canRun ? 'text-emerald-600' : 'text-nesy',
              )}
            >
              {readyPercent}%
            </span>
          </div>
          <Progress value={readyPercent} className="h-1.5" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StatTile
            icon={Package}
            label="Shipments"
            value={String(selectedShipments)}
          />
          <StatTile
            icon={Truck}
            label="Pickups"
            value={String(selectedPickups)}
          />
          <StatTile
            icon={Barcode}
            label="Barcodes"
            value={String(zimmetBarcodes.length)}
            className="col-span-2"
          />
        </div>

        {zimmetBarcodes.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {zimmetBarcodes.slice(0, 4).map((code) => (
              <Badge key={code} variant="info" appearance="outline" size="sm">
                {code}
              </Badge>
            ))}
            {zimmetBarcodes.length > 4 ? (
              <Badge variant="secondary" appearance="light" size="sm">
                +{zimmetBarcodes.length - 4} more
              </Badge>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-xs font-medium text-muted-foreground">Ready checks</p>
          <ul className="space-y-1.5">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-sm">
                {item.done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground/50" />
                )}
                <span
                  className={cn(
                    item.done ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Smartphone className="size-3.5" />
            Target device
          </label>
          <div className="flex gap-2">
            <Select
              value={selectedDeviceId ?? undefined}
              onValueChange={onDeviceChange}
            >
              <SelectTrigger className="h-10 min-w-0 flex-1">
                <SelectValue placeholder="Select device" />
              </SelectTrigger>
              <SelectContent>
                {devices.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    No devices found
                  </SelectItem>
                ) : (
                  devices.map((device) => (
                    <SelectItem
                      key={device.id}
                      value={device.id}
                      disabled={!isDeviceRunnable(device)}
                    >
                      {deviceTitle(device)}
                      {!isDeviceRunnable(device) ? ' (offline)' : ''}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="size-10 shrink-0"
              onClick={onRefreshDevices}
              disabled={loadingDevices}
              aria-label="Refresh devices"
            >
              {loadingDevices ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
            </Button>
          </div>
          {selectedDevice ? (
            <p className="text-[11px] text-muted-foreground">
              {selectedDevice.id}
              {!isDeviceRunnable(selectedDevice) ? ' · offline' : ' · ready'}
            </p>
          ) : (
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              Connect one Android device via ADB to run Verdict BridgeFlow.
            </p>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex-col gap-2 border-t py-4">
        {!hasSelection ? (
          <Alert variant="warning" appearance="light" size="sm" className="w-full">
            <AlertDescription>
              Select at least one shipment or pickup to enable Run.
            </AlertDescription>
          </Alert>
        ) : null}
        <Button
          variant="nesy"
          className="h-11 w-full"
          disabled={!canRun}
          onClick={onRun}
        >
          {running ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Play className="size-4" />
          )}
          Run Load & Tour
        </Button>
      </CardFooter>
    </Card>
  )
}

function StatTile({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-muted/20 px-3 py-2.5',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  )
}
