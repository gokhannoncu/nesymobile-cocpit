'use client'

// Generated Query Workspace — sağ kolon: sekmeler (query / explanation /
// validation) + altta Estimated Scope. Tamamı mock; "generated" prop'u
// empty state ile sonuç durumu arasında geçiş yapar.

import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  Database,
  Gauge,
  Save,
  ShieldCheck,
  WrapText,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@nesy/metronic/components/ui/tabs'
import { CodeBlock } from '@/components/engineering/tools/shared'
import {
  ESTIMATED_SCOPE,
  EXPLANATION_STEPS,
  GENERATED_QUERY,
  VALIDATION_CHECKS,
} from '@/data/engineering/tools/mongodb-generator'

function EmptyState() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 p-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-muted">
        <Database className="size-7 text-muted-foreground" />
      </span>
      <p className="mt-4 text-sm font-bold text-foreground">Query henüz oluşturulmadı</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
        Veri ihtiyacını doğal dille yaz veya hazır örneklerden birini seç.
      </p>
    </div>
  )
}

function GeneratedQueryTab() {
  return (
    <CodeBlock
      code={GENERATED_QUERY.code}
      label="mongodb"
      labelTone="green"
      lineNumbers
      badges={
        <Badge variant="success" appearance="outline" size="xs" className="gap-1">
          <ShieldCheck className="size-3" />
          Read-only
        </Badge>
      }
      actions={
        <>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
            <WrapText className="size-3.5" />
            Format
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
            <Save className="size-3.5" />
            Save Query
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
            <Compass className="size-3.5" />
            Open in Compass
          </Button>
        </>
      }
      summary={GENERATED_QUERY.summary}
    />
  )
}

function ExplanationTab() {
  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <ol className="space-y-2.5">
        {EXPLANATION_STEPS.map((step, i) => (
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
          Bu sorgu veri değiştirmez.
        </p>
      </div>
    </div>
  )
}

function ValidationTab() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {VALIDATION_CHECKS.map((check) => {
        const pass = check.status === 'pass'
        return (
          <div
            key={check.id}
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
              <span className="text-[13px] font-bold text-foreground">{check.label}</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-foreground/80">{check.detail}</p>
          </div>
        )
      })}
    </div>
  )
}

function EstimatedScope() {
  const scope = ESTIMATED_SCOPE
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
          <dd className="mt-0.5 text-sm font-bold tabular-nums text-foreground">{scope.documents}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold text-muted-foreground">Index</dt>
          <dd className="mt-0.5 truncate font-mono text-xs font-semibold text-foreground" title={scope.index ?? undefined}>
            {scope.index ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold text-muted-foreground">Expected response</dt>
          <dd className="mt-0.5 text-sm font-bold tabular-nums text-foreground">{scope.response}</dd>
        </div>
      </dl>
      {!scope.index && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-xs font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          {scope.noIndexWarning}
        </p>
      )}
    </div>
  )
}

export function QueryWorkspace({ generated }: { generated: boolean }) {
  if (!generated) {
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
          <GeneratedQueryTab />
        </TabsContent>
        <TabsContent value="explanation" className="mt-3">
          <ExplanationTab />
        </TabsContent>
        <TabsContent value="validation" className="mt-3">
          <ValidationTab />
        </TabsContent>
      </Tabs>
      <EstimatedScope />
    </div>
  )
}
