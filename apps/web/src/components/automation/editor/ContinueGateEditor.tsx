'use client'

import React, { useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import {
  VerdictPanelFieldLabel,
  VerdictPanelHeader,
  VerdictPanelSelect,
  VerdictPanelTextarea,
  type VerdictPanelSelectOption,
} from './VerdictPanelFields'

const EVIDENCE_SOURCES: VerdictPanelSelectOption[] = [
  { value: 'NETWORK', label: 'App Network Traffic' },
  { value: 'SCREEN', label: 'Screen State Analysis' },
  { value: 'LOG', label: 'Log Stream' },
]

const FAILURE_ACTIONS: VerdictPanelSelectOption[] = [
  { value: 'HALT', label: 'Halt execution' },
  { value: 'RETRY', label: 'Retry previous step' },
  { value: 'ESCALATE', label: 'Escalate to manual' },
]

export function ContinueGateEditor() {
  const [evidenceSource, setEvidenceSource] = useState('NETWORK')
  const [failureAction, setFailureAction] = useState('HALT')
  const [gateExpression, setGateExpression] = useState('')

  return (
    <div className="p-3">
      <VerdictPanelHeader
        icon={ShieldAlert}
        title="Continue Gate"
        description="Evaluated between steps to allow or block progression."
        iconClassName="text-orange-600"
      />

      <div className="space-y-3">
        <div>
          <VerdictPanelFieldLabel htmlFor="continue-gate-evidence">Evidence source</VerdictPanelFieldLabel>
          <VerdictPanelSelect
            id="continue-gate-evidence"
            value={evidenceSource}
            onValueChange={setEvidenceSource}
            options={EVIDENCE_SOURCES}
          />
        </div>

        <div>
          <VerdictPanelFieldLabel htmlFor="continue-gate-expression">Gate expression</VerdictPanelFieldLabel>
          <VerdictPanelTextarea
            id="continue-gate-expression"
            rows={2}
            value={gateExpression}
            onChange={setGateExpression}
            placeholder="$.status == 'SUCCESS'"
            mono
          />
        </div>

        <div>
          <VerdictPanelFieldLabel htmlFor="continue-gate-failure">Failure action</VerdictPanelFieldLabel>
          <VerdictPanelSelect
            id="continue-gate-failure"
            value={failureAction}
            onValueChange={setFailureAction}
            options={FAILURE_ACTIONS}
            tone="danger"
          />
        </div>
      </div>
    </div>
  )
}
