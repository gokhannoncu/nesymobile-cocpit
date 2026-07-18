'use client'

// Run Panel — right panel.
// Real-time execution status, step progress and result card.

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  Loader2,
  RotateCcw,
  Terminal,
  Undo2,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Button } from '@nesy/metronic/components/ui/button'
import { Progress } from '@nesy/metronic/components/ui/progress'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@nesy/metronic/components/ui/collapsible'
import { EASE, toneCard } from '@/components/product'
import {
  RunIdBadge,
  StepStatusIndicator,
  EmptyPanelState,
} from '@/components/engineering/device-lab/device-lab-shared'
import { useDeviceLab } from '@/components/engineering/device-lab/device-lab-context'
import { CopyButton } from '@/components/engineering/tools/shared'
import type { ScenarioPackage, RunStatus, RunStep } from '@/data/engineering/device-lab/device-lab-types'

/* ─── Props ─── */
interface RunPanelProps {
  runId: string | null
  status: RunStatus | null
  steps: RunStep[]
  scenario: ScenarioPackage | null
  startedAt: string | null
}

export function RunPanel({ runId, status, steps, scenario, startedAt }: RunPanelProps) {
  const { navigateToLogs } = useDeviceLab()
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  // Elapsed time counter
  useEffect(() => {
    if (status !== 'running' || !startedAt) return
    setElapsed(0)
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - new Date(startedAt).getTime()) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [status, startedAt])

  // Progress percentage
  const progress = useMemo(() => {
    if (steps.length === 0) return 0
    const completed = steps.filter((s) => s.status === 'completed').length
    return Math.round((completed / steps.length) * 100)
  }, [steps])

  const terminalOutput = useMemo(() => {
    if (!scenario) return ''
    return steps
      .filter((s) => s.status === 'completed' || s.status === 'running' || s.status === 'failed')
      .map((s) => {
        const body = s.output?.trim() || (s.status === 'running' ? 'running...' : s.status)
        return `$ ${s.label}\n  → ${body}`
      })
      .join('\n\n')
  }, [steps, scenario])

  // Empty state
  if (!runId || !status) {
    return (
      <motion.section
        className="rounded-xl border border-border bg-card"
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <EmptyPanelState
          icon={Terminal}
          title="No Execution Yet"
          description="When you select and run a scenario, results will be displayed here."
        />
      </motion.section>
    )
  }

  return (
    <motion.section
      className="flex flex-col overflow-hidden rounded-xl border border-border bg-card"
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between border-b border-border p-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-foreground">Run Status</h2>
          <RunIdBadge id={runId} />
        </div>
        {startedAt && (
          <span className="text-[10px] text-muted-foreground">
            {new Date(startedAt).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        )}
      </div>

      {/* ─── Progress ─── */}
      {status === 'running' && (
        <div className="space-y-1.5 border-b border-border px-3 py-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <Loader2 className="size-3 animate-spin" />
              Running…
            </span>
            <span className="font-mono text-muted-foreground">
              {elapsed}s · %{progress}
            </span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      {/* ─── Steps ─── */}
      <div className="flex-1 space-y-0.5 p-3">
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Steps
        </h3>
        <AnimatePresence mode="popLayout">
          {steps.map((step, i) => (
            <motion.div
              key={step.step}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: i * 0.06, ease: EASE }}
            >
              <StepStatusIndicator status={step.status} />
              <span className="font-mono text-[10px] text-muted-foreground">
                {String(step.step).padStart(2, '0')}
              </span>
              <span
                className={cn(
                  'flex-1 truncate',
                  step.status === 'running'
                    ? 'font-semibold text-blue-700 dark:text-blue-300'
                    : step.status === 'completed'
                      ? 'text-foreground'
                      : step.status === 'failed'
                        ? 'text-red-700 dark:text-red-300'
                        : 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ─── Terminal output (collapsible) ─── */}
      {terminalOutput && (
        <Collapsible open={terminalOpen} onOpenChange={setTerminalOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between border-t border-border px-3 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/30"
            >
              <span className="flex items-center gap-1.5">
                <Terminal className="size-3" />
                Terminal Output
              </span>
              <span>{terminalOpen ? '▲' : '▼'}</span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-border bg-muted/20 px-3 py-2">
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[10.5px] leading-relaxed text-foreground/80">
                {terminalOutput}
              </pre>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* ─── Result card ─── */}
      <AnimatePresence mode="wait">
        {status && status !== 'running' && status !== 'pending' && (
          <motion.div
            className="border-t border-border p-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <div
              className={cn(
                'rounded-lg border p-3',
                status === 'success' && toneCard.green,
                status === 'partial' && toneCard.amber,
                status === 'failed' && toneCard.red,
              )}
            >
              <div className="flex items-center gap-2">
                {status === 'success' && (
                  <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
                )}
                {status === 'partial' && (
                  <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
                )}
                {status === 'failed' && (
                  <XCircle className="size-4 text-red-600 dark:text-red-400" />
                )}
                <span className="text-xs font-bold text-foreground">
                  {status === 'success' && 'Scenario completed successfully'}
                  {status === 'partial' && 'Partial success — some steps skipped'}
                  {status === 'failed' && 'Scenario failed'}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {status === 'success' &&
                  'All steps executed successfully. Verification results are positive.'}
                {status === 'partial' &&
                  'Main operations completed but issues occurred during verification or cleanup steps.'}
                {status === 'failed' &&
                  'Error occurred in one or more critical steps. Check the terminal output.'}
              </p>
              {elapsed > 0 && (
                <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="size-2.5" />
                  Total duration: {elapsed}s
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Action buttons ─── */}
      {status && status !== 'running' && status !== 'pending' && (
        <div className="flex flex-wrap gap-1.5 border-t border-border p-3">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => navigateToLogs(runId ?? undefined)}
          >
            <ExternalLink className="size-3" />
            View Linked Logs
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs">
            <RotateCcw className="size-3" />
            Run Again
          </Button>
          {status !== 'failed' && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <Undo2 className="size-3" />
              Rollback
            </Button>
          )}
          <CopyButton text={terminalOutput} label="Copy Report" />
        </div>
      )}
    </motion.section>
  )
}
