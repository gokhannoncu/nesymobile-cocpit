'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  Database,
  Gauge,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@nesy/metronic/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@nesy/metronic/components/ui/tabs'
import { MongoQueryEditor } from '@/components/engineering/tools/mongo-query-editor'
import type { MongoQueryRun } from '@/services/mongo-query'

const GENERATE_STEPS = [
  {
    id: 'schema',
    label: 'Reading collection schema',
    icon: Database,
    idleHints: ['Loading key fields…', 'Checking indexes…', 'Mapping nested paths…'],
  },
  {
    id: 'prompt',
    label: 'Composing Claude prompt',
    icon: Sparkles,
    idleHints: ['Adding guardrail instructions…', 'Injecting schema context…', 'Setting read-only constraints…'],
  },
  {
    id: 'cli',
    label: 'Running Claude CLI (haiku)',
    icon: Terminal,
    idleHints: [
      'Waiting for model response…',
      'Claude is drafting the filter…',
      'Still working — hang tight…',
      'Parsing model output…',
    ],
  },
  {
    id: 'guard',
    label: 'Applying read-only guardrails',
    icon: ShieldCheck,
    idleHints: ['Blocking write operators…', 'Ensuring .limit(…)…', 'Validating query shape…'],
  },
  {
    id: 'format',
    label: 'Formatting Mongo shell query',
    icon: Braces,
    idleHints: ['Pretty-printing…', 'Building Compass JSON…', 'Almost done…'],
  },
] as const

/** Forward-only: advance to these steps after ms; park on CLI until complete. */
const STEP_ENTER_AT_MS = [0, 900, 2000] as const
const CLI_STEP = 2
const FINISH_STEP_MS = 480

const SAMPLE_QUERY_LINES = [
  'db.Shipment.find({',
  '  ShipmentId: "27663656233444"',
  '}).limit(100)',
]

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`
}

function GeneratingAnimation({
  complete,
  onFinished,
}: {
  /** True when API returned — finish remaining steps forward-only, then call onFinished. */
  complete?: boolean
  onFinished?: () => void
}) {
  const [stepIndex, setStepIndex] = useState(0)
  const [hintIndex, setHintIndex] = useState(0)
  const [typed, setTyped] = useState('')
  const [elapsedMs, setElapsedMs] = useState(0)
  const stepIndexRef = useRef(0)
  const finishingRef = useRef(false)
  const finishedRef = useRef(false)
  const fullSample = SAMPLE_QUERY_LINES.join('\n')

  useEffect(() => {
    stepIndexRef.current = stepIndex
  }, [stepIndex])

  // Forward-only early steps → park on CLI
  useEffect(() => {
    const timers = STEP_ENTER_AT_MS.map((at, idx) =>
      window.setTimeout(() => {
        if (finishingRef.current) return
        setStepIndex((current) => {
          const next = Math.max(current, idx)
          stepIndexRef.current = next
          return next
        })
      }, at),
    )
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [])

  // When API completes: advance forward through remaining steps, then finish
  useEffect(() => {
    if (!complete || finishedRef.current) return
    finishingRef.current = true
    const timers: number[] = []
    let cancelled = false

    const from = Math.max(stepIndexRef.current, CLI_STEP)
    stepIndexRef.current = from
    setStepIndex(from)

    let delay = FINISH_STEP_MS
    for (let step = from + 1; step < GENERATE_STEPS.length; step++) {
      const target = step
      timers.push(
        window.setTimeout(() => {
          if (cancelled) return
          stepIndexRef.current = target
          setStepIndex(target)
        }, delay),
      )
      delay += FINISH_STEP_MS
    }
    timers.push(
      window.setTimeout(() => {
        if (cancelled || finishedRef.current) return
        finishedRef.current = true
        onFinished?.()
      }, delay),
    )

    return () => {
      cancelled = true
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [complete, onFinished])

  // Per-step idle hints (stay on same step)
  useEffect(() => {
    setHintIndex(0)
    const hints = GENERATE_STEPS[stepIndex]?.idleHints ?? []
    if (hints.length <= 1) return
    const t = window.setInterval(() => {
      setHintIndex((i) => (i + 1) % hints.length)
    }, 2200)
    return () => window.clearInterval(t)
  }, [stepIndex])

  // Elapsed clock
  useEffect(() => {
    const started = Date.now()
    const t = window.setInterval(() => setElapsedMs(Date.now() - started), 250)
    return () => window.clearInterval(t)
  }, [])

  // Typewriter — pauses briefly at end before looping (stays lively on current step)
  useEffect(() => {
    setTyped('')
    let i = 0
    let pause = 0
    const typeTimer = window.setInterval(() => {
      if (pause > 0) {
        pause -= 1
        return
      }
      i += 1
      if (i > fullSample.length) {
        pause = 18
        i = 0
        setTyped('')
        return
      }
      setTyped(fullSample.slice(0, i))
    }, 36)
    return () => window.clearInterval(typeTimer)
  }, [fullSample])

  const active = GENERATE_STEPS[stepIndex] ?? GENERATE_STEPS[0]!
  const hint = active.idleHints[hintIndex] ?? active.label
  const progress = ((stepIndex + (complete ? 1 : 0.35)) / GENERATE_STEPS.length) * 100

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(249,115,22,0.08),_transparent_55%)]"
      />
      <div className="relative grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:p-8">
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="relative flex size-12 items-center justify-center">
              <motion.span
                className="absolute inset-0 rounded-2xl border-2 border-orange-400/40"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              />
              <motion.span
                className="absolute inset-1 rounded-xl border border-dashed border-orange-300/50"
                animate={{ rotate: -360 }}
                transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
              />
              <motion.span
                className="flex size-9 items-center justify-center rounded-xl bg-orange-500 text-white shadow-sm"
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <active.icon className="size-4" />
              </motion.span>
            </div>
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-foreground">Generating query…</p>
                <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                  {formatElapsed(elapsedMs)}
                </span>
              </div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={`${active.id}-${hint}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }}
                  className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <active.icon className="size-3.5 shrink-0 text-orange-600 dark:text-orange-400" />
                  {hint}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-orange-500"
              animate={{ width: `${Math.min(progress, 96)}%` }}
              transition={{ type: 'spring', stiffness: 80, damping: 20 }}
            />
          </div>

          <ol className="space-y-2">
            {GENERATE_STEPS.map((step, i) => {
              const done = i < stepIndex
              const current = i === stepIndex
              return (
                <li key={step.id} className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                      done && 'bg-orange-500 text-white',
                      current &&
                        'bg-orange-100 text-orange-700 ring-2 ring-orange-400/50 dark:bg-orange-950 dark:text-orange-300',
                      !done && !current && 'bg-muted text-muted-foreground',
                    )}
                  >
                    {done ? <CheckCircle2 className="size-3" /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-medium',
                      current ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {step.label}
                  </span>
                  {current && (
                    <motion.span className="ms-auto flex gap-0.5" aria-hidden>
                      {[0, 1, 2].map((d) => (
                        <motion.span
                          key={d}
                          className="size-1 rounded-full bg-orange-500"
                          animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
                          transition={{
                            duration: 0.9,
                            repeat: Infinity,
                            delay: d * 0.15,
                          }}
                        />
                      ))}
                    </motion.span>
                  )}
                </li>
              )
            })}
          </ol>
        </div>

        <div className="overflow-hidden rounded-lg border bg-zinc-950 text-left shadow-inner">
          <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
            <span className="size-2 rounded-full bg-red-400/80" />
            <span className="size-2 rounded-full bg-amber-400/80" />
            <span className="size-2 rounded-full bg-emerald-400/80" />
            <span className="ms-2 font-mono text-[10px] text-zinc-400">mongosh · draft</span>
            <motion.span
              className="ms-auto size-1.5 rounded-full bg-orange-400"
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
          </div>
          <pre className="min-h-[132px] overflow-hidden p-3 font-mono text-[12px] leading-relaxed text-emerald-300/90">
            <code>
              {typed}
              <motion.span
                className="inline-block w-1.5 translate-y-px bg-emerald-300/90"
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.7, repeat: Infinity }}
              >
                &nbsp;
              </motion.span>
            </code>
          </pre>
          <div className="border-t border-white/10 px-3 py-2">
            <AnimatePresence mode="wait">
              <motion.p
                key={hint}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="font-mono text-[10px] text-zinc-500"
              >
                // {hint}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 p-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-muted">
        <Database className="size-7 text-muted-foreground" />
      </span>
      <p className="mt-4 text-sm font-bold text-foreground">Query not yet generated</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
        Describe your data needs in natural language or select one of the ready-made examples.
      </p>
    </div>
  )
}

function ExplanationTab({ run }: { run: MongoQueryRun }) {
  const steps = run.explanation?.length ? run.explanation : ['No explanation returned.']
  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <ol className="space-y-2.5">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-foreground/85">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <div className="flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50/70 p-3 dark:border-green-900/60 dark:bg-green-950/30">
        <CheckCircle2 className="mt-px size-4 shrink-0 text-green-600 dark:text-green-400" />
        <p className="text-xs font-semibold leading-relaxed text-green-700 dark:text-green-300">
          This query does not modify data.
        </p>
      </div>
    </div>
  )
}

function ValidationTab({ run }: { run: MongoQueryRun }) {
  const checks = run.validation?.length
    ? run.validation
    : [{ id: 'empty', label: 'No checks', detail: 'Validation payload empty.', status: 'warn' }]
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {checks.map((check, idx) => {
        const pass = check.status !== 'warn'
        return (
          <div
            key={check.id ?? idx}
            className={cn(
              'rounded-xl border p-3.5',
              pass
                ? 'bg-card'
                : 'border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/30',
            )}
          >
            <div className="flex items-center gap-2">
              {pass ? (
                <CheckCircle2 className="size-4 shrink-0 text-green-600 dark:text-green-400" />
              ) : (
                <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              )}
              <span className="text-[13px] font-bold text-foreground">{check.label ?? 'Check'}</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-foreground/80">
              {check.detail ?? '—'}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function EstimatedScope({ run }: { run: MongoQueryRun }) {
  const scope = run.estimatedScope
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <Gauge className="size-4 text-orange-600 dark:text-orange-400" />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
          Estimated Scope
        </h3>
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-[11px] font-semibold text-muted-foreground">Estimated documents</dt>
          <dd className="mt-0.5 text-sm font-bold tabular-nums text-foreground">
            {scope?.documents ?? '—'}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold text-muted-foreground">Index</dt>
          <dd
            className="mt-0.5 truncate font-mono text-xs font-semibold text-foreground"
            title={scope?.index ?? undefined}
          >
            {scope?.index ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold text-muted-foreground">Expected response</dt>
          <dd className="mt-0.5 text-sm font-bold tabular-nums text-foreground">
            {scope?.response ?? '—'}
          </dd>
        </div>
      </dl>
      {!scope?.index && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-xs font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          {scope?.noIndexWarning ?? 'No suitable index found for this filter combination.'}
        </p>
      )}
    </div>
  )
}

export function QueryWorkspace({
  run,
  loading,
}: {
  run: MongoQueryRun | null
  loading?: boolean
}) {
  const [showResult, setShowResult] = useState(false)

  useEffect(() => {
    if (loading) setShowResult(false)
  }, [loading])

  const animating = Boolean(loading) || (Boolean(run) && !showResult)

  if (animating) {
    return (
      <GeneratingAnimation
        complete={Boolean(run && !loading)}
        onFinished={() => setShowResult(true)}
      />
    )
  }

  if (!run) {
    return <EmptyState />
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="query">
        <TabsList>
          <TabsTrigger value="query">Generated Query</TabsTrigger>
          <TabsTrigger value="explanation">Explanation</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
        </TabsList>
        <TabsContent value="query" className="mt-3">
          <MongoQueryEditor
            query={run.query}
            summary={
              run.summary ||
              run.estimatedScope?.summary ||
              `Collection: ${run.collection} · ${run.queryType}${run.model ? ` · ${run.model}` : ''}`
            }
          />
        </TabsContent>
        <TabsContent value="explanation" className="mt-3">
          <ExplanationTab run={run} />
        </TabsContent>
        <TabsContent value="validation" className="mt-3">
          <ValidationTab run={run} />
        </TabsContent>
      </Tabs>
      <EstimatedScope run={run} />
    </div>
  )
}
