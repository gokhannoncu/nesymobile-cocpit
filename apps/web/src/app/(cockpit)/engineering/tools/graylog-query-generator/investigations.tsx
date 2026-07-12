'use client'

// Saved Investigations — tam genişlik tablo + sağ Sheet drawer.
// Desen: field-tickets/pool.tsx ile aynı tablo hücre ve drawer bölüm dili.

import { ReactNode, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Link2,
  ListOrdered,
  RotateCcw,
  Target,
  Wrench,
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
import { toneText, type Tone } from '@/components/product'
import { CodeBlock } from '@/components/engineering/tools/shared'
import { SAVED_INVESTIGATIONS, type SavedInvestigation } from '@/data/engineering/tools/graylog-generator'

const th =
  'px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap'
const td = 'px-3 py-2.5 align-middle text-xs text-foreground/85'

function DrawerSection({
  icon: Icon,
  title,
  tone = 'gray',
  children,
}: {
  icon: typeof Target
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

export function SavedInvestigations({ onReuse }: { onReuse: (inv: SavedInvestigation) => void }) {
  const [selected, setSelected] = useState<SavedInvestigation | null>(null)

  return (
    <>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[1080px] border-collapse text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className={th}>Name</th>
              <th className={th}>Query purpose</th>
              <th className={th}>Country</th>
              <th className={th}>Time range</th>
              <th className={th}>Related incident</th>
              <th className={th}>Created by</th>
              <th className={th}>Last used</th>
              <th className={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {SAVED_INVESTIGATIONS.map((inv) => (
              <tr
                key={inv.id}
                onClick={() => setSelected(inv)}
                className="cursor-pointer border-b transition-colors last:border-b-0 hover:bg-muted/30"
              >
                <td className={cn(td, 'font-semibold text-foreground whitespace-nowrap')}>{inv.name}</td>
                <td className={cn(td, 'max-w-[320px]')}>
                  <span className="line-clamp-2">{inv.purpose}</span>
                </td>
                <td className={cn(td, 'whitespace-nowrap')}>
                  <Badge variant="secondary" appearance="outline" size="xs">{inv.country}</Badge>
                </td>
                <td className={cn(td, 'whitespace-nowrap')}>{inv.timeRange}</td>
                <td className={cn(td, 'whitespace-nowrap')}>
                  <code className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                    {inv.relatedIncident}
                  </code>
                </td>
                <td className={cn(td, 'whitespace-nowrap')}>{inv.createdBy}</td>
                <td className={cn(td, 'whitespace-nowrap text-muted-foreground')}>{inv.lastUsed}</td>
                <td className={cn(td, 'whitespace-nowrap')}>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={(ev) => {
                      ev.stopPropagation()
                      setSelected(inv)
                    }}
                  >
                    Detay <ArrowRight className="size-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-hidden p-0 sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader className="border-b px-5 py-4">
                <SheetTitle className="text-base">{selected.name}</SheetTitle>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge variant="secondary" appearance="outline" size="xs">{selected.country}</Badge>
                  <Badge variant="secondary" appearance="outline" size="xs">{selected.timeRange}</Badge>
                  <Badge variant="secondary" appearance="outline" size="xs">{selected.relatedIncident}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {selected.createdBy} · {selected.lastUsed}
                  </span>
                </div>
              </SheetHeader>
              <SheetBody className="h-[calc(100vh-96px)] space-y-6 overflow-y-auto px-5 py-5">
                <DrawerSection icon={Target} title="Investigation objective" tone="blue">
                  <p>{selected.objective}</p>
                </DrawerSection>

                <DrawerSection icon={ListOrdered} title="Query" tone="orange">
                  <CodeBlock code={selected.query} label="graylog" labelTone="orange" />
                </DrawerSection>

                <DrawerSection icon={ListOrdered} title="Expected event chain" tone="green">
                  <ol className="space-y-1.5">
                    {selected.expectedEventChain.map((e, i) => (
                      <li key={e} className="flex items-center gap-2 text-xs">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted font-bold text-muted-foreground">
                          {i + 1}
                        </span>
                        <code className="font-semibold text-foreground">{e}</code>
                      </li>
                    ))}
                  </ol>
                </DrawerSection>

                <DrawerSection icon={AlertTriangle} title="Known anomalies" tone="amber">
                  <ul className="list-disc space-y-1 pl-4 text-xs">
                    {selected.knownAnomalies.map((a) => <li key={a}>{a}</li>)}
                  </ul>
                </DrawerSection>

                <DrawerSection icon={Link2} title="Related tickets" tone="indigo">
                  <div className="flex flex-wrap gap-1.5">
                    {selected.relatedTickets.map((t) => (
                      <Badge key={t} variant="secondary" appearance="outline" size="xs">{t}</Badge>
                    ))}
                  </div>
                </DrawerSection>

                <DrawerSection icon={Wrench} title="Root cause" tone="red">
                  <p className="text-xs leading-relaxed">{selected.rootCause}</p>
                </DrawerSection>

                <DrawerSection icon={AlertTriangle} title="Edge case" tone="purple">
                  <p className="text-xs leading-relaxed">{selected.edgeCase}</p>
                </DrawerSection>

                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => {
                    onReuse(selected)
                    setSelected(null)
                  }}
                >
                  <RotateCcw className="size-4" />
                  Reuse query
                </Button>
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
