'use client'

// Reads a live Room DB + WAL snapshot and exposes every table read-only.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  Ban,
  ChevronRight,
  Columns3,
  Database,
  HardDrive,
  Hash,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  RefreshCw,
  Rows3,
  Search,
  ShieldAlert,
  Table2,
  Unlock,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { Input } from '@nesy/metronic/components/ui/input'
import { ProductPage, PageSection, StatCard, StatGrid, EASE, toneCard, toneIcon, toneText, type Tone } from '@/components/product'
import { DebugHeader, DebugCrossLinks, InfoRow, TonePill, NoDeviceState } from '@/components/debug-view/shared'
import { DebugCodePanel } from '@/components/debug-view/debug-code-panel'
import { useDebugView } from '@/components/debug-view/debug-context'
import { DB_ACCESS_METHODS } from '@/data/debug-view/mock-database'
import type { DbAccessMethod, DbTableInfo, RequestRow } from '@/data/debug-view/types'
import type {
  LiveDatabaseSnapshot,
  LiveDatabaseTableData,
  LiveDatabaseValue,
} from '@/data/debug-view/live-types'

const STATE_META: Record<RequestRow['derivedState'], { label: string; tone: Tone }> = {
  pending: { label: 'Pending', tone: 'blue' },
  waiting: { label: 'Delayed', tone: 'amber' },
  'in-flight': { label: 'Sending', tone: 'purple' },
  retrying: { label: 'Retrying', tone: 'orange' },
  dead: { label: 'Exhausted (>=3)', tone: 'red' },
}

const DIFFICULTY_META: Record<DbAccessMethod['difficulty'], { label: string; tone: Tone }> = {
  easy: { label: 'Easy', tone: 'green' },
  moderate: { label: 'Moderate', tone: 'amber' },
  hard: { label: 'Hard', tone: 'orange' },
  blocked: { label: 'Blocked', tone: 'red' },
}

export default function DatabaseAccessPage() {
  const { selectedDevice } = useDebugView()
  const [query, setQuery] = useState('')
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null)
  const [snapshot, setSnapshot] = useState<LiveDatabaseSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTable, setSelectedTable] = useState('Schedule')
  const [tableCatalogQuery, setTableCatalogQuery] = useState('')
  const [tableQuery, setTableQuery] = useState('')
  const [rowLimit, setRowLimit] = useState(100)
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null)
  const [tableError, setTableError] = useState<string | null>(null)
  const requestSequence = useRef(0)
  const snapshotRef = useRef<LiveDatabaseSnapshot | null>(null)

  const serial = selectedDevice?.serial ?? null

  const handleTableSelect = useCallback((tableName: string) => {
    if (tableName === selectedTable) return
    setTableQuery('')
    setSelectedRowIndex(null)
    setTableError(null)
    setSelectedTable(tableName)
  }, [selectedTable])

  const loadDatabase = useCallback(() => {
    const sequence = ++requestSequence.current
    if (!serial) {
      setSnapshot(null)
      snapshotRef.current = null
      setError(null)
      setTableError(null)
      setLoading(false)
      return
    }
    const preserveSnapshot = snapshotRef.current != null
    setLoading(true)
    setError(null)
    setTableError(null)
    const params = new URLSearchParams({
      serial,
      table: selectedTable,
      limit: String(rowLimit),
    })
    fetch(`/api/adb/database?${params.toString()}`)
      .then(async (response) => {
        const body = (await response.json()) as LiveDatabaseSnapshot & { error?: string }
        if (!response.ok || body.error) throw new Error(body.error ?? `HTTP ${response.status}`)
        if (sequence !== requestSequence.current) return
        snapshotRef.current = body
        setSnapshot(body)
        if (body.tableData) {
          setSelectedTable(body.tableData.tableName)
        }
        setSelectedRequestId(null)
        setSelectedRowIndex(null)
      })
      .catch((err: unknown) => {
        if (sequence !== requestSequence.current) return
        const message = err instanceof Error ? err.message : 'Failed to read database over ADB'
        if (preserveSnapshot) {
          setTableError(message)
        } else {
          snapshotRef.current = null
          setSnapshot(null)
          setError(message)
        }
      })
      .finally(() => {
        if (sequence === requestSequence.current) setLoading(false)
      })
  }, [rowLimit, selectedTable, serial])

  useEffect(() => {
    loadDatabase()
  }, [loadDatabase])

  const liveRows = useMemo(() => snapshot?.requestRows ?? [], [snapshot])

  const filteredTables = useMemo(() => {
    const tables = snapshot?.tables ?? []
    const q = tableCatalogQuery.trim().toLowerCase()
    if (!q) return tables
    return tables.filter(
      (table) =>
        table.name.toLowerCase().includes(q) ||
        table.description.toLowerCase().includes(q) ||
        table.primaryKey.toLowerCase().includes(q),
    )
  }, [snapshot?.tables, tableCatalogQuery])

  const requestRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return liveRows
    return liveRows.filter(
      (r) => r.requestName.toLowerCase().includes(q) || r.waybillNumbers.some((w) => w.toLowerCase().includes(q)) || r.uniqueKey.toLowerCase().includes(q),
    )
  }, [liveRows, query])

  const selectedRequest = requestRows.find((row) => row.id === selectedRequestId) ?? null
  const deadCount = liveRows.filter((r) => r.derivedState === 'dead').length
  const pendingCount = liveRows.filter((r) => r.derivedState === 'pending' || r.derivedState === 'waiting').length
  const activeTableData = snapshot?.tableData?.tableName === selectedTable ? snapshot.tableData : null

  return (
    <ProductPage path="/debug-view/database">
      <DebugHeader
        icon={Table2}
        title="Database Access"
        lead="Read-only live view of every table in the selected device's Room database over ADB."
        tone="orange"
        badges={[
          { label: snapshot ? `${snapshot.databaseName} · v${snapshot.version}` : 'Room database' },
          { label: 'Live ADB snapshot' },
          { label: 'Read-only + WAL/SHM' },
        ]}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={loadDatabase} disabled={!serial || loading}>
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Refresh
            </Button>
            <DebugCrossLinks currentPath="/debug-view/database" />
          </>
        }
      />

      {!selectedDevice ? (
        <NoDeviceState />
      ) : (
        <>
          {loading && !snapshot ? (
            <DatabaseLoadingState deviceName={selectedDevice.name} />
          ) : error ? (
            <DatabaseErrorState deviceName={selectedDevice.name} message={error} onRetry={loadDatabase} />
          ) : snapshot ? (
            <>
              <DatabaseMetaStrip snapshot={snapshot} tableCount={snapshot.tables.length} />

              <PageSection
                eyebrow="Schema"
                title="Tables"
                description={`${snapshot.tables.length} Room tables captured at ${new Date(snapshot.capturedAt).toLocaleTimeString('en-US')}. Pick one to inspect rows.`}
                icon={Layers}
                tone="orange"
              >
                <div className="relative max-w-md">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={tableCatalogQuery}
                    onChange={(event) => setTableCatalogQuery(event.target.value)}
                    placeholder="Filter tables by name, description or primary key..."
                    className="h-9 pl-8 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredTables.map((table, index) => (
                    <TablePickerCard
                      key={table.name}
                      table={table}
                      selected={selectedTable === table.name}
                      loading={loading && selectedTable === table.name}
                      onSelect={() => handleTableSelect(table.name)}
                      index={index}
                    />
                  ))}
                </div>
                {filteredTables.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border py-10 text-center text-xs text-muted-foreground">
                    No tables match this filter.
                  </div>
                ) : null}
              </PageSection>

              <TableExplorer
                tableName={selectedTable}
                data={activeTableData}
                loading={loading}
                error={tableError}
                query={tableQuery}
                onQueryChange={setTableQuery}
                rowLimit={rowLimit}
                onRowLimitChange={setRowLimit}
                selectedRowIndex={selectedRowIndex}
                onSelectedRowIndexChange={setSelectedRowIndex}
              />

              <PageSection
                eyebrow="Offline queue"
                title="Request Queue"
                description="Specialized view of the request table. Status is derived from isProcessing, isWaitingRequest and tryCount."
                icon={Rows3}
                tone="orange"
              >
                <StatGrid cols={4}>
                  <StatCard icon={Table2} label="Total rows" value={liveRows.length} tone="orange" />
                  <StatCard icon={Unlock} label="Pending" value={pendingCount} tone="amber" />
                  <StatCard icon={Ban} label="Exhausted (>=3)" value={deadCount} tone={deadCount > 0 ? 'red' : 'green'} />
                  <StatCard icon={Database} label="Archive (Completed)" value={snapshot.completedRequestCount} tone="orange" />
                </StatGrid>

                <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
                  <div className="w-full shrink-0 space-y-3 xl:w-[420px]">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search requestName, waybill or uniqueKey..."
                        className="h-9 pl-8 text-xs"
                      />
                    </div>

                    <div className="overflow-hidden rounded-xl border border-border bg-card">
                      <div className="border-b border-border bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {requestRows.length} queue row{requestRows.length === 1 ? '' : 's'}
                      </div>
                      <div className="max-h-[420px] overflow-y-auto p-2">
                        {requestRows.length === 0 ? (
                          <div className="py-10 text-center text-xs text-muted-foreground">
                            {query.trim() ? 'No matching rows.' : 'The live request queue is empty.'}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {requestRows.map((row) => {
                              const meta = STATE_META[row.derivedState]
                              const selected = selectedRequestId === row.id
                              return (
                                <button
                                  key={row.id}
                                  type="button"
                                  onClick={() => setSelectedRequestId(selected ? null : row.id)}
                                  className={cn(
                                    'w-full rounded-lg border px-3 py-2.5 text-left transition-all hover:border-orange-500/30 hover:bg-muted/30',
                                    selected
                                      ? 'border-orange-500/40 bg-orange-500/5 ring-1 ring-orange-500/20'
                                      : 'border-border/70 bg-background/60',
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="truncate font-mono text-[11px] font-semibold text-foreground">{row.requestName}</div>
                                      <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                                        {row.waybillNumbers.join(', ') || 'No waybill'}
                                      </div>
                                    </div>
                                    <TonePill label={meta.label} tone={meta.tone} />
                                  </div>
                                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                                    <span className="font-mono">#{row.id}</span>
                                    <span className={cn('font-mono', row.tryCount >= 3 && 'font-bold text-red-600 dark:text-red-400')}>
                                      try {row.tryCount}/3
                                    </span>
                                    <span>{new Date(row.timeStamp).toLocaleTimeString('en-US')}</span>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 rounded-xl border border-border bg-card">
                    <AnimatePresence mode="wait">
                      {selectedRequest ? (
                        <motion.div
                          key={selectedRequest.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.22, ease: EASE }}
                          className="p-4"
                        >
                          <RequestDetailPanel request={selectedRequest} />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="empty"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex min-h-[280px] flex-col items-center justify-center gap-2 px-6 py-12 text-center"
                        >
                          <Rows3 className="size-8 text-muted-foreground/40" />
                          <p className="text-sm font-medium text-foreground">Select a request</p>
                          <p className="max-w-sm text-xs text-muted-foreground">
                            Pick a queue row to inspect metadata and the full requestJson payload in the dark code viewer.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </PageSection>
            </>
          ) : null}

          <PageSection
            eyebrow="Reference"
            title="DB Access Methods Over Release APK"
            description="In non-debuggable production builds, the device sandbox is protected by the OS — methods are sorted by difficulty and release compatibility."
            icon={Database}
            tone="orange"
          >
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
              {DB_ACCESS_METHODS.map((m) => (
                <AccessMethodCard key={m.id} method={m} />
              ))}
            </div>
          </PageSection>
        </>
      )}
    </ProductPage>
  )
}

function DatabaseMetaStrip({ snapshot, tableCount }: { snapshot: LiveDatabaseSnapshot; tableCount: number }) {
  const items = [
    { icon: Database, label: 'Database', value: snapshot.databaseName },
    { icon: Hash, label: 'Version', value: `v${snapshot.version}` },
    { icon: Layers, label: 'Tables', value: String(tableCount) },
    { icon: HardDrive, label: 'Snapshot size', value: formatBytes(snapshot.sizeBytes + snapshot.walSizeBytes + snapshot.shmSizeBytes) },
    { icon: KeyRound, label: 'Journal', value: snapshot.journalMode },
  ]

  return (
    <motion.div
      className="rounded-2xl border border-border bg-card p-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <item.icon className="size-3" />
              {item.label}
            </div>
            <div className="mt-1 truncate font-mono text-sm font-semibold text-foreground">{item.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3 text-[10px] text-muted-foreground">
        <Badge variant="secondary" appearance="outline" size="xs" className="font-mono">
          {snapshot.packageName}
        </Badge>
        <code className="truncate font-mono">{snapshot.databasePath}</code>
      </div>
    </motion.div>
  )
}

function TablePickerCard({
  table,
  selected,
  loading,
  onSelect,
  index,
}: {
  table: DbTableInfo
  selected: boolean
  loading: boolean
  onSelect: () => void
  index: number
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.2), ease: EASE }}
      className={cn(
        'group relative flex w-full flex-col rounded-xl border p-4 text-left transition-all',
        selected
          ? 'border-orange-500/50 bg-orange-500/5 shadow-[0_0_0_1px_rgba(249,115,22,0.25)]'
          : 'border-border bg-card hover:border-orange-500/25 hover:bg-muted/20',
        loading && selected && 'opacity-80',
      )}
      aria-pressed={selected}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-lg border',
                selected ? 'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-300' : 'border-border bg-muted/40 text-muted-foreground',
              )}
            >
              <Table2 className="size-4" />
            </span>
            <code className={cn('truncate text-sm font-bold text-foreground', selected && 'text-orange-700 dark:text-orange-300')}>
              {table.name}
            </code>
          </div>
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{table.description}</p>
        </div>
        {selected ? (
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white">
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <ChevronRight className="size-3.5" />}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" appearance="outline" size="xs" className="font-mono">
          {table.rowCount} rows
        </Badge>
        <Badge variant="secondary" appearance="outline" size="xs" className="font-mono">
          {table.sizeKb} KB
        </Badge>
        <Badge variant="secondary" appearance="outline" size="xs" className="max-w-full truncate font-mono">
          PK {table.primaryKey}
        </Badge>
      </div>
    </motion.button>
  )
}

interface TableExplorerProps {
  tableName: string
  data: LiveDatabaseTableData | null
  loading: boolean
  error: string | null
  query: string
  onQueryChange: (value: string) => void
  rowLimit: number
  onRowLimitChange: (value: number) => void
  selectedRowIndex: number | null
  onSelectedRowIndexChange: (value: number | null) => void
}

function TableExplorer({
  tableName,
  data,
  loading,
  error,
  query,
  onQueryChange,
  rowLimit,
  onRowLimitChange,
  selectedRowIndex,
  onSelectedRowIndexChange,
}: TableExplorerProps) {
  const [schemaOpen, setSchemaOpen] = useState(true)

  const visibleRows = useMemo(() => {
    if (!data) return []
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return data.rows
    return data.rows.filter((row) =>
      Object.values(row).some((value) => databaseValueText(value).toLowerCase().includes(normalizedQuery)),
    )
  }, [data, query])

  const primaryKeyColumn = useMemo(
    () =>
      data?.columns.find((column) => column.primaryKeyPosition > 0) ??
      data?.columns[0] ??
      null,
    [data?.columns],
  )

  const isPending = loading && data == null

  const toggleRow = useCallback(
    (rowIndex: number) => {
      onSelectedRowIndexChange(selectedRowIndex === rowIndex ? null : rowIndex)
    },
    [onSelectedRowIndexChange, selectedRowIndex],
  )

  useEffect(() => {
    if (selectedRowIndex != null && selectedRowIndex >= visibleRows.length) {
      onSelectedRowIndexChange(null)
    }
  }, [visibleRows.length, selectedRowIndex, onSelectedRowIndexChange])

  return (
    <PageSection
      eyebrow="Explorer"
      title={tableName}
      description={
        data
          ? `${data.rows.length} of ${data.totalRows} rows loaded · ${data.columns.length} columns`
          : isPending
            ? 'Reading this table from the device snapshot...'
            : error
              ? 'Could not load this table from the device snapshot.'
              : 'Select a table above to inspect its rows.'
      }
      icon={Table2}
      tone="orange"
    >
      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50/60 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {isPending ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/20 py-16 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-orange-500" />
          Loading {tableName} rows...
        </div>
      ) : null}

      {data ? (
        <div className={cn('overflow-hidden rounded-2xl border border-border bg-card shadow-sm', loading && 'opacity-80')}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-orange-50/40 px-4 py-3 dark:bg-orange-950/15">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg border border-orange-500/20 bg-orange-500/10">
                <Table2 className="size-4 text-orange-600 dark:text-orange-400" />
              </span>
              <div>
                <div className="font-mono text-sm font-bold text-foreground">{data.tableName}</div>
                <div className="text-[11px] text-muted-foreground">
                  {data.columns.length} columns · {visibleRows.length} visible row{visibleRows.length === 1 ? '' : 's'}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {data.truncated ? (
                <Badge variant="secondary" appearance="outline" size="xs" className="text-amber-700 dark:text-amber-400">
                  First {data.limit} rows
                </Badge>
              ) : (
                <Badge variant="secondary" appearance="outline" size="xs" className="text-green-700 dark:text-green-400">
                  All rows loaded
                </Badge>
              )}
              {primaryKeyColumn ? (
                <Badge variant="secondary" appearance="outline" size="xs" className="font-mono text-orange-700 dark:text-orange-300">
                  PK {primaryKeyColumn.name}
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder={`Search ${tableName} rows...`}
                className="h-9 border-border/80 bg-background pl-8 text-xs"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                Limit
                <select
                  value={rowLimit}
                  onChange={(event) => onRowLimitChange(Number(event.target.value))}
                  className="h-9 rounded-md border border-input bg-background px-2 font-mono text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30"
                  aria-label="Table row limit"
                >
                  {[25, 50, 100, 200].map((limit) => (
                    <option key={limit} value={limit}>{limit}</option>
                  ))}
                </select>
              </label>
              {loading ? (
                <span className="flex items-center gap-1.5 text-[11px] text-orange-600 dark:text-orange-400">
                  <Loader2 className="size-3.5 animate-spin" />
                  Reading
                </span>
              ) : null}
            </div>
          </div>

          <div className="border-b border-border/70">
            <button
              type="button"
              onClick={() => setSchemaOpen(!schemaOpen)}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted/30"
            >
              <Columns3 className="size-3.5 text-orange-600 dark:text-orange-400" />
              Schema ({data.columns.length})
              <ChevronRight className={cn('size-3.5 transition-transform', schemaOpen && 'rotate-90')} />
            </button>
            <AnimatePresence initial={false}>
              {schemaOpen ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="overflow-x-auto px-4 pb-3">
                    <div className="inline-flex min-w-full gap-2">
                      {data.columns.map((column) => (
                        <div
                          key={column.name}
                          className={cn(
                            'shrink-0 rounded-lg border px-3 py-2',
                            column.primaryKeyPosition > 0
                              ? 'border-orange-500/25 bg-orange-500/5'
                              : 'border-border/70 bg-muted/20',
                          )}
                          title={`${column.notNull ? 'NOT NULL · ' : ''}${column.defaultValue == null ? '' : `DEFAULT ${column.defaultValue} · `}${column.primaryKeyPosition ? `PK ${column.primaryKeyPosition}` : ''}`}
                        >
                          <div className="font-mono text-xs font-semibold text-foreground">{column.name}</div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span>{column.type}</span>
                            {column.primaryKeyPosition > 0 ? (
                              <span className="font-semibold text-orange-600 dark:text-orange-400">PK</span>
                            ) : null}
                            {column.notNull ? <span>NOT NULL</span> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="overflow-x-auto">
            {visibleRows.length === 0 ? (
              <div className="px-4 py-14 text-center text-xs text-muted-foreground">
                {query.trim() ? 'No rows match this search.' : `${data.tableName} is empty.`}
              </div>
            ) : (
              <table className="w-full min-w-[640px] text-left">
                <thead className="border-b border-border bg-muted/40">
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="w-10 px-2 py-2.5 font-semibold" aria-label="Expand" />
                    <th className="w-12 px-2 py-2.5 font-semibold">#</th>
                    {data.columns.map((column) => (
                      <th key={column.name} className="px-3 py-2.5 font-semibold">
                        <span className="font-mono text-foreground">{column.name}</span>
                        <span className="ms-1.5 font-normal text-muted-foreground">{column.type}</span>
                        {column.primaryKeyPosition > 0 ? (
                          <span className="ms-1 text-orange-600 dark:text-orange-400">PK</span>
                        ) : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {visibleRows.map((row, rowIndex) => {
                    const expanded = selectedRowIndex === rowIndex
                    return (
                      <RowTableGroup
                        key={`${data.tableName}-row-${rowIndex}`}
                        row={row}
                        rowIndex={rowIndex}
                        columns={data.columns}
                        expanded={expanded}
                        onToggle={() => toggleRow(rowIndex)}
                      />
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="border-t border-border/70 bg-muted/20 px-4 py-2.5 text-[11px] text-muted-foreground">
            {query.trim() ? `${visibleRows.length} matching rows. ` : ''}
            {data.truncated ? `Showing the first ${data.limit} rows — increase the limit to read more. ` : 'All rows are shown. '}
            BLOB values show size plus hex preview; text over 20,000 characters is marked truncated.
          </div>
        </div>
      ) : null}
    </PageSection>
  )
}

function RowTableGroup({
  row,
  rowIndex,
  columns,
  expanded,
  onToggle,
}: {
  row: Record<string, LiveDatabaseValue>
  rowIndex: number
  columns: LiveDatabaseTableData['columns']
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={cn(
          'cursor-pointer transition-colors hover:bg-muted/30',
          expanded && 'bg-orange-500/6 shadow-[inset_3px_0_0_0_rgb(249,115,22)]',
        )}
        aria-expanded={expanded}
      >
        <td className="px-2 py-2.5 text-center">
          <ChevronRight className={cn('mx-auto size-4 text-muted-foreground transition-transform', expanded && 'rotate-90 text-orange-600 dark:text-orange-400')} />
        </td>
        <td className="px-2 py-2.5 font-mono text-[10px] font-bold text-muted-foreground">
          {rowIndex + 1}
        </td>
        {columns.map((column) => (
          <td key={column.name} className="max-w-[220px] px-3 py-2.5">
            <span className="block truncate font-mono text-[11px] text-foreground" title={databaseValueText(row[column.name])}>
              {databaseValuePreview(row[column.name])}
            </span>
          </td>
        ))}
      </tr>
      <AnimatePresence initial={false}>
        {expanded ? (
          <tr>
            <td colSpan={columns.length + 2} className="border-t border-orange-500/15 bg-orange-500/[0.03] p-0">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: EASE }}
                className="overflow-hidden"
              >
                <RowExpandedDetail row={row} rowIndex={rowIndex} columns={columns} />
              </motion.div>
            </td>
          </tr>
        ) : null}
      </AnimatePresence>
    </>
  )
}

function RowExpandedDetail({
  row,
  rowIndex,
  columns,
}: {
  row: Record<string, LiveDatabaseValue>
  rowIndex: number
  columns: LiveDatabaseTableData['columns']
}) {
  return (
    <div className="space-y-0 border-t border-orange-500/10">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/25 px-4 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Row {rowIndex + 1} · {columns.length} columns
        </span>
        <span className="text-[10px] text-muted-foreground">JSON fields are auto-formatted</span>
      </div>
      <div className="divide-y divide-border/50">
        {columns.map((column) => {
          const value = row[column.name]
          const formatted = formatExpandedDatabaseValue(value)
          const isJsonField = looksLikeJson(value)
          return (
            <div key={column.name} className="px-4 py-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-foreground">{column.name}</span>
                <Badge variant="secondary" appearance="outline" size="xs" className="font-mono text-muted-foreground">
                  {column.type}
                </Badge>
                {column.primaryKeyPosition > 0 ? (
                  <Badge variant="secondary" appearance="outline" size="xs" className="text-orange-600 dark:text-orange-400">
                    PK
                  </Badge>
                ) : null}
                {isJsonField ? (
                  <Badge variant="secondary" appearance="outline" size="xs" className="text-sky-600 dark:text-sky-400">
                    JSON
                  </Badge>
                ) : null}
              </div>
              <DebugCodePanel
                code={formatted}
                label={column.name}
                language={isJsonField ? 'json' : 'text'}
                maxHeightClassName="max-h-56"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RequestDetailPanel({ request }: { request: RequestRow }) {
  const meta = STATE_META[request.derivedState]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <code className="text-sm font-bold text-foreground">{request.requestName}</code>
        <TonePill label={meta.label} tone={meta.tone} />
        <Badge variant="secondary" appearance="outline" size="xs" className="font-mono">
          #{request.id}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-border/70 bg-muted/15 p-3 lg:grid-cols-2">
        <InfoRow label="userName" value={request.userName} mono />
        <InfoRow label="uniqueKey" value={request.uniqueKey} mono />
        <InfoRow label="createdAt" value={new Date(request.createdAt).toLocaleString('en-US')} />
        <InfoRow label="timeStamp" value={new Date(request.timeStamp).toLocaleString('en-US')} />
        <InfoRow label="tryCount" value={`${request.tryCount}/3`} mono tone={request.tryCount >= 3 ? 'red' : undefined} />
        <InfoRow label="sendWithoutWaiting" value={request.sendWithoutWaiting ? 'true' : 'false'} />
        <InfoRow label="isProcessing" value={request.isProcessing ? '1' : '0'} />
        <InfoRow label="isWaitingRequest" value={request.isWaitingRequest ? '1' : '0'} />
        <InfoRow label="fiscalInvoiceId" value={request.fiscalInvoiceId ?? '-'} mono />
        <InfoRow label="waybillNumbers" value={request.waybillNumbers.join(', ') || '-'} mono />
      </div>

      <DebugCodePanel code={request.requestJson} label="requestJson" language="json" maxHeightClassName="max-h-[28rem]" />
    </div>
  )
}

function databaseValueText(value: LiveDatabaseValue | undefined): string {
  if (value == null) return 'NULL'
  return String(value)
}

function databaseValuePreview(value: LiveDatabaseValue | undefined): string {
  const text = databaseValueText(value).replaceAll(/\s+/g, ' ')
  return text.length > 80 ? `${text.slice(0, 77)}...` : text
}

function looksLikeJson(value: LiveDatabaseValue | undefined): boolean {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return trimmed.startsWith('{') || trimmed.startsWith('[')
}

function formatExpandedDatabaseValue(value: LiveDatabaseValue | undefined): string {
  if (value == null) return 'NULL'
  if (typeof value !== 'string') return String(value)
  const trimmed = value.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2)
    } catch {
      // Plain text or truncated JSON preview.
    }
  }
  return value
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function DatabaseLoadingState({ deviceName }: { deviceName: string }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 py-16 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <Loader2 className="size-6 animate-spin text-orange-500" />
      <div>
        <h3 className="text-sm font-semibold text-foreground">{`Reading ${deviceName}'s Room database...`}</h3>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
          Leaving the app running while pulling the database with its WAL/SHM files, then opening the merged snapshot
          in read-only mode. A rare mid-write skew is possible.
        </p>
      </div>
    </motion.div>
  )
}

function DatabaseErrorState({ deviceName, message, onRetry }: { deviceName: string; message: string; onRetry: () => void }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-red-300 bg-red-50/40 py-14 text-center dark:border-red-900 dark:bg-red-950/20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <AlertTriangle className="size-6 text-red-500" />
      <div>
        <h3 className="text-sm font-semibold text-foreground">Could not read the database on {deviceName}</h3>
        <p className="mt-1 max-w-lg break-all text-xs leading-relaxed text-muted-foreground">{message}</p>
      </div>
      <Button size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw className="size-3.5" />
        Try again
      </Button>
    </motion.div>
  )
}

function AccessMethodCard({ method: m }: { method: DbAccessMethod }) {
  const diff = DIFFICULTY_META[m.difficulty]
  const Icon = m.difficulty === 'blocked' ? Ban : m.requiresRoot ? ShieldAlert : m.worksOnRelease ? Unlock : Lock
  return (
    <motion.div
      className={cn('rounded-xl border p-4', toneCard[m.tone])}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <div className="flex items-start gap-3">
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl bg-background/60')}>
          <Icon className={cn('size-4.5', toneIcon[m.tone])} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">{m.name}</h3>
            <TonePill label={diff.label} tone={diff.tone} />
          </div>
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            <Badge variant="secondary" appearance="outline" size="xs">{m.tool}</Badge>
            <Badge variant="secondary" appearance="outline" size="xs" className={m.worksOnRelease ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
              {m.worksOnRelease ? 'Release ✓' : 'Release ✗'}
            </Badge>
            {m.requiresRoot && <Badge variant="secondary" appearance="outline" size="xs" className="text-amber-700 dark:text-amber-400">root required</Badge>}
          </div>
        </div>
      </div>
      <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{m.summary}</p>

      {m.steps.length > 0 && (
        <ol className="mt-2.5 space-y-1 text-[11px] text-foreground/85">
          {m.steps.map((s, i) => (
            <li key={i} className="flex gap-1.5">
              <span className={cn('font-mono font-bold', toneText[m.tone])}>{i + 1}.</span>
              <span className="leading-relaxed">{s}</span>
            </li>
          ))}
        </ol>
      )}

      {m.commands.length > 0 ? (
        <div className="mt-2.5">
          <DebugCodePanel code={m.commands.join('\n')} label="adb" language="shell" maxHeightClassName="max-h-48" lineNumbers={false} />
        </div>
      ) : null}

      {m.caveats.length > 0 && (
        <ul className="mt-2.5 space-y-1 text-[11px] text-muted-foreground">
          {m.caveats.map((c, i) => (
            <li key={i} className="flex gap-1.5">
              <span className="text-amber-500">!</span>
              <span className="leading-relaxed">{c}</span>
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  )
}
