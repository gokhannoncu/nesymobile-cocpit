'use client'
import { Alert, AlertDescription, AlertTitle } from '@nesy/metronic/components/ui/alert'
import { ShieldAlert } from 'lucide-react'

export function PreviewGateWarning({ releaseGate }: { releaseGate: boolean }) {
  if (!releaseGate) return null
  return (
    <Alert variant="destructive">
      <ShieldAlert className="w-4 h-4" />
      <AlertTitle>Configuration Conflict</AlertTitle>
      <AlertDescription>
        This is a PREVIEW profile but releaseGate is set to true. Preview profiles must NOT be release gates.
      </AlertDescription>
    </Alert>
  )
}
