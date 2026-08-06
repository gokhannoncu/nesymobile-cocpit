'use client';

import React from 'react';
import { Database, Activity, LayoutTemplate, Wifi, Plus } from 'lucide-react';

export function EvidenceSourceRegistry() {
  const sources = [
    { id: 1, name: 'Main Activity Screen', kind: 'SCREEN_STATE', authority: 'PRIMARY', lane: 'Ordered Bus' },
    { id: 2, name: 'API Responses', kind: 'NETWORK', authority: 'SECONDARY', lane: 'Receipt Bus' },
    { id: 3, name: 'Analytics SDK', kind: 'SDK_EVENT', authority: 'SUPPLEMENTARY', lane: 'Receipt Bus' },
  ];

  const getIcon = (kind: string) => {
    switch (kind) {
      case 'SCREEN_STATE': return <LayoutTemplate size={14} className="text-blue-500" />;
      case 'NETWORK': return <Wifi size={14} className="text-purple-500" />;
      default: return <Activity size={14} className="text-green-500" />;
    }
  };

  return (
    <div className="p-4 bg-white border rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-gray-700" />
          <h3 className="font-semibold text-sm">Evidence Source Registry</h3>
        </div>
        <button className="flex items-center gap-1 text-[10px] bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded font-medium">
          <Plus size={12} /> Add Source
        </button>
      </div>

      <div className="space-y-2">
        {sources.map(src => (
          <div key={src.id} className="p-2 border rounded hover:border-gray-300 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                {getIcon(src.kind)}
                <span className="font-medium text-sm">{src.name}</span>
              </div>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                src.authority === 'PRIMARY' ? 'bg-blue-100 text-blue-700' :
                src.authority === 'SECONDARY' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {src.authority}
              </span>
            </div>
            
            <div className="flex gap-4 text-[10px] text-gray-500 mt-2">
              <div>Kind: <span className="font-mono text-gray-700">{src.kind}</span></div>
              <div>Lane: <span className="text-gray-700">{src.lane}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
