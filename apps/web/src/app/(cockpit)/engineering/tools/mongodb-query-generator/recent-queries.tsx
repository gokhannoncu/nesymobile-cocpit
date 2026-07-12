'use client'

// Recent Queries — tablo + sağ detail Sheet (field-tickets/pool.tsx deseni).

import { ReactNode, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  FileText,
  History,
  Link2,
  ListChecks,
  MessageSquareText,
  User,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
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
  RECENT_QUERIES,
  RECENT_STATUS_META,
  type RecentQuery,
} from '@/data/engineering/tools/mongodb-generator'

const th =
  'px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap'
const td = 'px-3 py-2.5 align-middle text-xs text-foreground/85'

function StatusCell({ status }: { status: RecentQuery['status'] }) {
  const meta = RECENT_STATUS_META[status]
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={cn('size-2 rounded-full', toneDot[meta.tone])} />
      <span className={cn('text-xs font-semibold', toneText[meta.tone])}>{meta.label}</span>
    </span>
  )
}

function EnvCell({ env }: { env: RecentQuery['environment'] }) {
  return (
    <Badge
      variant="secondary"
      appearance="outline"
      size="xs"
      className={cn(env === 'Production' && 'text-amber-700 dark:text-amber-300')}
    >
      {env}
    </Badge>
  )
}

export function RecentQueriesTable({ onReuse }: { onReuse: (q: RecentQuery) => void }) {
  const [selected, setSelected] = useState<RecentQuery | null>(null)

  return (
    <>
      <div className="overflow-x-auto rounded-xl border bg-background">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className={cn(th, 'min-w-[220px]')}>Query name</th>
              <th className={th}>Collection</th>
              <th className={th}>Environment</th>
              <th className={th}>Query type</th>
              <th className={th}>Created by</th>
              <th className={th}>Last used</th>
              <th className={th}>Status</th>
              <th className={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {RECENT_QUERIES.map((q) => (
              <tr
                key={q.id}
                onClick={() => setSelected(q)}
                className="cursor-pointer border-b transition-colors last:border-b-0 hover:bg-muted/30"
              >
                <td className={cn(td, 'font-semibold text-foreground')}>{q.name}</td>
                <td className={td}>
                  <code className="text-[11px] font-semibold">{q.collection}</code>
                </td>
                <td className={td}>
                  <EnvCell env={q.environment} />
                </td>
                <td className={cn(td, 'whitespace-nowrap')}>{q.queryType}</td>
                <td className={cn(td, 'whitespace-nowrap')}>{q.createdBy}</td>
                <td className={cn(td, 'whitespace-nowrap tabular-nums')}>{q.lastUsed}</td>
                <td className={td}>
                  <StatusCell status={q.status} />
                </td>
                <td className={cn(td, 'whitespace-nowrap')}>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={(ev) => {
                      ev.stopPropagation()
                      setSelected(q)
                    }}
                  >
                    Detay
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RecentQueryDrawer
        query={selected}
        onClose={() => setSelected(null)}
        onReuse={(q) => {
          setSelected(null)
          onReuse(q)
        }}
      />
    </>
  )
}

// ── Drawer ───────────────────────────────────────────────────────

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

export function RecentQueryDrawer({
  query,
  onClose,
  onReuse,
}: {
  query: RecentQuery | null
  onClose: () => void
  onReuse: (q: RecentQuery) => void
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
                  {q.collection}
                </Badge>
                <EnvCell env={q.environment} />
                <Badge variant="secondary" appearance="outline" size="xs">
                  {q.queryType}
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
                <CodeBlock code={q.query} label="mongodb" summary={undefined} />
              </DrawerSection>

              <DrawerSection icon={ListChecks} title="Explanation" tone="green">
                <ol className="space-y-1.5">
                  {q.explanation.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                      <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </DrawerSection>

              <DrawerSection icon={History} title="Validation history" tone="amber">
                <div className="space-y-1.5">
                  {q.validationHistory.map((v, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-2 rounded-lg border p-2.5 text-xs"
                    >
                      <span className="flex min-w-0 items-start gap-1.5">
                        {v.status === 'validated' ? (
                          <CheckCircle2 className="mt-px size-3.5 shrink-0 text-green-600 dark:text-green-400" />
                        ) : (
                          <AlertTriangle className="mt-px size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        )}
                        <span className="text-foreground/85">{v.result}</span>
                      </span>
                      <span className="shrink-0 whitespace-nowrap tabular-nums text-muted-foreground">
                        {v.date}
                      </span>
                    </div>
                  ))}
                </div>
              </DrawerSection>

              <DrawerSection icon={Link2} title="Connected knowledge" tone="purple">
                <div className="space-y-1.5">
                  <Fact label="Related ticket">{q.relatedTicket ?? '—'}</Fact>
                  <Fact label="Related incident">{q.relatedIncident ?? '—'}</Fact>
                  <Fact label="Owner">
                    <span className="inline-flex items-center gap-1">
                      <User className="size-3 text-muted-foreground" /> {q.owner}
                    </span>
                  </Fact>
                  <Fact label="Created by">{q.createdBy}</Fact>
                  <Fact label="Last used">{q.lastUsed}</Fact>
                </div>
              </DrawerSection>

              <div className="border-t pt-4">
                <Button variant="outline" onClick={() => onReuse(q)}>
                  <Copy className="size-3.5" />
                  Copy and reuse
                </Button>
              </div>
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
