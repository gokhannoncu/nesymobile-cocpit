'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  Circle,
  Copy,
  Check,
  Link2,
  Loader2,
  Smartphone,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@nesy/metronic/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@nesy/metronic/components/ui/dialog'
import { Progress, ProgressCircle } from '@nesy/metronic/components/ui/progress'
import { Button } from '@nesy/metronic/components/ui/button'
import type { NesyMobileCountry } from '@/services/nesy-mobile-env'

type InstallEnv = 'test' | 'prod'
type InstallStep = 'device' | 'version' | 'download' | 'install' | 'done'

type ProgressEvent = {
  type: 'progress'
  step: InstallStep
  percent: number
  message: string
  detail?: string
}

type DoneEvent = {
  type: 'done'
  result: {
    ok: true
    versionNumber: number | null
    applicationId: string
    deviceSerial: string
  }
}

type ErrorEvent = {
  type: 'error'
  code?: string
  message: string
}

type StreamEvent = ProgressEvent | DoneEvent | ErrorEvent

type DialogState = {
  open: boolean
  environment: InstallEnv
  country: NesyMobileCountry
  percent: number
  message: string
  detail?: string
  step: InstallStep | null
  status: 'running' | 'success' | 'error'
  errorMessage?: string
  versionLabel?: string
}

type LinkDialogState = {
  open: boolean
  environment: InstallEnv | null
  status: 'pick' | 'loading' | 'ready' | 'error'
  versionNumber: number | null
  appName: string | null
  downloadUrl: string | null
  errorMessage?: string
  copied: boolean
}

type Props = {
  countryId: string
  disabled?: boolean
}

const STEPS: { id: InstallStep; label: string }[] = [
  { id: 'device', label: 'Cihaz' },
  { id: 'version', label: 'Versiyon' },
  { id: 'download', label: 'İndirme' },
  { id: 'install', label: 'Kurulum' },
  { id: 'done', label: 'Bitti' },
]

const pillMotion =
  'transition-[transform,box-shadow,background-color,border-color,opacity] duration-200 ease-out motion-safe:hover:-translate-y-0.5 motion-safe:hover:scale-[1.04] motion-safe:active:translate-y-0 motion-safe:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1'

function toMobileCountry(countryId: string): NesyMobileCountry | null {
  const upper = countryId.toUpperCase()
  if (upper === 'HR' || upper === 'SI' || upper === 'RS' || upper === 'BA' || upper === 'ME') {
    return upper
  }
  return null
}

function stepIndex(step: InstallStep | null): number {
  if (!step) return -1
  return STEPS.findIndex((s) => s.id === step)
}

async function consumeInstallStream(
  country: NesyMobileCountry,
  environment: InstallEnv,
  onEvent: (event: StreamEvent) => void,
) {
  const res = await fetch('/api/adb/install-latest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ country, environment }),
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    throw new Error(text.slice(0, 300) || `HTTP ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''
    for (const chunk of chunks) {
      const line = chunk
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.startsWith('data:'))
      if (!line) continue
      const json = line.slice(5).trim()
      if (!json) continue
      onEvent(JSON.parse(json) as StreamEvent)
    }
  }
}

export function CountryInstallButtons({ countryId, disabled }: Props) {
  const country = toMobileCountry(countryId)
  const [busy, setBusy] = useState<InstallEnv | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [linkDialog, setLinkDialog] = useState<LinkDialogState | null>(null)

  if (!country) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const mobileCountry = country

  async function fetchDownloadLink(environment: InstallEnv) {
    setLinkDialog((prev) =>
      prev
        ? {
            ...prev,
            environment,
            status: 'loading',
            downloadUrl: null,
            versionNumber: null,
            appName: null,
            errorMessage: undefined,
            copied: false,
          }
        : prev,
    )
    try {
      const res = await fetch('/api/versions/download-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: mobileCountry, environment }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        message?: string
        downloadUrl?: string
        versionNumber?: number | null
        appName?: string
      }
      if (!res.ok || !data.ok || !data.downloadUrl) {
        throw new Error(data.message || `Link alınamadı (HTTP ${res.status})`)
      }
      setLinkDialog((prev) =>
        prev
          ? {
              ...prev,
              status: 'ready',
              downloadUrl: data.downloadUrl!,
              versionNumber: data.versionNumber ?? null,
              appName: data.appName ?? null,
            }
          : prev,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Link alınamadı'
      setLinkDialog((prev) =>
        prev ? { ...prev, status: 'error', errorMessage: message } : prev,
      )
      toast.error(message)
    }
  }

  async function copyLink() {
    const url = linkDialog?.downloadUrl
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setLinkDialog((prev) => (prev ? { ...prev, copied: true } : prev))
      toast.success('SAS linki kopyalandı')
      window.setTimeout(() => {
        setLinkDialog((prev) => (prev ? { ...prev, copied: false } : prev))
      }, 1800)
    } catch {
      toast.error('Kopyalama başarısız')
    }
  }

  async function install(environment: InstallEnv) {
    if (busy || disabled) return
    setBusy(environment)
    setDialog({
      open: true,
      environment,
      country: mobileCountry,
      percent: 0,
      message: 'Başlatılıyor…',
      step: 'device',
      status: 'running',
    })

    try {
      let sawDone = false
      await consumeInstallStream(mobileCountry, environment, (event) => {
        if (event.type === 'progress') {
          setDialog((prev) =>
            prev
              ? {
                  ...prev,
                  percent: event.percent,
                  message: event.message,
                  detail: event.detail,
                  step: event.step,
                }
              : prev,
          )
          return
        }
        if (event.type === 'done') {
          sawDone = true
          const versionLabel =
            event.result.versionNumber != null
              ? `v${event.result.versionNumber}`
              : event.result.applicationId
          setDialog((prev) =>
            prev
              ? {
                  ...prev,
                  percent: 100,
                  message: 'Kurulum tamamlandı',
                  detail: `${versionLabel} · ${event.result.deviceSerial}`,
                  step: 'done',
                  status: 'success',
                  versionLabel,
                }
              : prev,
          )
          toast.success(`Kuruldu · ${versionLabel}`)
          return
        }
        if (event.type === 'error') {
          setDialog((prev) =>
            prev
              ? {
                  ...prev,
                  status: 'error',
                  errorMessage: event.message,
                  message: 'Kurulum başarısız',
                  detail: event.code,
                }
              : prev,
          )
          toast.error(event.message)
        }
      })
      if (!sawDone) {
        setDialog((prev) =>
          prev && prev.status === 'running'
            ? {
                ...prev,
                status: 'error',
                message: 'Kurulum sonucu alınamadı',
                errorMessage: 'Akış beklenmedik şekilde kapandı',
              }
            : prev,
        )
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Kurulum başarısız'
      setDialog((prev) =>
        prev
          ? {
              ...prev,
              status: 'error',
              message: 'Kurulum başarısız',
              errorMessage: message,
            }
          : prev,
      )
      toast.error(message)
    } finally {
      setBusy(null)
    }
  }

  const activeStepIdx = stepIndex(dialog?.step ?? null)
  const canClose = dialog?.status !== 'running'
  const actionsLocked = disabled || busy != null

  return (
    <>
      <div className="inline-flex flex-wrap items-center gap-1.5">
        <Smartphone className="size-3 text-muted-foreground" aria-hidden />
        {(['test', 'prod'] as const).map((environment) => {
          const isBusy = busy === environment
          const isOtherBusy = busy != null && busy !== environment
          return (
            <button
              key={environment}
              type="button"
              disabled={actionsLocked}
              onClick={() => void install(environment)}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold',
                pillMotion,
                environment === 'test'
                  ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:shadow-sm hover:shadow-amber-200/80 focus-visible:ring-amber-400 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:shadow-amber-950/40'
                  : 'border-green-300 bg-green-50 text-green-900 hover:bg-green-100 hover:shadow-sm hover:shadow-green-200/80 focus-visible:ring-green-500 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200 dark:hover:shadow-green-950/40',
                isBusy && 'motion-safe:animate-pulse',
                (disabled || isOtherBusy) &&
                  'cursor-not-allowed opacity-50 motion-safe:hover:translate-y-0 motion-safe:hover:scale-100 hover:shadow-none',
              )}
            >
              {isBusy ? <Loader2 className="size-3 animate-spin" /> : null}
              {environment === 'test' ? 'Test' : 'Prod'}
            </button>
          )
        })}
        <button
          type="button"
          disabled={actionsLocked}
          onClick={() =>
            setLinkDialog({
              open: true,
              environment: null,
              status: 'pick',
              versionNumber: null,
              appName: null,
              downloadUrl: null,
              copied: false,
            })
          }
          className={cn(
            'inline-flex items-center gap-1 rounded-md border border-sky-300 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-900',
            'hover:bg-sky-100 hover:shadow-sm hover:shadow-sky-200/80 focus-visible:ring-sky-400',
            'dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:shadow-sky-950/40',
            pillMotion,
            actionsLocked &&
              'cursor-not-allowed opacity-50 motion-safe:hover:translate-y-0 motion-safe:hover:scale-100 hover:shadow-none',
          )}
        >
          <Link2 className="size-3" />
          Link
        </button>
      </div>

      <Dialog
        open={Boolean(linkDialog?.open)}
        onOpenChange={(open) => {
          if (!open) setLinkDialog(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>SAS link generator</DialogTitle>
            <DialogDescription>
              {mobileCountry} · GetLatestVersion downloadUrl (SAS)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(['test', 'prod'] as const).map((environment) => {
                const selected = linkDialog?.environment === environment
                const loading =
                  linkDialog?.status === 'loading' && linkDialog.environment === environment
                return (
                  <button
                    key={environment}
                    type="button"
                    disabled={linkDialog?.status === 'loading'}
                    onClick={() => void fetchDownloadLink(environment)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold',
                      pillMotion,
                      environment === 'test'
                        ? 'border-amber-300 bg-amber-50 text-amber-900'
                        : 'border-green-300 bg-green-50 text-green-900',
                      selected && 'ring-2 ring-offset-1',
                      selected && environment === 'test' && 'ring-amber-400',
                      selected && environment === 'prod' && 'ring-green-500',
                      linkDialog?.status === 'loading' && !loading && 'opacity-50',
                    )}
                  >
                    {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
                    {environment === 'test' ? 'Test linki getir' : 'Prod linki getir'}
                  </button>
                )
              })}
            </div>

            {linkDialog?.status === 'pick' && (
              <p className="text-xs text-muted-foreground">
                Ortam seçin — GetLatestVersion SAS downloadUrl döner.
              </p>
            )}

            {linkDialog?.status === 'loading' && (
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Link alınıyor…
              </p>
            )}

            {linkDialog?.status === 'error' && (
              <p className="text-xs font-medium text-destructive">{linkDialog.errorMessage}</p>
            )}

            {linkDialog?.status === 'ready' && linkDialog.downloadUrl && (
              <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    {linkDialog.environment?.toUpperCase()}
                    {linkDialog.versionNumber != null ? ` · v${linkDialog.versionNumber}` : ''}
                    {linkDialog.appName ? ` · ${linkDialog.appName}` : ''}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5"
                    onClick={() => void copyLink()}
                  >
                    {linkDialog.copied ? (
                      <Check className="size-3.5 text-green-600" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    {linkDialog.copied ? 'Kopyalandı' : 'Kopyala'}
                  </Button>
                </div>
                <p className="break-all rounded-md border border-border bg-background p-2.5 font-mono text-[11px] leading-relaxed text-foreground">
                  {linkDialog.downloadUrl}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLinkDialog(null)}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(dialog?.open)}
        onOpenChange={(open) => {
          if (!open && canClose) setDialog(null)
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => {
            if (!canClose) e.preventDefault()
          }}
          onEscapeKeyDown={(e) => {
            if (!canClose) e.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {dialog?.environment === 'test' ? 'Test' : 'Prod'} APK kurulumu
            </DialogTitle>
            <DialogDescription>
              {dialog?.country} · GetLatestVersion → indirme → adb install
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-2">
            <ProgressCircle
              value={dialog?.percent ?? 0}
              size={88}
              strokeWidth={6}
              indicatorClassName={
                dialog?.status === 'error'
                  ? 'text-destructive'
                  : dialog?.status === 'success'
                    ? 'text-green-600'
                    : 'text-primary'
              }
            >
              <span className="text-base font-bold tabular-nums">
                {Math.round(dialog?.percent ?? 0)}%
              </span>
            </ProgressCircle>

            <div className="w-full space-y-2">
              <Progress
                value={dialog?.percent ?? 0}
                className="h-2"
                indicatorClassName={
                  dialog?.status === 'error'
                    ? 'bg-destructive'
                    : dialog?.status === 'success'
                      ? 'bg-green-600'
                      : undefined
                }
              />
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">{dialog?.message}</p>
                {dialog?.detail && (
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{dialog.detail}</p>
                )}
                {dialog?.errorMessage && (
                  <p className="mt-2 text-xs font-medium text-destructive">{dialog.errorMessage}</p>
                )}
              </div>
            </div>

            <ol className="w-full space-y-1.5 rounded-lg border border-border bg-muted/20 p-3">
              {STEPS.map((step, index) => {
                const done =
                  dialog?.status === 'success' ||
                  (activeStepIdx > index && dialog?.status !== 'error') ||
                  (dialog?.status === 'error' && activeStepIdx > index)
                const current = dialog?.status === 'running' && activeStepIdx === index
                const failed = dialog?.status === 'error' && activeStepIdx === index
                return (
                  <li key={step.id} className="flex items-center gap-2 text-xs">
                    {failed ? (
                      <XCircle className="size-3.5 text-destructive" />
                    ) : done ? (
                      <CheckCircle2 className="size-3.5 text-green-600" />
                    ) : current ? (
                      <Loader2 className="size-3.5 animate-spin text-primary" />
                    ) : (
                      <Circle className="size-3.5 text-muted-foreground/40" />
                    )}
                    <span
                      className={cn(
                        'font-medium',
                        current && 'text-foreground',
                        done && 'text-muted-foreground',
                        failed && 'text-destructive',
                        !current && !done && !failed && 'text-muted-foreground/60',
                      )}
                    >
                      {step.label}
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={!canClose}
              onClick={() => setDialog(null)}
            >
              {dialog?.status === 'running' ? 'Çalışıyor…' : 'Kapat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
