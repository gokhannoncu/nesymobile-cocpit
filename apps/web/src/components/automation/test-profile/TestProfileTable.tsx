'use client'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@nesy/metronic/components/ui/table'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { TestProfileKindBadge } from './TestProfileKindBadge'
import Link from 'next/link'

export function TestProfileTable({ items }: { items: any[] }) {
  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Profile</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Release Gate</TableHead>
            <TableHead>Owner</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium">
                <Link href={`/automation/test-profiles/${item.key || 'demo'}`} className="hover:underline">
                  {item.displayName || item.key || `Profile ${i}`}
                </Link>
                {item.preview && <Badge variant="secondary" className="ml-2 text-[10px]">PREVIEW</Badge>}
              </TableCell>
              <TableCell><TestProfileKindBadge kind={item.kind || 'SMOKE'} /></TableCell>
              <TableCell>
                {item.blockedReason ? (
                  <Badge variant="destructive">BLOCKED</Badge>
                ) : (
                  <Badge variant="outline" className="text-green-600 border-green-200">READY</Badge>
                )}
              </TableCell>
              <TableCell>{item.releaseGate ? 'Yes' : 'No'}</TableCell>
              <TableCell className="text-muted-foreground">{item.owner || 'Unowned'}</TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow><TableCell colSpan={5} className="text-center py-4">No profiles found.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
