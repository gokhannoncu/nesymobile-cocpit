'use client'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@nesy/metronic/components/ui/table'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { CampaignTypeBadge } from './CampaignTypeBadge'
import Link from 'next/link'

export function CampaignTable({ items }: { items: any[] }) {
  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Campaign</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Failed Cells</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium">
                <Link href={`/automation/test-campaigns/${item.campaignId || 'demo'}`} className="hover:underline">
                  {item.campaignId}
                </Link>
              </TableCell>
              <TableCell><CampaignTypeBadge type={item.type || 'NIGHTLY'} /></TableCell>
              <TableCell>
                {item.partial ? <Badge variant="secondary">IN PROGRESS</Badge> : <Badge variant="outline">COMPLETED</Badge>}
              </TableCell>
              <TableCell>
                {item.failedCells?.length > 0 ? (
                  <span className="text-destructive font-medium">{item.failedCells.length}</span>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow><TableCell colSpan={4} className="text-center py-4">No campaigns found.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
