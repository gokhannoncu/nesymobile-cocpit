'use client'

import React, { useState } from 'react'
import { Gavel } from 'lucide-react'
import {
  VerdictPanelFieldLabel,
  VerdictPanelHeader,
  VerdictPanelNote,
  VerdictPanelSelect,
  VerdictPanelTextarea,
  type VerdictPanelSelectOption,
} from './VerdictPanelFields'

const ORACLE_TEMPLATES: VerdictPanelSelectOption[] = [
  { value: 'STRICT', label: 'Strict data match' },
  { value: 'FUZZY', label: 'Fuzzy visual match' },
  { value: 'STATE', label: 'State transition validator' },
]

export function FinalOracleEditor() {
  const [oracleTemplate, setOracleTemplate] = useState('STRICT')
  const [verdictCriteria, setVerdictCriteria] = useState('')

  return (
    <div className="p-3">
      <VerdictPanelHeader
        icon={Gavel}
        title="Final Oracle"
        description="Evaluated at workflow end to determine final pass or fail."
        iconClassName="text-blue-700"
      />

      <div className="space-y-3">
        <div>
          <VerdictPanelFieldLabel htmlFor="final-oracle-template">Oracle template</VerdictPanelFieldLabel>
          <VerdictPanelSelect
            id="final-oracle-template"
            value={oracleTemplate}
            onValueChange={setOracleTemplate}
            options={ORACLE_TEMPLATES}
          />
        </div>

        <div>
          <VerdictPanelFieldLabel htmlFor="final-oracle-criteria">Verdict criteria</VerdictPanelFieldLabel>
          <VerdictPanelTextarea
            id="final-oracle-criteria"
            rows={3}
            value={verdictCriteria}
            onChange={setVerdictCriteria}
            placeholder="assert($.finalState.isComplete == true)"
            mono
          />
        </div>

        <VerdictPanelNote>
          <strong className="font-semibold text-slate-700">Note:</strong> A failure here marks the workflow run as
          failed, regardless of cleanup status.
        </VerdictPanelNote>
      </div>
    </div>
  )
}
