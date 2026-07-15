'use client'

// Reads a consistent Room DB + WAL snapshot and exposes every table read-only.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  Ban,
  Database,
  Loader2,
  Lock,
  RefreshCw,
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
import { DebugHeader, DebugCrossLinks, CodeBlock, InfoRow, TonePill, NoDeviceState } from '@/components/debug-view/shared'
import { useDebugView } from '@/components/debug-view/debug-context'
import { DB_ACCESS_METHODS } from '@/data/debug-view/mock-database'
import type { DbAccessMethod, RequestRow } from '@/data/debug-view/types'
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
  const [expandedRow, setExpandedRow] = useState<number | null>(null)
  const [snapshot, setSnapshot] = useState<LiveDatabaseSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTable, setSelectedTable] = useState('Schedule')
  const [tableQuery, setTableQuery] = useState('')
  const [rowLimit, setRowLimit] = useState(100)
  const [expandedTableRow, setExpandedTableRow] = useState<number | null>(null)
  const [tableError, setTableError] = useState<string | null>(null)
  const requestSequence = useRef(0)
  const snapshotRef = useRef<LiveDatabaseSnapshot | null>(null)

  const serial = selectedDevice?.serial ?? null

  const handleTableSelect = useCallback((tableName: string) => {
    if (tableName === selectedTable) return
    setTableQuery('')
    setExpandedTableRow(null)
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
        setExpandedRow(null)
        setExpandedTableRow(null)
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

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return liveRows
    return liveRows.filter(
      (r) => r.requestName.toLowerCase().includes(q) || r.waybillNumbers.some((w) => w.toLowerCase().includes(q)) || r.uniqueKey.toLowerCase().includes(q),
    )
  }, [liveRows, query])

  const deadCount = liveRows.filter((r) => r.derivedState === 'dead').length
  const pendingCount = liveRows.filter((r) => r.derivedState === 'pending' || r.derivedState === 'waiting').length

  return (
    <ProductPage path="/debug-view/database">
      <DebugHeader
        icon={Table2}
        title="Database Access"
        lead="Read-only live view of every table in the selected device's Room database over ADB."
        tone="teal"
        badges={[
          { label: snapshot ? `${snapshot.databaseName} * v${snapshot.version}` : 'Room database' },
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
          {/* --- 2. DB summary --- */}
          <PageSection
            eyebrow={snapshot.databaseName}
            title="Database Tables"
            description={`Read via adb run-as at ${new Date(snapshot.capturedAt).toLocaleTimeString('en-US')}`}
            icon={Database}
            tone="indigo"
          >
            <div className="mb-3 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 text-xs">
              <InfoRowInline label="File" value={snapshot.databaseName} />
              <InfoRowInline label="Version" value={`v${snapshot.version}`} />
              <InfoRowInline label="Journal" value={snapshot.journalMode} />
              <InfoRowInline label="Package" value={snapshot.packageName} />
              <InfoRowInline label="DB + WAL + SHM" value={formatBytes(snapshot.sizeBytes + snapshot.walSizeBytes + snapshot.shmSizeBytes)} />
              <code className="ms-auto hidden truncate font-mono text-[10px] text-muted-foreground xl:block">{snapshot.databasePath}</code>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[560px] text-left">
                <thead className="border-b border-border bg-muted/40">
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-semibold">Table</th>
                    <th className="px-3 py-2 font-semibold">Description</th>
                    <th className="px-3 py-2 font-semibold">PK</th>
                    <th className="px-3 py-2 text-right font-semibold">Row</th>
                    <th className="px-3 py-2 text-right font-semibold">Size</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {snapshot.tables.map((t) => {
                    const selected = selectedTable === t.name
                    return (
                    <tr
                      key={t.name}
                      role="button"
                      tabIndex={0}
                      aria-selected={selected}
                      aria-label={`Open ${t.name} table`}
                      onClick={() => handleTableSelect(t.name)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          handleTableSelect(t.name)
                        }
                      }}
                      className={cn(
                        'cursor-pointer transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset',
                        selected && 'bg-indigo-500/10',
                        loading && selected && 'opacity-80',
                      )}
                    >
                      <td className="px-3 py-2">
                        <code className={cn('text-[11px] font-semibold text-foreground', selected && 'text-indigo-700 dark:text-indigo-300')}>
                          {t.name}
                        </code>
                      </td>
                      <td className="px-3 py-2 text-[11px] text-muted-foreground">{t.description}</td>
                      <td className="px-3 py-2"><code className="text-[10px] text-muted-foreground">{t.primaryKey}</code></td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-foreground">{t.rowCount}</td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-muted-foreground">{t.sizeKb} KB</td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </PageSection>

          <TableExplorer
            tableName={selectedTable}
            data={snapshot.tableData?.tableName === selectedTable ? snapshot.tableData : null}
            loading={loading}
            error={tableError}
            query={tableQuery}
            onQueryChange={setTableQuery}
            rowLimit={rowLimit}
            onRowLimitChange={setRowLimit}
            expandedRow={expandedTableRow}
            onExpandedRowChange={setExpandedTableRow}
          />

          {/* --- Specialized request queue view --- */}
          <PageSection
            eyebrow="Offline queue"
            title="request table"
            description="Requests waiting to be sent. Status is derived from the combination of isProcessing + isWaitingRequest + tryCount (tryCount >= 3 = exhausted)."
            icon={Table2}
            tone="teal"
          >
            <StatGrid cols={4}>
              <StatCard icon={Table2} label="Total rows" value={liveRows.length} tone="blue" />
              <StatCard icon={Unlock} label="Pending" value={pendingCount} tone="amber" />
              <StatCard icon={Ban} label="Exhausted (>=3)" value={deadCount} tone={deadCount > 0 ? 'red' : 'green'} />
              <StatCard icon={Database} label="Archive (Completed)" value={snapshot.completedRequestCount} tone="teal" />
            </StatGrid>

            <div className="relative mt-3 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search requestName, waybill or uniqueKey..." className="h-8 pl-8 text-xs" />
            </div>

            <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[820px] text-left">
                <thead className="border-b border-border bg-muted/40">
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-semibold">id</th>
                    <th className="px-3 py-2 font-semibold">requestName</th>
                    <th className="px-3 py-2 font-semibold">waybillNumbers</th>
                    <th className="px-3 py-2 text-center font-semibold">tryCount</th>
                    <th className="px-3 py-2 text-center font-semibold">proc</th>
                    <th className="px-3 py-2 text-center font-semibold">wait</th>
                    <th className="px-3 py-2 font-semibold">status</th>
                    <th className="px-3 py-2 font-semibold">timeStamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {rows.map((r) => {
                    const meta = STATE_META[r.derivedState]
                    const expanded = expandedRow === r.id
                    return (
                      <Fragment key={r.id}>
                        <tr
                          onClick={() => setExpandedRow(expanded ? null : r.id)}
                          className={cn('cursor-pointer hover:bg-muted/30', expanded && 'bg-muted/40')}
                        >
                          <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{r.id}</td>
                          <td className="px-3 py-2"><code className="text-[11px] font-semibold text-foreground">{r.requestName}</code></td>
                          <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{r.waybillNumbers.join(', ') || '-'}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={cn('font-mono text-[11px]', r.tryCount >= 3 ? 'font-bold text-red-600 dark:text-red-400' : 'text-foreground')}>
                              {r.tryCount}/3
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center text-[11px]">{r.isProcessing ? '1' : '0'}</td>
                          <td className="px-3 py-2 text-center text-[11px]">{r.isWaitingRequest ? '1' : '0'}</td>
                          <td className="px-3 py-2"><TonePill label={meta.label} tone={meta.tone} /></td>
                          <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                            {new Date(r.timeStamp).toLocaleTimeString('en-US')}
                          </td>
                        </tr>
                        <AnimatePresence initial={false}>
                          {expanded && (
                            <tr>
                              <td colSpan={8} className="p-0">
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.22, ease: EASE }}
                                  className="overflow-hidden bg-muted/20"
                                >
                                  <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-2">
                                    <div className="divide-y divide-border/60">
                                      <InfoRow label="userName" value={r.userName} mono />
                                      <InfoRow label="uniqueKey" value={r.uniqueKey} mono />
                                      <InfoRow label="createdAt" value={new Date(r.createdAt).toLocaleString('en-US')} />
                                      <InfoRow label="sendWithoutWaiting" value={r.sendWithoutWaiting ? 'true' : 'false'} />
                                      <InfoRow label="fiscalInvoiceId" value={r.fiscalInvoiceId ?? '-'} mono />
                                    </div>
                                    <CodeBlock label="requestJson" code={r.requestJson} />
                                  </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
              {rows.length === 0 && (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  {query.trim() ? 'No matching rows.' : 'The live request queue is empty.'}
                </div>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Click on a row to see <code className="text-foreground">requestJson</code> and all fields. After a successful
              shipment, the row is moved to the <code className="text-foreground">CompletedRequest</code> table with{' '}
              <code className="text-foreground">deleteAndArchive()</code>.
            </p>
          </PageSection>
            </>
          ) : null}

          <PageSection
            eyebrow="Reference"
            title="DB Access Methods Over Release APK"
            description="In non-debuggable production builds, the device sandbox is protected by the OS - methods are sorted by difficulty and release compatibility."
            icon={Database}
            tone="teal"
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

interface TableExplorerProps {
  tableName: string
  data: LiveDatabaseTableData | null
  loading: boolean
  error: string | null
  query: string
  onQueryChange: (value: string) => void
  rowLimit: number
  onRowLimitChange: (value: number) => void
  expandedRow: number | null
  onExpandedRowChange: (value: number | null) => void
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
  expandedRow,
  onExpandedRowChange,
}: TableExplorerProps) {
  const visibleRows = useMemo(() => {
    if (!data) return []
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return data.rows
    return data.rows.filter((row) =>
      Object.values(row).some((value) => databaseValueText(value).toLowerCase().includes(normalizedQuery)),
    )
  }, [data, query])

  const isPending = loading && data == null

  return (
    <PageSection
      eyebrow="Table explorer"
      title={tableName}
      description={
        data
          ? `Showing ${data.rows.length} of ${data.totalRows} rows from the merged device snapshot. Click a row to inspect every field.`
          : isPending
            ? 'Reading this table from the device snapshot...'
            : error
              ? 'Could not load this table from the device snapshot.'
              : 'Select a table above to inspect its rows.'
      }
      icon={Table2}
      tone="blue"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={`Search ${tableName} rows...`}
            className="h-8 pl-8 text-xs"
            disabled={!data}
          />
        </div>
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          Row limit
          <select
            value={rowLimit}
            onChange={(event) => onRowLimitChange(Number(event.target.value))}
            className="h-8 rounded-md border border-input bg-background px-2 font-mono text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Table row limit"
          >
            {[25, 50, 100, 200].map((limit) => (
              <option key={limit} value={limit}>{limit}</option>
            ))}
          </select>
        </label>
        {loading ? (
          <span className="flex items-center gap-1.5 text-[11px] text-blue-600 dark:text-blue-400">
            <Loader2 className="size-3.5 animate-spin" />
            Reading device
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50/60 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {data ? (
      <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Table schema">
        {data.columns.map((column) => (
          <Badge
            key={column.name}
            variant="secondary"
            appearance="outline"
            size="xs"
            title={`${column.notNull ? 'NOT NULL · ' : ''}${column.defaultValue == null ? '' : `DEFAULT ${column.defaultValue} · `}${column.primaryKeyPosition ? `PK ${column.primaryKeyPosition}` : ''}`}
          >
            <span className="font-mono">{column.name}</span>
            <span className="ms-1 text-muted-foreground">{column.type}</span>
            {column.primaryKeyPosition > 0 ? <span className="ms-1 text-blue-600 dark:text-blue-400">PK</span> : null}
          </Badge>
        ))}
      </div>
      ) : null}

      {data ? (
      <div className={cn('mt-3 overflow-x-auto rounded-xl border border-border bg-card transition-opacity', loading && 'opacity-60')}>
        <table className="w-full text-left">
          <thead className="border-b border-border bg-muted/40">
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {data.columns.map((column) => (
                <th key={column.name} className="whitespace-nowrap px-3 py-2 font-semibold">
                  <span>{column.name}</span>
                  <span className="ms-1 normal-case tracking-normal text-muted-foreground/60">{column.type}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {visibleRows.map((row, rowIndex) => {
              const expanded = expandedRow === rowIndex
              return (
                <Fragment key={`${data.tableName}-${rowIndex}`}>
                  <tr
                    onClick={() => onExpandedRowChange(expanded ? null : rowIndex)}
                    className={cn('cursor-pointer hover:bg-muted/30', expanded && 'bg-blue-500/5')}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onExpandedRowChange(expanded ? null : rowIndex)
                      }
                    }}
                    aria-expanded={expanded}
                  >
                    {data.columns.map((column) => {
                      const value = row[column.name]
                      return (
                        <td key={column.name} className="max-w-80 whitespace-nowrap px-3 py-2 font-mono text-[10px] text-foreground">
                          <span
                            className={cn('block max-w-80 truncate', value == null && 'italic text-muted-foreground')}
                            title={databaseValueText(value)}
                          >
                            {databaseValuePreview(value)}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                  <AnimatePresence initial={false}>
                    {expanded ? (
                      <tr>
                        <td colSpan={Math.max(data.columns.length, 1)} className="p-0">
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: EASE }}
                            className="overflow-hidden bg-muted/20"
                          >
                            <dl className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-2">
                              {data.columns.map((column) => (
                                <div key={column.name} className="min-w-0 rounded-lg border border-border/70 bg-background/70 p-3">
                                  <dt className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    {column.name}
                                    <span className="font-mono font-normal normal-case tracking-normal">{column.type}</span>
                                  </dt>
                                  <dd>
                                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-foreground">
                                      {formatExpandedDatabaseValue(row[column.name])}
                                    </pre>
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          </motion.div>
                        </td>
                      </tr>
                    ) : null}
                  </AnimatePresence>
                </Fragment>
              )
            })}
          </tbody>
        </table>
        {visibleRows.length === 0 ? (
          <div className="py-10 text-center text-xs text-muted-foreground">
            {query.trim() ? 'No rows match this search.' : `${data.tableName} is empty.`}
          </div>
        ) : null}
      </div>
      ) : isPending ? (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 py-12 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-blue-500" />
          Loading {tableName} rows...
        </div>
      ) : null}
      {data ? (
      <p className="mt-2 text-[11px] text-muted-foreground">
        {query.trim() ? `${visibleRows.length} matching rows. ` : ''}
        {data.truncated ? `The first ${data.limit} rows are shown; increase the row limit to read more.` : 'All rows are shown.'}
        {' '}BLOB values are rendered as a size plus a hexadecimal preview; text cells over 20,000 characters are marked as truncated.
      </p>
      ) : null}
    </PageSection>
  )
}

function databaseValueText(value: LiveDatabaseValue | undefined): string {
  if (value == null) return 'NULL'
  return String(value)
}

function databaseValuePreview(value: LiveDatabaseValue | undefined): string {
  const text = databaseValueText(value).replaceAll(/\s+/g, ' ')
  return text.length > 160 ? `${text.slice(0, 157)}...` : text
}

function formatExpandedDatabaseValue(value: LiveDatabaseValue | undefined): string {
  if (value == null) return 'NULL'
  if (typeof value !== 'string') return String(value)
  const trimmed = value.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2)
    } catch {
      // The value is plain text or a deliberately truncated JSON preview.
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
      <Loader2 className="size-6 animate-spin text-teal-500" />
      <div>
        <h3 className="text-sm font-semibold text-foreground">{`Reading ${deviceName}'s Room database...`}</h3>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
          Force-stopping the app, pulling the database with its WAL/SHM files, then opening the merged snapshot in read-only mode.
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
              {m.worksOnRelease ? 'Release v' : 'Release x'}
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

      {m.commands.length > 0 && <CodeBlock className="mt-2.5" code={m.commands.join('\n')} />}

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

function InfoRowInline({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}:</span>
      <code className="font-mono font-semibold text-foreground">{value}</code>
    </span>
  )
}
