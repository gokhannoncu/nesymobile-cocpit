'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { DomainPackDetailApi } from '@/lib/verdict-runtime/types'
import { SurfaceRegistryManager } from './SurfaceRegistryManager'
import {
  DomainPackTabNav,
  domainPackTabMeta,
  DOMAIN_PACK_TABS,
  type DomainPackTabId,
} from './DomainPackTabNav'

interface DomainPackTabsProps {
  pack: DomainPackDetailApi
}

export function DomainPackTabs({ pack }: DomainPackTabsProps) {
  const [activeTab, setActiveTab] = useState<DomainPackTabId>(DOMAIN_PACK_TABS[0]!.id)
  const activeMeta = domainPackTabMeta(activeTab)
  const ActiveIcon = activeMeta.icon

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Manifest</h3>
              <pre className="overflow-auto rounded-[8px] border border-border bg-muted/20 p-4 text-xs">
                {JSON.stringify(pack.manifest, null, 2) || '{}'}
              </pre>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Compatibility</h3>
              <pre className="overflow-auto rounded-[8px] border border-border bg-muted/20 p-4 text-xs">
                {JSON.stringify(pack.compatibility, null, 2) || '{}'}
              </pre>
            </div>
            {Object.keys(pack.validation || {}).length > 0 ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-red-700 dark:text-red-300">
                  Validation errors
                </h3>
                <pre className="overflow-auto rounded-[8px] border border-red-200/80 bg-red-50/70 p-4 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                  {JSON.stringify(pack.validation, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        )
      case 'applications':
        return (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Application list is shown in the Screen &amp; Surface hierarchy.{' '}
              <Link
                href={`/automation/domain-packs/${encodeURIComponent(pack.packKey)}/surfaces?version=${encodeURIComponent(pack.version)}`}
                className="font-semibold text-nesy-ink hover:underline"
              >
                Open Surface Registry
              </Link>
            </p>
            <CountView title="Applications" items={pack.applications} />
          </div>
        )
      case 'screens':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Pack-scoped Application → Screen → Surface manager (DRAFT editable, PUBLISHED
                read-only).
              </p>
              <Link
                href={`/automation/domain-packs/${encodeURIComponent(pack.packKey)}/surfaces?version=${encodeURIComponent(pack.version)}`}
                className="whitespace-nowrap text-xs font-semibold text-nesy-ink hover:underline"
              >
                Open dedicated route
              </Link>
            </div>
            <SurfaceRegistryManager packKey={pack.packKey} version={pack.version} />
          </div>
        )
      case 'entities':
        return (
          <div className="space-y-6">
            <CountView title="Entities" items={pack.entities} />
            <CountView title="Targets" items={pack.targets} />
          </div>
        )
      case 'evidence':
        return <CountView title="Evidence Sources" items={pack.evidenceSources} />
      case 'actions':
        return (
          <div className="space-y-6">
            <CountView title="Semantic Actions" items={pack.semanticActions} />
            <CountView title="Macros" items={pack.macros} />
          </div>
        )
      case 'oracles':
        return <CountView title="Oracle Templates" items={pack.oracleTemplates} />
      case 'profiles':
        return (
          <div className="space-y-6">
            <CountView title="Launch Profiles" items={pack.launchProfiles} />
            <CountView title="Test Profiles" items={pack.testProfiles} />
          </div>
        )
      case 'migrations':
        return <CountView title="Migrations" items={pack.migrations} />
      default:
        return null
    }
  }

  return (
    <article className="overflow-hidden rounded-[8px] border border-border bg-card">
      <div className="flex min-h-[520px] flex-col lg:flex-row">
        <DomainPackTabNav pack={pack} activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="min-w-0 flex-1" role="tabpanel">
          <div className="border-b border-border bg-muted/10 px-4 py-3 lg:px-5">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-nesy-soft text-nesy-ink ring-1 ring-nesy/10">
                <ActiveIcon className="size-4" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">{activeMeta.label}</h2>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {activeMeta.description}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 lg:p-5">{renderTabContent()}</div>
        </div>
      </div>
    </article>
  )
}

function CountView({ title, items }: { title: string; items?: unknown[] }) {
  const count = items?.length ?? 0

  if (count === 0) {
    return (
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
        <div className="rounded-[8px] border border-dashed border-border bg-muted/15 p-8 text-center text-sm text-muted-foreground">
          No {title.toLowerCase()} configured
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="inline-flex rounded-[4px] border border-border/70 bg-muted/40 px-2 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
          {count}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(items ?? []).map((item, idx) => (
          <div key={idx} className="rounded-[8px] border border-border bg-card p-3">
            <pre className="overflow-hidden text-ellipsis text-[11px] text-muted-foreground">
              {JSON.stringify(item, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  )
}
