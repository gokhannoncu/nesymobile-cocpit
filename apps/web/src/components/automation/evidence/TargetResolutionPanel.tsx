'use client';

import React from 'react';
import { Target, Search, ArrowRight, Zap } from 'lucide-react';

export function TargetResolutionPanel() {
  return (
    <div className="p-4 bg-white border rounded-lg shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Target size={16} className="text-indigo-600" />
        <h3 className="font-semibold text-sm">Target Resolution Chain</h3>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          {/* Provider 1 */}
          <div className="flex items-start gap-3 p-2 bg-gray-50 rounded border">
            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 text-xs font-bold">1</div>
            <div>
              <h4 className="text-xs font-semibold">Semantic Matcher</h4>
              <p className="text-[10px] text-gray-500">Strategy: Exact ID + Content Desc</p>
              <div className="mt-1 text-[10px] bg-green-100 text-green-700 px-1 py-0.5 rounded inline-block">High Confidence (0.95)</div>
            </div>
          </div>

          <div className="flex justify-center -my-1 text-gray-300">
            <ArrowRight size={14} className="rotate-90" />
          </div>

          {/* Provider 2 */}
          <div className="flex items-start gap-3 p-2 bg-gray-50 rounded border opacity-75">
            <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center shrink-0 text-xs font-bold">2</div>
            <div>
              <h4 className="text-xs font-semibold">Fuzzy Text Resolver</h4>
              <p className="text-[10px] text-gray-500">Strategy: Levenshtein Distance &lt; 2</p>
              <div className="mt-1 text-[10px] bg-gray-200 text-gray-600 px-1 py-0.5 rounded inline-block">Fallback only</div>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t">
          <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
            <Zap size={12} className="text-yellow-500" /> Ambiguity Handling
          </h4>
          <p className="text-[10px] text-gray-600 mb-2">If multiple elements match the fingerprint:</p>
          <select className="w-full text-xs border rounded p-1.5 bg-gray-50">
            <option>Fail Workflow (Strict)</option>
            <option>Use First Match (Document Order)</option>
            <option>Prompt User for Resolution</option>
          </select>
        </div>
      </div>
    </div>
  );
}
