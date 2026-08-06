'use client';

import React from 'react';
import { Rocket, Smartphone, Shield, Power } from 'lucide-react';

export function LaunchProfileBuilder() {
  return (
    <div className="p-4 bg-white border rounded-lg shadow-sm">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b">
        <Rocket size={18} className="text-indigo-600" />
        <h3 className="font-semibold text-sm">Launch Profile</h3>
      </div>

      <div className="space-y-4">
        {/* Process Config */}
        <div>
          <h4 className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-2">
            <Smartphone size={14} /> Process Configuration
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="App Package (e.g. com.example.app)" className="text-xs border rounded p-1.5 col-span-2" />
            <input type="text" placeholder="Activity (optional)" className="text-xs border rounded p-1.5 col-span-2" />
          </div>
        </div>

        {/* Readiness */}
        <div>
          <h4 className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-2">
            <Shield size={14} /> Readiness Checks
          </h4>
          <select className="w-full text-xs border rounded p-1.5 bg-gray-50 mb-2">
            <option value="FULL">FULL (Check Device, Network, SDKs)</option>
            <option value="QUICK">QUICK (Check App Install Only)</option>
            <option value="TARGETED">TARGETED (Custom Rules)</option>
          </select>
        </div>

        {/* Entry Point */}
        <div>
          <h4 className="text-xs font-medium text-gray-700 mb-2">Entry Point</h4>
          <input type="text" placeholder="Deep Link URI (optional)" className="w-full text-xs border rounded p-1.5" />
        </div>

        {/* Cleanup */}
        <div>
          <h4 className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-2">
            <Power size={14} /> Post-Run Cleanup
          </h4>
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" defaultChecked /> Clear App Data
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" /> Uninstall App
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" defaultChecked /> Reset Device State (Settings)
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
