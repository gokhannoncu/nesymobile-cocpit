import { tickets as pmTickets } from '@/data/pm/tickets'
import type { FeatureDetail } from './nesy-types'
import { FEATURE_TICKET_IDS } from './feature-ticket-links'

const ticketById = new Map(pmTickets.map((ticket) => [ticket.id, ticket]))

export function resolveFeatureTickets(featureId: string): FeatureDetail['tickets'] {
  const ids = FEATURE_TICKET_IDS[featureId] ?? []

  return ids
    .map((id) => ticketById.get(id))
    .filter((ticket): ticket is NonNullable<typeof ticket> => Boolean(ticket))
    .map((ticket) => ({
      id: String(ticket.id),
      title: ticket.title,
      status: ticket.status,
      url: ticket.gh_url,
    }))
}
