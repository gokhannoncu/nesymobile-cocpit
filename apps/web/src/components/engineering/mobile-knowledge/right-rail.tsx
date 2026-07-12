'use client'

// Sağ sabit bilgi rayı — On this page (anchor'lar) + Metadata + Related.

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { DocStatusBadge } from './badges'
import { COUNTRY_LABELS, type DocMeta, type RelatedLink } from '@/data/engineering/mobile-knowledge/types'

export interface RailSection {
  id: string
  label: string
}

function MetaRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-end font-medium">{value}</span>
    </div>
  )
}

export function RightRail({
  sections,
  meta,
  related,
}: {
  sections: RailSection[]
  meta: DocMeta
  related?: RelatedLink[]
}) {
  return (
    <aside className="hidden w-64 shrink-0 xl:block">
      <div className="sticky top-24 space-y-6">
        {sections.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              On this page
            </p>
            <ul className="space-y-1 border-s">
              {sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="-ms-px block border-s border-transparent py-0.5 ps-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Metadata
          </p>
          <div className="space-y-1.5 rounded-lg border bg-card p-3">
            <MetaRow label="Owner" value={meta.owner} />
            <MetaRow label="Reviewer" value={meta.reviewer} />
            <MetaRow label="Version" value={meta.version} />
            <MetaRow
              label="Countries"
              value={meta.countries.map((c) => COUNTRY_LABELS[c]).join(', ')}
            />
            <MetaRow label="Last verified" value={meta.lastVerified} />
            <MetaRow label="Next review" value={meta.nextReview} />
            <div className="flex justify-between gap-3 pt-1 text-xs">
              <span className="text-muted-foreground">Status</span>
              <DocStatusBadge status={meta.status} />
            </div>
          </div>
        </div>

        {related?.length ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Related
            </p>
            <ul className="space-y-1">
              {related.map((r) => (
                <li key={r.label}>
                  {r.href ? (
                    <Link
                      href={r.href}
                      className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      {r.label}
                      <ArrowUpRight className="size-3 shrink-0" />
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">{r.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
