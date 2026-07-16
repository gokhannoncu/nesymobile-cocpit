'use client'

// ADB Scenario Runner — main page component.
// Brings together the scenario pool, configuration panel, and run panel
// in a three-column layout.

import { useState, useMemo } from 'react'
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
import type { ScenarioPackage, RunStatus, RunStep } from '@/data/engineering/device-lab/device-lab-types'
import { MOCK_EXECUTION_HISTORY } from '@/data/engineering/device-lab/adb-scenarios'

export default function AdbScenariosPage() {
  const { selectedDevice } = useDeviceLab()

  // Selected scenario and parameter state
  const [selectedScenario, setSelectedScenario] = useState<ScenarioPackage | null>(null)
  const [paramValues, setParamValues] = useState<Record<string, any>>({})
  const [activeTab, setActiveTab] = useState<'summary' | 'commands' | 'verification' | 'rollback'>('summary')

  // Run state
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null)
  const [runSteps, setRunSteps] = useState<RunStep[]>([])
  const [runId, setRunId] = useState<string | null>(null)
  const [runStartedAt, setRunStartedAt] = useState<string | null>(null)

  // Reset parameters when scenario changes
  const handleSelectScenario = (scenario: ScenarioPackage) => {
    setSelectedScenario(scenario)
    const defaults: Record<string, any> = {}
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

  // Calculate preflight check results
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
            label: 'Debug build installed (debuggable flag active)',
            status: selectedDevice.isDebuggable ? ('pass' as const) : ('fail' as const),
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

  // Did all preflight checks pass?
  const allPreflightsPassed = preflightResults.every((r) => r.status !== 'fail')

  // Mock execution
  const handleRun = () => {
    if (!selectedScenario || !selectedDevice) return
    const now = new Date()
    const id = `RUN-2026-0712-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
    setRunId(id)
    setRunStatus('running')
    setRunStartedAt(now.toISOString())

    // Create steps
    const steps: RunStep[] = [
      { step: 1, label: 'Device validation', status: 'completed' },
      ...selectedScenario.commands.map((cmd, i) => ({
        step: i + 2,
        label: cmd.label,
        status: (i === 0 ? 'running' : 'waiting') as RunStep['status'],
      })),
      {
        step: selectedScenario.commands.length + 2,
        label: 'Result verification',
        status: 'waiting' as RunStep['status'],
      },
    ]
    setRunSteps(steps)

    // Advance steps sequentially
    let currentStep = 1
    const interval = setInterval(() => {
      currentStep++
      setRunSteps((prev) =>
        prev.map((s) => {
          if (s.step < currentStep + 1) return { ...s, status: 'completed' as const }
          if (s.step === currentStep + 1) return { ...s, status: 'running' as const }
          return s
        }),
      )
      if (currentStep >= steps.length) {
        clearInterval(interval)
        setRunStatus('success')
        setRunSteps((prev) => prev.map((s) => ({ ...s, status: 'completed' as const })))
      }
    }, 800)
  }

  return (
    <ProductPage path="/debug-view/adb-scenarios">
      {/* ─── Header ─── */}
      <ToolHeader
        path="/debug-view/adb-scenarios"
        icon={Play}
        title="ADB Scenario Runner"
        lead="Select approved device scenarios, enter their parameters, verify the commands to be applied, and execute them in a controlled manner."
        tone="blue"
        badges={[
          { label: 'Controlled execution' },
          { label: 'Command allowlist' },
          { label: 'Auto-backup' },
          { label: 'Rollback support' },
        ]}
      />

      {/* ─── 3-column layout ─── */}
      <motion.div
        className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[28fr_40fr_32fr]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
      >
        {/* Left: Scenario Pool */}
        <ScenarioPool selectedId={selectedScenario?.id ?? null} onSelect={handleSelectScenario} />

        {/* Middle: Configuration */}
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

        {/* Right: Run Panel */}
        <RunPanel
          runId={runId}
          status={runStatus}
          steps={runSteps}
          scenario={selectedScenario}
          startedAt={runStartedAt}
        />
      </motion.div>

      {/* ─── Execution History ─── */}
      <ExecutionHistory records={MOCK_EXECUTION_HISTORY} />
    </ProductPage>
  )
}
