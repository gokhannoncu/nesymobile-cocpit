'use client'

// Engineering Tools shared components — the three tool pages (Data Locator,
// MongoDB Query Generator, Graylog Query Generator) derive their visual language from here.

import { ReactNode, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowUpRight,
  Check,
  Compass,
  Copy,
  Database,
  Play,
  ScrollText,
  Terminal,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { EASE, toneIcon, toneIconBox, type Tone } from '@/components/product'

/** Single source of truth for tools — header cross-links are derived from here. */
export const TOOL_LINKS: { path: string; title: string; icon: LucideIcon }[] = [
  { path: '/engineering/tools/data-locator', title: 'Data Locator', icon: Compass },
  { path: '/engineering/tools/mongodb-query-generator', title: 'MongoDB Query Generator', icon: Database },
  { path: '/engineering/tools/graylog-query-generator', title: 'Graylog Query Generator', icon: Terminal },
  { path: '/engineering/device-lab/adb-scenarios', title: 'ADB Scenario Runner', icon: Play },
  { path: '/engineering/device-lab/log-explorer', title: 'Device Log Explorer', icon: ScrollText },
]

/**
 * Compact tool header — not a marketing hero.
 * Left: icon + title + single-sentence purpose + trust badges.
 * Right: secondary navigation cards to the other tools.
 */
export function ToolHeader({
  path,
  icon: Icon,
  title,
  lead,
  tone = 'orange',
  badges,
}: {
  /** This page's route — excluded from cross-links. */
  path: string
  icon: LucideIcon
  title: string
  lead: string
  tone?: Tone
  /** Trust/status badges — e.g. "Read-only by default". */
  badges: { label: string; icon?: LucideIcon; tone?: Tone }[]
}) {
  const others = TOOL_LINKS.filter((t) => t.path !== path)
  return (
    <motion.section
      className="rounded-2xl border bg-card p-5 lg:p-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4 min-w-0">
          <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', toneIconBox[tone])}>
            <Icon className={cn('size-5.5', toneIcon[tone])} />
          </span>
          <div className="min-w-0">
            <div className={cn('text-[11px] font-bold uppercase tracking-[0.18em]', toneIcon[tone])}>
              Engineering Tools
            </div>
            <h1 className="mt-0.5 text-xl lg:text-2xl font-bold text-foreground">{title}</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{lead}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {others.map((t) => (
            <Button key={t.path} size="sm" variant="outline" asChild>
              <Link href={t.path}>
                <t.icon className="size-3.5" />
                {t.title}
                <ArrowUpRight className="size-3.5 opacity-60" />
              </Link>
            </Button>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border/70 pt-4">
        {badges.map((b) => (
          <Badge key={b.label} variant="secondary" appearance="outline" size="sm" className="gap-1">
            {b.icon && <b.icon className={cn('size-3', toneIcon[b.tone ?? 'gray'])} />}
            {b.label}
          </Badge>
        ))}
      </div>
    </motion.section>
  )
}

/** Copy to clipboard button — briefly shows a "Copied" state after copying. */
export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 px-2 text-xs"
      onClick={() => {
        void navigator.clipboard?.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      }}
    >
      {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : label}
    </Button>
  )
}

/**
 * Monospace code block — label/badge + action toolbar on top, optional summary line at the bottom.
 * Not IDE-dense; line numbers are shown if requested.
 */
export function CodeBlock({
  code,
  label,
  labelTone = 'green',
  badges,
  actions,
  summary,
  lineNumbers = false,
  className,
}: {
  code: string
  /** Top-left language label — e.g. "mongodb", "graylog". */
  label?: string
  labelTone?: Tone
  /** Small badges next to the label — e.g. "Read-only". */
  badges?: ReactNode
  /** Toolbar actions besides Copy. */
  actions?: ReactNode
  /** Single-line summary below the code — e.g. "Collection: … · Limit: 100". */
  summary?: string
  lineNumbers?: boolean
  className?: string
}) {
  const lines = code.split('\n')
  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card', className)}>
      <div className="flex flex-wrap items-center gap-1.5 border-b bg-muted/40 px-3 py-1.5">
        {label && (
          <Badge variant="secondary" appearance="outline" size="xs" className={cn('font-mono', toneIcon[labelTone])}>
            {label}
          </Badge>
        )}
        {badges}
        <div className="ms-auto flex items-center gap-0.5">
          {actions}
          <CopyButton text={code} />
        </div>
      </div>
      <pre className="overflow-x-auto p-4 text-[12.5px] leading-relaxed">
        <code className="font-mono text-foreground/90">
          {lineNumbers
            ? lines.map((l, i) => (
                <span key={i} className="block">
                  <span className="me-4 inline-block w-5 select-none text-right text-muted-foreground/50">
                    {i + 1}
                  </span>
                  {l}
                </span>
              ))
            : code}
        </code>
      </pre>
      {summary && (
        <div className="border-t bg-muted/30 px-4 py-2 font-mono text-[11px] text-muted-foreground">
          {summary}
        </div>
      )}
    </div>
  )
}

/** Example request chip — inserts the text into the form when clicked. */
export function ExampleChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11.5px] font-medium text-foreground/80 transition-colors hover:border-blue-300 hover:bg-blue-50/70 hover:text-blue-700 dark:hover:border-blue-800 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
    >
      {label}
    </button>
  )
}

/** Tool card — white background, thin border, title + description + content. */
export function ToolCard({
  step,
  title,
  description,
  children,
  className,
}: {
  /** Step number — e.g. "1". */
  step?: string
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-xl border bg-card p-5', className)}>
      <header>
        <h2 className="text-[15px] font-bold text-foreground">
          {step && <span className="me-1.5 text-muted-foreground">{step}.</span>}
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        )}
      </header>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}
