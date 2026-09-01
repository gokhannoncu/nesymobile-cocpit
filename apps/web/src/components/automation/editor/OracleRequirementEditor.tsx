'use client'

import React, { useState } from 'react'
import { Scale } from 'lucide-react'
import {
  VerdictPanelFieldLabel,
  VerdictPanelHeader,
  VerdictPanelInput,
  VerdictPanelSelect,
  type VerdictPanelSelectOption,
} from './VerdictPanelFields'

const OBLIGATIONS: VerdictPanelSelectOption[] = [
  { value: 'REQUIRED', label: 'Required' },
  { value: 'OPTIONAL', label: 'Optional' },
  { value: 'INFORMATIONAL', label: 'Informational' },
]

const TIMINGS: VerdictPanelSelectOption[] = [
  { value: 'IMMEDIATE', label: 'Immediate' },
  { value: 'DEFERRED', label: 'Deferred' },
  { value: 'EVENTUAL', label: 'Eventual' },
]

const TIMEOUT_ACTIONS: VerdictPanelSelectOption[] = [
  { value: 'FAIL', label: 'Fail workflow' },
  { value: 'WARN', label: 'Warn only' },
  { value: 'SKIP', label: 'Skip evaluation' },
]

export function OracleRequirementEditor() {
  const [obligation, setObligation] = useState('REQUIRED')
  const [timing, setTiming] = useState('IMMEDIATE')
  const [deadline, setDeadline] = useState('')
  const [timeoutAction, setTimeoutAction] = useState('FAIL')

  return (
    <div className="p-3">
      <VerdictPanelHeader
        icon={Scale}
        title="Oracle Requirement"
        description="Defines when and how strictly an oracle must be satisfied."
        iconClassName="text-teal-600"
      />

      <div className="space-y-3">
        <div>
          <VerdictPanelFieldLabel htmlFor="oracle-requirement-obligation">Obligation</VerdictPanelFieldLabel>
          <VerdictPanelSelect
            id="oracle-requirement-obligation"
            value={obligation}
            onValueChange={setObligation}
            options={OBLIGATIONS}
          />
        </div>

        <div>
          <VerdictPanelFieldLabel htmlFor="oracle-requirement-timing">Timing</VerdictPanelFieldLabel>
          <VerdictPanelSelect
            id="oracle-requirement-timing"
            value={timing}
            onValueChange={setTiming}
            options={TIMINGS}
          />
        </div>

        <div>
          <VerdictPanelFieldLabel htmlFor="oracle-requirement-deadline">Deadline</VerdictPanelFieldLabel>
          <VerdictPanelInput
            id="oracle-requirement-deadline"
            value={deadline}
            onChange={setDeadline}
            placeholder="e.g. 5000ms, 10s"
          />
        </div>

        <div>
          <VerdictPanelFieldLabel htmlFor="oracle-requirement-timeout">On timeout action</VerdictPanelFieldLabel>
          <VerdictPanelSelect
            id="oracle-requirement-timeout"
            value={timeoutAction}
            onValueChange={setTimeoutAction}
            options={TIMEOUT_ACTIONS}
            tone={timeoutAction === 'FAIL' ? 'danger' : 'default'}
          />
        </div>
      </div>
    </div>
  )
}
