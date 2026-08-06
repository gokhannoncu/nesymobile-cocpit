'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { DomainPackDetailApi } from '@/lib/verdict-runtime/types'
import { cn } from '@nesy/metronic/lib/utils'
import { SurfaceRegistryManager } from './SurfaceRegistryManager'

interface DomainPackTabsProps {
  pack: DomainPackDetailApi
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'applications', label: 'Applications' },
  { id: 'screens', label: 'Screens & Surfaces' },
  { id: 'entities', label: 'Entities & Targets' },
  { id: 'evidence', label: 'Evidence Sources' },
  { id: 'actions', label: 'Actions & Macros' },
  { id: 'oracles', label: 'Oracle Templates' },
  { id: 'profiles', label: 'Profiles' },
  { id: 'migrations', label: 'Migrations' },
]

export function DomainPackTabs({ pack }: DomainPackTabsProps) {
  const [activeTab, setActiveTab] = useState(TABS[0]!.id)

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-2">Manifest</h3>
              <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border text-sm overflow-auto">
                {JSON.stringify(pack.manifest, null, 2) || '{}'}
              </pre>
            </div>
            <div>
              <h3 className="text-lg font-medium mb-2">Compatibility</h3>
              <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border text-sm overflow-auto">
                {JSON.stringify(pack.compatibility, null, 2) || '{}'}
              </pre>
            </div>
            {Object.keys(pack.validation || {}).length > 0 && (
              <div>
                <h3 className="text-lg font-medium mb-2 text-red-600 dark:text-red-400">Validation Errors</h3>
                <pre className="bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300 p-4 rounded-lg border border-red-200 dark:border-red-900 text-sm overflow-auto">
                  {JSON.stringify(pack.validation, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )
      case 'applications':
        return (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Application list is shown in the Screen &amp; Surface hierarchy.{' '}
              <Link
                href={`/automation/domain-packs/${encodeURIComponent(pack.packKey)}/surfaces?version=${encodeURIComponent(pack.version)}`}
                className="text-indigo-600 hover:underline"
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
              <p className="text-xs text-gray-500">
                Pack-scoped Application → Screen → Surface manager (DRAFT editable,
                PUBLISHED read-only).
              </p>
              <Link
                href={`/automation/domain-packs/${encodeURIComponent(pack.packKey)}/surfaces?version=${encodeURIComponent(pack.version)}`}
                className="text-xs text-indigo-600 hover:underline whitespace-nowrap"
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
    <div className="mt-4">
      <div className="border-b border-gray-200 dark:border-gray-800">
        <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:hover:text-gray-300',
                  'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors'
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>
      <div className="py-6">
        {renderTabContent()}
      </div>
    </div>
  )
}

function CountView({ title, items }: { title: string, items?: any[] }) {
  const count = items?.length || 0
  
  if (count === 0) {
    return (
      <div>
        <h3 className="text-lg font-medium mb-4">{title}</h3>
        <div className="p-8 text-center text-gray-500 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-dashed">
          No {title.toLowerCase()} configured
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-lg font-medium">{title}</h3>
        <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full text-xs font-medium">
          {count}
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(items ?? []).map((item, idx) => (
          <div key={idx} className="p-4 rounded-lg border bg-white dark:bg-gray-950 shadow-sm">
            <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-hidden text-ellipsis">
              {JSON.stringify(item, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  )
}
