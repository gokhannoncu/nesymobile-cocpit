'use client'

// Senaryo Yapılandırma — orta panel.
// Seçili senaryonun parametreleri, komut önizlemesi, doğrulama ve
// geri alma adımlarını barındırır. Preflight kontrollerini yürütür.

import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  BookOpen,
  ChevronRight,
  Code2,
  Info,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Undo2,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { Input } from '@nesy/metronic/components/ui/input'
import { Switch } from '@nesy/metronic/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nesy/metronic/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@nesy/metronic/components/ui/tabs'
import { EASE, toneCard, toneIcon, toneText } from '@/components/product'
import {
  RiskBadge,
  BuildCompatBadge,
  DebugOnlyWarning,
  ProductionProtectionBadge,
  PreflightCheckList,
  EmptyPanelState,
} from '@/components/engineering/device-lab/device-lab-shared'
import { CodeBlock } from '@/components/engineering/tools/shared'
import { RISK_LEVEL_META } from '@/data/engineering/device-lab/mock-devices'
import type { ScenarioPackage, ConfigType } from '@/data/engineering/device-lab/device-lab-types'

/* ─── Komut interpolasyonu ─── */
function interpolateCommand(cmd: string, serial: string, params: Record<string, any>): string {
  let result = cmd.replace(/{serial}/g, serial)
  Object.entries(params).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value))
  })
  return result
}

/* ─── Süre formatla ─── */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `~${seconds} saniye`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `~${m} dk ${s} sn` : `~${m} dk`
}

/* ─── Preflight check result type ─── */
interface PreflightResult {
  id: string
  label: string
  status: 'pass' | 'warn' | 'fail'
  message?: string
}

/* ─── Props ─── */
interface ScenarioConfigProps {
  scenario: ScenarioPackage | null
  paramValues: Record<string, any>
  onParamChange: (key: string, value: any) => void
  activeTab: 'summary' | 'commands' | 'verification' | 'rollback'
  onTabChange: (tab: 'summary' | 'commands' | 'verification' | 'rollback') => void
  onRun: () => void
  preflightResults: PreflightResult[]
  allPreflightsPassed: boolean
  deviceSerial: string
  isDebuggable: boolean
  isConnected: boolean
  configType: ConfigType | null
  isRunning: boolean
}

export function ScenarioConfig({
  scenario,
  paramValues,
  onParamChange,
  activeTab,
  onTabChange,
  onRun,
  preflightResults,
  allPreflightsPassed,
  deviceSerial,
  isDebuggable,
  isConnected,
  configType,
  isRunning,
}: ScenarioConfigProps) {
  // İnterpolasyonlu komutlar
  const interpolatedCommands = useMemo(() => {
    if (!scenario) return []
    return scenario.commands.map((cmd) => ({
      ...cmd,
      command: interpolateCommand(cmd.command, deviceSerial, paramValues),
    }))
  }, [scenario, deviceSerial, paramValues])

  // Tüm komutları tek string olarak birleştir
  const allCommandsText = useMemo(
    () => interpolatedCommands.map((c) => `# ${c.label}\n${c.command}`).join('\n\n'),
    [interpolatedCommands],
  )

  // Rollback komutlarını birleştir
  const rollbackCommandsText = useMemo(() => {
    if (!scenario) return ''
    return scenario.rollbackSteps
      .map((r) => `# ${r.label}\n${interpolateCommand(r.command, deviceSerial, paramValues)}`)
      .join('\n\n')
  }, [scenario, deviceSerial, paramValues])

  // Yıkıcı senaryo mu?
  const isDestructive = scenario?.riskLevel === 'destructive'

  // Production config ile destructive senaryo
  const isProductionBlocked = configType === 'production' && isDestructive

  // Debug gerekli ama cihaz debug değil
  const isDebugRequired =
    scenario?.buildCompatibility === 'debug' && !isDebuggable

  // CTA butonu devre dışı mı?
  const isCtaDisabled =
    !isConnected ||
    !allPreflightsPassed ||
    isProductionBlocked ||
    isDebugRequired ||
    isRunning

  // Boş durum
  if (!scenario) {
    return (
      <motion.section
        className="rounded-xl border border-border bg-card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <EmptyPanelState
          icon={Settings2}
          title="Senaryo Seçin"
          description="Sol panelden bir senaryo seçtiğinizde yapılandırma ve komut detayları burada görüntülenecek."
        />
      </motion.section>
    )
  }

  return (
    <motion.section
      className="flex flex-col overflow-hidden rounded-xl border border-border bg-card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      key={scenario.id}
    >
      {/* ─── Senaryo başlığı ─── */}
      <div className="space-y-3 border-b border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground">{scenario.name}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {scenario.description}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <RiskBadge risk={scenario.riskLevel} />
            <BuildCompatBadge build={scenario.buildCompatibility} />
          </div>
        </div>

        {/* Meta bilgiler */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span>Süre: <strong className="text-foreground">{formatDuration(scenario.estimatedDuration)}</strong></span>
          <span>Versiyon: <strong className="text-foreground">v{scenario.version}</strong></span>
          <span>Sahip: <strong className="text-foreground">{scenario.owner}</strong></span>
          <span>Son doğrulama: <strong className="text-foreground">{scenario.lastVerifiedAt}</strong></span>
          <span>Kullanım: <strong className="text-foreground">{scenario.executionCount}x</strong></span>
        </div>

        {/* Ne değişecek? */}
        <div className={cn('rounded-lg border p-3', toneCard[RISK_LEVEL_META[scenario.riskLevel].tone])}>
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <Info className={cn('size-3.5', toneIcon[RISK_LEVEL_META[scenario.riskLevel].tone])} />
            <span className={toneText[RISK_LEVEL_META[scenario.riskLevel].tone]}>Ne değişecek?</span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {RISK_LEVEL_META[scenario.riskLevel].description}
          </p>
        </div>
      </div>

      {/* ─── Uyarılar ─── */}
      {isDebugRequired && <DebugOnlyWarning className="mx-4 mt-3" />}
      {isProductionBlocked && <ProductionProtectionBadge className="mx-4 mt-3" />}

      {/* ─── Parametre formu ─── */}
      {scenario.parameters.length > 0 && (
        <div className="space-y-3 border-b border-border p-4">
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Settings2 className="size-3" />
            Parametreler
          </h3>
          <div className="space-y-3">
            {scenario.parameters.map((param) => (
              <div key={param.key} className="space-y-1">
                <label className="flex items-center gap-1 text-xs font-medium text-foreground">
                  {param.label}
                  {param.required && <span className="text-red-500">*</span>}
                </label>

                {/* Boolean → Switch */}
                {param.type === 'boolean' && (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={paramValues[param.key] ?? false}
                      onCheckedChange={(checked) => onParamChange(param.key, checked)}
                    />
                    <span className="text-[11px] text-muted-foreground">
                      {paramValues[param.key] ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>
                )}

                {/* Select */}
                {param.type === 'select' && param.options && (
                  <Select
                    value={paramValues[param.key] ?? ''}
                    onValueChange={(v) => onParamChange(param.key, v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Seçin..." />
                    </SelectTrigger>
                    <SelectContent>
                      {param.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Date */}
                {param.type === 'date' && (
                  <Input
                    type="date"
                    value={paramValues[param.key] ?? ''}
                    onChange={(e) => onParamChange(param.key, e.target.value)}
                    className="h-8 text-xs"
                  />
                )}

                {/* DateTime */}
                {param.type === 'datetime' && (
                  <Input
                    type="datetime-local"
                    value={paramValues[param.key] ?? ''}
                    onChange={(e) => onParamChange(param.key, e.target.value)}
                    className="h-8 text-xs"
                  />
                )}

                {/* Number */}
                {param.type === 'number' && (
                  <Input
                    type="number"
                    value={paramValues[param.key] ?? ''}
                    onChange={(e) => onParamChange(param.key, Number(e.target.value))}
                    className="h-8 text-xs"
                  />
                )}

                {/* Text */}
                {param.type === 'text' && (
                  <Input
                    type="text"
                    value={paramValues[param.key] ?? ''}
                    onChange={(e) => onParamChange(param.key, e.target.value)}
                    placeholder={param.hint ?? ''}
                    className="h-8 text-xs"
                  />
                )}

                {/* Multiselect placeholder */}
                {param.type === 'multiselect' && param.options && (
                  <div className="flex flex-wrap gap-1">
                    {param.options.map((opt) => {
                      const selected = Array.isArray(paramValues[param.key])
                        ? (paramValues[param.key] as string[]).includes(opt.value)
                        : false
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            const current: string[] = Array.isArray(paramValues[param.key])
                              ? paramValues[param.key]
                              : []
                            const next = selected
                              ? current.filter((v) => v !== opt.value)
                              : [...current, opt.value]
                            onParamChange(param.key, next)
                          }}
                          className={cn(
                            'rounded-md border px-2 py-1 text-[10.5px] font-medium transition-all',
                            selected
                              ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
                              : 'border-border text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Hint */}
                {param.hint && param.type !== 'text' && (
                  <p className="text-[10px] text-muted-foreground">{param.hint}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Sekmeler ─── */}
      <div className="flex-1">
        <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as any)}>
          <div className="border-b border-border px-4">
            <TabsList className="h-9 w-full justify-start gap-0 rounded-none bg-transparent p-0">
              <TabsTrigger
                value="summary"
                className="rounded-none border-b-2 border-transparent px-3 py-2 text-[11px] data-[state=active]:border-blue-500 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300"
              >
                <BookOpen className="mr-1 size-3" />
                Özet
              </TabsTrigger>
              <TabsTrigger
                value="commands"
                className="rounded-none border-b-2 border-transparent px-3 py-2 text-[11px] data-[state=active]:border-blue-500 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300"
              >
                <Code2 className="mr-1 size-3" />
                Komutlar
              </TabsTrigger>
              <TabsTrigger
                value="verification"
                className="rounded-none border-b-2 border-transparent px-3 py-2 text-[11px] data-[state=active]:border-blue-500 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300"
              >
                <ShieldCheck className="mr-1 size-3" />
                Doğrulama
              </TabsTrigger>
              <TabsTrigger
                value="rollback"
                className="rounded-none border-b-2 border-transparent px-3 py-2 text-[11px] data-[state=active]:border-blue-500 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300"
              >
                <Undo2 className="mr-1 size-3" />
                Geri Alma
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Özet */}
          <TabsContent value="summary" className="p-4">
            <div className="space-y-4">
              {/* Komut adımları */}
              <div>
                <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Yürütülecek Adımlar
                </h4>
                <div className="space-y-2">
                  {scenario.commands.map((cmd) => (
                    <div
                      key={cmd.step}
                      className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
                    >
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        {cmd.step}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-foreground">{cmd.label}</div>
                        <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">
                          {cmd.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Desteklenen paketler */}
              <div>
                <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Desteklenen Paketler
                </h4>
                <div className="flex flex-wrap gap-1">
                  {scenario.supportedPackages.map((pkg) => (
                    <Badge key={pkg} variant="secondary" appearance="outline" size="xs" className="font-mono text-[10px]">
                      {pkg}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Etiketler */}
              <div>
                <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Etiketler
                </h4>
                <div className="flex flex-wrap gap-1">
                  {scenario.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" size="xs" className="text-[10px]">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Komutlar */}
          <TabsContent value="commands" className="p-4">
            <CodeBlock
              code={allCommandsText}
              label="adb"
              labelTone="blue"
              lineNumbers
              summary={`${interpolatedCommands.length} komut · Cihaz: ${deviceSerial || '—'}`}
            />
          </TabsContent>

          {/* Doğrulama */}
          <TabsContent value="verification" className="p-4">
            <div className="space-y-3">
              {scenario.verificationSteps.map((step) => (
                <div
                  key={step.step}
                  className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5"
                >
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-[10px] font-bold text-green-700 dark:bg-green-900/40 dark:text-green-300">
                    {step.step}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-foreground">{step.label}</div>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                    {step.query && (
                      <code className="mt-1.5 block rounded bg-muted px-2 py-1 font-mono text-[10px] text-foreground/80">
                        {interpolateCommand(step.query, deviceSerial, paramValues)}
                      </code>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Geri Alma */}
          <TabsContent value="rollback" className="p-4">
            <div className="space-y-3">
              {scenario.rollbackSteps.map((step, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 rounded-lg border border-amber-200/60 bg-amber-50/30 px-3 py-2.5 dark:border-amber-900/40 dark:bg-amber-950/10"
                >
                  <RotateCcw className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-foreground">{step.label}</div>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
              {rollbackCommandsText && (
                <CodeBlock
                  code={rollbackCommandsText}
                  label="rollback"
                  labelTone="amber"
                  lineNumbers
                />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── Preflight kontroller ─── */}
      {preflightResults.length > 0 && (
        <div className="border-t border-border p-4">
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Ön Kontroller
          </h3>
          <PreflightCheckList checks={preflightResults} />
        </div>
      )}

      {/* ─── CTA ─── */}
      <div className="border-t border-border p-4">
        <Button
          size="sm"
          className={cn(
            'w-full gap-2',
            isDestructive
              ? 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800'
              : '',
          )}
          disabled={isCtaDisabled}
          onClick={onRun}
        >
          {isRunning ? (
            <>
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="inline-flex"
              >
                <RotateCcw className="size-3.5" />
              </motion.span>
              Çalışıyor...
            </>
          ) : (
            <>
              <Play className="size-3.5" />
              {isDestructive ? 'Değişiklikleri Onayla ve Çalıştır' : 'Senaryoyu Çalıştır'}
            </>
          )}
        </Button>
        {!isConnected && (
          <p className="mt-2 text-center text-[10px] text-red-600 dark:text-red-400">
            Cihaz bağlı değil — önce bir cihaz seçin.
          </p>
        )}
      </div>
    </motion.section>
  )
}
