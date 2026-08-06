'use client';

import React from 'react';
import { ShieldAlert, GitMerge } from 'lucide-react';

export function ContinueGateEditor() {
  return (
    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <ShieldAlert size={16} className="text-orange-600" />
        <h3 className="font-semibold text-sm text-orange-900">Continue Gate</h3>
      </div>
      <p className="text-[10px] text-orange-700 mb-4 flex items-center gap-1">
        <GitMerge size={10} /> Evaluated between steps to allow/block progression.
      </p>
      
      <div className="space-y-3 bg-white p-3 rounded border border-orange-100">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Evidence Source</label>
          <select className="w-full text-xs border rounded p-1.5">
            <option>App Network Traffic</option>
            <option>Screen State Analysis</option>
            <option>Log Stream</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Gate Expression</label>
          <textarea 
            rows={2} 
            className="w-full text-xs border rounded p-1.5 font-mono"
            placeholder="$.status == 'SUCCESS'"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Failure Action</label>
          <select className="w-full text-xs border rounded p-1.5 text-red-600">
            <option value="HALT">HALT Execution</option>
            <option value="RETRY">RETRY Previous Step</option>
            <option value="ESCALATE">ESCALATE to Manual</option>
          </select>
        </div>
      </div>
    </div>
  );
}
