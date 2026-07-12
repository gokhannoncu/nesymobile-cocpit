'use client'

// Endpoint tablosu — satıra tıklanınca sağ Sheet'te tüm sözleşme detayları.
// Request/Response monospace; error kodları, retry, idempotency, ilişkili ekranlar.

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@nesy/metronic/components/ui/table'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@nesy/metronic/components/ui/sheet'
import { SegmentTabs, toneCard, toneText } from '@/components/product'
import { TonePill } from './badges'
import { OFFLINE_META, type Endpoint } from '@/data/engineering/mobile-knowledge/types'

const METHOD_TONE = {
  GET: 'blue',
  POST: 'green',
  PUT: 'amber',
  PATCH: 'amber',
  DELETE: 'red',
} as const

function MethodPill({ method }: { method: Endpoint['method'] }) {
  return (
    <span
      className={cn(
        'inline-flex min-w-[3.5rem] justify-center rounded-md border px-2 py-0.5 font-mono text-xs font-semibold',
        toneCard[METHOD_TONE[method]],
        toneText[METHOD_TONE[method]],
      )}
    >
      {method}
    </span>
  )
}

function CodeBlock({ code }: { code?: string }) {
  if (!code) return <p className="text-sm text-muted-foreground">—</p>
  return (
    <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs leading-relaxed">
      {code}
    </pre>
  )
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm">{value}</p>
    </div>
  )
}

export function EndpointTable({ endpoints }: { endpoints: Endpoint[] }) {
  const [selected, setSelected] = useState<Endpoint | null>(null)

  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Method</TableHead>
              <TableHead>Endpoint</TableHead>
              <TableHead>Mobil kullanım</TableHead>
              <TableHead>Kritik alanlar</TableHead>
              <TableHead className="w-20 text-center">Offline</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {endpoints.map((ep) => (
              <TableRow
                key={`${ep.method} ${ep.path}`}
                className="cursor-pointer"
                onClick={() => setSelected(ep)}
              >
                <TableCell>
                  <MethodPill method={ep.method} />
                </TableCell>
                <TableCell className="font-mono text-xs">{ep.path}</TableCell>
                <TableCell className="text-sm">{ep.usage}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {ep.criticalFields.join(', ')}
                </TableCell>
                <TableCell className="text-center">
                  <TonePill tone={OFFLINE_META[ep.offline].tone}>
                    {OFFLINE_META[ep.offline].label}
                  </TonePill>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 font-mono text-sm">
                  <MethodPill method={selected.method} />
                  {selected.path}
                </SheetTitle>
                <SheetDescription>{selected.purpose ?? selected.usage}</SheetDescription>
              </SheetHeader>
              <SheetBody className="space-y-5 overflow-y-auto">
                <SegmentTabs
                  variant="line"
                  items={[
                    { value: 'req', label: 'Request', content: <CodeBlock code={selected.request} /> },
                    { value: 'ok', label: 'Success', content: <CodeBlock code={selected.successResponse} /> },
                    { value: 'err', label: 'Error', content: <CodeBlock code={selected.errorResponse} /> },
                    {
                      value: 'map',
                      label: 'Mobile Mapping',
                      content: (
                        <p className="text-sm text-muted-foreground">{selected.mobileMapping ?? '—'}</p>
                      ),
                    },
                  ]}
                />

                {selected.errorCodes?.length ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Error codes
                    </p>
                    <ul className="space-y-1.5">
                      {selected.errorCodes.map((e) => (
                        <li key={e.code} className="flex gap-2 text-sm">
                          <span className="font-mono font-semibold text-red-500">{e.code}</span>
                          <span className="text-muted-foreground">{e.meaning}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Mobile caller" value={selected.caller} />
                  <Field label="Retry" value={selected.retry} />
                  <Field label="Idempotency" value={selected.idempotency} />
                  <Field label="Timeout" value={selected.timeout} />
                </div>

                {selected.relatedScreens?.length ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Related screens
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selected.relatedScreens.map((s) => (
                        <Link
                          key={s}
                          href={`/engineering/mobile-knowledge/screens/${s}`}
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                        >
                          {s}
                          <ArrowUpRight className="size-3" />
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}

                {(selected.graylog || selected.mongo) && (
                  <div className="space-y-2">
                    <Field label="Graylog" value={selected.graylog} />
                    <Field label="MongoDB" value={selected.mongo} />
                  </div>
                )}
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
