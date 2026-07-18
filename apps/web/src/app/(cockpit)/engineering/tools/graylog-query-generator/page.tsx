'use client'

import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  Clock,
  Eraser,
  EyeOff,
  History,
  Loader2,
  Search,
  Sparkles,
  Terminal,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Button } from '@nesy/metronic/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@nesy/metronic/components/ui/collapsible'
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
import { ToggleGroup, ToggleGroupItem } from '@nesy/metronic/components/ui/toggle-group'
import { PageSection, ProductPage } from '@/components/product'
import { ExampleChip, ToolCard, ToolHeader } from '@/components/engineering/tools/shared'
import {
  APPLICATIONS,
  APP_VERSIONS,
  COUNTRIES,
  DEVICES,
  ENVIRONMENTS,
  GUARDRAIL_BROAD_SCOPE,
  GUARDRAIL_SOFT_HINTS,
  IDENTIFIER_FIELDS,
  LOG_LEVELS,
  LOG_SOURCES,
  PRODUCTION_DEFAULT_TIME_RANGE,
  SCENARIO_CHIPS,
  SERVICES,
  TIME_RANGES,
  type SelectOption,
} from '@/data/engineering/tools/graylog-generator'
import {
  deleteGraylogQuery,
  fetchGraylogFields,
  fetchRecentGraylogQueries,
  generateGraylogQuery,
  reuseGraylogQuery,
  type GraylogField,
  type GraylogQueryRun,
} from '@/services/graylog-query'
import { QueryWorkspace } from './workspace'
import { RecentQueriesTable } from './recent-queries'

const PATH = '/engineering/tools/graylog-query-generator'

const EMPTY_IDENTIFIERS: Record<string, string> = Object.fromEntries(
  IDENTIFIER_FIELDS.map((f) => [f.key, '']),
)

const DEFAULT_SOURCES = ['mobile', 'backend', 'fiscal']

function AmberNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
      <AlertTriangle className="mt-px size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}

function ContextSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
}) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

export default function GraylogQueryGeneratorPage() {
  const [request, setRequest] = useState('')
  const [env, setEnv] = useState('production')
  const [country, setCountry] = useState('HR')
  const [application, setApplication] = useState('nesy-mobile')
  const [service, setService] = useState('any')
  const [logLevel, setLogLevel] = useState('any')
  const [timeRange, setTimeRange] = useState(PRODUCTION_DEFAULT_TIME_RANGE)
  const [device, setDevice] = useState('any')
  const [appVersion, setAppVersion] = useState('any')
  const [identifiers, setIdentifiers] = useState<Record<string, string>>(EMPTY_IDENTIFIERS)
  const [sources, setSources] = useState<string[]>(DEFAULT_SOURCES)
  const [fields, setFields] = useState<GraylogField[]>([])
  const [fieldsError, setFieldsError] = useState<string | null>(null)
  const [fieldDictOpen, setFieldDictOpen] = useState(false)
  const [fieldFilter, setFieldFilter] = useState('')
  const [recent, setRecent] = useState<GraylogQueryRun[]>([])
  const [recentLoading, setRecentLoading] = useState(true)
  const [recentError, setRecentError] = useState<string | null>(null)
  const [result, setResult] = useState<GraylogQueryRun | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  const hasIdentifier = useMemo(
    () => Object.values(identifiers).some((v) => v.trim().length > 0),
    [identifiers],
  )
  const showGuardrail = timeRange === '24h' && !hasIdentifier

  const filteredFields = useMemo(() => {
    const q = fieldFilter.trim().toLowerCase()
    if (!q) return fields
    return fields.filter((f) =>
      [f.field, f.meaning, f.example, f.source].some((s) => s.toLowerCase().includes(q)),
    )
  }, [fields, fieldFilter])

  const loadRecent = useCallback(async () => {
    setRecentLoading(true)
    setRecentError(null)
    try {
      const rows = await fetchRecentGraylogQueries()
      setRecent(rows)
    } catch (e) {
      // One retry — API may be briefly unavailable during tsx watch restart
      try {
        await new Promise((r) => window.setTimeout(r, 600))
        const rows = await fetchRecentGraylogQueries()
        setRecent(rows)
        setRecentError(null)
      } catch (retryError) {
        setRecent([])
        setRecentError(
          retryError instanceof Error ? retryError.message : 'Failed to load recent queries',
        )
      }
    } finally {
      setRecentLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await fetchGraylogFields()
        if (!cancelled) {
          setFields(list)
          setFieldsError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setFieldsError(e instanceof Error ? e.message : 'Failed to load field dictionary')
        }
      }
    })()
    void loadRecent()
    return () => {
      cancelled = true
    }
  }, [loadRecent])

  const handleEnvChange = (v: string) => {
    setEnv(v)
    if (v === 'production') setTimeRange(PRODUCTION_DEFAULT_TIME_RANGE)
  }

  const handleClear = () => {
    setRequest('')
    setEnv('production')
    setCountry('HR')
    setApplication('nesy-mobile')
    setService('any')
    setLogLevel('any')
    setTimeRange(PRODUCTION_DEFAULT_TIME_RANGE)
    setDevice('any')
    setAppVersion('any')
    setIdentifiers(EMPTY_IDENTIFIERS)
    setSources(DEFAULT_SOURCES)
    setResult(null)
    setGenerateError(null)
  }

  const appendField = (field: string) => {
    setRequest((prev) => (prev.trim() ? `${prev.trimEnd()} ${field}:` : `${field}:`))
  }

  const onGenerate = async () => {
    if (!request.trim() || generating) return
    setResult(null)
    setGenerateError(null)
    setGenerating(true)
    try {
      const run = await generateGraylogQuery({
        naturalLanguage: request.trim(),
        environment: env,
        country,
        application,
        service,
        logLevel,
        timeRange,
        device,
        appVersion,
        identifiers,
        sources,
      })
      setResult(run)
      await loadRecent()
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : 'Generate failed')
    } finally {
      setGenerating(false)
    }
  }

  const reuseQuery = async (q: GraylogQueryRun) => {
    setRequest(q.naturalLanguage)
    setEnv(q.environment || 'production')
    setCountry(q.country || 'HR')
    setApplication(q.application || 'nesy-mobile')
    setService(q.service || 'any')
    setLogLevel(q.logLevel || 'any')
    setTimeRange(q.timeRange || PRODUCTION_DEFAULT_TIME_RANGE)
    setDevice(q.device || 'any')
    setAppVersion(q.appVersion || 'any')
    setIdentifiers({ ...EMPTY_IDENTIFIERS, ...(q.identifiers ?? {}) })
    setSources(q.sources?.length ? q.sources : DEFAULT_SOURCES)
    setResult(q)
    setGenerateError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    try {
      const updated = await reuseGraylogQuery(q.id)
      setRecent((prev) => {
        const rest = prev.filter((r) => r.id !== updated.id)
        return [updated, ...rest]
      })
    } catch {
      // reuse bump is optional
    }
  }

  const deleteQuery = async (q: GraylogQueryRun) => {
    try {
      await deleteGraylogQuery(q.id)
      setRecent((prev) => prev.filter((r) => r.id !== q.id))
      if (result?.id === q.id) setResult(null)
      setRecentError(null)
    } catch (e) {
      setRecentError(e instanceof Error ? e.message : 'Failed to delete query')
      throw e
    }
  }

  const th =
    'px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground'
  const td = 'px-2.5 py-2 align-middle text-xs text-foreground/85'

  return (
    <ProductPage path={PATH}>
      <ToolHeader
        path={PATH}
        icon={Terminal}
        tone="orange"
        title="Graylog Query Generator"
        lead="Describe the log signal you need in natural language; convert it into a safe Graylog query via Claude CLI (haiku) with time, service, and field constraints."
        badges={[
          { label: 'Search only', icon: Search, tone: 'green' },
          { label: 'Time range required', icon: Clock, tone: 'blue' },
          { label: 'Sensitive fields masked', icon: EyeOff, tone: 'gray' },
        ]}
      />

      <div className="space-y-6">
        <ToolCard
          step="1"
          title="Define your log needs"
          description="Pick a scenario or write your own prompt, then narrow with context, identifiers, and log sources."
          className="w-full"
        >
          <div className="space-y-2">
            <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Natural language
            </Label>
            <Textarea
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              placeholder="Show the delivery, fiscal, and retry logs generated in the last 2 hours for shipment 45-40-20251224-1."
              className="min-h-[120px] text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {SCENARIO_CHIPS.map((c) => (
              <ExampleChip
                key={c.id}
                label={c.label}
                onClick={() => setRequest(c.text)}
              />
            ))}
          </div>

          {generateError && <AmberNotice>{generateError}</AmberNotice>}

          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Query context
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
              <ContextSelect label="Environment" value={env} onChange={handleEnvChange} options={ENVIRONMENTS} />
              <ContextSelect label="Country" value={country} onChange={setCountry} options={COUNTRIES} />
              <ContextSelect
                label="Application"
                value={application}
                onChange={setApplication}
                options={APPLICATIONS}
              />
              <ContextSelect label="Service" value={service} onChange={setService} options={SERVICES} />
              <ContextSelect label="Log level" value={logLevel} onChange={setLogLevel} options={LOG_LEVELS} />
              <ContextSelect label="Time range" value={timeRange} onChange={setTimeRange} options={TIME_RANGES} />
              <ContextSelect label="Device" value={device} onChange={setDevice} options={DEVICES} />
              <ContextSelect
                label="App version"
                value={appVersion}
                onChange={setAppVersion}
                options={APP_VERSIONS}
              />
            </div>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Known Identifiers
              <span className="ms-1.5 font-medium normal-case tracking-normal">(optional)</span>
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              {IDENTIFIER_FIELDS.map((f) => (
                <Field key={f.key} label={f.label}>
                  <Input
                    variant="sm"
                    value={identifiers[f.key]}
                    placeholder={f.placeholder}
                    onChange={(e) =>
                      setIdentifiers((prev) => ({ ...prev, [f.key]: e.target.value }))
                    }
                  />
                </Field>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Log sources
            </h3>
            <ToggleGroup
              type="multiple"
              variant="outline"
              size="sm"
              value={sources}
              onValueChange={(v: string[]) => setSources(v)}
              className="mt-2 flex-wrap justify-start gap-1.5 data-[variant=outline]:gap-1.5 data-[variant=outline]:shadow-none"
            >
              {LOG_SOURCES.map((s) => (
                <ToggleGroupItem
                  key={s.id}
                  value={s.id}
                  className="rounded-full border data-[variant=outline]:rounded-full data-[variant=outline]:border-s data-[state=on]:border-orange-300 data-[state=on]:bg-orange-50/80 data-[state=on]:text-orange-700 dark:data-[state=on]:border-orange-800 dark:data-[state=on]:bg-orange-950/40 dark:data-[state=on]:text-orange-300"
                >
                  {s.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <Collapsible open={fieldDictOpen} onOpenChange={setFieldDictOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted/50">
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="size-3.5 text-muted-foreground" />
                Field dictionary
                {fields.length ? ` · ${fields.length} fields` : ''}
              </span>
              <ChevronDown
                className={cn(
                  'size-3.5 text-muted-foreground transition-transform',
                  fieldDictOpen && 'rotate-180',
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-2">
                {fieldsError && <AmberNotice>{fieldsError}</AmberNotice>}
                <Input
                  variant="sm"
                  value={fieldFilter}
                  onChange={(e) => setFieldFilter(e.target.value)}
                  placeholder="Search field, meaning, or source…"
                  className="max-w-xs"
                />
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[560px] border-collapse text-xs">
                    <thead className="border-b bg-muted/40">
                      <tr>
                        {['Field', 'Meaning', 'Example', 'Source'].map((h) => (
                          <th key={h} className={th}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFields.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-2.5 py-6 text-center text-muted-foreground">
                            No fields match the filter.
                          </td>
                        </tr>
                      )}
                      {filteredFields.map((f) => (
                        <tr
                          key={f.field}
                          onClick={() => appendField(f.field)}
                          title={`${f.field}: append to your request`}
                          className="cursor-pointer border-b transition-colors last:border-b-0 hover:bg-orange-50/50 dark:hover:bg-orange-950/20"
                        >
                          <td className={cn(td, 'whitespace-nowrap')}>
                            <code className="font-bold text-orange-600 dark:text-orange-400">
                              {f.field}
                            </code>
                          </td>
                          <td className={cn(td, 'max-w-[280px]')}>{f.meaning}</td>
                          <td className={cn(td, 'whitespace-nowrap')}>
                            <code className="text-[11px] text-foreground/70">{f.example}</code>
                          </td>
                          <td className={cn(td, 'whitespace-nowrap text-muted-foreground')}>
                            {f.source}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {showGuardrail && (
            <AmberNotice>
              <p className="font-bold">{GUARDRAIL_BROAD_SCOPE}</p>
              <p className="mt-1 text-foreground/75">
                {GUARDRAIL_SOFT_HINTS[0]} {GUARDRAIL_SOFT_HINTS[1]}
              </p>
            </AmberNotice>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <Button
              variant="primary"
              onClick={() => void onGenerate()}
              disabled={!request.trim() || generating}
            >
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {generating ? 'Generating…' : 'Generate Query'}
            </Button>
            <Button variant="outline" onClick={handleClear} disabled={generating}>
              <Eraser className="size-4" />
              Clear form
            </Button>
          </div>
        </ToolCard>

        <div className="w-full">
          <QueryWorkspace run={result} loading={generating} />
        </div>
      </div>

      <PageSection
        eyebrow="History"
        title="Recent Queries"
        icon={History}
        tone="orange"
        description="Queries auto-saved to Postgres on every Generate — click a row to open details and reuse."
      >
        <RecentQueriesTable
          queries={recent}
          loading={recentLoading}
          error={recentError}
          onReuse={(q) => void reuseQuery(q)}
          onDelete={deleteQuery}
        />
      </PageSection>
    </ProductPage>
  )
}
