'use client'

import { useParams, notFound } from 'next/navigation'
import { ProductPage } from '@/components/product'
import { KnowledgeNav, RightRail } from '@/components/engineering/mobile-knowledge'
import { BACKEND_DOMAINS, getBackendDomain } from '@/data/engineering/mobile-knowledge/backend-domains'
import { DomainView, domainRailSections } from './domain-view'

const BASE = '/engineering/mobile-knowledge/backend'

export default function BackendDomainPage() {
  const params = useParams()
  const slug = Array.isArray(params.domain) ? params.domain[0] : params.domain
  const domain = slug ? getBackendDomain(slug) : undefined

  if (!domain) {
    notFound()
  }

  const navGroups = [
    { items: BACKEND_DOMAINS.map((d) => ({ slug: d.slug, title: d.title, documented: d.documented })) },
  ]

  return (
    <ProductPage path={`${BASE}/${domain.slug}`} title={`Backend · ${domain.title}`}>
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="w-full shrink-0 lg:w-60">
          <KnowledgeNav groups={navGroups} basePath={BASE} activeSlug={domain.slug} />
        </div>
        <DomainView domain={domain} />
        <RightRail sections={domainRailSections(domain)} meta={domain.meta} />
      </div>
    </ProductPage>
  )
}
