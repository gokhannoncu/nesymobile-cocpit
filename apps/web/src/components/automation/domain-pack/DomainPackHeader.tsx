'use client'

import React from 'react'
import { DomainPackDetailApi } from '@/lib/verdict-runtime/types'
import { DomainPackStateBadge } from './DomainPackStateBadge'
import { DomainPackDigestDisplay } from './DomainPackDigestDisplay'
import { Button } from '@nesy/metronic/components/ui/button'
import { ArrowLeft, Save, UploadCloud, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@nesy/metronic/lib/utils'

interface DomainPackHeaderProps {
  pack: DomainPackDetailApi
  isSaving?: boolean
  isPublishing?: boolean
  onSaveDraft?: () => void
  onPublish?: () => void
  hasValidationErrors?: boolean
}

export function DomainPackHeader({
  pack,
  isSaving,
  isPublishing,
  onSaveDraft,
  onPublish,
  hasValidationErrors
}: DomainPackHeaderProps) {
  const isDraft = pack.state === 'DRAFT'
  const sourceCommit = String((pack.manifest?.provenance as Record<string, unknown> | undefined)?.sourceCommit ?? 'workspace')
  const canonicalSource = pack.state === 'PUBLISHED' ? 'Published immutable snapshot' : 'Draft registry snapshot'

  return (
    <div className="flex flex-col gap-4 border-b pb-6 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/automation/domain-packs" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{pack.displayName}</h1>
              <DomainPackStateBadge state={pack.state} />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {pack.packKey} • Version {pack.version}
              {!isDraft && <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">(Read-Only)</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isDraft ? (
            <>
              <Button 
                variant="outline" 
                onClick={onSaveDraft} 
                disabled={isSaving || isPublishing}
                className="gap-2"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save Draft'}
              </Button>
              <div 
                className={cn("inline-flex", hasValidationErrors && "cursor-not-allowed")}
                title={hasValidationErrors ? "Cannot publish with validation errors" : ""}
              >
                <Button 
                  onClick={onPublish} 
                  disabled={isSaving || isPublishing || hasValidationErrors}
                  className="gap-2"
                >
                  <UploadCloud className="w-4 h-4" />
                  {isPublishing ? 'Publishing...' : 'Publish'}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 dark:bg-gray-900 px-3 py-1.5 rounded-md border">
              <AlertCircle className="w-4 h-4" />
              This version is published and cannot be modified.
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 ml-14">
        <div className="rounded-md border bg-slate-50 px-3 py-1.5 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          <span className="font-semibold">SSOT:</span> {canonicalSource} · source {sourceCommit}
        </div>
        <div className="rounded-md border bg-slate-50 px-3 py-1.5 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          <span className="font-semibold">Review gate:</span> {hasValidationErrors ? 'blocked by validation' : 'validation clear'}
        </div>
        <div className="rounded-md border bg-slate-50 px-3 py-1.5 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          <span className="font-semibold">Migration:</span> publish creates a new immutable version
        </div>
        {pack.publishedBundleHash && (
          <DomainPackDigestDisplay label="Bundle Hash" digest={pack.publishedBundleHash} />
        )}
        {pack.derivedGraphDigest && (
          <DomainPackDigestDisplay label="Graph Digest" digest={pack.derivedGraphDigest} />
        )}
        {pack.derivedReducerDigest && (
          <DomainPackDigestDisplay label="Reducer Digest" digest={pack.derivedReducerDigest} />
        )}
        {pack.derivedTestProfileDigest && (
          <DomainPackDigestDisplay label="Profile Digest" digest={pack.derivedTestProfileDigest} />
        )}
      </div>

      {pack.activePinnedRunVersions?.length > 0 && (
        <div className="ml-14 mt-2">
          <p className="text-sm text-gray-500 flex gap-2 items-center">
            <span className="font-medium">Active Pinned Runs:</span>
            {pack.activePinnedRunVersions.map(v => (
              <span key={v} className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded text-xs">
                {v}
              </span>
            ))}
          </p>
        </div>
      )}
    </div>
  )
}
