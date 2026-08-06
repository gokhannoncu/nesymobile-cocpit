'use client';

import React, { useState } from 'react';
import { Link2, Plus, Trash2 } from 'lucide-react';

export function EntityBindingEditor() {
  const [bindings, setBindings] = useState([
    { id: 1, entity: 'UserAccount', query: '$.currentUser.id' }
  ]);

  return (
    <div className="p-4 bg-white border rounded-lg shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Link2 size={16} className="text-purple-600" />
        <h3 className="font-semibold text-sm">Entity Bindings</h3>
      </div>
      
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_2fr_auto] gap-2 items-end">
          <div>
            <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Entity</label>
            <select className="w-full text-xs border rounded p-1.5 bg-gray-50">
              <option>UserAccount</option>
              <option>ProductItem</option>
              <option>OrderSession</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Query Resolution</label>
            <input type="text" placeholder="e.g. $.data.id" className="w-full text-xs border rounded p-1.5 font-mono" />
          </div>
          <button className="bg-blue-600 text-white p-1.5 rounded hover:bg-blue-700">
            <Plus size={14} />
          </button>
        </div>

        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left py-2 px-2 font-medium text-gray-600">Entity</th>
              <th className="text-left py-2 px-2 font-medium text-gray-600">Query</th>
              <th className="text-right py-2 px-2 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bindings.map(b => (
              <tr key={b.id} className="border-b">
                <td className="py-2 px-2 font-medium">{b.entity}</td>
                <td className="py-2 px-2 font-mono text-gray-600">{b.query}</td>
                <td className="py-2 px-2 text-right">
                  <button className="text-red-500 hover:text-red-700">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {bindings.length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-center text-gray-500">No bindings defined.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
