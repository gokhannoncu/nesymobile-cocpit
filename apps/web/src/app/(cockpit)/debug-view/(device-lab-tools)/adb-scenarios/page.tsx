'use client'

// ADB Scenario Runner — real allowlisted execution via /api/adb/scenarios/run

import { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Play } from 'lucide-react'
import { ProductPage } from '@/components/product'
import { EASE } from '@/components/product'
import { ToolHeader } from '@/components/engineering/tools/shared'
import { useDeviceLab } from '@/components/engineering/device-lab/device-lab-context'
import { ScenarioPool } from './scenario-pool'
import { ScenarioConfig } from './scenario-config'
import { RunPanel } from './run-panel'
import { ExecutionHistory } from './execution-history'
import type {
  ScenarioPackage,
  RunStatus,
  RunStep,
  ExecutionRecord,
  ScenarioStepEvent,
} from '@/data/engineering/device-lab/device-lab-types'

export default function AdbScenariosPage() {
  const { selectedDevice } = useDeviceLab()

  const [selectedScenario, setSelectedScenario] = useState<ScenarioPackage | null>(null)
  const [paramValues, setParamValues] = useState<Record<string, unknown>>({})
  const [activeTab, setActiveTab] = useState<'summary' | 'commands' | 'verification' | 'rollback'>('summary')

  const [runStatus, setRunStatus] = useState<RunStatus | null>(null)
  const [runSteps, setRunSteps] = useState<RunStep[]>([])
  const [runId, setRunId] = useState<string | null>(null)
  const [runStartedAt, setRunStartedAt] = useState<string | null>(null)
  const [history, setHistory] = useState<ExecutionRecord[]>([])

  const handleSelectScenario = (scenario: ScenarioPackage) => {
    setSelectedScenario(scenario)
    const defaults: Record<string, unknown> = {}
    scenario.parameters.forEach((p) => {
      defaults[p.key] = p.defaultValue
    })
    setParamValues(defaults)
    setRunStatus(null)
    setRunSteps([])
    setRunId(null)
    setRunStartedAt(null)
    setActiveTab('summary')
  }

  const preflightResults = useMemo(() => {
    if (!selectedScenario || !selectedDevice) return []
    return selectedScenario.preflightChecks.map((checkId) => {
      switch (checkId) {
        case 'device-connected':
          return {
            id: checkId,
            label: 'Device connected and ADB access available',
            status: selectedDevice.status === 'connected' ? ('pass' as const) : ('fail' as const),
          }
        case 'app-installed':
          return {
            id: checkId,
            label: 'NesyMobile app installed',
            status: selectedDevice.appInstalled ? ('pass' as const) : ('fail' as const),
          }
        case 'debuggable':
          return {
            id: checkId,
            label: 'Debug / test build (chaos receiver)',
            status: selectedDevice.isDebuggable ? ('pass' as const) : ('warn' as const),
            message: selectedDevice.isDebuggable ? undefined : 'Chaos scenarios need test/dev APK',
          }
        case 'chaos-receiver':
          return {
            id: checkId,
            label: 'Chaos receiver available',
            status: selectedDevice.isDebuggable ? ('pass' as const) : ('warn' as const),
            message: selectedDevice.isDebuggable ? undefined : 'Install test flavor with ChaosReceiver',
          }
        case 'battery-ok':
          return {
            id: checkId,
            label: 'Battery level sufficient (>20%)',
            status: selectedDevice.batteryLevel > 20 ? ('pass' as const) : ('warn' as const),
            message: selectedDevice.batteryLevel <= 20 ? `%${selectedDevice.batteryLevel}` : undefined,
          }
        case 'no-active-run':
          return {
            id: checkId,
            label: 'No other ongoing scenario',
            status: runStatus !== 'running' ? ('pass' as const) : ('fail' as const),
          }
        default:
          return { id: checkId, label: checkId, status: 'pass' as const }
      }
    })
  }, [selectedScenario, selectedDevice, runStatus])

  const allPreflightsPassed = preflightResults.every((r) => r.status !== 'fail')

  const handleRun = useCallback(async () => {
    if (!selectedScenario || !selectedDevice) return
    const startedAt = new Date().toISOString()
    setRunStatus('running')
    setRunStartedAt(startedAt)
    setRunId(null)
    setRunSteps(
      selectedScenario.commands.map((cmd, i) => ({
        step: i + 1,
        label: cmd.label,
        status: 'waiting' as const,
      })),
    )

    try {
      const res = await fetch('/api/adb/scenarios/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: selectedScenario.id,
          serial: selectedDevice.serial,
          params: paramValues,
        }),
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        setRunStatus('failed')
        setRunSteps((prev) => [
          {
            step: 1,
            label: 'Execution',
            status: 'failed',
            output: err.error ?? 'Request failed',
          },
        ])
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalStatus: RunStatus = 'success'
      let currentRunId: string | null = null
      const collected: RunStep[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() ?? ''

        for (const chunk of chunks) {
          const line = chunk
            .split('\n')
            .find((l) => l.startsWith('data: '))
          if (!line) continue
          let event: ScenarioStepEvent
          try {
            event = JSON.parse(line.slice(6)) as ScenarioStepEvent
          } catch {
            continue
          }

          if (event.runId) {
            currentRunId = event.runId
            setRunId(event.runId)
          }

          if (event.type === 'error') {
            finalStatus = 'failed'
            setRunStatus('failed')
            collected.push({
              step: collected.length + 1,
              label: 'Error',
              status: 'failed',
              output: event.message ?? 'Unknown error',
            })
            setRunSteps([...collected])
            continue
          }

          if (event.type === 'step' && event.step != null && event.label) {
            const idx = collected.findIndex((s) => s.step === event.step)
            const next: RunStep = {
              step: event.step,
              label: event.label,
              status: event.status ?? 'running',
              output: event.output,
            }
            if (idx >= 0) collected[idx] = next
            else collected.push(next)
            collected.sort((a, b) => a.step - b.step)
            setRunSteps([...collected])
          }

          if (event.type === 'done') {
            finalStatus = event.runStatus === 'failed' ? 'failed' : 'success'
            setRunStatus(finalStatus)
          }
        }
      }

      setRunStatus((prev) => (prev === 'running' ? finalStatus : prev))

      const completedAt = new Date().toISOString()
      const terminalOutput = collected
        .map((s) => `$ ${s.label}\n  → ${s.output ?? s.status}`)
        .join('\n\n')

      setHistory((prev) => [
        {
          id: currentRunId ?? `RUN-${Date.now()}`,
          scenarioId: selectedScenario.id,
          scenarioName: selectedScenario.name,
          deviceId: selectedDevice.id,
          deviceName: selectedDevice.name,
          user: 'local',
          startedAt,
          completedAt,
          status: finalStatus,
          steps: collected,
          parameters: paramValues,
          previousValues: {},
          newValues: {},
          terminalOutput,
          linkedSessionId: null,
          rollbackAvailable: selectedScenario.rollbackSteps.some((r) => !r.command.includes('# N/A')),
        },
        ...prev,
      ].slice(0, 20))
    } catch (err) {
      setRunStatus('failed')
      setRunSteps([
        {
          step: 1,
          label: 'Execution',
          status: 'failed',
          output: err instanceof Error ? err.message : String(err),
        },
      ])
    }
  }, [selectedScenario, selectedDevice, paramValues])

  return (
    <ProductPage path="/debug-view/adb-scenarios">
      <ToolHeader
        path="/debug-view/adb-scenarios"
        icon={Play}
        title="ADB Scenario Runner"
        lead="Run allowlisted hard-situation scenarios against a connected Courier Mobile device via real ADB."
        tone="blue"
        badges={[
          { label: 'Real ADB' },
          { label: 'Command allowlist' },
          { label: 'ChaosReceiver' },
          { label: '20 scenarios' },
        ]}
      />

      <motion.div
        className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[28fr_40fr_32fr]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
      >
        <ScenarioPool selectedId={selectedScenario?.id ?? null} onSelect={handleSelectScenario} />

        <ScenarioConfig
          scenario={selectedScenario}
          paramValues={paramValues}
          onParamChange={(key, value) => setParamValues((prev) => ({ ...prev, [key]: value }))}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onRun={handleRun}
          preflightResults={preflightResults}
          allPreflightsPassed={allPreflightsPassed}
          deviceSerial={selectedDevice?.serial ?? ''}
          isDebuggable={selectedDevice?.isDebuggable ?? false}
          isConnected={selectedDevice?.status === 'connected'}
          configType={selectedDevice?.configType ?? null}
          isRunning={runStatus === 'running'}
        />

        <RunPanel
          runId={runId}
          status={runStatus}
          steps={runSteps}
          scenario={selectedScenario}
          startedAt={runStartedAt}
        />
      </motion.div>

      <ExecutionHistory records={history} />
    </ProductPage>
  )
}
