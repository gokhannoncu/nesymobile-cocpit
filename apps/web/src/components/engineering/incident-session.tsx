'use client'

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Crosshair,
  History,
  Link2,
  LoaderCircle,
  Megaphone,
  Play,
  Power,
  RotateCcw,
  Siren,
  Users,
} from 'lucide-react'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { Input } from '@nesy/metronic/components/ui/input'
import { Label } from '@nesy/metronic/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nesy/metronic/components/ui/select'
import { Textarea } from '@nesy/metronic/components/ui/textarea'
import { cn } from '@nesy/metronic/lib/utils'
import { DIAGNOSIS_SCREENS } from '@/data/engineering/incident-command'
import {
  fetchActiveEngineeringIncident,
  finishEngineeringIncident,
  startEngineeringIncident,
  updateEngineeringIncidentStatus,
  type EngineeringIncident,
  type EngineeringIncidentSeverity,
  type EngineeringIncidentStatus,
  type StartEngineeringIncidentInput,
} from '@/services/engineering-incidents'
import { toneCard } from '@/components/product'

const STATUS_STEPS: Array<{
  value: Exclude<EngineeringIncidentStatus, 'RESOLVED'>
  label: string
}> = [
  { value: 'ASSESSING', label: 'Değerlendiriliyor' },
  { value: 'INVESTIGATING', label: 'İnceleniyor' },
  { value: 'IDENTIFIED', label: 'Neden belirlendi' },
  { value: 'MITIGATING', label: 'Mitigation sürüyor' },
  { value: 'MONITORING', label: 'İzleniyor' },
]

const COUNTRY_OPTIONS = ['HR', 'RS', 'SI', 'BA', 'ME', 'AZ', 'SK', 'BG'] as const
const RISK_OPTIONS = [
  'Mali kayıp',
  'Double charge',
  'Fiscal kayıt tutarsızlığı',
  'Veri kaybı',
  'Operasyonların durması',
  'Güvenlik riski',
] as const

type IncidentStartFormState = {
  title: string
  summary: string
  severity: EngineeringIncidentSeverity
  objective: string
  countries: string[]
  environment: 'stage' | 'prod'
  appVersion: string
  affectedScreen: string
  riskTypes: string[]
  reporterName: string
  incidentCommander: string
  operationsLead: string
  communicationsLead: string
  scribe: string
  affectedCouriers: string
  affectedShipments: string
  affectedPaymentRecords: string
  relatedTicket: string
  nextCommunicationAt: string
}

const INITIAL_FORM: IncidentStartFormState = {
  title: '',
  summary: '',
  severity: 'SEV-2',
  objective: '',
  countries: ['HR'],
  environment: 'prod',
  appVersion: '',
  affectedScreen: 'Delivery',
  riskTypes: [],
  reporterName: '',
  incidentCommander: '',
  operationsLead: '',
  communicationsLead: '',
  scribe: '',
  affectedCouriers: '0',
  affectedShipments: '0',
  affectedPaymentRecords: '0',
  relatedTicket: '',
  nextCommunicationAt: '',
}

function formatElapsed(startedAt: string, endedAt: string | null, now: number): string {
  const start = new Date(startedAt).getTime()
  const end = endedAt ? new Date(endedAt).getTime() : now
  const seconds = Math.max(0, Math.floor((end - start) / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, '0')).join(':')
}

function formatTime(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function statusLabel(status: EngineeringIncidentStatus): string {
  if (status === 'RESOLVED') return 'Çözüldü'
  return STATUS_STEPS.find((step) => step.value === status)?.label ?? status
}

function useElapsedTime(incident: EngineeringIncident | null): string {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!incident || incident.endedAt) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [incident])

  return incident ? formatElapsed(incident.startedAt, incident.endedAt, now) : '00:00:00'
}

export function useEngineeringIncidentSession() {
  const [incident, setIncident] = useState<EngineeringIncident | null>(null)
  const [lastFinished, setLastFinished] = useState<EngineeringIncident | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchActiveEngineeringIncident()
      .then((active) => {
        if (!cancelled) setIncident(active)
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Aktif incident yüklenemedi.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const start = async (input: StartEngineeringIncidentInput) => {
    setBusy(true)
    setError(null)
    try {
      const created = await startEngineeringIncident(input)
      setIncident(created)
      setLastFinished(null)
      return created
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Incident başlatılamadı.'
      setError(message)
      throw reason
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = async (
    status: Exclude<EngineeringIncidentStatus, 'RESOLVED'>,
  ) => {
    if (!incident || incident.status === status) return
    setBusy(true)
    setError(null)
    try {
      const updated = await updateEngineeringIncidentStatus(
        incident.id,
        status,
        incident.incidentCommander,
      )
      setIncident(updated)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Incident status’u güncellenemedi.')
    } finally {
      setBusy(false)
    }
  }

  const finish = async (input: { resolutionSummary: string; rootCause?: string }) => {
    if (!incident) return
    setBusy(true)
    setError(null)
    try {
      const finished = await finishEngineeringIncident(incident.id, {
        ...input,
        createdBy: incident.incidentCommander,
      })
      setLastFinished(finished)
      setIncident(null)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Incident kapatılamadı.'
      setError(message)
      throw reason
    } finally {
      setBusy(false)
    }
  }

  const reload = async () => {
    setLoading(true)
    setError(null)
    try {
      setIncident(await fetchActiveEngineeringIncident())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Aktif incident yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }

  return { incident, lastFinished, loading, busy, error, start, changeStatus, finish, reload }
}

export type EngineeringIncidentSession = ReturnType<typeof useEngineeringIncidentSession>

function FormField({
  label,
  required,
  children,
  className,
}: {
  label: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-xs font-semibold">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
    </div>
  )
}

function IncidentStartForm({
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  busy: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (input: StartEngineeringIncidentInput) => Promise<EngineeringIncident>
}) {
  const [form, setForm] = useState<IncidentStartFormState>(INITIAL_FORM)

  const update = <K extends keyof IncidentStartFormState>(
    key: K,
    value: IncidentStartFormState[K],
  ) => setForm((current) => ({ ...current, [key]: value }))

  const toggleArrayValue = (key: 'countries' | 'riskTypes', value: string) => {
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value],
    }))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextCommunicationAt = form.nextCommunicationAt
      ? new Date(form.nextCommunicationAt).toISOString()
      : undefined
    try {
      await onSubmit({
        title: form.title,
        summary: form.summary || undefined,
        severity: form.severity,
        objective: form.objective,
        countries: form.countries,
        environment: form.environment,
        appVersion: form.appVersion,
        affectedScreen: form.affectedScreen,
        riskTypes: form.riskTypes,
        reporterName: form.reporterName,
        incidentCommander: form.incidentCommander,
        operationsLead: form.operationsLead || undefined,
        communicationsLead: form.communicationsLead || undefined,
        scribe: form.scribe || undefined,
        affectedCouriers: Number(form.affectedCouriers),
        affectedShipments: Number(form.affectedShipments),
        affectedPaymentRecords: Number(form.affectedPaymentRecords),
        relatedTicket: form.relatedTicket || undefined,
        nextCommunicationAt,
      })
    } catch {
      // The session hook exposes the request error in the form callout.
    }
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="rounded-2xl border border-red-200 bg-background shadow-sm dark:border-red-900/60"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <div className="flex items-center gap-2 text-base font-bold text-foreground">
            <Siren className="size-5 text-red-500" /> Yeni incident başlat
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Bu bilgiler incident kaydı, canlı sayaç, etki özeti ve timeline için kullanılacaktır.
            Teknik ayrıntılar diagnosis adımında daha sonra eklenebilir.
          </p>
        </div>
        <Badge variant="secondary" appearance="outline">DB kaydı oluşturur</Badge>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <FormField label="Incident başlığı" required>
            <Input
              value={form.title}
              onChange={(event) => update('title', event.target.value)}
              placeholder="Örn. Ödeme tamamlandı ancak teslimat kaydedilmedi"
              required
            />
          </FormField>
          <FormField label="Mevcut hedef" required>
            <Input
              value={form.objective}
              onChange={(event) => update('objective', event.target.value)}
              placeholder="Örn. Double charge riskini durdur ve etkilenen gönderileri çıkar"
              required
            />
          </FormField>
          <FormField label="Olay özeti" className="lg:col-span-2">
            <Textarea
              value={form.summary}
              onChange={(event) => update('summary', event.target.value)}
              placeholder="İlk sinyal, kullanıcı etkisi ve bilinen belirtiler"
              rows={3}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Severity" required>
            <Select
              value={form.severity}
              onValueChange={(value) => update('severity', value as EngineeringIncidentSeverity)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['SEV-1', 'SEV-2', 'SEV-3'] as const).map((severity) => (
                  <SelectItem key={severity} value={severity}>{severity}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Environment" required>
            <Select
              value={form.environment}
              onValueChange={(value) => update('environment', value as 'stage' | 'prod')}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="prod">Prod</SelectItem>
                <SelectItem value="stage">Stage</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="App version" required>
            <Input
              value={form.appVersion}
              onChange={(event) => update('appVersion', event.target.value)}
              placeholder="8.4.60"
              required
            />
          </FormField>
          <FormField label="Etkilenen ekran" required>
            <Select value={form.affectedScreen} onValueChange={(value) => update('affectedScreen', value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIAGNOSIS_SCREENS.map((screen) => (
                  <SelectItem key={screen} value={screen}>{screen}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <FormField label="Etkilenen ülkeler" required>
            <div className="flex flex-wrap gap-1.5">
              {COUNTRY_OPTIONS.map((country) => {
                const selected = form.countries.includes(country)
                return (
                  <button
                    key={country}
                    type="button"
                    onClick={() => toggleArrayValue('countries', country)}
                    className={cn(
                      'rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors',
                      selected
                        ? 'border-red-400 bg-red-500/10 text-red-700 dark:text-red-300'
                        : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted',
                    )}
                    aria-pressed={selected}
                  >
                    {country}
                  </button>
                )
              })}
            </div>
          </FormField>
          <FormField label="Risk türleri">
            <div className="flex flex-wrap gap-1.5">
              {RISK_OPTIONS.map((risk) => {
                const selected = form.riskTypes.includes(risk)
                return (
                  <button
                    key={risk}
                    type="button"
                    onClick={() => toggleArrayValue('riskTypes', risk)}
                    className={cn(
                      'rounded-md border px-2.5 py-1.5 text-xs transition-colors',
                      selected
                        ? 'border-orange-400 bg-orange-500/10 font-semibold text-orange-700 dark:text-orange-300'
                        : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted',
                    )}
                    aria-pressed={selected}
                  >
                    {risk}
                  </button>
                )
              })}
            </div>
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Bildiren kişi" required>
            <Input
              value={form.reporterName}
              onChange={(event) => update('reporterName', event.target.value)}
              placeholder="Bildiren kişinin adı"
              required
            />
          </FormField>
          <FormField label="Incident Commander" required>
            <Input
              value={form.incidentCommander}
              onChange={(event) => update('incidentCommander', event.target.value)}
              placeholder="Incident Commander adı"
              required
            />
          </FormField>
          <FormField label="Operations Lead">
            <Input value={form.operationsLead} onChange={(event) => update('operationsLead', event.target.value)} placeholder="Operations Lead adı" />
          </FormField>
          <FormField label="Communications Lead">
            <Input value={form.communicationsLead} onChange={(event) => update('communicationsLead', event.target.value)} placeholder="Communications Lead adı" />
          </FormField>
          <FormField label="Scribe / Timeline Owner">
            <Input value={form.scribe} onChange={(event) => update('scribe', event.target.value)} placeholder="Scribe adı" />
          </FormField>
          <FormField label="İlgili ticket">
            <Input value={form.relatedTicket} onChange={(event) => update('relatedTicket', event.target.value)} placeholder="Örn. NESY-4484" />
          </FormField>
          <FormField label="Sonraki iletişim zamanı">
            <Input
              type="datetime-local"
              value={form.nextCommunicationAt}
              onChange={(event) => update('nextCommunicationAt', event.target.value)}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="Etkilenen kurye sayısı">
            <Input type="number" min={0} value={form.affectedCouriers} onChange={(event) => update('affectedCouriers', event.target.value)} />
          </FormField>
          <FormField label="Etkilenen gönderi sayısı">
            <Input type="number" min={0} value={form.affectedShipments} onChange={(event) => update('affectedShipments', event.target.value)} />
          </FormField>
          <FormField label="Etkilenen ödeme kaydı">
            <Input type="number" min={0} value={form.affectedPaymentRecords} onChange={(event) => update('affectedPaymentRecords', event.target.value)} />
          </FormField>
        </div>

        {error && (
          <div className="flex gap-2 rounded-lg border border-red-200 bg-red-500/5 p-3 text-xs text-red-700 dark:border-red-900 dark:text-red-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Vazgeç</Button>
          <Button type="submit" className="bg-red-600 text-white hover:bg-red-700" disabled={busy || form.countries.length === 0}>
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4" />}
            Incident’ı Başlat
          </Button>
        </div>
      </div>
    </form>
  )
}

function FinishIncidentForm({
  busy,
  onCancel,
  onFinish,
}: {
  busy: boolean
  onCancel: () => void
  onFinish: (input: { resolutionSummary: string; rootCause?: string }) => Promise<void>
}) {
  const [resolutionSummary, setResolutionSummary] = useState('')
  const [rootCause, setRootCause] = useState('')

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void onFinish({ resolutionSummary, rootCause: rootCause || undefined }).catch(() => undefined)
      }}
      className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-green-200 bg-green-500/5 p-4 lg:grid-cols-2 dark:border-green-900/60"
    >
      <FormField label="Çözüm özeti" required>
        <Textarea
          value={resolutionSummary}
          onChange={(event) => setResolutionSummary(event.target.value)}
          placeholder="Etki nasıl durduruldu ve sistem nasıl doğrulandı?"
          rows={3}
          required
        />
      </FormField>
      <FormField label="Root cause">
        <Textarea
          value={rootCause}
          onChange={(event) => setRootCause(event.target.value)}
          placeholder="Biliniyorsa teknik root cause"
          rows={3}
        />
      </FormField>
      <div className="flex justify-end gap-2 lg:col-span-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Vazgeç</Button>
        <Button type="submit" className="bg-green-600 text-white hover:bg-green-700" disabled={busy || !resolutionSummary.trim()}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Incident’ı Bitir
        </Button>
      </div>
    </form>
  )
}

function ActiveIncidentBar({ session }: { session: EngineeringIncidentSession }) {
  const { incident, busy, error, changeStatus, finish } = session
  const [showFinishForm, setShowFinishForm] = useState(false)
  const elapsed = useElapsedTime(incident)

  if (!incident) return null
  const statusIndex = STATUS_STEPS.findIndex((step) => step.value === incident.status)
  const scope = `${incident.countries.join(' + ')} · ${incident.environment.toUpperCase()} · v${incident.appVersion}`

  return (
    <div>
      <div className="sticky top-0 z-40 -mx-2 rounded-xl border border-red-200/80 bg-background/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85 dark:border-red-900/60">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
            </span>
            <span className="font-mono text-xs font-bold text-red-600 dark:text-red-400">{incident.incidentNumber}</span>
            <Badge variant="destructive" size="xs">{incident.severity}</Badge>
          </div>
          <div className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{incident.title}</div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" className="h-7 bg-red-600 text-xs text-white hover:bg-red-700">
              <Megaphone className="size-3.5" /> Operasyon duyurusu gönder
            </Button>
            {incident.relatedTicket && (
              <Button size="sm" variant="outline" className="h-7 text-xs">
                <Link2 className="size-3.5" /> {incident.relatedTicket}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-green-300 text-xs text-green-700 hover:bg-green-500/10 dark:border-green-900 dark:text-green-300"
              onClick={() => setShowFinishForm((shown) => !shown)}
              disabled={busy}
            >
              <Power className="size-3.5" /> Incident’ı Bitir
            </Button>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1">
          {STATUS_STEPS.map((step, index) => (
            <div key={step.value} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void changeStatus(step.value)}
                disabled={busy}
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors disabled:cursor-not-allowed',
                  index < statusIndex && 'bg-muted text-muted-foreground line-through decoration-1',
                  index === statusIndex && 'bg-red-600 text-white',
                  index > statusIndex && 'bg-muted/50 text-muted-foreground/60 hover:bg-muted',
                )}
              >
                {step.label}
              </button>
              {index < STATUS_STEPS.length - 1 && <span className="text-[10px] text-muted-foreground/40">›</span>}
            </div>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span>Başlangıç <b className="text-foreground">{formatTime(incident.startedAt)}</b></span>
          <span>Geçen süre <b className="font-mono text-foreground">{elapsed}</b></span>
          <span>Kapsam <b className="text-foreground">{scope}</b></span>
          <span>IC <b className="text-foreground">{incident.incidentCommander}</b></span>
          <span>Son güncelleme <b className="text-foreground">{formatTime(incident.lastUpdateAt)}</b></span>
          <span>Sonraki iletişim <b className="text-red-600 dark:text-red-400">{formatTime(incident.nextCommunicationAt)}</b></span>
        </div>
        {error && <div className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">{error}</div>}
      </div>

      {showFinishForm && (
        <FinishIncidentForm
          busy={busy}
          onCancel={() => setShowFinishForm(false)}
          onFinish={async (input) => {
            await finish(input)
            setShowFinishForm(false)
          }}
        />
      )}
    </div>
  )
}

export function IncidentSessionPanel({ session }: { session: EngineeringIncidentSession }) {
  const [showStartForm, setShowStartForm] = useState(false)

  if (session.loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" /> Aktif incident kontrol ediliyor…
      </div>
    )
  }

  if (session.incident) return <ActiveIncidentBar session={session} />

  if (showStartForm) {
    return (
      <IncidentStartForm
        busy={session.busy}
        error={session.error}
        onCancel={() => setShowStartForm(false)}
        onSubmit={async (input) => {
          const created = await session.start(input)
          setShowStartForm(false)
          return created
        }}
      />
    )
  }

  return (
    <div className={cn('rounded-xl border p-5', session.lastFinished ? toneCard.green : toneCard.gray)}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', session.lastFinished ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground')}>
            {session.lastFinished ? <CheckCircle2 className="size-5" /> : <Clock3 className="size-5" />}
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">
              {session.lastFinished ? `${session.lastFinished.incidentNumber} kapatıldı` : 'Aktif incident yok'}
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              {session.lastFinished
                ? `Toplam süre ${formatElapsed(session.lastFinished.startedAt, session.lastFinished.endedAt, Date.now())}. Yeni bir incident başlatabilirsiniz.`
                : 'Sayaç ve canlı incident paneli yalnızca siz formu gönderip DB kaydı oluşturduğunuzda başlayacak.'}
            </p>
            {session.error && <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">{session.error}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          {session.error && (
            <Button variant="outline" size="sm" onClick={() => void session.reload()}>
              <RotateCcw className="size-4" /> Yenile
            </Button>
          )}
          <Button size="sm" className="bg-red-600 text-white hover:bg-red-700" onClick={() => setShowStartForm(true)}>
            <Play className="size-4" /> Incident Başlat
          </Button>
        </div>
      </div>
    </div>
  )
}

export function IncidentLiveRail({ incident }: { incident: EngineeringIncident }) {
  const elapsed = useElapsedTime(incident)
  const team = useMemo(
    () => [
      { role: 'IC', name: incident.incidentCommander },
      { role: 'Ops Lead', name: incident.operationsLead },
      { role: 'Comms', name: incident.communicationsLead },
      { role: 'Scribe', name: incident.scribe },
    ].filter((member): member is { role: string; name: string } => Boolean(member.name)),
    [incident],
  )
  const latestEvent = incident.events.at(-1)

  return (
    <div className="space-y-3">
      <div className={cn('rounded-xl border p-3.5', toneCard.red)}>
        <div className="flex items-center justify-between">
          <Badge variant="destructive" size="sm">{incident.severity}</Badge>
          <span className="text-xs font-semibold text-red-700 dark:text-red-300">{statusLabel(incident.status)}</span>
        </div>
        <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground">{elapsed}</div>
        <div className="text-[11px] text-muted-foreground">geçen süre · başlangıç {formatTime(incident.startedAt)}</div>
      </div>

      <div className={cn('rounded-xl border p-3.5', toneCard.amber)}>
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          <Crosshair className="size-3.5" /> Mevcut hedef
        </div>
        <p className="mt-1.5 text-sm font-medium leading-snug text-foreground">{incident.objective}</p>
      </div>

      <div className="mt-8">
        <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Etki özeti</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[
            { label: 'Ülke', value: incident.countries.length },
            { label: 'Kurye', value: incident.affectedCouriers },
            { label: 'Gönderi', value: incident.affectedShipments },
            { label: 'Ödeme kaydı', value: incident.affectedPaymentRecords },
            { label: 'Version', value: incident.appVersion },
          ].map((metric) => (
            <div key={metric.label} className="rounded-lg bg-muted/50 px-2 py-1.5">
              <div className="text-sm font-bold tabular-nums text-foreground">{metric.value}</div>
              <div className="text-[10px] text-muted-foreground">{metric.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background p-3.5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          <Users className="size-3.5" /> Incident ekibi
        </div>
        <ul className="mt-2 space-y-1.5 text-xs">
          {team.map((member) => (
            <li key={member.role} className="flex items-baseline justify-between gap-2">
              <span className="shrink-0 font-bold text-foreground/70">{member.role}</span>
              <span className="truncate text-right text-foreground">{member.name}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className={cn('rounded-xl border p-3.5', toneCard.blue)}>
        <div className="text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">Son karar</div>
        <p className="mt-1 text-xs leading-relaxed text-foreground">{latestEvent?.message ?? 'Incident başlatıldı.'}</p>
        <div className="mt-2.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">Sonraki kontrol</div>
        <p className="mt-1 text-xs leading-relaxed text-foreground">
          {incident.nextCommunicationAt ? `${formatTime(incident.nextCommunicationAt)} — iletişim güncellemesi` : 'Henüz planlanmadı'}
        </p>
      </div>

      <div className="mt-8 border-t border-border/60 pt-6">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <History className="size-3.5" /> Canlı timeline
        </div>
        <ol className="mt-2.5 space-y-0">
          {incident.events.map((event, index) => (
            <li key={event.id} className="relative flex gap-2.5 pb-2.5 last:pb-0">
              {index < incident.events.length - 1 && <span className="absolute left-[3px] top-3 h-full w-px bg-border" />}
              <span className={cn('relative mt-1.5 size-[7px] shrink-0 rounded-full', index === incident.events.length - 1 ? 'bg-red-500' : 'bg-muted-foreground/40')} />
              <div className="min-w-0 text-xs">
                <span className="font-mono font-semibold text-muted-foreground">{formatTime(event.occurredAt)}</span>{' '}
                <span className="text-foreground/90">{event.message}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
