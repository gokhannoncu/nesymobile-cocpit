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
  if (upper === 'PASS' || upper === 'SUCCESS' || upper === 'NORMAL') return 'primary'
  if (upper === 'NOT_MEASURED' || upper === 'NOT_APPLICABLE' || upper === 'PENDING') {
    return 'secondary'
  }
  return 'outline'
}

/**
 * Lifecycle / verdict / termination / cleanup / operational are separate
 * dispositions. Values come from RunDetailQuery runtime fields only
 * (CHECKPOINT 58). Hardcoded NORMAL/FAILED/READY is forbidden.
 */
export function VerdictDisposition({ run }: { run: any }) {
  const runtime = run?.runtime ?? {}
  const lifecycle = pick(runtime.lifecycle, run?.run?.status)
  const verdict = pick(runtime.productVerdict, run?.run?.outcome)
  const termination = pick(runtime.terminationReason)
  const cleanup = pick(runtime.cleanupResult)
  const operational = pick(runtime.operationalDisposition, runtime.schedulerDisposition)
  // Free text, so it gets its own row rather than a badge: `ABORTED` alone says a
  // run died without saying what killed it, and that sentence is the whole answer.
  const failureDetail = asText(runtime.failureDetail)

  return (
    <div className="flex flex-col gap-4">
    <div className="flex flex-wrap gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Lifecycle</span>
        <Badge variant={badgeVariant(lifecycle)}>{lifecycle}</Badge>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Business Verdict</span>
        <Badge variant={badgeVariant(verdict)}>{verdict}</Badge>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Termination</span>
        <Badge variant={badgeVariant(termination)}>{termination}</Badge>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Cleanup</span>
        <Badge variant={badgeVariant(cleanup)}>{cleanup}</Badge>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Operational</span>
        <Badge variant={badgeVariant(operational)}>{operational}</Badge>
      </div>
    </div>
      {failureDetail ? (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Failure detail</span>
          <p className="whitespace-pre-wrap break-words font-mono text-xs text-destructive">
            {failureDetail}
          </p>
        </div>
      ) : null}
    </div>
  )
}
