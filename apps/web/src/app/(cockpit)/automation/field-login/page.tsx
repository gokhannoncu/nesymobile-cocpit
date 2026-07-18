'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  Circle,
  Loader2,
  Plus,
  Search,
  Trash2,
  UserRoundCog,
  X,
  XCircle,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@nesy/metronic/components/ui/alert-dialog'
import { Button } from '@nesy/metronic/components/ui/button'
import { Input, InputWrapper } from '@nesy/metronic/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nesy/metronic/components/ui/select'
import { cn } from '@nesy/metronic/lib/utils'
import { ProductPage } from '@/components/product'
import { FieldCourierLoginTableShimmer } from '@/components/automation/field-courier-login-shimmer'
import { useNesyAuth } from '@/contexts/nesy-auth-context'
import {
  deleteFieldCourierLogin,
  fetchFieldCourierLogins,
  startFieldCourierLoginSession,
  subscribeFieldCourierLoginSession,
  type FieldCourierLoginRecord,
  type FieldLoginSession,
  type FieldLoginStep,
} from '@/services/field-courier-login'

type StatusFilter = 'all' | 'success' | 'failed'

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function statusClassName(status: string) {
  if (status === 'success') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950 dark:text-emerald-400'
  }
  if (status === 'failed') {
    return 'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950 dark:text-rose-400'
  }
  return 'bg-muted text-muted-foreground ring-border'
}

export default function FieldCourierLoginPage() {
  const { country, environment } = useNesyAuth()
  const [rows, setRows] = useState<FieldCourierLoginRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [deleteTarget, setDeleteTarget] = useState<FieldCourierLoginRecord | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchFieldCourierLogins({
        country: country || undefined,
        environment: environment || undefined,
      })
      setRows(data)
    } catch (err) {
      console.error(err)
      toast.error('Field courier login history could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [country, environment])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false
      if (!q) return true
      const hay = [
        row.courierFullName,
        row.courierUsername,
        row.hubName,
        row.waybillNumber,
        row.legacyBarcode,
        row.barcode,
        row.deviceCode,
        row.adminUsername,
        row.errorMessage,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [rows, searchQuery, statusFilter])

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteFieldCourierLogin(deleteTarget.id)
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      toast.success('Record deleted.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.')
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <ProductPage path="/automation/field-login">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Field Courier Login
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Resolve a field courier, align hub, register this device, and PIN-login via Maestro.
          </p>
        </div>
        <Button type="button" variant="nesy" onClick={() => setModalOpen(true)}>
          <Plus className="size-4" />
          Create
        </Button>
      </section>

      {loading ? (
        <FieldCourierLoginTableShimmer />
      ) : (
        <section className="overflow-hidden rounded-[4px] border border-border bg-card">
          <div className="grid gap-3 border-b border-border p-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px]">
            <InputWrapper>
              <Search className="size-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by courier, hub, waybill, device…"
              />
            </InputWrapper>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <div className="px-5 py-16 text-center text-sm text-muted-foreground">
              {rows.length === 0
                ? 'No field logins yet. Create one to help a courier on site.'
                : 'No rows match the current filters.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Courier</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Hub</th>
                    <th className="px-3 py-3 font-medium">Shipment</th>
                    <th className="px-3 py-3 font-medium">Device</th>
                    <th className="px-3 py-3 font-medium">When</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border last:border-b-0 hover:bg-muted/30"
                    >
                      <td className="px-5 py-3 align-middle">
                        <div className="font-medium text-foreground">
                          {row.courierFullName || row.courierUsername || '—'}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {[row.courierUsername, `${row.country}/${row.environment}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                        {row.errorMessage ? (
                          <div className="mt-1 max-w-xs truncate text-xs text-rose-600">
                            {row.errorMessage}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <span
                          className={cn(
                            'inline-flex rounded-[4px] px-2 py-1 text-xs font-medium ring-1 ring-inset',
                            statusClassName(row.status),
                          )}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-middle text-muted-foreground">
                        {row.hubName || row.hubId || '—'}
                      </td>
                      <td className="px-3 py-3 align-middle text-muted-foreground">
                        {row.waybillNumber || row.legacyBarcode || row.barcode || '—'}
                      </td>
                      <td className="px-3 py-3 align-middle font-mono text-xs text-muted-foreground">
                        {row.deviceCode || '—'}
                      </td>
                      <td className="px-3 py-3 align-middle text-xs text-muted-foreground">
                        {formatWhen(row.createdAt)}
                      </td>
                      <td className="px-5 py-3 align-middle text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-9 text-muted-foreground hover:text-rose-600"
                          onClick={() => setDeleteTarget(row)}
                          aria-label="Delete"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <AnimatePresence>
        {modalOpen ? (
          <FieldLoginCreateModal
            country={country}
            environment={environment}
            onClose={() => setModalOpen(false)}
            onFinished={() => {
              void load()
            }}
          />
        ) : null}
      </AnimatePresence>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete login record?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove{' '}
              <strong>
                {deleteTarget?.courierFullName || deleteTarget?.courierUsername || 'this row'}
              </strong>{' '}
              from field login history. This does not change Nesy devices or hubs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => void handleDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProductPage>
  )
}

function FieldLoginCreateModal({
  country,
  environment,
  onClose,
  onFinished,
}: {
  country: string
  environment: string
  onClose: () => void
  onFinished: () => void
}) {
  const [phase, setPhase] = useState<'form' | 'progress'>('form')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [barcode, setBarcode] = useState('')
  const [legacyBarcode, setLegacyBarcode] = useState('')
  const [courierName, setCourierName] = useState('')
  const [courierUsername, setCourierUsername] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [session, setSession] = useState<FieldLoginSession | null>(null)

  useEffect(() => {
    if (!session?.id) return
    return subscribeFieldCourierLoginSession(
      session.id,
      (next) => {
        setSession(next)
        if (next.status !== 'running') {
          onFinished()
          if (next.status === 'success') toast.success('Courier login completed.')
          else if (next.status === 'failed') {
            toast.error(next.errorMessage || 'Field courier login failed.')
          }
        }
      },
      (err) => toast.error(err.message),
    )
    // Subscribe once per session id; updates arrive via SSE.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id])

  const canSubmit =
    Boolean(
      trackingNumber.trim() ||
        barcode.trim() ||
        legacyBarcode.trim() ||
        courierName.trim() ||
        courierUsername.trim(),
    ) && !submitting

  const handleStart = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const started = await startFieldCourierLoginSession({
        country,
        environment,
        trackingNumber: trackingNumber.trim() || undefined,
        barcode: barcode.trim() || undefined,
        legacyBarcode: legacyBarcode.trim() || undefined,
        courierName: courierName.trim() || undefined,
        courierUsername: courierUsername.trim() || undefined,
      })
      setSession(started)
      setPhase('progress')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start session.')
    } finally {
      setSubmitting(false)
    }
  }

  const done = session?.status === 'success' || session?.status === 'failed'

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => {
        if (phase === 'form' || done) onClose()
      }}
    >
      <motion.div
        role="dialog"
        aria-modal
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <UserRoundCog className="size-5 text-nesy" />
            <h2 className="text-base font-semibold">
              {phase === 'form' ? 'Field courier login' : 'Running login flow'}
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onClose}
            disabled={phase === 'progress' && !done}
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Env: <strong>{country.toUpperCase()}</strong> / <strong>{environment}</strong>
            {' · '}
            Requires exactly one ADB device
          </div>

          {phase === 'form' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Tracking / waybill"
                value={trackingNumber}
                onChange={setTrackingNumber}
                placeholder="e.g. 57952343914584"
              />
              <Field
                label="Barcode"
                value={barcode}
                onChange={setBarcode}
                placeholder="Optional"
              />
              <Field
                label="Legacy short barcode"
                value={legacyBarcode}
                onChange={setLegacyBarcode}
                placeholder="e.g. 1910051002061419"
              />
              <Field
                label="Courier name"
                value={courierName}
                onChange={setCourierName}
                placeholder="Full name"
              />
              <Field
                label="Courier username"
                value={courierUsername}
                onChange={setCourierUsername}
                placeholder="Exact username"
                className="sm:col-span-2"
              />
            </div>
          ) : (
            <StepTimeline steps={session?.steps ?? []} />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          {phase === 'form' ? (
            <>
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button
                type="button"
                variant="nesy"
                disabled={!canSubmit}
                onClick={() => void handleStart()}
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserRoundCog className="size-4" />
                )}
                Start login
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={onClose} disabled={!done}>
              {done ? 'Close' : 'Running…'}
            </Button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

function StepTimeline({ steps }: { steps: FieldLoginStep[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((step, index) => {
        const isActive = step.status === 'active'
        const isDone = step.status === 'done' || step.status === 'skipped'
        const isError = step.status === 'error'
        return (
          <motion.li
            key={step.id}
            layout
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
            className={cn(
              'flex gap-3 rounded-lg border px-3 py-2.5',
              isActive && 'border-nesy/40 bg-nesy-soft/20',
              isDone && 'border-border bg-muted/20',
              isError && 'border-rose-300 bg-rose-50/80 dark:border-rose-800 dark:bg-rose-950/40',
              step.status === 'pending' && 'border-border/60 opacity-60',
            )}
          >
            <div className="mt-0.5 shrink-0">
              {isActive ? (
                <Loader2 className="size-4 animate-spin text-nesy" />
              ) : isError ? (
                <XCircle className="size-4 text-rose-600" />
              ) : isDone ? (
                <Check className="size-4 text-emerald-600" />
              ) : (
                <Circle className="size-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">{step.label}</span>
                {step.status === 'skipped' ? (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    skipped
                  </span>
                ) : null}
              </div>
              {step.detail ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{step.detail}</p>
              ) : null}
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}
