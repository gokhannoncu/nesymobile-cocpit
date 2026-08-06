'use client'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@nesy/metronic/components/ui/table'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { CampaignTypeBadge } from './CampaignTypeBadge'
import Link from 'next/link'
import type { TestCampaignCatalogItemApi } from '@/lib/verdict-runtime/types'

/**
 * Renders exactly the fields the campaign catalog DTO carries. Cell-level
 * failures are not part of the catalog response and are shown on the campaign
 * detail page instead of being guessed here.
 */
export function CampaignTable({ items }: { items: TestCampaignCatalogItemApi[] }) {
  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Campaign</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Cells</TableHead>
            <TableHead>Release Gate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.campaignId}>
              <TableCell className="font-medium">
                <Link
                  href={`/automation/test-campaigns/${encodeURIComponent(item.campaignId)}`}
                  className="hover:underline"
                >
                  {item.campaignId}
                </Link>
              </TableCell>
              <TableCell><CampaignTypeBadge type={item.campaignKey} /></TableCell>
              <TableCell><Badge variant="outline">{item.status}</Badge></TableCell>
              <TableCell>{item.cellCount}</TableCell>
              <TableCell>
                {item.releaseGateResult === 'NOT_EVALUATED' ? (
                  <span className="text-muted-foreground">NOT_EVALUATED</span>
                ) : (
                  <Badge variant="secondary">{item.releaseGateResult}</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow><TableCell colSpan={5} className="text-center py-4">No campaigns found.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
