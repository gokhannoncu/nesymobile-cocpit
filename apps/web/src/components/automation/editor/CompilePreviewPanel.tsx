'use client';

import React, { useState, useEffect } from 'react';
import { compileVerdictWorkflow } from '@/lib/verdict-runtime/client';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Copy, Terminal } from 'lucide-react';

export function CompilePreviewPanel({ workflowState }: { workflowState: any }) {
  const [compiling, setCompiling] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [autoCompile, setAutoCompile] = useState(false);

  const handleCompile = async () => {
    setCompiling(true);
    try {
      const data = await compileVerdictWorkflow({ workflow: workflowState });
      setResult(data);
    } catch (e) {
      console.error(e);
      setResult({ ok: false, issues: [{ severity: 'ERROR', message: 'Network or API error' }] });
    }
    setCompiling(false);
  };

  useEffect(() => {
    if (autoCompile) {
      const timer = setTimeout(() => {
        handleCompile();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [workflowState, autoCompile]);

  return (
    <div className="flex flex-col h-full border-l border-gray-200 bg-gray-50">
      <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Terminal size={16} /> Compile Preview
        </h3>
        <div className="flex gap-2 items-center">
          <label className="text-xs flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={autoCompile} onChange={e => setAutoCompile(e.target.checked)} />
            Auto-compile
          </label>
          <button 
            onClick={handleCompile} 
            disabled={compiling}
            className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
          >
            {compiling && <Loader2 size={12} className="animate-spin" />}
            Compile
          </button>
        </div>
      </div>

      <div className="p-4 bg-yellow-50 border-b border-yellow-200 text-yellow-800 text-xs flex gap-2">
        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
        <p><strong>Notice:</strong> YAML and Maestro preview panels are deprecated and will be removed in a future update. Please use the WorkflowCompileApi standard preview.</p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {!result && !compiling && (
          <div className="text-gray-500 text-sm text-center mt-10">Click Compile to generate the Verdict plan.</div>
        )}

        {result && (
          <div className="space-y-4">
            <div className={`p-3 rounded border ${result.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 font-medium">
                {result.ok ? <CheckCircle2 className="text-green-600" size={16} /> : <XCircle className="text-red-600" size={16} />}
                <span className={result.ok ? 'text-green-800' : 'text-red-800'}>
                  {result.ok ? 'Compilation Successful' : 'Compilation Failed'}
                </span>
              </div>
              {result.compiledPlanHash && (
                <div className="mt-2 text-xs flex items-center gap-2 text-gray-600">
                  Hash: <code className="bg-gray-100 px-1 rounded">{result.compiledPlanHash.substring(0, 8)}...</code>
                  <button className="hover:text-gray-900"><Copy size={12} /></button>
                </div>
              )}
            </div>

            {result.issues && result.issues.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Issues</h4>
                <div className="space-y-2">
                  {result.issues.map((issue: any, i: number) => (
                    <div key={i} className={`p-2 text-xs rounded border ${issue.severity === 'ERROR' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
                      <div className="font-medium">{issue.severity}</div>
                      <div>{issue.message}</div>
                      {issue.sourceLocation && (
                        <div className="mt-1 opacity-75 font-mono text-[10px]">Node: {issue.sourceLocation}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.sourceMap && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Source Map</h4>
                <div className="bg-white border rounded p-2 text-xs font-mono max-h-48 overflow-auto">
                  {JSON.stringify(result.sourceMap, null, 2)}
                </div>
              </div>
            )}
            
            {result.provenance && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Provenance</h4>
                <div className="bg-white border rounded p-2 text-xs font-mono">
                  {JSON.stringify(result.provenance, null, 2)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
