'use client'

import { ReactNode, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  FileText,
  History,
  Link2,
  ListChecks,
  Loader2,
  MessageSquareText,
  Trash2,
  User,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@nesy/metronic/components/ui/alert-dialog'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@nesy/metronic/components/ui/sheet'
import { toneDot, toneText, type Tone } from '@/components/product'
import { CodeBlock } from '@/components/engineering/tools/shared'
import {
  formatLastUsed,
  normalizeRecentStatus,
  RECENT_STATUS_META,
  type RecentQueryStatus,
} from '@/data/engineering/tools/graylog-generator'
import type { GraylogQueryRun } from '@/services/graylog-query'

const th =
  'px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap'
const td = 'px-3 py-2.5 align-middle text-xs text-foreground/85'

function StatusCell({ status }: { status: string }) {
  const normalized: RecentQueryStatus = normalizeRecentStatus(status)
  const meta = RECENT_STATUS_META[normalized]
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={cn('size-2 rounded-full', toneDot[meta.tone])} />
      <span className={cn('text-xs font-semibold', toneText[meta.tone])}>{meta.label}</span>
    </span>
  )
}

export function RecentQueriesTable({
  queries,
  loading,
  error,
  onReuse,
  onDelete,
}: {
  queries: GraylogQueryRun[]
  loading?: boolean
  error?: string | null
  onReuse: (q: GraylogQueryRun) => void
  onDelete: (q: GraylogQueryRun) => Promise<void> | void
}) {
  const [selected, setSelected] = useState<GraylogQueryRun | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GraylogQueryRun | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const requestDelete = (q: GraylogQueryRun) => {
    setDeleteTarget(q)
  }

  const confirmDelete = async () => {
    const q = deleteTarget
    if (!q) return
    setDeletingId(q.id)
    try {
      await onDelete(q)
      if (selected?.id === q.id) setSelected(null)
      setDeleteTarget(null)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      {error && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          {error}
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border bg-background">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className={cn(th, 'min-w-[220px]')}>Query name</th>
              <th className={th}>Application</th>
              <th className={th}>Country</th>
              <th className={th}>Time range</th>
              <th className={th}>Created by</th>
              <th className={th}>Last used</th>
              <th className={th}>Status</th>
              <th className={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className={cn(td, 'py-8 text-center text-muted-foreground')}>
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" />
                    Loading recent queries…
                  </span>
                </td>
              </tr>
            )}
            {!loading && queries.length === 0 && (
              <tr>
                <td colSpan={8} className={cn(td, 'py-8 text-center text-muted-foreground')}>
                  No saved queries yet. Generate one to populate history.
                </td>
              </tr>
            )}
            {!loading &&
              queries.map((q) => (
                <tr
                  key={q.id}
                  onClick={() => setSelected(q)}
                  className="cursor-pointer border-b transition-colors last:border-b-0 hover:bg-muted/30"
                >
                  <td className={cn(td, 'font-semibold text-foreground')}>{q.name}</td>
                  <td className={td}>
                    <code className="text-[11px] font-semibold">{q.application}</code>
                  </td>
                  <td className={cn(td, 'whitespace-nowrap')}>{q.country ?? '—'}</td>
                  <td className={cn(td, 'whitespace-nowrap')}>{q.timeRange}</td>
                  <td className={cn(td, 'whitespace-nowrap')}>{q.createdBy}</td>
                  <td className={cn(td, 'whitespace-nowrap tabular-nums')}>
                    {formatLastUsed(q.lastUsedAt)}
                  </td>
                  <td className={td}>
                    <StatusCell status={q.status} />
                  </td>
                  <td className={cn(td, 'whitespace-nowrap')}>
                    <div className="flex items-center gap-0.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={(ev) => {
                          ev.stopPropagation()
                          setSelected(q)
                        }}
                      >
                        Details
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                        disabled={deletingId === q.id}
                        onClick={(ev) => {
                          ev.stopPropagation()
                          requestDelete(q)
                        }}
                      >
                        {deletingId === q.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <RecentQueryDrawer
        query={selected}
        deleting={selected ? deletingId === selected.id : false}
        onClose={() => setSelected(null)}
        onReuse={(q) => {
          setSelected(null)
          onReuse(q)
        }}
        onDelete={requestDelete}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="max-w-md rounded-md border border-border shadow-lg sm:rounded-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              You are about to delete &quot;{deleteTarget?.name}&quot;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" className="mt-2 rounded-md sm:mt-0" disabled={Boolean(deletingId)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              className="rounded-md"
              disabled={Boolean(deletingId)}
              onClick={(ev) => {
                ev.preventDefault()
                void confirmDelete()
              }}
            >
              {deletingId ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function DrawerSection({
  icon: Icon,
  title,
  tone = 'gray',
  children,
}: {
  icon: typeof FileText
  title: string
  tone?: Tone
  children: ReactNode
}) {
  return (
    <section>
      <div className="flex items-center gap-2">
        <Icon className={cn('size-4', toneText[tone])} />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
          {title}
        </h3>
      </div>
      <div className="mt-2 text-sm leading-relaxed text-foreground/85">{children}</div>
    </section>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="w-32 shrink-0 font-semibold text-muted-foreground">{label}</span>
      <span className="min-w-0 text-foreground/85">{children}</span>
    </div>
  )
}

function RecentQueryDrawer({
  query,
  deleting,
  onClose,
  onReuse,
  onDelete,
}: {
  query: GraylogQueryRun | null
  deleting?: boolean
  onClose: () => void
  onReuse: (q: GraylogQueryRun) => void
  onDelete: (q: GraylogQueryRun) => void
}) {
  const q = query
  return (
    <Sheet open={!!q} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-hidden p-0 sm:max-w-xl">
        {q && (
          <>
            <SheetHeader className="border-b px-5 py-4">
              <SheetTitle className="flex items-center gap-2 text-base">
                <span>{q.name}</span>
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant="secondary" appearance="outline" size="xs" className="font-mono">
                  {q.application}
                </Badge>
                <Badge variant="secondary" appearance="outline" size="xs">
                  {q.timeRange}
                </Badge>
                <StatusCell status={q.status} />
              </div>
            </SheetHeader>
            <SheetBody className="h-[calc(100vh-96px)] space-y-6 overflow-y-auto px-5 py-5">
              <DrawerSection icon={MessageSquareText} title="Natural language request" tone="blue">
                <p className="rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed italic">
                  &ldquo;{q.naturalLanguage}&rdquo;
                </p>
              </DrawerSection>

              <DrawerSection icon={FileText} title="Generated query" tone="orange">
                <CodeBlock code={q.query} label="graylog" labelTone="orange" />
              </DrawerSection>

              <DrawerSection icon={ListChecks} title="Explanation" tone="green">
                <ol className="space-y-1.5">
                  {(q.explanation?.length ? q.explanation : ['—']).map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                      <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </DrawerSection>

              <DrawerSection icon={History} title="Validation" tone="amber">
                <div className="space-y-1.5">
                  {(q.validation?.length
                    ? q.validation
                    : [{ detail: 'No validation history', status: 'warn' }]
                  ).map((v, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-2 rounded-lg border p-2.5 text-xs"
                    >
                      <span className="flex min-w-0 items-start gap-1.5">
                        {v.status === 'warn' ? (
                          <AlertTriangle className="mt-px size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <CheckCircle2 className="mt-px size-3.5 shrink-0 text-green-600 dark:text-green-400" />
                        )}
                        <span className="text-foreground/85">
                          {v.label ? `${v.label}: ` : ''}
                          {v.detail ?? '—'}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </DrawerSection>

              <DrawerSection icon={Link2} title="Meta" tone="purple">
                <div className="space-y-1.5">
                  <Fact label="Model">{q.model ?? '—'}</Fact>
                  <Fact label="Quality">{q.quality?.verdict ?? '—'}</Fact>
                  <Fact label="Related incident">{q.relatedIncident ?? '—'}</Fact>
                  <Fact label="Created by">
                    <span className="inline-flex items-center gap-1">
                      <User className="size-3 text-muted-foreground" /> {q.createdBy}
                    </span>
                  </Fact>
                  <Fact label="Last used">{formatLastUsed(q.lastUsedAt)}</Fact>
                </div>
              </DrawerSection>

              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button variant="outline" onClick={() => onReuse(q)}>
                  <Copy className="size-3.5" />
                  Copy and reuse
                </Button>
                <Button
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
                  disabled={deleting}
                  onClick={() => onDelete(q)}
                >
                  {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  Delete
                </Button>
              </div>
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
