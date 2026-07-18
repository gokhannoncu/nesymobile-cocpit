'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  Circle,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserRoundCog,
  X,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
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
  const [replayTarget, setReplayTarget] = useState<FieldCourierLoginRecord | null>(null)
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
      toast.error(
        err instanceof Error
          ? err.message
          : 'Field courier login history could not be loaded.',
      )
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
      {loading ? (
        <FieldCourierLoginTableShimmer />
      ) : (
        <section className="overflow-hidden rounded-[4px] border border-border bg-card">
          <div className="flex flex-col gap-3 border-b border-border p-3 lg:flex-row lg:items-center">
            <InputWrapper className="min-w-0 flex-1">
              <Search className="size-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by courier, hub, waybill, device…"
              />
            </InputWrapper>
            <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as StatusFilter)}
              >
                <SelectTrigger className="h-11 w-full min-w-[10rem] lg:w-[11rem]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="nesy"
                className="h-11"
                onClick={() => setModalOpen(true)}
              >
                <Plus className="size-4" />
                New field login
              </Button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
              {rows.length === 0 ? (
                <>
                  <p className="text-sm font-medium text-foreground">No field logins yet</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Start a field login once per courier — later visits reuse the same row and skip
                    shipment search.
                  </p>
                  <Button type="button" variant="nesy" onClick={() => setModalOpen(true)}>
                    <Plus className="size-4" />
                    New field login
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No rows match the current filters.</p>
              )}
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
                        {formatWhen(row.updatedAt || row.createdAt)}
                      </td>
                      <td className="px-5 py-3 align-middle text-right">
                        <div className="inline-flex items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-9 text-muted-foreground hover:text-nesy"
                            disabled={!row.courierUserId}
                            onClick={() => {
                              setModalOpen(false)
                              setReplayTarget(row)
                            }}
                            aria-label="Replay login"
                            title={
                              row.courierUserId
                                ? 'Verify PIN is still active and replay login'
                                : 'Courier user id missing — cannot replay'
                            }
                          >
                            <RotateCcw className="size-4" />
                          </Button>
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
                        </div>
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
        {modalOpen || replayTarget ? (
          <FieldLoginCreateModal
            key={replayTarget ? `replay-${replayTarget.id}` : 'field-login-create-modal'}
            country={country}
            environment={environment}
            replayFrom={replayTarget}
            onClose={() => {
              setModalOpen(false)
              setReplayTarget(null)
            }}
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
  replayFrom,
  onClose,
  onFinished,
}: {
  country: string
  environment: string
  replayFrom?: FieldCourierLoginRecord | null
  onClose: () => void
  onFinished: () => void
}) {
  const isReplay = Boolean(replayFrom?.courierUserId)
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
    let finishedNotified = false
    return subscribeFieldCourierLoginSession(
      session.id,
      (next) => {
        setSession(next)
        if (next.status !== 'running' && !finishedNotified) {
          finishedNotified = true
          onFinished()
          if (next.status === 'success') toast.success('Courier login completed.')
          else if (next.status === 'failed') {
            toast.error(next.errorMessage || 'Field courier login failed.')
          }
        }
      },
      (err) => {
        // Transient API restarts: keep polling; only warn once in console.
        console.warn('[field-courier-login] poll error', err)
      },
    )
    // Subscribe once per session id; updates arrive via polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id])

  const canSubmitCreate =
    Boolean(
      trackingNumber.trim() ||
        barcode.trim() ||
        legacyBarcode.trim() ||
        courierName.trim() ||
        courierUsername.trim(),
    ) && !submitting

  const canSubmit = isReplay ? Boolean(replayFrom?.courierUserId) && !submitting : canSubmitCreate

  const handleStart = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const started = isReplay
        ? await startFieldCourierLoginSession({
            mode: 'replay',
            country: replayFrom!.country || country,
            environment: replayFrom!.environment || environment,
            courierUserId: replayFrom!.courierUserId!,
            courierName: replayFrom!.courierFullName || undefined,
            courierUsername: replayFrom!.courierUsername || undefined,
            hubId: replayFrom!.hubId || undefined,
            hubName: replayFrom!.hubName || undefined,
            trackingNumber: replayFrom!.waybillNumber || undefined,
            barcode: replayFrom!.barcode || undefined,
            legacyBarcode: replayFrom!.legacyBarcode || undefined,
          })
        : await startFieldCourierLoginSession({
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

  const steps = session?.steps ?? []
  const hasTerminalStep = steps.some((s) => s.status === 'error')
  const allStepsSettled =
    steps.length > 0 &&
    steps.every(
      (s) => s.status === 'done' || s.status === 'skipped' || s.status === 'error',
    )
  const done =
    session?.status === 'success' ||
    session?.status === 'failed' ||
    hasTerminalStep ||
    allStepsSettled

  // Never trap the modal — Escape / Close always dismiss (session may continue server-side).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <motion.div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => onClose()}
    >
      <motion.div
        role="dialog"
        aria-modal
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl"
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
              {phase === 'progress'
                ? 'Logging in…'
                : isReplay
                  ? 'Replay field login'
                  : 'Field courier login'}
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onClose()
            }}
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
            isReplay && replayFrom ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">
                    {replayFrom.courierFullName || replayFrom.courierUsername || 'Courier'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[
                      replayFrom.courierUsername,
                      replayFrom.hubName || replayFrom.hubId,
                      `${replayFrom.country}/${replayFrom.environment}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {(replayFrom.waybillNumber ||
                    replayFrom.legacyBarcode ||
                    replayFrom.barcode) && (
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {replayFrom.waybillNumber ||
                        replayFrom.legacyBarcode ||
                        replayFrom.barcode}
                    </p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Skip shipment search. Backend will check that this courier still has an active
                  PIN, then login on this device.
                </p>
              </div>
            ) : (
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
            )
          ) : (
            <StepTimeline
              steps={session?.steps ?? []}
              sessionStatus={session?.status ?? 'running'}
            />
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
                ) : isReplay ? (
                  <RotateCcw className="size-4" />
                ) : (
                  <UserRoundCog className="size-4" />
                )}
                {isReplay ? 'Replay login' : 'Start login'}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onClose()
              }}
            >
              Close
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

const LONG_STEP_AFTER_MS = 2500

const LONG_STEP_HINTS: Record<string, string[]> = {
  maestro_login: [
    'Launching app on device…',
    'Entering PIN…',
    'Waiting for Maestro run…',
    'Almost there…',
  ],
  read_device_code: [
    'Broadcasting GET_DEVICE_ID…',
    'Waiting for device response…',
  ],
  register_device: ['Updating courier devices…'],
  align_hub: ['Switching admin hub…', 'Refreshing session…'],
  restore_hub: ['Restoring admin hub…'],
  fetch_pin: ['Checking courier PIN is still active…', 'Requesting PIN from portal…'],
}

function useActiveStepElapsed(stepId: string | undefined, isActive: boolean) {
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    if (!isActive || !stepId) {
      setElapsedMs(0)
      return
    }
    setElapsedMs(0)
    const started = Date.now()
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - started)
    }, 250)
    return () => window.clearInterval(timer)
  }, [stepId, isActive])

  return elapsedMs
}

function formatElapsed(ms: number) {
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function StepTimeline({
  steps,
  sessionStatus,
}: {
  steps: FieldLoginStep[]
  sessionStatus: FieldLoginSession['status']
}) {
  const reduceMotion = useReducedMotion()
  const total = steps.length || 1
  const completed = steps.filter(
    (s) => s.status === 'done' || s.status === 'skipped' || s.status === 'error',
  ).length
  const activeIndex = steps.findIndex((s) => s.status === 'active')
  const errorIndex = steps.findIndex((s) => s.status === 'error')

  const slideIndex =
    sessionStatus === 'success'
      ? Math.max(total - 1, 0)
      : errorIndex >= 0
        ? errorIndex
        : activeIndex >= 0
          ? activeIndex
          : Math.max(completed - 1, 0)

  const step = steps[slideIndex]
  const isActive = step?.status === 'active'
  const elapsedMs = useActiveStepElapsed(step?.id, Boolean(isActive))
  const isLongRunning = Boolean(isActive && elapsedMs >= LONG_STEP_AFTER_MS)

  const progress =
    sessionStatus === 'success'
      ? 1
      : sessionStatus === 'failed'
        ? Math.max(completed / total, 0.08)
        : (completed + (activeIndex >= 0 ? 0.35 : 0)) / total

  const statusLabel =
    sessionStatus === 'success'
      ? 'Complete'
      : sessionStatus === 'failed'
        ? 'Failed'
        : isLongRunning
          ? `Working · ${formatElapsed(elapsedMs)}`
          : step?.status === 'skipped'
            ? 'Skipped'
            : step?.status === 'active'
              ? 'Working'
              : 'In progress'

  const hints = step ? (LONG_STEP_HINTS[step.id] ?? ['Still working…']) : []
  const hintIndex =
    hints.length > 0 ? Math.floor(elapsedMs / 2800) % hints.length : 0

  return (
    <div className="space-y-5">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-medium text-muted-foreground">
            Step {Math.min(slideIndex + 1, total)} of {total}
          </span>
          <span
            className={cn(
              'font-medium tabular-nums',
              sessionStatus === 'success' && 'text-emerald-600',
              sessionStatus === 'failed' && 'text-rose-600',
              sessionStatus === 'running' && 'text-nesy',
            )}
          >
            {statusLabel}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <motion.div
            className={cn(
              'h-full rounded-full',
              sessionStatus === 'failed' ? 'bg-rose-500' : 'bg-nesy',
            )}
            initial={false}
            animate={{ width: `${Math.round(progress * 100)}%` }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: 'spring', stiffness: 160, damping: 24 }
            }
          />
        </div>
        <div className="flex items-center justify-center gap-1.5 pt-0.5" aria-hidden>
          {steps.map((s, i) => {
            const filled =
              s.status === 'done' ||
              s.status === 'skipped' ||
              s.status === 'error' ||
              i === slideIndex
            return (
              <span
                key={s.id}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === slideIndex ? 'w-5' : 'w-1.5',
                  s.status === 'error'
                    ? 'bg-rose-500'
                    : filled
                      ? 'bg-nesy'
                      : 'bg-muted-foreground/25',
                )}
              />
            )
          })}
        </div>
      </div>

      <div className="relative min-h-[12.5rem] overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {step ? (
            <motion.div
              key={step.id}
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, x: 36 }
              }
              animate={{ opacity: 1, x: 0 }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, x: -28 }
              }
              transition={
                reduceMotion
                  ? { duration: 0.12 }
                  : { type: 'spring', stiffness: 340, damping: 30 }
              }
              className={cn(
                'relative flex h-full min-h-[12.5rem] flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border px-6 py-8 text-center',
                step.status === 'error' &&
                  'border-rose-200 bg-rose-50/80 dark:border-rose-900 dark:bg-rose-950/40',
                step.status === 'active' && 'border-nesy/35 bg-nesy-soft/25',
                (step.status === 'done' || step.status === 'skipped') &&
                  'border-border bg-muted/20',
                step.status === 'pending' && 'border-dashed border-border bg-muted/10',
                sessionStatus === 'success' &&
                  step.status !== 'error' &&
                  'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30',
              )}
            >
              {isActive && !reduceMotion ? (
                <>
                  <motion.div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-nesy/10 to-transparent"
                    animate={{ x: ['-80%', '140%'] }}
                    transition={{
                      duration: isLongRunning ? 1.6 : 2.4,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                  />
                  {isLongRunning ? (
                    <motion.div
                      className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-nesy/25"
                      animate={{ opacity: [0.25, 0.7, 0.25] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  ) : null}
                </>
              ) : null}

              <StepStatusGlyph
                status={
                  sessionStatus === 'success' && step.status !== 'error'
                    ? 'done'
                    : step.status
                }
                reduceMotion={Boolean(reduceMotion)}
                large
                longRunning={isLongRunning}
              />
              <div className="relative space-y-1.5">
                <p className="text-base font-semibold text-foreground">{step.label}</p>
                <AnimatePresence mode="wait">
                  {isLongRunning ? (
                    <motion.p
                      key={`hint-${hintIndex}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="mx-auto max-w-sm text-sm text-muted-foreground"
                    >
                      {hints[hintIndex]}
                    </motion.p>
                  ) : step.detail ? (
                    <motion.p
                      key={step.detail}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mx-auto max-w-sm text-sm text-muted-foreground"
                    >
                      {step.detail}
                    </motion.p>
                  ) : step.status === 'active' ? (
                    <p className="text-sm text-muted-foreground">Please wait…</p>
                  ) : null}
                </AnimatePresence>
                {sessionStatus === 'success' ? (
                  <p className="pt-1 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    Courier session is live on the device.
                  </p>
                ) : null}
              </div>

              {isActive ? (
                <div className="relative mt-1 w-full max-w-[14rem] space-y-2">
                  <div className="relative h-1 overflow-hidden rounded-full bg-nesy/15">
                    {!reduceMotion ? (
                      <motion.div
                        className="absolute inset-y-0 w-1/3 rounded-full bg-nesy"
                        animate={{ left: ['-35%', '105%'] }}
                        transition={{
                          duration: isLongRunning ? 1.1 : 1.5,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                      />
                    ) : (
                      <div className="h-full w-1/2 rounded-full bg-nesy/60" />
                    )}
                  </div>
                  {isLongRunning ? (
                    <p className="text-[11px] tabular-nums text-nesy">
                      Running for {formatElapsed(elapsedMs)}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}

function StepStatusGlyph({
  status,
  reduceMotion,
  large = false,
  longRunning = false,
}: {
  status: FieldLoginStep['status']
  reduceMotion: boolean
  large?: boolean
  longRunning?: boolean
}) {
  const size = large ? 'size-14' : 'size-7'
  const icon = large ? 'size-6' : 'size-3.5'

  if (status === 'active') {
    return (
      <span
        className={cn(
          'relative flex items-center justify-center',
          large && longRunning ? 'size-16' : size,
        )}
      >
        {!reduceMotion ? (
          <>
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-nesy/30"
              animate={{ scale: [1, longRunning ? 1.55 : 1.35], opacity: [0.55, 0] }}
              transition={{
                duration: longRunning ? 1.1 : 1.4,
                repeat: Infinity,
                ease: 'easeOut',
              }}
            />
            {longRunning ? (
              <>
                <motion.span
                  className="absolute inset-[-4px] rounded-full border border-dashed border-nesy/50"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
                />
                <motion.span
                  className="absolute inset-[-10px] rounded-full border border-nesy/20"
                  animate={{ rotate: -360 }}
                  transition={{ duration: 5.5, repeat: Infinity, ease: 'linear' }}
                />
              </>
            ) : null}
          </>
        ) : null}
        <span
          className={cn(
            'relative flex items-center justify-center rounded-full bg-nesy text-white shadow-sm',
            large && longRunning ? 'size-14' : size,
          )}
        >
          <Loader2
            className={cn(icon, 'animate-spin')}
            strokeWidth={2.5}
            style={longRunning && !reduceMotion ? { animationDuration: '0.7s' } : undefined}
          />
        </span>
      </span>
    )
  }

  if (status === 'error') {
    return (
      <motion.span
        className={cn(
          'flex items-center justify-center rounded-full bg-rose-500 text-white shadow-sm',
          size,
        )}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
      >
        <X className={icon} strokeWidth={3} />
      </motion.span>
    )
  }

  if (status === 'done' || status === 'skipped') {
    return (
      <motion.span
        className={cn(
          'flex items-center justify-center rounded-full text-white shadow-sm',
          size,
          status === 'skipped' ? 'bg-muted-foreground/70' : 'bg-emerald-500',
        )}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 18 }}
      >
        <Check className={icon} strokeWidth={3} />
      </motion.span>
    )
  }

  return (
    <span
      className={cn(
        'flex items-center justify-center rounded-full border border-border bg-background',
        size,
      )}
    >
      <Circle className="size-2.5 fill-muted-foreground/40 text-muted-foreground/40" />
    </span>
  )
}
