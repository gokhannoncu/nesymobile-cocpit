'use client'

import { Badge } from '@nesy/metronic/components/ui/badge'

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function pick(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    const text = asText(candidate)
    if (text) return text
  }
  return 'NOT_MEASURED'
}

function badgeVariant(value: string): 'secondary' | 'outline' | 'destructive' | 'primary' {
  const upper = value.toUpperCase()
  if (upper.includes('FAIL') || upper.includes('ERROR')) return 'destructive'
  if (upper === 'PASS' || upper === 'COMPLETED' || upper === 'SUCCESS') return 'primary'
  if (upper === 'NOT_MEASURED' || upper === 'NOT_APPLICABLE' || upper === 'PENDING') {
    return 'secondary'
  }
  return 'outline'
}

/**
 * Four outcome lanes must come from the run DTO — never fabricated PASS/FAIL.
 * Missing fields surface as NOT_MEASURED (CHECKPOINT 57).
 */
export function OutcomePanel({ run }: { run: any }) {
  const runtime = run?.runtime ?? {}
  const action = pick(
    runtime.actionOutcome,
    runtime.lastActionOutcome,
    Array.isArray(run?.actionTransitions) && run.actionTransitions.length > 0
      ? run.actionTransitions[run.actionTransitions.length - 1]?.outcome
      : null,
  )
  const gate = pick(
    runtime.continueGateOutcome,
    runtime.gateOutcome,
    Array.isArray(run?.waits)
      ? run.waits.find((w: { kind?: string }) => w?.kind === 'CONTINUE_GATE')?.outcome
      : null,
  )
  const oracle = pick(
    runtime.productVerdict,
    runtime.oracleOutcome,
    run?.run?.outcome,
    Array.isArray(run?.oracleEvaluations) && run.oracleEvaluations.length > 0
      ? run.oracleEvaluations[run.oracleEvaluations.length - 1]?.outcome
      : null,
  )
  const cleanup = pick(runtime.cleanupResult, runtime.cleanupOutcome)

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-md bg-muted/20">
      <div>
        <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Action</div>
        <Badge variant={badgeVariant(action)}>{action}</Badge>
      </div>
      <div>
        <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Gate</div>
        <Badge variant={badgeVariant(gate)}>{gate}</Badge>
      </div>
      <div>
        <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Oracle</div>
        <Badge variant={badgeVariant(oracle)}>{oracle}</Badge>
      </div>
      <div>
        <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Cleanup</div>
        <Badge variant={badgeVariant(cleanup)}>{cleanup}</Badge>
        <p className="text-[10px] text-muted-foreground mt-1">
          Cleanup does not rewrite business oracle
        </p>
      </div>
    </div>
  )
}
