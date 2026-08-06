'use client'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@nesy/metronic/components/ui/table'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { TestProfileKindBadge } from './TestProfileKindBadge'
import Link from 'next/link'
import type { TestProfileCatalogItemApi } from '@/lib/verdict-runtime/types'

/**
 * Renders the profile catalog DTO as-is. Earlier this component read `key` and
 * `displayName`, which the runtime never sends, so rows fell back to
 * "Profile <index>" and every link pointed at a literal `demo` id.
 */
export function TestProfileTable({ items }: { items: TestProfileCatalogItemApi[] }) {
  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Profile</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Last Result</TableHead>
            <TableHead>Release Gate</TableHead>
            <TableHead>Owner</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={`${item.profileKey}@${item.version}`}>
              <TableCell className="font-medium">
                <Link
                  href={`/automation/test-profiles/${encodeURIComponent(item.profileKey)}`}
                  className="hover:underline"
                >
                  {item.profileKey}
                </Link>
                <span className="text-muted-foreground ml-2 text-xs">v{item.version}</span>
                {item.kind === 'PREVIEW' && (
                  <Badge variant="secondary" className="ml-2 text-[10px]">PREVIEW</Badge>
                )}
              </TableCell>
              <TableCell><TestProfileKindBadge kind={item.kind} /></TableCell>
              <TableCell>
                {item.blockedReason ? (
                  <Badge variant="destructive" title={item.blockedReason}>BLOCKED</Badge>
                ) : (
                  <Badge variant="outline">{item.lastResult}</Badge>
                )}
              </TableCell>
              <TableCell>{item.releaseGate ? 'Yes' : 'No'}</TableCell>
              <TableCell className="text-muted-foreground">{item.owner}</TableCell>
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
