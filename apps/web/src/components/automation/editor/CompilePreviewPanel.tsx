'use client';

import React, { useState, useEffect } from 'react';
import { compileVerdictWorkflow, fetchVerdictDomainPacks } from '@/lib/verdict-runtime/client';
import { selectPinnedPublishedPack } from '@/lib/verdict-runtime/select-published-pack';
import type { DomainPackSummary } from '@/lib/verdict-runtime/types';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Copy } from 'lucide-react';

export function CompilePreviewPanel({ workflowState }: { workflowState: any }) {
  const [compiling, setCompiling] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [autoCompile, setAutoCompile] = useState(false);
  const [pack, setPack] = useState<DomainPackSummary | null>(null);
  const [packError, setPackError] = useState<string | null>(null);

  // A plan can only be attributed to a published Domain Pack, so the pack is
  // resolved before compiling rather than sending an unpinned request that the
  // runtime would (correctly) reject.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const catalog = await fetchVerdictDomainPacks();
        if (cancelled) return;
        const published = selectPinnedPublishedPack(catalog.items);
        setPack(published ?? null);
        setPackError(published ? null : 'No published Domain Pack to pin a compiled plan to.');
      } catch {
        if (!cancelled) setPackError('Domain Pack catalog unavailable.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCompile = async () => {
    if (!pack) return;
    setCompiling(true);
    try {
      const data = await compileVerdictWorkflow({
        workflowRef: workflowState?.workflowSlug ?? workflowState?.workflowId ?? '',
        workflowIr: {
          nodes: workflowState?.nodes ?? [],
          connections: workflowState?.connections ?? [],
        },
        domainPackKey: pack.packKey,
        domainPackVersion: pack.version,
        domainPackDigest: pack.bundleDigest,
      });
      setResult(data);
    } catch (e) {
      console.error(e);
      setResult({
        ok: false,
        issues: [
          {
            severity: 'ERROR',
            code: 'COMPILE_REQUEST_FAILED',
            message: e instanceof Error ? e.message : 'compile request failed',
          },
        ],
      });
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
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200/90 px-3 py-2.5">
        <h3 className="text-sm font-semibold text-slate-900">Compile Preview</h3>
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-slate-600">
            <input
              type="checkbox"
              checked={autoCompile}
              onChange={(e) => setAutoCompile(e.target.checked)}
              className="size-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
            />
            Auto
          </label>
          <button
            onClick={handleCompile}
            disabled={compiling || pack === null}
            title={packError ?? undefined}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {compiling ? <Loader2 size={12} className="animate-spin" /> : null}
            Compile
          </button>
        </div>
      </div>

      {packError ? (
        <div className="flex shrink-0 gap-2 border-b border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-900">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <p>{packError} Publish a Domain Pack before compiling — an unpinned plan cannot be attributed to a pack.</p>
        </div>
      ) : pack ? (
        <div className="shrink-0 border-b border-slate-200/80 bg-slate-50/80 px-3 py-1.5 font-mono text-[10px] font-medium text-slate-600">
          pinned: {pack.packKey}@{pack.version}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {!result && !compiling ? (
          <div className="flex h-full min-h-[12rem] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center">
            <p className="text-xs font-medium leading-snug text-slate-500">
              Click Compile to generate the Verdict plan.
            </p>
          </div>
        ) : null}

        {result && (
          <div className="space-y-4">
            <div className={`p-3 rounded border ${result.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 font-medium">
                {result.ok ? <CheckCircle2 className="text-green-600" size={16} /> : <XCircle className="text-red-600" size={16} />}
                <span className={result.ok ? 'text-green-800' : 'text-red-800'}>
                  {result.ok ? 'Compilation Successful' : 'Compilation Failed'}
                </span>
              </div>
              {result.compilerKind === 'STUB' ? (
                <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 flex gap-1.5">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  <span>
                    Stub compiler (`compilerKind: STUB`) — canvas error binding is deferred until the
                    real BridgeFlowCompiler is wired.
                  </span>
                </div>
              ) : null}
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
                      <div className="font-medium">
                        {issue.severity}
                        {issue.code ? <span className="ml-1 font-mono opacity-75">{issue.code}</span> : null}
                      </div>
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
