'use client';

import React from 'react';
import { Scale, Clock } from 'lucide-react';

export function OracleRequirementEditor() {
  return (
    <div className="p-4 bg-white border rounded-lg shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Scale size={16} className="text-teal-600" />
        <h3 className="font-semibold text-sm">Oracle Requirement</h3>
      </div>
      
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Obligation</label>
            <select className="w-full text-xs border rounded p-1.5 bg-gray-50">
              <option value="REQUIRED">REQUIRED</option>
              <option value="OPTIONAL">OPTIONAL</option>
              <option value="INFORMATIONAL">INFORMATIONAL</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Timing</label>
            <select className="w-full text-xs border rounded p-1.5 bg-gray-50">
              <option value="IMMEDIATE">IMMEDIATE</option>
              <option value="DEFERRED">DEFERRED</option>
              <option value="EVENTUAL">EVENTUAL</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
            <Clock size={12} /> Deadline
          </label>
          <input type="text" placeholder="e.g. 5000ms, 10s" className="w-full text-xs border rounded p-1.5" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">On Timeout Action</label>
          <select className="w-full text-xs border rounded p-1.5 bg-gray-50">
            <option value="FAIL">FAIL Workflow</option>
            <option value="WARN">WARN only</option>
            <option value="SKIP">SKIP evaluation</option>
          </select>
        </div>
      </div>
    </div>
  );
}
