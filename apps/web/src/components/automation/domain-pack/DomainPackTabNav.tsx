'use client'

import type { LucideIcon } from 'lucide-react'
import {
  Box,
  FileSearch,
  FileText,
  FlaskConical,
  GitBranch,
  Layers,
  ShieldCheck,
  Smartphone,
  Zap,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import type { DomainPackDetailApi } from '@/lib/verdict-runtime/types'

export const DOMAIN_PACK_TABS = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'Manifest, compatibility, validation',
    icon: FileText,
  },
  {
    id: 'applications',
    label: 'Applications',
    description: 'Mobile and adapter apps',
    icon: Smartphone,
  },
  {
    id: 'screens',
    label: 'Screens & Surfaces',
    description: 'Screen readiness and overlays',
    icon: Layers,
  },
  {
    id: 'entities',
    label: 'Entities & Targets',
    description: 'Domain entities and run targets',
    icon: Box,
  },
  {
    id: 'evidence',
    label: 'Evidence Sources',
    description: 'Telemetry and fact sources',
    icon: FileSearch,
  },
  {
    id: 'actions',
    label: 'Actions & Macros',
    description: 'Semantic actions and macros',
    icon: Zap,
  },
  {
    id: 'oracles',
    label: 'Oracle Templates',
    description: 'Verdict evaluation templates',
    icon: ShieldCheck,
  },
  {
    id: 'profiles',
    label: 'Profiles',
    description: 'Launch and test profiles',
    icon: FlaskConical,
  },
  {
    id: 'migrations',
    label: 'Migrations',
    description: 'Pack version migrations',
    icon: GitBranch,
  },
] as const

export type DomainPackTabId = (typeof DOMAIN_PACK_TABS)[number]['id']

export function domainPackTabCount(
  pack: DomainPackDetailApi,
  tabId: DomainPackTabId,
): number | undefined {
  switch (tabId) {
    case 'applications':
      return pack.applications?.length
    case 'entities':
      return (pack.entities?.length ?? 0) + (pack.targets?.length ?? 0)
    case 'evidence':
      return pack.evidenceSources?.length
    case 'actions':
      return (pack.semanticActions?.length ?? 0) + (pack.macros?.length ?? 0)
    case 'oracles':
      return pack.oracleTemplates?.length
    case 'profiles':
      return (pack.launchProfiles?.length ?? 0) + (pack.testProfiles?.length ?? 0)
    case 'migrations':
      return pack.migrations?.length
    default:
      return undefined
  }
}

function TabCountBadge({ count, active }: { count: number; active: boolean }) {
  if (count <= 0) return null

  return (
    <span
      className={cn(
        'inline-flex min-w-5 items-center justify-center rounded-[4px] px-1.5 py-px text-[9px] font-bold tabular-nums',
        active
          ? 'bg-nesy/15 text-nesy-ink'
          : 'bg-muted/70 text-muted-foreground',
      )}
    >
      {count}
    </span>
  )
}

function TabButton({
  tab,
  active,
  count,
  onClick,
  layout,
}: {
  tab: (typeof DOMAIN_PACK_TABS)[number]
  active: boolean
  count: number | undefined
  onClick: () => void
  layout: 'rail' | 'strip'
}) {
  const Icon = tab.icon

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'group relative flex w-full text-left transition',
        layout === 'rail'
          ? 'items-start gap-3 rounded-[8px] px-3 py-2.5'
          : 'shrink-0 items-center gap-2 rounded-[8px] px-3 py-2',
        active
          ? 'bg-nesy-soft/70 text-nesy-ink ring-1 ring-nesy/15'
          : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
      )}
    >
      {active && layout === 'rail' ? (
        <span
          aria-hidden
          className="absolute inset-y-2 start-0 w-0.5 rounded-full bg-nesy"
        />
      ) : null}

      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-[6px] ring-1 ring-border/60',
          layout === 'rail' ? 'size-8' : 'size-7',
          active
            ? 'bg-background text-nesy-ink ring-nesy/20'
            : 'bg-background/80 text-muted-foreground group-hover:text-foreground',
        )}
      >
        <Icon className={layout === 'rail' ? 'size-4' : 'size-3.5'} strokeWidth={2.2} />
      </span>

      <span className={cn('min-w-0 flex-1', layout === 'strip' && 'flex items-center gap-2')}>
        <span className="flex items-center gap-2">
          <span
            className={cn(
              'font-semibold leading-tight',
              layout === 'rail' ? 'text-sm' : 'whitespace-nowrap text-xs',
              active ? 'text-nesy-ink' : 'text-foreground',
            )}
          >
            {tab.label}
          </span>
          {count != null ? <TabCountBadge count={count} active={active} /> : null}
        </span>
        {layout === 'rail' ? (
          <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground group-hover:text-foreground/80">
            {tab.description}
          </span>
        ) : null}
      </span>
    </button>
  )
}

export function DomainPackTabNav({
  pack,
  activeTab,
  onTabChange,
}: {
  pack: DomainPackDetailApi
  activeTab: DomainPackTabId
  onTabChange: (tabId: DomainPackTabId) => void
}) {
  return (
    <>
      <nav
        className="hidden lg:flex lg:w-[15.5rem] lg:shrink-0 lg:flex-col lg:gap-1 lg:border-e lg:border-border lg:bg-muted/10 lg:p-3"
        aria-label="Domain pack sections"
        role="tablist"
      >
        <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Registry sections
        </p>
        {DOMAIN_PACK_TABS.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            active={activeTab === tab.id}
            count={domainPackTabCount(pack, tab.id)}
            onClick={() => onTabChange(tab.id)}
            layout="rail"
          />
        ))}
      </nav>

      <div className="border-b border-border bg-muted/10 lg:hidden">
        <nav
          className="flex gap-1.5 overflow-x-auto px-3 py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Domain pack sections"
          role="tablist"
        >
          {DOMAIN_PACK_TABS.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              active={activeTab === tab.id}
              count={domainPackTabCount(pack, tab.id)}
              onClick={() => onTabChange(tab.id)}
              layout="strip"
            />
          ))}
        </nav>
      </div>
    </>
  )
}

export function domainPackTabMeta(tabId: DomainPackTabId): {
  label: string
  description: string
  icon: LucideIcon
} {
  const tab = DOMAIN_PACK_TABS.find((entry) => entry.id === tabId) ?? DOMAIN_PACK_TABS[0]!
  return {
    label: tab.label,
    description: tab.description,
    icon: tab.icon,
  }
}
