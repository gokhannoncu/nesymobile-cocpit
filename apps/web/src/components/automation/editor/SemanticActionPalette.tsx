'use client';

import React, { useState } from 'react';
import { Search, Zap, MousePointer2, Type, Eye, Database } from 'lucide-react';

const ACTIONS = [
  { id: 'tap', name: 'Tap Element', category: 'Interaction', icon: MousePointer2, desc: 'Tap on a UI element', target: 'UI Node' },
  { id: 'type', name: 'Type Text', category: 'Interaction', icon: Type, desc: 'Enter text into an input field', target: 'Input Node' },
  { id: 'assert_visible', name: 'Assert Visible', category: 'Validation', icon: Eye, desc: 'Verify an element is visible on screen', target: 'UI Node' },
  { id: 'query_db', name: 'Query Database', category: 'Data', icon: Database, desc: 'Fetch data from local storage/db', target: 'Database' },
  { id: 'api_call', name: 'API Call', category: 'Network', icon: Zap, desc: 'Make a network request', target: 'Endpoint' },
];

export function SemanticActionPalette() {
  const [search, setSearch] = useState('');

  const filteredActions = ACTIONS.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase()) || 
    a.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      <div className="p-3 border-b border-gray-200">
        <h3 className="font-semibold text-sm mb-2">Semantic Actions</h3>
        <div className="relative">
          <Search size={14} className="absolute left-2 top-2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search actions..." 
            className="w-full pl-8 pr-2 py-1.5 text-xs border rounded bg-gray-50 focus:bg-white outline-none focus:ring-1 focus:ring-blue-500"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto p-2 space-y-4">
        {['Interaction', 'Validation', 'Data', 'Network'].map(cat => {
          const catActions = filteredActions.filter(a => a.category === cat);
          if (catActions.length === 0) return null;
          return (
            <div key={cat}>
              <h4 className="text-xs font-medium text-gray-500 mb-2 px-1 uppercase tracking-wider">{cat}</h4>
              <div className="space-y-2">
                {catActions.map(action => (
                  <div 
                    key={action.id}
                    className="flex flex-col p-2 bg-white border border-gray-200 rounded cursor-grab hover:border-blue-400 hover:shadow-sm transition-all"
                    draggable
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <action.icon size={14} className="text-blue-600" />
                      <span className="text-sm font-medium">{action.name}</span>
                    </div>
                    <span className="text-[10px] text-gray-500 leading-tight">{action.desc}</span>
                    <span className="text-[9px] mt-1 text-gray-400 font-mono bg-gray-50 px-1 py-0.5 rounded w-fit">Target: {action.target}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
