'use client';

import React from 'react';
import { Gavel, CheckSquare } from 'lucide-react';

export function FinalOracleEditor() {
  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Gavel size={16} className="text-blue-700" />
        <h3 className="font-semibold text-sm text-blue-900">Final Oracle</h3>
      </div>
      <p className="text-[10px] text-blue-700 mb-4 flex items-center gap-1">
        <CheckSquare size={10} /> Evaluated at the end of the workflow run to determine final PASS/FAIL.
      </p>
      
      <div className="space-y-3 bg-white p-3 rounded border border-blue-100">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Oracle Template</label>
          <select className="w-full text-xs border rounded p-1.5">
            <option>Strict Data Match</option>
            <option>Fuzzy Visual Match</option>
            <option>State Transition Validator</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Verdict Criteria</label>
          <textarea 
            rows={3} 
            className="w-full text-xs border rounded p-1.5 font-mono"
            placeholder="assert($.finalState.isComplete == true)"
          />
        </div>

        <div className="p-2 bg-gray-50 rounded border text-[10px] text-gray-600">
          <strong>Note:</strong> A failure here will result in a workflow run FAILURE, regardless of cleanup status.
        </div>
      </div>
    </div>
  );
}
