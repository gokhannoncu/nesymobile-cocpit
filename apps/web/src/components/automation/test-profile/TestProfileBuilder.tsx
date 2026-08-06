'use client'
import { Button } from '@nesy/metronic/components/ui/button'

export function TestProfileBuilder({ profile }: { profile?: any }) {
  // Simple stub for builder form
  return (
    <div className="border rounded-md p-4 space-y-4">
      <h3 className="font-medium">Profile Builder</h3>
      <p className="text-sm text-muted-foreground">Form for editing profile. Kind-specific validation applies.</p>
      <div className="flex justify-end">
        <Button size="sm">Save Configuration</Button>
      </div>
    </div>
  )
}
