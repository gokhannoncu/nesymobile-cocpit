'use client';

import React from 'react';
import { Target, AlertCircle } from 'lucide-react';

export function TargetFingerprintForm() {
  return (
    <div className="p-4 bg-white border rounded-lg shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Target size={16} className="text-blue-600" />
        <h3 className="font-semibold text-sm">Target Fingerprint</h3>
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Primary Identifier (rowKey) <span className="text-red-500">*</span>
          </label>
          <input type="text" placeholder="Unique business ID..." className="w-full text-xs border rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none" />
          <p className="text-[10px] text-gray-500 mt-0.5">The primary, stable identifier for this target.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Secondary Hint (rowIndexHint)</label>
          <input type="number" placeholder="e.g. 0" className="w-full text-xs border rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none" />
          <div className="flex items-start gap-1 mt-1 text-[10px] text-yellow-600 bg-yellow-50 p-1 rounded">
            <AlertCircle size={10} className="mt-0.5 shrink-0" />
            <span>Warning: Layout indices are fragile and prone to drift.</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">resourceId</label>
            <input type="text" className="w-full text-xs border rounded p-1.5" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">text</label>
            <input type="text" className="w-full text-xs border rounded p-1.5" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">className</label>
            <input type="text" className="w-full text-xs border rounded p-1.5" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">contentDescription</label>
            <input type="text" className="w-full text-xs border rounded p-1.5" />
          </div>
        </div>

        <div className="mt-4 p-2 bg-gray-50 border rounded flex justify-between items-center">
          <span className="text-xs font-medium text-gray-600">Fingerprint Strength</span>
          <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded">STRONG</span>
        </div>
      </div>
    </div>
  );
}
