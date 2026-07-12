'use client'

// Graylog Query Generator — doğal dil isteğini güvenli Graylog sorgusuna çevirir (mock).
// Sol: istek + context formu · Sağ: sorgu sonucu sekmeleri · Altta: field dictionary + saved investigations.

import { ReactNode, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  Braces,
  Clock,
  Eraser,
  EyeOff,
  FolderSearch,
  Map,
  Search,
  Sparkles,
  Terminal,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
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
import { ToggleGroup, ToggleGroupItem } from '@nesy/metronic/components/ui/toggle-group'
import { PageSection, ProductPage } from '@/components/product'
import { ExampleChip, ToolCard, ToolHeader } from '@/components/engineering/tools/shared'
import {
  APPLICATIONS,
  APP_VERSIONS,
  COUNTRIES,
  DEVICES,
  ENVIRONMENTS,
  GRAYLOG_FIELDS,
  GUARDRAIL_BROAD_SCOPE,
  GUARDRAIL_SOFT_HINTS,
  IDENTIFIER_FIELDS,
  LOG_LEVELS,
  LOG_SOURCES,
  PRODUCTION_DEFAULT_TIME_RANGE,
  SCENARIO_CHIPS,
  SERVICES,
  TIME_RANGES,
  type SavedInvestigation,
  type SelectOption,
} from '@/data/engineering/tools/graylog-generator'
import { ResultPanel } from './result-panel'
import { SavedInvestigations } from './investigations'

// ── Küçük form yardımcıları ──────────────────────────────────────

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] font-semibold text-muted-foreground">{label}</Label>
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

const EMPTY_IDENTIFIERS: Record<string, string> = Object.fromEntries(
  IDENTIFIER_FIELDS.map((f) => [f.key, '']),
)

const DEFAULT_SOURCES = ['mobile', 'backend', 'fiscal']

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
  const [generated, setGenerated] = useState(false)
  const [fieldFilter, setFieldFilter] = useState('')

  const hasIdentifier = useMemo(
    () => Object.values(identifiers).some((v) => v.trim().length > 0),
    [identifiers],
  )
  // Amber guardrail: 24 saatlik geniş aralık + hiç identifier yoksa uyar.
  const showGuardrail = timeRange === '24h' && !hasIdentifier

  const contextBar = useMemo(() => {
    const envLabel = ENVIRONMENTS.find((e) => e.value === env)?.label ?? env
    const trLabel = TIME_RANGES.find((t) => t.value === timeRange)?.label ?? timeRange
    return `${envLabel} · ${country} · ${trLabel} · ${sources.length} sources`
  }, [env, country, timeRange, sources])

  const handleEnvChange = (v: string) => {
    setEnv(v)
    // Production'a geçişte varsayılan zaman aralığı 1 saate çekilir.
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
    setGenerated(false)
  }

  const handleReuse = (inv: SavedInvestigation) => {
    setRequest(inv.objective)
    setCountry(inv.country)
    setGenerated(true)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const appendField = (field: string) => {
    setRequest((prev) => (prev.trim() ? `${prev.trimEnd()} ${field}:` : `${field}:`))
    setGenerated(false)
  }

  const filteredFields = GRAYLOG_FIELDS.filter((f) => {
    const q = fieldFilter.trim().toLowerCase()
    if (!q) return true
    return [f.field, f.meaning, f.example, f.source].some((s) => s.toLowerCase().includes(q))
  })

  const th =
    'px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap'
  const td = 'px-3 py-2.5 align-middle text-xs text-foreground/85'

  return (
    <ProductPage path="/engineering/tools/graylog-query-generator">
      <ToolHeader
        path="/engineering/tools/graylog-query-generator"
        icon={Terminal}
        tone="orange"
        title="Graylog Query Generator"
        lead="Aradığın log sinyalini doğal dille tanımla; zaman, servis ve teknik alanlarla güvenli Graylog sorgusuna dönüştür."
        badges={[
          { label: 'Search only', icon: Search, tone: 'green' },
          { label: 'Time range required', icon: Clock, tone: 'blue' },
          { label: 'Sensitive fields masked', icon: EyeOff, tone: 'gray' },
          { label: 'Graylog syntax aware', icon: Braces, tone: 'orange' },
          { label: 'Source map synced', icon: Map, tone: 'teal' },
        ]}
      />

      {/* Ana düzen: sol form %45 / sağ sonuç %55 */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[45fr_55fr]">
        {/* ── Sol kolon ── */}
        <ToolCard
          step="1"
          title="Hangi logları arıyorsun?"
          description="İsteğini doğal dille yaz veya hazır bir senaryodan başla; context alanları sorguyu daraltır."
        >
          <Textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder="Shipment 45-40-20251224-1 için son 2 saatte oluşan delivery, fiscal ve retry loglarını göster."
            className="min-h-[96px]"
            variant="sm"
          />

          <div className="flex flex-wrap gap-1.5">
            {SCENARIO_CHIPS.map((c) => (
              <ExampleChip
                key={c.id}
                label={c.label}
                onClick={() => {
                  setRequest(c.text)
                  setGenerated(false)
                }}
              />
            ))}
          </div>

          {/* Query context */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Query context
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <ContextSelect label="Environment" value={env} onChange={handleEnvChange} options={ENVIRONMENTS} />
              <ContextSelect label="Country" value={country} onChange={setCountry} options={COUNTRIES} />
              <ContextSelect label="Application" value={application} onChange={setApplication} options={APPLICATIONS} />
              <ContextSelect label="Service" value={service} onChange={setService} options={SERVICES} />
              <ContextSelect label="Log level" value={logLevel} onChange={setLogLevel} options={LOG_LEVELS} />
              <ContextSelect label="Time range" value={timeRange} onChange={setTimeRange} options={TIME_RANGES} />
              <ContextSelect label="Device" value={device} onChange={setDevice} options={DEVICES} />
              <ContextSelect label="App version" value={appVersion} onChange={setAppVersion} options={APP_VERSIONS} />
            </div>
          </div>

          {/* Known identifiers */}
          <div className="rounded-lg border bg-muted/20 p-3">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Known Identifiers
              <span className="ms-1.5 font-medium normal-case tracking-normal">(opsiyonel)</span>
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

          {/* Log kaynakları */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Log kaynakları
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
                  className="rounded-full border data-[variant=outline]:rounded-full data-[variant=outline]:border-s data-[state=on]:border-blue-300 data-[state=on]:bg-blue-50/80 data-[state=on]:text-blue-700 dark:data-[state=on]:border-blue-800 dark:data-[state=on]:bg-blue-950/40 dark:data-[state=on]:text-blue-300"
                >
                  {s.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {/* Amber guardrail */}
          {showGuardrail && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="text-xs leading-relaxed">
                <p className="font-bold text-amber-700 dark:text-amber-300">{GUARDRAIL_BROAD_SCOPE}</p>
                <p className="mt-1 text-foreground/75">
                  {GUARDRAIL_SOFT_HINTS[0]} {GUARDRAIL_SOFT_HINTS[1]}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <Button variant="primary" onClick={() => setGenerated(true)}>
              <Sparkles className="size-4" />
              Graylog Query Oluştur
            </Button>
            <Button variant="outline" onClick={handleClear}>
              <Eraser className="size-4" />
              Alanları temizle
            </Button>
          </div>
        </ToolCard>

        {/* ── Sağ kolon ── */}
        <ResultPanel generated={generated} contextBar={contextBar} strong={hasIdentifier} />
      </div>

      {/* ── Common Graylog Fields ── */}
      <PageSection
        eyebrow="Sözlük"
        title="Common Graylog Fields"
        icon={BookOpen}
        tone="orange"
        description="Sık kullanılan alanların anlamı ve kaynağı. Bir satıra tıklayarak alanı isteğine ekleyebilirsin."
      >
        <div className="space-y-3">
          <Input
            variant="sm"
            value={fieldFilter}
            onChange={(e) => setFieldFilter(e.target.value)}
            placeholder="Alan, anlam veya kaynak ara…"
            className="max-w-xs"
          />
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className={th}>Field</th>
                  <th className={th}>Meaning</th>
                  <th className={th}>Example</th>
                  <th className={th}>Source</th>
                </tr>
              </thead>
              <tbody>
                {filteredFields.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      Filtreye uyan alan yok.
                    </td>
                  </tr>
                )}
                {filteredFields.map((f) => (
                  <tr
                    key={f.field}
                    onClick={() => appendField(f.field)}
                    title={`${f.field}: isteğine ekle`}
                    className="cursor-pointer border-b transition-colors last:border-b-0 hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
                  >
                    <td className={cn(td, 'whitespace-nowrap')}>
                      <code className="text-xs font-bold text-orange-600 dark:text-orange-400">{f.field}</code>
                    </td>
                    <td className={cn(td, 'max-w-[420px]')}>{f.meaning}</td>
                    <td className={cn(td, 'whitespace-nowrap')}>
                      <code className="text-[11px] text-foreground/70">{f.example}</code>
                    </td>
                    <td className={cn(td, 'whitespace-nowrap text-muted-foreground')}>{f.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </PageSection>

      {/* ── Saved Investigations ── */}
      <PageSection
        eyebrow="Arşiv"
        title="Saved Investigations"
        icon={FolderSearch}
        tone="orange"
        description="Ekibin daha önce çalıştığı araştırma sorguları. Satıra tıklayarak detayı aç; 'Reuse query' ile formu doldur."
      >
        <SavedInvestigations onReuse={handleReuse} />
      </PageSection>
    </ProductPage>
  )
}
