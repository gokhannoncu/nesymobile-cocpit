'use client'

import { Building2, CreditCard, Globe, MapPin, Zap } from 'lucide-react'
import {
  Callout,
  CardGrid,
  ComparisonTable,
  HeroCallout,
  InfoCard,
  PageSection,
  ProductPage,
  type Tone,
} from '@/components/product'
import { COUNTRIES, TOTAL_FEATURES, supportedCount } from '@/data/product/nesy'

const statusTone: Record<string, Tone> = {
  Global: 'indigo',
  Active: 'green',
  Advanced: 'purple',
  Limited: 'gray',
}

// Key differentiators of country packages — summary derived from the matrix.
const highlights: Record<string, string[]> = {
  core: [
    'Default behavior of the full feature set',
    'Cash + credit card collection, VPFR fiscalization',
    'Automatic pickup assignment (job runs every 3 minutes)',
  ],
  hr: [
    'Credit card collection via Raipay',
    'No fiscalization; pickup assignment is manual via dispatcher',
    'Additional parcels after the first tour are automatically approved',
  ],
  si: [
    'Credit card collection via Softpos',
    'CPP and Red Label out of scope; limited failed-reason list',
    'Inactive PAC task does not block end-of-day',
  ],
  rs: [
    'Fiscalization (VPFR) same as CORE — broadest scope',
    'Softpos integration in progress; digital signature optional',
    'D4Me integration with 14-digit Legacy ID mapping',
  ],
  ba: [
    'Cash collection only; photo proof not available',
    'Parcelshop / locker delivery out of scope',
    'Additional PICK event in the event list',
  ],
  me: [
    'Cash collection only; Red Label out of scope',
    'Parcelshop / locker delivery out of scope',
    'Additional RETS (Return to Sender) event in the event list',
  ],
  sk: [
    'In onboarding phase — behaviors not yet defined',
    'Feature set will be defined via the Country Matrix',
  ],
}

export default function CountryProfilesPage() {
  return (
    <ProductPage path="/product/country-profiles">
      <HeroCallout
        icon={Globe}
        eyebrow="Capabilities & Countries"
        tone="orange"
        title="Country packages: same core, local behavior."
        lead="Each country layers its own payment provider, fiscalization rules, and operations model on top of the CORE infrastructure. This page is a commercial and operational summary of the packages."
        chips={['CORE + 6 countries', 'Balkans & Central Europe']}
      />

      <PageSection
        eyebrow="Packages"
        title="Country Packages"
        icon={MapPin}
        tone="orange"
        description="The scope count is the number of active (not out-of-scope or undefined) features in that country."
      >
        <CardGrid cols={3}>
          {COUNTRIES.map((c) => (
            <InfoCard
              key={c.id}
              icon={c.id === 'core' ? Building2 : MapPin}
              tone={statusTone[c.status] ?? 'gray'}
              eyebrow={c.status}
              title={`${c.name} — ${c.subtitle}`}
              desc={`${c.price} · ${supportedCount(c.id)}/${TOTAL_FEATURES} features active${c.isPopular ? ' · Most popular package' : ''}`}
              bullets={highlights[c.id]}
              href="/product/country-matrix"
            />
          ))}
        </CardGrid>
      </PageSection>

      <PageSection
        eyebrow="Local Differences"
        title="Payment and fiscalization summary"
        icon={CreditCard}
        tone="purple"
        description="The most common source of country behavior differences: collection provider and fiscal requirements."
      >
        <ComparisonTable
          headers={[
            { label: 'Country' },
            { label: 'Cash', tone: 'green' },
            { label: 'Credit Card', tone: 'blue' },
            { label: 'Fiscalization', tone: 'purple' },
          ]}
          rows={[
            ['CORE', 'Yes', 'Yes', 'VPFR — on delivery and CPP collection'],
            ['Scale HR · Croatia', 'Yes', 'Raipay', 'No'],
            ['Scale SI · Slovenia', 'Yes', 'Softpos', 'No'],
            ['Scale Plus RS · Serbia', 'Yes', 'Softpos (to be integrated)', 'VPFR — same as CORE'],
            ['Start BA · Bosnia', 'Yes', 'No', 'No'],
            ['Start ME · Montenegro', 'Yes', 'No', 'No'],
            ['Scale SK · Slovakia', '—', '—', '—'],
          ]}
          highlightCol={0}
        />
      </PageSection>

      <Callout icon={Zap} title="New country launch" tone="orange">
        A new country is first defined as a column in the Country Matrix (as in the Scale SK
        example). As behaviors are clarified feature by feature, the matrix is filled in; the package
        only moves to &quot;Active&quot; status once the matrix is complete.
      </Callout>
    </ProductPage>
  )
}
