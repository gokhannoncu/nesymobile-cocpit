'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  Bug,
  ChevronRight,
  Code2,
  GitBranch,
  Globe,
  Info,
  Lightbulb,
  Settings,
  Ticket,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@nesy/metronic/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@nesy/metronic/components/ui/tabs'

import type { Feature } from '@/data/product/nesy-types'
import { COUNTRIES, isSupported } from '@/data/product/nesy'
import type { Tone } from './tones'
import { toneCard, toneIcon, toneIconBox, toneText, toneDot, EASE } from './tones'
import { FlowDiagram } from './flow-diagram'

/* ─── Tab definitions ─── */
const TABS = [
  { id: 'overview', label: 'Genel bakış', icon: Info },
  { id: 'scope', label: 'Country Coverage', icon: Globe },
  { id: 'diagram', label: 'Flow Diagram', icon: GitBranch },
  { id: 'params', label: 'Parameters & API', icon: Settings },
  { id: 'tips', label: 'Tips & Tricks', icon: Lightbulb },
  { id: 'tickets', label: 'Tickets', icon: Ticket },
  { id: 'team', label: 'Team & Score', icon: Users },
] as const

type TabId = (typeof TABS)[number]['id']

/* ─── Score bar helpers ─── */
const scoreLabels: Record<string, string> = {
  bugProneness: 'Bug Risk',
  boilerplate: 'Boilerplate',
  complexity: 'Complexity',
  testCoverage: 'Test Coverage',
}

const scoreColors: Record<number, string> = {
  1: 'bg-green-500',
  2: 'bg-emerald-500',
  3: 'bg-amber-500',
  4: 'bg-orange-500',
  5: 'bg-red-500',
}

const ticketStatusColor: Record<string, string> = {
  open: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  closed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  'in-progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
}

/* ─── Main Component ─── */
export function FeatureDetailDialog({
  feature,
  module,
  tone = 'orange',
  open,
  onOpenChange,
}: {
  feature: Feature | null
  module?: { title: string; id: string }
  tone?: Tone
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  useEffect(() => {
    setActiveTab('overview')
  }, [feature?.id])

  if (!feature) return null

  const detail = feature.detail
  const activeCountries = COUNTRIES.filter((c) => c.id !== 'core')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-4xl overflow-hidden p-0 sm:h-[min(82vh,48rem)] sm:w-[calc(100vw-3rem)] sm:rounded-2xl"
      >
        {/* ─── Header ─── */}
        <DialogHeader className="mb-0 shrink-0 border-b border-border/60 bg-muted/15 px-4 py-4 pr-12 sm:px-6 sm:py-5 sm:pr-14">
          <div className="flex items-start gap-3.5">
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-xl',
                toneIconBox[tone],
              )}
            >
              <Code2 className={cn('size-4.5', toneIcon[tone])} />
            </span>
            <div className="min-w-0 flex-1">
              {module && (
                <div className={cn('mb-0.5 text-[10px] font-bold uppercase tracking-[0.16em]', toneText[tone])}>
                  {module.title}
                </div>
              )}
              <DialogTitle className="text-lg font-bold sm:text-xl">{feature.title}</DialogTitle>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {feature.desc}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <Badge variant="secondary" appearance="outline" size="sm">
                  {feature.id}
                </Badge>
                <Badge variant="secondary" appearance="outline" size="sm">
                  {activeCountries.filter((c) => isSupported(feature.values[c.id])).length}/{activeCountries.length} countries active
                </Badge>
                {detail?.score && (
                  <Badge
                    variant="secondary"
                    appearance="outline"
                    size="sm"
                    className={cn(
                      detail.score.bugProneness >= 4
                        ? 'border-red-300 text-red-600 dark:border-red-800 dark:text-red-400'
                        : detail.score.bugProneness >= 3
                          ? 'border-amber-300 text-amber-600 dark:border-amber-800 dark:text-amber-400'
                          : '',
                    )}
                  >
                    <Bug className="size-3 mr-0.5" />
                    Risk: {detail.score.bugProneness}/5
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* ─── Tabs ─── */}
        <DialogBody className="flex min-h-0 grow flex-col overflow-hidden">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TabId)}
            className="flex h-full flex-col"
          >
            <div className="shrink-0 border-b border-border/60 bg-background px-3 sm:px-5">
              <TabsList
                variant="line"
                size="sm"
                className="w-full justify-start overflow-x-auto"
              >
                {TABS.map((t) => (
                  <TabsTrigger key={t.id} value={t.id} className="shrink-0">
                    <t.icon className="size-3.5" />
                    <span className="hidden md:inline">{t.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="mt-0 min-h-0 grow overflow-y-auto px-4 pb-5 sm:px-6">
              {/* ─── 1. Overview ─── */}
              <TabsContent value="overview">
                <AnimatePresence mode="wait">
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="grid gap-4 py-4 lg:grid-cols-2 lg:items-start"
                  >
                    {detail ? (
                      <>
                        {/* What Is It */}
                        <Section
                          title="Nedir?"
                          icon={Info}
                          tone={tone}
                          className="rounded-xl border border-border/60 bg-muted/20 p-4 lg:col-span-2"
                        >
                          <p className="max-w-4xl text-sm leading-relaxed text-foreground/85">
                            {detail.whatIs}
                          </p>
                        </Section>

                        {/* How It Works */}
                        <Section
                          title="Nasıl çalışır?"
                          icon={GitBranch}
                          tone={tone}
                          className="rounded-xl border border-border/60 bg-muted/20 p-4"
                        >
                          <ol className="space-y-2.5 text-sm">
                            {detail.howItWorks.map((step, i) => (
                              <li key={i} className="flex gap-2.5">
                                <span
                                  className={cn(
                                    'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white mt-0.5',
                                    toneDot[tone],
                                  )}
                                >
                                  {i + 1}
                                </span>
                                <span className="leading-relaxed text-foreground/85">{step}</span>
                              </li>
                            ))}
                          </ol>
                        </Section>

                        {/* Screens */}
                        <Section
                          title="Hangi ekranda çalışır?"
                          icon={Code2}
                          tone={tone}
                          className="rounded-xl border border-border/60 bg-muted/20 p-4"
                        >
                          <div className="grid gap-2">
                            {detail.screens.map((screen) => (
                              <div
                                key={screen}
                                className={cn(
                                  'rounded-lg border px-3 py-2 text-xs leading-relaxed',
                                  toneCard[tone],
                                )}
                              >
                                <ChevronRight
                                  className={cn('inline-block size-3 mr-1', toneIcon[tone])}
                                />
                                {screen}
                              </div>
                            ))}
                          </div>
                        </Section>
                      </>
                    ) : (
                      <EmptyState message="Bu feature için henüz detay bilgisi eklenmedi." />
                    )}
                  </motion.div>
                </AnimatePresence>
              </TabsContent>

              {/* ─── 2. Country Coverage ─── */}
              <TabsContent value="scope">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="py-2"
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/60">
                          <th className="py-2 pr-4 text-left font-semibold text-foreground">Country</th>
                          <th className="py-2 pr-4 text-left font-semibold text-foreground">Status</th>
                          <th className="py-2 text-left font-semibold text-foreground">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {COUNTRIES.map((c) => {
                          const val = feature.values[c.id]
                          return (
                            <tr
                              key={c.id}
                              className="border-b border-border/30 last:border-0"
                            >
                              <td className="py-2.5 pr-4">
                                <div className="font-medium text-foreground">{c.name}</div>
                                <div className="text-xs text-muted-foreground">{c.subtitle}</div>
                              </td>
                              <td className="py-2.5 pr-4">
                                <Badge
                                  variant="secondary"
                                  size="xs"
                                  className={cn(
                                    val === '—'
                                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                      : val === 'N/A'
                                        ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                                  )}
                                >
                                  {val === '—' ? 'Unavailable' : val === 'N/A' ? 'Out of Scope' : 'Active'}
                                </Badge>
                              </td>
                              <td className="py-2.5">
                                <div className="text-xs text-foreground/75 whitespace-pre-line leading-relaxed max-w-xl">
                                  {val === '—' ? 'Not yet available' : val === 'N/A' ? 'Out of scope in this country' : val}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              </TabsContent>

              {/* ─── 3. Flow Diagram ─── */}
              <TabsContent value="diagram">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="py-4"
                >
                  {detail?.diagram && detail.diagram.length > 0 ? (
                    <div className={cn('rounded-xl border p-6 sm:p-8', toneCard[tone])}>
                      <div className={cn('text-xs font-bold uppercase tracking-[0.15em] mb-5', toneText[tone])}>
                        Flow Diagram
                      </div>
                      <FlowDiagram elements={detail.diagram} tone={tone} />
                    </div>
                  ) : (
                    <EmptyState message="No flow diagram has been added for this feature yet." />
                  )}
                </motion.div>
              </TabsContent>

              {/* ─── 4. Parameters & API ─── */}
              <TabsContent value="params">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="space-y-6 py-2"
                >
                  {detail ? (
                    <>
                      {/* Parameters */}
                      {detail.parameters.length > 0 && (
                        <Section title="Related Parameters" icon={Settings} tone={tone}>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border/60">
                                  <th className="py-2 pr-3 text-left font-semibold">Parameter</th>
                                  <th className="py-2 pr-3 text-left font-semibold">Description</th>
                                  <th className="py-2 text-left font-semibold">Type</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detail.parameters.map((p) => (
                                  <tr key={p.name} className="border-b border-border/30 last:border-0">
                                    <td className="py-2 pr-3">
                                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                                        {p.name}
                                      </code>
                                    </td>
                                    <td className="py-2 pr-3 text-xs text-foreground/80">{p.desc}</td>
                                    <td className="py-2">
                                      <Badge variant="secondary" size="xs">{p.type}</Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </Section>
                      )}

                      {/* APIs */}
                      {detail.apis && detail.apis.length > 0 && (
                        <Section title="API Endpoints" icon={Code2} tone={tone}>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border/60">
                                  <th className="py-2 pr-3 text-left font-semibold">Method</th>
                                  <th className="py-2 pr-3 text-left font-semibold">Endpoint</th>
                                  <th className="py-2 text-left font-semibold">Description</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detail.apis.map((api) => (
                                  <tr key={api.endpoint} className="border-b border-border/30 last:border-0">
                                    <td className="py-2 pr-3">
                                      <Badge
                                        variant="secondary"
                                        size="xs"
                                        className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                                      >
                                        {api.method}
                                      </Badge>
                                    </td>
                                    <td className="py-2 pr-3">
                                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                                        {api.endpoint}
                                      </code>
                                    </td>
                                    <td className="py-2 text-xs text-foreground/80">{api.desc}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </Section>
                      )}
                    </>
                  ) : (
                    <EmptyState message="No parameter and API information has been added for this feature yet." />
                  )}
                </motion.div>
              </TabsContent>

              {/* ─── 5. Tips & Tricks ─── */}
              <TabsContent value="tips">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="py-2"
                >
                  {detail?.tips && detail.tips.length > 0 ? (
                    <div className="space-y-2">
                      {detail.tips.map((tip, i) => (
                        <div
                          key={i}
                          className={cn(
                            'flex gap-3 rounded-lg border px-4 py-3',
                            toneCard[tone],
                          )}
                        >
                          <Lightbulb
                            className={cn('size-4 shrink-0 mt-0.5', toneIcon[tone])}
                          />
                          <p className="text-sm leading-relaxed text-foreground/85">{tip}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState message="No tips or tricks have been added for this feature yet." />
                  )}
                </motion.div>
              </TabsContent>

              {/* ─── 6. Tickets ─── */}
              <TabsContent value="tickets">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="py-2"
                >
                  {detail?.tickets && detail.tickets.length > 0 ? (
                    <div className="space-y-2">
                      {detail.tickets.map((ticket) => (
                        <div
                          key={ticket.id}
                          className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3"
                        >
                          <Ticket className="size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {ticket.url ? (
                                <a
                                  href={ticket.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-bold text-primary hover:underline"
                                >
                                  #{ticket.id}
                                </a>
                              ) : (
                                <code className="text-xs font-bold text-foreground">#{ticket.id}</code>
                              )}
                              <Badge
                                variant="secondary"
                                size="xs"
                                className={ticketStatusColor[ticket.status]}
                              >
                                {ticket.status === 'open'
                                  ? 'Open'
                                  : ticket.status === 'closed'
                                    ? 'Closed'
                                    : 'In Progress'}
                              </Badge>
                            </div>
                            <p className="mt-0.5 text-sm text-foreground/80">{ticket.title}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState message="No tickets are recorded for this feature." />
                  )}
                </motion.div>
              </TabsContent>

              {/* ─── 7. Team & Score ─── */}
              <TabsContent value="team">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="space-y-6 py-2"
                >
                  {detail ? (
                    <>
                      {/* Know-how owners */}
                      {detail.experts.length > 0 && (
                        <Section title="Know-How Owners" icon={Users} tone={tone}>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {detail.experts.map((expert) => (
                              <div
                                key={expert.name}
                                className={cn(
                                  'flex items-center gap-3 rounded-lg border px-3 py-2.5',
                                  toneCard[tone],
                                )}
                              >
                                <span
                                  className={cn(
                                    'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white',
                                    toneDot[tone],
                                  )}
                                >
                                  {expert.name
                                    .split(' ')
                                    .map((w) => w[0])
                                    .slice(0, 2)
                                    .join('')}
                                </span>
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-foreground truncate">
                                    {expert.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {expert.role}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </Section>
                      )}

                      {/* Score */}
                      <Section title="Feature Score" icon={AlertTriangle} tone={tone}>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {(
                            Object.entries(detail.score) as [string, number][]
                          ).map(([key, value]) => (
                            <div key={key} className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-foreground">
                                  {scoreLabels[key] ?? key}
                                </span>
                                <span className="text-xs font-bold text-foreground">
                                  {value}/5
                                </span>
                              </div>
                              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                <motion.div
                                  className={cn('h-full rounded-full', scoreColors[value])}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(value / 5) * 100}%` }}
                                  transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Overall score */}
                        <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-3">
                          <Bug className={cn('size-4', toneIcon[tone])} />
                          <span className="text-sm font-medium text-foreground">
                            Overall Risk Score:{' '}
                            <strong>
                              {(
                                (detail.score.bugProneness +
                                  detail.score.boilerplate +
                                  detail.score.complexity +
                                  (6 - detail.score.testCoverage)) /
                                4
                              ).toFixed(1)}
                              /5
                            </strong>
                          </span>
                        </div>
                      </Section>
                    </>
                  ) : (
                    <EmptyState message="No team and score information has been added for this feature yet." />
                  )}
                </motion.div>
              </TabsContent>
            </div>
          </Tabs>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Helper components ─── */

function Section({
  title,
  icon: Icon,
  tone = 'orange',
  children,
  className,
}: {
  title: string
  icon: LucideIcon
  tone?: Tone
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={className}>
      <div className="mb-2.5 flex items-center gap-2">
        <Icon className={cn('size-4', toneIcon[tone])} />
        <h3 className={cn('text-sm font-bold', toneText[tone])}>{title}</h3>
      </div>
      {children}
    </section>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center">
        <Info className="size-10 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}
