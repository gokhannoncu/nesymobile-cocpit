import type { FeatureDomain, FeatureDomainId } from './nesy-types'

export const FEATURE_DOMAINS: FeatureDomain[] = [
  {
    id: 'payments-fiscal',
    title: 'Payments & Fiscal',
    desc: 'Cash/card collection, skip rules, and fiscal receipt printing at delivery or pickup.',
  },
  {
    id: 'delivery-outcomes',
    title: 'Delivery Outcomes',
    desc: 'Doorstep completion: failure evidence, consignee, signature, and alternate delivery points.',
  },
  {
    id: 'pickup-operations',
    title: 'Pickup Operations',
    desc: 'Pickup assignment, on-site variants, failed reasons, and next-day reassignment.',
  },
  {
    id: 'tour-stops',
    title: 'Tour & Stops',
    desc: 'Stop creation/merge, beginning-of-day tour approval, and HC event list.',
  },
  {
    id: 'tracking-self-service',
    title: 'Tracking & Self-service',
    desc: 'Shipment tracking UI, Ebranch delivery options, and D4Me locker flows.',
  },
]

export function getFeatureDomain(id: FeatureDomainId): FeatureDomain | undefined {
  return FEATURE_DOMAINS.find((domain) => domain.id === id)
}
